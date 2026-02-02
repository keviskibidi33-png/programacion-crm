
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useSearchParams } from "next/navigation"

export type ViewMode = "LAB" | "COM" | "ADMIN"

export function useCurrentUser() {
    const supabase = useMemo(() => createClient(), [])
    const searchParams = useSearchParams()

    // We expect "userId" in the iframe URL
    const userIdParam = searchParams.get("userId")
    const urlRole = searchParams.get("role")
    const urlCanWrite = searchParams.get("canWrite") === "true"

    const [role, setRole] = useState<string | null>(urlRole?.toLowerCase() || null)
    const [loading, setLoading] = useState(true)
    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(urlRole ? ["LAB"] : [])
    const [permissions, setPermissions] = useState<any>(urlRole ? {
        laboratorio: { read: true, write: urlCanWrite, delete: false },
        programacion: { read: true, write: urlCanWrite, delete: false }
    } : null)

    useEffect(() => {
        async function fetchRole() {
            if (!userIdParam) {
                setLoading(false)
                return
            }

            try {
                const { data, error } = await supabase
                    .from("perfiles")
                    .select("role, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", userIdParam)
                    .single()

                if (error || !data) {
                    console.log("[Auth] Error or no data from Supabase (maybe RLS?), keeping URL fallbacks")
                    setLoading(false)
                    return
                }

                const userRole = data.role.toLowerCase()
                setRole(userRole)

                // Extract permissions from the join (handle potential array)
                const roleDef = Array.isArray((data as any).role_definitions)
                    ? (data as any).role_definitions[0]
                    : (data as any).role_definitions

                const perms = roleDef?.permissions || {}
                console.log(`[DEBUG] User profile role: ${userRole}`, { perms })
                setPermissions(perms)

                // Determine allowed views and granular write access
                const views: ViewMode[] = []

                if (perms.laboratorio?.read) views.push("LAB")
                if (perms.comercial?.read) views.push("COM")
                if (perms.administracion?.read) views.push("ADMIN")

                // Fallback for transition or admin
                if (userRole.includes("admin") && views.length === 0) {
                    views.push("LAB", "COM", "ADMIN")
                } else if (views.length === 0) {
                    // Default fallback if no permissions defined yet
                    views.push("LAB")
                }

                setAllowedViews([...new Set(views)])
                setLoading(false)
            } catch (e) {
                setLoading(false)
            }
        }

        fetchRole()
    }, [userIdParam, supabase])

    return {
        userId: userIdParam,
        role,
        loading,
        allowedViews,
        permissions,
        canView: (mode: ViewMode) => allowedViews.includes(mode),
        getCanWrite: (mode: ViewMode) => {
            if (role?.includes("admin")) return true
            if (mode === "LAB") {
                return permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }
            if (mode === "COM") return permissions?.comercial?.write || false
            if (mode === "ADMIN") return permissions?.administracion?.write || false
            return false
        }
    }
}
