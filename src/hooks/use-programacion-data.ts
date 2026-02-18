import { useEffect, useCallback, useState, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { useCurrentUser } from "./use-current-user"
import { ProgramacionServicio } from "@/types/programacion"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set that auto-expires entries after `ttl` ms. Prevents single-delete
 *  issues when Supabase fires multiple realtime events for a single write
 *  (e.g. lab INSERT ➜ auto-trigger creates commercial & admin rows). */
class ExpiringSet {
    private map = new Map<string, ReturnType<typeof setTimeout>>()
    add(id: string, ttl = 4000) {
        if (this.map.has(id)) clearTimeout(this.map.get(id)!)
        this.map.set(id, setTimeout(() => this.map.delete(id), ttl))
    }
    has(id: string) { return this.map.has(id) }
    delete(id: string) { if (this.map.has(id)) { clearTimeout(this.map.get(id)!); this.map.delete(id) } }
    clear() { this.map.forEach(t => clearTimeout(t)); this.map.clear() }
}

export function useProgramacionData() {
    const supabase = useMemo(() => createClient(), [])
    const queryClient = useQueryClient()
    const { loading: authLoading } = useCurrentUser()
    const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED">("CONNECTING")

    // IDs written locally — kept for 4 s so ALL cascade events are skipped
    const pendingLocalIds = useRef(new ExpiringSet())
    const requestTokenFromParent = useCallback(async (): Promise<string | null> => {
        if (typeof window === "undefined" || window.parent === window) {
            return null
        }

        return await new Promise((resolve) => {
            let resolved = false

            const cleanup = () => {
                window.removeEventListener("message", onMessage)
                clearTimeout(timeoutId)
            }

            const onMessage = (event: MessageEvent) => {
                if (event.data?.type === "TOKEN_REFRESH" && event.data?.token) {
                    resolved = true
                    cleanup()
                    const token = String(event.data.token)
                    localStorage.setItem("programacion_access_token", token)
                    resolve(token)
                }
            }

            const timeoutId = window.setTimeout(() => {
                if (!resolved) {
                    cleanup()
                    resolve(null)
                }
            }, 2500)

            window.addEventListener("message", onMessage)
            window.parent.postMessage({ type: "TOKEN_REFRESH_REQUEST" }, "*")
        })
    }, [])

    // 1. Fetch Inicial (Carga los 2000 registros una sola vez)
    const { data: programacion = [], isLoading } = useQuery({
        queryKey: ["programacion"],
        enabled: !authLoading,
        staleTime: Infinity,
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

    // 2. Realtime handler — NEVER calls invalidateQueries for UPDATEs
    const handleRealtimePayload = useCallback((payload: any) => {
        const rec = payload.new || payload.old || {}
        const viewId: string | undefined = rec.programacion_id || rec.id

        // Skip ALL events caused by our own writes (kept 4 s in ExpiringSet)
        if (viewId && pendingLocalIds.current.has(viewId)) {
            return // don't delete — let it expire naturally to catch cascades
        }

        const eventType = payload.eventType

        if (eventType === "DELETE") {
            queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) =>
                old.filter(r => r.id !== viewId)
            )
            return
        }

        // INSERT from another user — add to cache directly from joined-view fetch
        // of just that one row, NOT a full refetch
        if (eventType === "INSERT" && viewId) {
            // Fetch only the new row from the view
            ;(supabase.from("cuadro_control") as any)
                .select("*")
                .eq("id", viewId)
                .maybeSingle()
                .then(({ data: newRow }: any) => {
                    if (!newRow) return
                    queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
                        // Avoid duplicates
                        if (old.some(r => r.id === newRow.id)) return old
                        return [...old, newRow]
                    })
                })
            return
        }

        // UPDATE — merge changed fields in-place (zero network)
        if (eventType === "UPDATE" && payload.new) {
            const changed = payload.new
            queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
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
    }, [queryClient, supabase])

    // 3. Suscripción Realtime — ZERO invalidateQueries
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

            // Add to cache directly from view (single-row fetch, NOT full refetch)
            const { data: viewRow } = await (supabase.from("cuadro_control") as any)
                .select("*").eq("id", rowId).maybeSingle()
            if (viewRow) {
                queryClient.setQueryData(["programacion"], (old: ProgramacionServicio[] = []) => {
                    if (old.some(r => r.id === viewRow.id)) return old
                    return [...old, viewRow]
                })
            }
        }
    }, [queryClient, supabase])

    const exportToExcel = useCallback(async (items: ProgramacionServicio[], mode: 'lab' | 'comercial' | 'administracion' = 'lab') => {
        const toastId = toast.loading("Generando Excel...")
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const { data: { session } } = await supabase.auth.getSession()
            const urlToken = typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("token")
                : null
            const localToken = typeof window !== "undefined"
                ? localStorage.getItem("programacion_access_token")
                : null
            const parentToken = session?.access_token || urlToken || localToken
                ? null
                : await requestTokenFromParent()
            const accessToken = session?.access_token || urlToken || localToken || parentToken

            if (!accessToken) {
                throw new Error("Token de autenticación requerido para exportar")
            }

            if (typeof window !== "undefined" && accessToken) {
                localStorage.setItem("programacion_access_token", accessToken)
            }

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
                    "Authorization": `Bearer ${accessToken}`,
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
    }, [requestTokenFromParent, supabase])

    return {
        data: programacion,
        isLoading,
        realtimeStatus,
        updateField,
        insertRow,
        exportToExcel
    }
}
