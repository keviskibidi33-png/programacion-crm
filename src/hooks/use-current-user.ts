
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useSearchParams } from "next/navigation"

export type ViewMode = "LAB" | "COM" | "ADMIN"

// Helper to read URL params synchronously during initialization
function getUrlParam(param: string) {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get(param)
}

export function useCurrentUser() {
    const supabase = useMemo(() => createClient(), [])
    const searchParams = useSearchParams()

    // 1. Lectura inmediata de URL (Fuente de Verdad en Iframe)
    const urlUserId = getUrlParam("userId")
    const urlRole = getUrlParam("role")?.toLowerCase() || null
    const urlCanWrite = getUrlParam("canWrite") === "true"
    const urlIsAdmin = getUrlParam("isAdmin") === "true"

    const [role, setRole] = useState<string | null>(urlRole)
    const [loading, setLoading] = useState(!urlRole)
    const [userId, setUserId] = useState<string | null>(urlUserId)
    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(() => {
        if (!urlRole) return []
        const views: ViewMode[] = ["LAB"]
        if (urlIsAdmin || urlRole.includes("admin") || urlRole.includes("gerencia") || urlRole.includes("administra")) {
            views.push("COM", "ADMIN")
        }
        return views
    })
    const [permissions, setPermissions] = useState<any>(() => {
        if (!urlRole) return null
        return {
            laboratorio: { read: true, write: urlCanWrite, delete: false },
            programacion: { read: true, write: urlCanWrite, delete: false },
            comercial: { read: true, write: urlCanWrite, delete: false },
            administracion: { read: true, write: urlCanWrite, delete: false }
        }
    })

    useEffect(() => {
        if (urlRole) {
            setRole(urlRole)
            const views: ViewMode[] = ["LAB"]
            if (urlIsAdmin || urlRole.includes("admin") || urlRole.includes("gerencia") || urlRole.includes("administra")) {
                views.push("COM", "ADMIN")
            }
            setAllowedViews(views)
            setLoading(false)
        }

        async function fetchRoleDetails() {
            const currentUserId = searchParams.get("userId") || urlUserId
            if (!currentUserId || !urlRole) {
                setLoading(false)
                return
            }

            try {
                const { data } = await supabase
                    .from("perfiles")
                    .select("role, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", currentUserId)
                    .single()

                if (data) {
                    const roleDef = Array.isArray((data as any).role_definitions)
                        ? (data as any).role_definitions[0]
                        : (data as any).role_definitions

                    const dbPerms = roleDef?.permissions
                    if (dbPerms && Object.keys(dbPerms).length > 0) {
                        setPermissions(dbPerms)

                        const views: ViewMode[] = []
                        if (dbPerms.laboratorio?.read) views.push("LAB")
                        if (dbPerms.comercial?.read) views.push("COM")
                        if (dbPerms.administracion?.read) views.push("ADMIN")

                        if (urlIsAdmin || data.role.toLowerCase().includes("admin")) {
                            setAllowedViews(["LAB", "COM", "ADMIN"])
                        } else if (views.length > 0) {
                            setAllowedViews([...new Set(views)])
                        }
                    }
                }
            } catch (e) {
                console.log("[Auth] Error fetching real perms, using URL defaults")
            } finally {
                setLoading(false)
            }
        }

        fetchRoleDetails()
    }, [searchParams, supabase, urlRole, urlIsAdmin, urlUserId])

    return {
        userId,
        role,
        loading,
        allowedViews,
        permissions,
        canView: (mode: ViewMode) => allowedViews.includes(mode),
        getCanWrite: (mode: ViewMode) => {
            if (!role) return false
            if (urlIsAdmin || role.includes("admin") || role.includes("gerencia")) return true

            // If the URL explicitly says we can write, we trust it
            if (urlCanWrite) return true

            if (mode === "LAB") {
                return permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }
            if (mode === "COM") return permissions?.comercial?.write || false
            if (mode === "ADMIN") return permissions?.administracion?.write || false
            return false
        }
    }
}
