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
    const { data: programacion = [], isLoading, error } = useQuery({
        queryKey: ["programacion"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("cuadro_control")
                .select("*")
                .order("item_numero", { ascending: false })

            if (error) {
                console.error("Error fetching data:", error)
                toast.error("Error al cargar datos")
                throw error
            }
            return data as ProgramacionServicio[]
        },
    })

    // 2. Suscripción Realtime (La magia para no dar F5)
    useEffect(() => {
        const channel = supabase
            .channel("cuadro_control_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_lab" },
                (payload) => {
                    console.log("Realtime (lab) event:", payload)
                    queryClient.invalidateQueries({ queryKey: ["programacion"] })
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_comercial" },
                (payload) => {
                    console.log("Realtime (com) event:", payload)
                    queryClient.invalidateQueries({ queryKey: ["programacion"] })
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_administracion" },
                (payload) => {
                    console.log("Realtime (admin) event:", payload)
                    queryClient.invalidateQueries({ queryKey: ["programacion"] })
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
            // Route update to the correct table
            const commercialFields = ['fecha_solicitud_com', 'fecha_entrega_com', 'evidencia_solicitud_envio', 'dias_atraso_envio_coti', 'motivo_dias_atraso_com']
            const adminFields = ['numero_factura', 'estado_pago', 'estado_autorizar', 'nota_admin']

            let targetTable = "programacion_lab"
            let idField = "id"

            if (commercialFields.includes(field)) {
                targetTable = "programacion_comercial"
                idField = "programacion_id"
            } else if (adminFields.includes(field)) {
                targetTable = "programacion_administracion"
                idField = "programacion_id"
            }

            const { error } = await supabase
                .from(targetTable)
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq(idField, rowId)

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
        const { data: insertedData, error: labError } = await supabase
            .from("programacion_lab")
            .insert({
                ...newRow,
                item_numero: undefined,
                created_at: new Date().toISOString(),
                estado_trabajo: newRow.estado_trabajo || "PENDIENTE",
                // Extension fields must be removed for the base table insert
                fecha_solicitud_com: undefined,
                fecha_entrega_com: undefined,
                evidencia_solicitud_envio: undefined,
                motivo_dias_atraso_com: undefined,
                numero_factura: undefined,
                estado_pago: undefined,
                estado_autorizar: undefined,
                nota_admin: undefined,
            })
            .select()
            .single()

        if (labError) {
            console.error("Insert lab failed:", labError)
            toast.error("Error al crear registro base")
            throw labError
        }

        if (insertedData) {
            const rowId = insertedData.id

            // Check if we need to update extension tables
            const commercialData: any = {}
            if (newRow.fecha_solicitud_com) commercialData.fecha_solicitud_com = newRow.fecha_solicitud_com
            if (newRow.fecha_entrega_com) commercialData.fecha_entrega_com = newRow.fecha_entrega_com
            if (newRow.evidencia_solicitud_envio) commercialData.evidencia_solicitud_envio = newRow.evidencia_solicitud_envio
            if (newRow.motivo_dias_atraso_com) commercialData.motivo_dias_atraso_com = newRow.motivo_dias_atraso_com

            const adminData: any = {}
            if (newRow.numero_factura) adminData.numero_factura = newRow.numero_factura
            if (newRow.estado_pago) adminData.estado_pago = newRow.estado_pago
            if (newRow.estado_autorizar) adminData.estado_autorizar = newRow.estado_autorizar
            if (newRow.nota_admin) adminData.nota_admin = newRow.nota_admin

            if (Object.keys(commercialData).length > 0) {
                await supabase.from("programacion_comercial").update(commercialData).eq("programacion_id", rowId)
            }
            if (Object.keys(adminData).length > 0) {
                await supabase.from("programacion_administracion").update(adminData).eq("programacion_id", rowId)
            }

            // The views will reload via realtime or cache invalidation
            queryClient.invalidateQueries({ queryKey: ["programacion"] })
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
        data: programacion,
        isLoading,
        realtimeStatus,
        updateField,
        insertRow,
        exportToExcel
    }
}
