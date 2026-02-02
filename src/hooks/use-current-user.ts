
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

    // Síncronos - Disponibles desde el primer render
    const initialUserId = getUrlParam("userId")
    const initialRole = getUrlParam("role")?.toLowerCase() || null
    const initialCanWrite = getUrlParam("canWrite") === "true"

    const [role, setRole] = useState<string | null>(initialRole)
    const [loading, setLoading] = useState(!initialRole) // Si no hay rol en URL, esperamos a Supabase
    const [userId, setUserId] = useState<string | null>(initialUserId)
    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(() => {
        if (!initialRole) return []
        const views: ViewMode[] = ["LAB"]
        if (initialRole.includes("admin") || initialRole.includes("gerencia") || initialRole.includes("administra")) {
            views.push("COM", "ADMIN")
        }
        return views
    })
    const [permissions, setPermissions] = useState<any>(() => {
        if (!initialRole) return null
        return {
            laboratorio: { read: true, write: initialCanWrite, delete: false },
            programacion: { read: true, write: initialCanWrite, delete: false },
            comercial: { read: true, write: initialCanWrite, delete: false },
            administracion: { read: true, write: initialCanWrite, delete: false }
        }
    })

    useEffect(() => {
        // Actualizar estados si cambian los params (aunque suelen ser estables en el iframe)
        const currentUserId = searchParams.get("userId")
        const currentRole = searchParams.get("role")?.toLowerCase()
        const currentCanWrite = searchParams.get("canWrite") === "true"

        if (currentUserId && currentUserId !== userId) setUserId(currentUserId)

        async function fetchRole() {
            const uid = currentUserId || initialUserId
            if (!uid) {
                setLoading(false)
                return
            }

            try {
                const { data, error } = await supabase
                    .from("perfiles")
                    .select("role, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", uid)
                    .single()

                if (error || !data) {
                    console.log("[Auth] Falló carga Supabase (RLS?), manteniendo datos de URL")
                    setLoading(false)
                    return
                }

                const userRole = data.role.toLowerCase()
                setRole(userRole)

                const roleDef = Array.isArray((data as any).role_definitions)
                    ? (data as any).role_definitions[0]
                    : (data as any).role_definitions

                const perms = roleDef?.permissions
                if (perms && Object.keys(perms).length > 0) {
                    setPermissions(perms)

                    const views: ViewMode[] = []
                    if (perms.laboratorio?.read) views.push("LAB")
                    if (perms.comercial?.read) views.push("COM")
                    if (perms.administracion?.read) views.push("ADMIN")

                    if (userRole.includes("admin") || userRole.includes("gerencia") || userRole.includes("administra")) {
                        setAllowedViews(["LAB", "COM", "ADMIN"])
                    } else {
                        if (views.length === 0) views.push("LAB")
                        setAllowedViews([...new Set(views)])
                    }
                } else {
                    console.log("[Auth] role_definitions vacíos o bloqueados por RLS, manteniendo fallbacks")
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
            // Super Admin / Gerencia / Administración siempre tienen permiso total si el rol lo indica
            const isPowerUser = role.includes("admin") || role.includes("gerencia") || role.includes("administra")
            if (isPowerUser) return true

            if (mode === "LAB") {
                return permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }
            if (mode === "COM") return permissions?.comercial?.write || false
            if (mode === "ADMIN") return permissions?.administracion?.write || false
            return false
        }
    }
}
