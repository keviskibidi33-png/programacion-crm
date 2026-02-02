
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useSearchParams } from "next/navigation"

export type ViewMode = "LAB" | "COM" | "ADMIN"

export function useCurrentUser() {
    const supabase = useMemo(() => createClient(), [])
    const searchParams = useSearchParams()

    // Stable key for URL changes to keep dependency array safe
    const urlKey = searchParams.toString()

    // Derived values from URL (Reactive because they depend on searchParams)
    const qUserId = searchParams.get("userId")
    const qRole = searchParams.get("role")?.toLowerCase() || null
    const qCanWrite = searchParams.get("canWrite") === "true"
    const qIsAdmin = searchParams.get("isAdmin") === "true"

    const [role, setRole] = useState<string | null>(qRole)
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(qUserId)

    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(() => {
        const views: ViewMode[] = ["LAB"]
        if (qIsAdmin || (qRole && (qRole.includes("admin") || qRole.includes("gerencia") || qRole.includes("administra")))) {
            views.push("COM", "ADMIN")
        }
        return views
    })

    const [permissions, setPermissions] = useState<any>(() => {
        if (!qRole) return null
        return {
            laboratorio: { read: true, write: qCanWrite, delete: false },
            programacion: { read: true, write: qCanWrite, delete: false },
            comercial: { read: true, write: qCanWrite, delete: false },
            administracion: { read: true, write: qCanWrite, delete: false }
        }
    })

    useEffect(() => {
        // 1. Sync identity state with reactive URL params
        if (qRole) setRole(qRole)
        if (qUserId) setUserId(qUserId)

        // 2. Initial view calculation based on URL Role/Admin flags
        const views: ViewMode[] = ["LAB"]
        if (qIsAdmin || (qRole && (qRole.includes("admin") || qRole.includes("gerencia") || qRole.includes("administra")))) {
            views.push("COM", "ADMIN")
        }
        setAllowedViews(views)

        // 3. Deep Permissions Fetch from Supabase
        async function fetchRoleDetails() {
            if (!qUserId || !qRole) {
                setLoading(false)
                return
            }

            try {
                const { data } = await supabase
                    .from("perfiles")
                    .select("role, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", qUserId)
                    .single()

                if (data) {
                    const roleDef = Array.isArray((data as any).role_definitions)
                        ? (data as any).role_definitions[0]
                        : (data as any).role_definitions

                    const dbPerms = roleDef?.permissions
                    if (dbPerms && Object.keys(dbPerms).length > 0) {
                        setPermissions(dbPerms)

                        const dbViews: ViewMode[] = []
                        if (dbPerms.laboratorio?.read) dbViews.push("LAB")
                        if (dbPerms.comercial?.read) dbViews.push("COM")
                        if (dbPerms.administracion?.read) dbViews.push("ADMIN")

                        // Admin override for views
                        if (qIsAdmin || data.role.toLowerCase().includes("admin") || data.role.toLowerCase().includes("gerencia")) {
                            setAllowedViews(["LAB", "COM", "ADMIN"])
                        } else if (dbViews.length > 0) {
                            setAllowedViews([...new Set(dbViews)])
                        }
                    }
                }
            } catch (e) {
                console.log("[Auth] Fallback to URL-based permissions")
            } finally {
                setLoading(false)
            }
        }

        fetchRoleDetails()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlKey, supabase]) // STABLE SIZE: Only 2 dependencies. Fixes "changed size between renders" issues.

    return {
        userId,
        role,
        loading,
        allowedViews,
        permissions,
        canView: (mode: ViewMode) => allowedViews.includes(mode),
        getCanWrite: (mode: ViewMode) => {
            // Priority 1: Instant URL Overrides (Fast Path for Iframe)
            if (qIsAdmin || (qRole && (qRole.includes("admin") || qRole.includes("gerencia")))) return true
            if (qCanWrite) return true

            // Priority 2: Reactive Role state
            if (!role) return false
            if (role.toLowerCase().includes("admin") || role.toLowerCase().includes("gerencia")) return true

            // Priority 3: Granular Database Permissions
            if (mode === "LAB") {
                return permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }
            if (mode === "COM") return permissions?.comercial?.write || false
            if (mode === "ADMIN") return permissions?.administracion?.write || false
            return false
        }
    }
}
