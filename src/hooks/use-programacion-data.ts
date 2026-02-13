import { useEffect, useCallback, useState, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { useCurrentUser } from "./use-current-user"
import { ProgramacionServicio } from "@/types/programacion"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Debounce helper: coalesce rapid realtime events into a single refetch
// ---------------------------------------------------------------------------
function useDebouncedCallback<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const stableFn = useRef(fn)
    stableFn.current = fn

    return useCallback((...args: unknown[]) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => stableFn.current(...args), delay)
    }, [delay]) as unknown as T
}

export function useProgramacionData() {
    const supabase = useMemo(() => createClient(), [])
    const queryClient = useQueryClient()
    const { loading: authLoading } = useCurrentUser()
    const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED">("CONNECTING")

    // Track IDs we just changed locally so realtime can skip self-echoes
    const pendingLocalIds = useRef<Set<string>>(new Set())

    // 1. Fetch Inicial (Carga los 2000 registros una vez)
    const { data: programacion = [], isLoading } = useQuery({
        queryKey: ["programacion"],
        enabled: !authLoading,
        staleTime: Infinity, // Never auto-refetch — we rely on Realtime merge
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        queryFn: async () => {
            const { data, error } = await (supabase
                .from("cuadro_control") as any)
                .select("*")
                .order("item_numero", { ascending: true })

            if (error) {
                console.error("Error fetching data:", error)
                toast.error("Error al cargar datos")
                throw error
            }
            return data as ProgramacionServicio[]
        },
    })

    // 2. Debounced refetch — coalesce bursts into 1 call
    const debouncedRefetch = useDebouncedCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["programacion"] })
    }, 1500)

    // 3. Realtime: merge remote changes into cache without full refetch
    const handleRealtimePayload = useCallback((payload: any) => {
        const rec = payload.new || payload.old || {}
        // For commercial/admin tables the row's own "id" is NOT the view key.
        // The view key is always the lab row's id = programacion_id in those tables.
        // So: prefer programacion_id when it exists (joined table), fall back to id (lab table).
        const viewId: string | undefined = rec.programacion_id || rec.id

        // Skip events caused by our own writes (already applied optimistically).
        // We stored the *lab id* (= view id) in pendingLocalIds, so check viewId.
        if (viewId && pendingLocalIds.current.has(viewId)) {
            pendingLocalIds.current.delete(viewId)
            return
        }

        const eventType = payload.eventType

        if (eventType === "DELETE") {
            queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) =>
                old.filter(r => r.id !== viewId)
            )
            return
        }

        if (eventType === "INSERT") {
            // New row by another user — debounced fetch (view needs join)
            debouncedRefetch()
            return
        }

        // UPDATE — merge changed fields into the cached row
        if (eventType === "UPDATE" && payload.new) {
            const changed = payload.new
            queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
                const found = old.some(r => r.id === viewId)
                if (!found) {
                    // Not in cache — silently ignore (avoid refetch flicker)
                    return old
                }
                return old.map(row => {
                    if (row.id !== viewId) return row
                    const merged = { ...row }
                    for (const key of Object.keys(changed)) {
                        if (key === "id" || key === "programacion_id" || key === "created_at") continue
                        ;(merged as any)[key] = changed[key]
                    }
                    return merged
                })
            })
        }
    }, [queryClient, debouncedRefetch])

    // 4. Suscripción Realtime — sin invalidateQueries directo
    useEffect(() => {
        if (authLoading) return

        const channel = supabase
            .channel("programacion_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_lab" },
                handleRealtimePayload
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_comercial" },
                handleRealtimePayload
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "programacion_administracion" },
                handleRealtimePayload
            )
            .subscribe((status) => {
                setRealtimeStatus(status)
                if (status === "CHANNEL_ERROR") {
                    toast.error("Error de conexión en tiempo real")
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, authLoading, handleRealtimePayload])

    const updateField = useCallback(async (rowId: string, field: string, value: unknown) => {
        // 1. Optimistic Update in Cache (instant UI)
        queryClient.setQueryData(["programacion"], (oldData: ProgramacionServicio[] = []) => {
            return oldData.map(row => row.id === rowId ? { ...row, [field]: value } : row)
        })

        // 2. Mark this ID so realtime skips the echo
        pendingLocalIds.current.add(rowId)

        try {
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

            const { error } = await (supabase
                .from(targetTable) as any)
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq(idField, rowId)

            if (error) throw error
        } catch (error) {
            console.error("Update failed:", error)
            toast.error("Error al guardar")
            pendingLocalIds.current.delete(rowId)
            // Rollback: refetch true state from DB
            queryClient.invalidateQueries({ queryKey: ["programacion"] })
        }
    }, [queryClient, supabase])

    const insertRow = useCallback(async (newRow: Partial<ProgramacionServicio>) => {
        const labData: any = {
            ...newRow,
            estado_trabajo: newRow.estado_trabajo || "PENDIENTE",
        }

        delete labData.item_numero
        delete labData.fecha_solicitud_com
        delete labData.fecha_entrega_com
        delete labData.evidencia_solicitud_envio
        delete labData.motivo_dias_atraso_com
        delete labData.numero_factura
        delete labData.estado_pago
        delete labData.estado_autorizar
        delete labData.nota_admin
        delete labData.dias_atraso_envio_coti

        Object.keys(labData).forEach(key => {
            if (labData[key] === undefined || labData[key] === null || labData[key] === '') {
                delete labData[key]
            }
        })

        const { data: insertedData, error: labError } = await (supabase
            .from("programacion_lab") as any)
            .insert(labData)
            .select()
            .single()

        if (labError) {
            console.error("Insert lab failed:", labError)
            toast.error("Error al crear registro base")
            throw labError
        }

        if (insertedData) {
            const rowId = (insertedData as any).id
            // Mark so realtime skips our own insert echoes
            pendingLocalIds.current.add(rowId)

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
                await (supabase.from("programacion_comercial") as any).update(commercialData).eq("programacion_id", rowId)
            }
            if (Object.keys(adminData).length > 0) {
                await (supabase.from("programacion_administracion") as any).update(adminData).eq("programacion_id", rowId)
            }

            // Single controlled refetch after full insert completes
            queryClient.invalidateQueries({ queryKey: ["programacion"] })
        }
    }, [queryClient, supabase])

    const exportToExcel = useCallback(async (items: ProgramacionServicio[], mode: 'lab' | 'comercial' | 'administracion' = 'lab') => {
        const toastId = toast.loading("Generando Excel...")
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

            // Determine endpoint based on mode
            const endpointMap = {
                'lab': '/programacion/export',
                'comercial': '/programacion/export/comercial',
                'administracion': '/programacion/export/administracion'
            }
            const endpoint = endpointMap[mode] || '/programacion/export'

            const response = await fetch(`${apiUrl}${endpoint}`, {
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

            // Filename based on mode
            const modeLabels = { 'lab': 'Lab', 'comercial': 'Comercial', 'administracion': 'Administracion' }
            a.download = `Programacion_${modeLabels[mode]}_${new Date().toISOString().split("T")[0]}.xlsx`

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
