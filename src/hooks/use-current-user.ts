
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useSearchParams } from "next/navigation"

export type ViewMode = "LAB" | "COM" | "ADMIN"

export function useCurrentUser() {
    const supabase = useMemo(() => createClient(), [])
    const searchParams = useSearchParams()

    const [role, setRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [allowedViews, setAllowedViews] = useState<ViewMode[]>([])
    const [permissions, setPermissions] = useState<any>(null)
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const userIdParam = searchParams.get("userId")
        const urlRole = searchParams.get("role")?.toLowerCase()
        const urlCanWrite = searchParams.get("canWrite") === "true"

        setUserId(userIdParam)

        // 1. Inmediatamente aplicar valores de URL como fallback (evita el badge de Solo Lectura si Supabase falla)
        if (urlRole) {
            setRole(urlRole)
            const initialViews: ViewMode[] = ["LAB"]
            if (urlRole.includes("admin") || urlRole.includes("gerencia")) {
                initialViews.push("COM", "ADMIN")
            }
            setAllowedViews(initialViews)
            setPermissions({
                laboratorio: { read: true, write: urlCanWrite, delete: false },
                programacion: { read: true, write: urlCanWrite, delete: false },
                comercial: { read: true, write: urlCanWrite, delete: false },
                administracion: { read: true, write: urlCanWrite, delete: false }
            })
        }

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
                    console.log("[Auth] Falló Supabase (posiblemente RLS), usando datos de URL")
                    setLoading(false)
                    return
                }

                const userRole = data.role.toLowerCase()
                setRole(userRole)

                const roleDef = Array.isArray((data as any).role_definitions)
                    ? (data as any).role_definitions[0]
                    : (data as any).role_definitions

                const perms = roleDef?.permissions || {}
                setPermissions(perms)

                const views: ViewMode[] = []
                if (perms.laboratorio?.read) views.push("LAB")
                if (perms.comercial?.read) views.push("COM")
                if (perms.administracion?.read) views.push("ADMIN")

                if (userRole.includes("admin") || userRole.includes("gerencia")) {
                    setAllowedViews(["LAB", "COM", "ADMIN"])
                } else {
                    if (views.length === 0) views.push("LAB")
                    setAllowedViews([...new Set(views)])
                }

                setLoading(false)
            } catch (e) {
                setLoading(false)
            }
        }

        fetchRole()
    }, [searchParams, supabase])

    return {
        userId,
        role,
        loading,
        allowedViews,
        permissions,
        canView: (mode: ViewMode) => allowedViews.includes(mode),
        getCanWrite: (mode: ViewMode) => {
            if (!role) return false
            if (role.toLowerCase().includes("admin") || role.toLowerCase().includes("gerencia")) return true

            if (mode === "LAB") {
                return permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }
            if (mode === "COM") return permissions?.comercial?.write || false
            if (mode === "ADMIN") return permissions?.administracion?.write || false
            return false
        }
    }
}
