import { useEffect, useCallback, useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { ProgramacionServicio } from "@/types/programacion"
import { toast } from "sonner"

export function useProgramacionData() {
    const supabase = useMemo(() => createClient(), [])
    const queryClient = useQueryClient()
    const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED">("CONNECTING")

    // 1. Fetch Inicial (Carga los 2000 registros una vez)
    const { data = [], isLoading } = useQuery({
        queryKey: ["programacion"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("programacion_servicios")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(2000)

            if (error) {
                console.error("Error fetching data:", error)
                toast.error("Error al cargar datos")
                throw error
            }
            return data as ProgramacionServicio[]
        },
        staleTime: Infinity, // Important: Don't auto-refetch, rely on Realtime
    })

    // 2. Suscripción Realtime (La magia para no dar F5)
    useEffect(() => {
        const channel = supabase
            .channel("programacion-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",               // Escuchar INSERT, UPDATE y DELETE
                    schema: "public",
                    table: "programacion_servicios",
                },
                (payload) => {
                    // Cuando llega un cambio, actualizamos la lista en memoria manualmente

                    if (payload.eventType === "INSERT") {
                        const newRow = payload.new as ProgramacionServicio
                        queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
                            // Deduplication: Avoid adding if it's already there (e.g. from optimistic insert)
                            if (oldData.some(r => r.id === newRow.id)) return oldData
                            return [newRow, ...oldData]
                        })
                    }

                    else if (payload.eventType === "UPDATE") {
                        const updatedRow = payload.new as ProgramacionServicio
                        queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
                            return oldData.map((item) =>
                                item.id === updatedRow.id ? updatedRow : item
                            )
                        })
                    }

                    else if (payload.eventType === "DELETE") {
                        queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
                            return oldData.filter((item) => item.id !== payload.old.id)
                        })
                    }
                }
            )
            .subscribe((status) => {
                setRealtimeStatus(status)
                if (status === "CHANNEL_ERROR") {
                    toast.error("Error de conexión en tiempo real")
                }
            })

        // Limpieza al salir de la página
        return () => {
            supabase.removeChannel(channel)
        }
    }, [queryClient, supabase])

    const updateField = useCallback(async (rowId: string, field: string, value: unknown) => {
        // 1. Optimistic Update in Cache
        queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
            return oldData.map(row => row.id === rowId ? { ...row, [field]: value } : row)
        })

        try {
            const { error } = await supabase
                .from("programacion_servicios")
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq("id", rowId)

            if (error) throw error
        } catch (error) {
            console.error("Update failed:", error)
            toast.error("Error al guardar")
            // Rollback could be implemented by refetching or saving previous state, 
            // but for simple text edits, just invalidating usually works enough or letting user retry
            queryClient.invalidateQueries({ queryKey: ["programacion"] })
        }
    }, [queryClient, supabase])

    const insertRow = useCallback(async (newRow: Partial<ProgramacionServicio>) => {
        // Optimistic update difficult without ID, so we wait for DB response
        // BUT, since we want "instant" feedback, we can optimistically add if we generate a temp ID?
        // Better: Wait for the INSERT response (which is very fast usually) and manually update cache THEN, 
        // essentially "beating" the realtime subscription to it.

        const { data: insertedData, error } = await supabase
            .from("programacion_servicios")
            .insert({
                ...newRow,
                item_numero: undefined,
                created_at: new Date().toISOString(),
                estado_trabajo: newRow.estado_trabajo || "PENDIENTE",
                evidencia_envio_recepcion: newRow.evidencia_envio_recepcion,
                envio_informes: newRow.envio_informes,
            })
            .select()
            .single()

        if (insertedData) {
            const row = insertedData as ProgramacionServicio
            // Immediate manual cache update
            queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
                if (oldData.some(r => r.id === row.id)) return oldData
                return [row, ...oldData]
            })
        }

        if (error) {
            console.error("Insert failed details:", JSON.stringify(error, null, 2))
            toast.error("Error al crear registro")
            throw error
        }
    }, [queryClient, supabase])

    const exportToExcel = useCallback(async (items: ProgramacionServicio[]) => {
        const toastId = toast.loading("Generando Excel...")
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
            const response = await fetch(`${apiUrl}/programacion/export`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ items }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(errorText || "Error al exportar")
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `Programacion_${new Date().toISOString().split("T")[0]}.xlsx`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast.success("Excel descargado correctamente", { id: toastId })
        } catch (error) {
            console.error("Export error:", error)
            toast.error("Error al generar Excel", { id: toastId })
        }
    }, [])

    return {
        data,
        isLoading,
        realtimeStatus,
        updateField,
        insertRow,
        exportToExcel
    }
}
