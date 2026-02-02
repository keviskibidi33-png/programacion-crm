
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
    const [needsAuth, setNeedsAuth] = useState(false)

    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(() => {
        // Role-based mapping for known roles (before DB load)
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

        // Map role_ids to their expected views (based on database permissions)
        const roleViewMap: Record<string, ViewMode[]> = {
            'admin': ['LAB', 'COM', 'ADMIN'],           // Superadmin: all views
            'administrativo': ['ADMIN'],                 // Administrativo: only admin view
            'vendor': ['COM'],                           // Vendor: only commercial view
            'laboratorio_lector': ['LAB'],               // Lab reader: only lab view
            'laboratorio_tipificador': ['LAB']           // Lab tipificador: only lab view
        }

        // Use exact match first, then fall back to heuristics
        if (roleViewMap[rNorm]) {
            return roleViewMap[rNorm]
        }

        // Heuristic fallback for unknown roles
        if (rNorm === 'admin' || qIsAdmin) return ['LAB', 'COM', 'ADMIN']
        if (rNorm.includes('comercial') || rNorm.includes('vendor') || rNorm.includes('vendedor')) return ['COM']
        if (rNorm.includes('laboratorio')) return ['LAB']

        // Default: wait for DB permissions (show only the requested mode)
        const qMode = searchParams.get("mode")?.toUpperCase()
        if (qMode === "COMERCIAL" || qMode === "COM") return ['COM']
        if (qMode === "ADMIN") return ['ADMIN']
        return ['LAB']  // Ultimate fallback
    })

    const [permissions, setPermissions] = useState<any>(() => {
        // Initial permissions: minimal until DB load completes
        // We only grant write if qCanWrite or qIsAdmin are explicitly true
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const isSuperAdmin = rNorm === 'admin' || qIsAdmin
        const dynamicCanWrite = qCanWrite || isSuperAdmin

        return {
            laboratorio: { read: isSuperAdmin || rNorm.includes('laboratorio'), write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('laboratorio')), delete: false },
            programacion: { read: isSuperAdmin || rNorm.includes('laboratorio'), write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('laboratorio')), delete: false },
            comercial: { read: isSuperAdmin || rNorm.includes('comercial') || rNorm.includes('vendor') || rNorm.includes('vendedor'), write: dynamicCanWrite, delete: false },
            administracion: { read: isSuperAdmin || rNorm === 'administrativo', write: dynamicCanWrite, delete: false }
        }
    })

    useEffect(() => {
        async function fetchIdentityAndPerms() {
            setLoading(true)

            // 1. Get User ID (either from URL or Supabase Session)
            let currentUid = qUserId
            let sourceOfTruthIsUrl = !!qUserId

            if (!currentUid) {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    currentUid = session.user.id
                    setUserId(currentUid)
                } else {
                    // NO USER DETECTED AT ALL
                    setNeedsAuth(true)
                    setLoading(false)
                    return
                }
            } else {
                setUserId(currentUid)
                setNeedsAuth(false)
            }

            // 2. Sync basic identity state
            if (qRole) setRole(qRole)

            // 3. NO initial view calculation - wait for DB permissions
            // (Initial views are set by useState based on role heuristics)


            // 4. Fetch Profile & Permissions Matrix
            try {
                const { data: profile } = await supabase
                    .from("perfiles")
                    .select("role, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", currentUid)
                    .single()

                if (profile) {
                    const dbRole = profile.role?.toLowerCase()
                    if (!sourceOfTruthIsUrl) setRole(dbRole)

                    const roleDef = Array.isArray((profile as any).role_definitions)
                        ? (profile as any).role_definitions[0]
                        : (profile as any).role_definitions

                    const dbPerms = roleDef?.permissions
                    if (dbPerms && Object.keys(dbPerms).length > 0) {
                        setPermissions(dbPerms)

                        // Build allowed views strictly from database permissions
                        const dbViews: ViewMode[] = []
                        if (dbPerms.laboratorio?.read || dbPerms.programacion?.read) dbViews.push("LAB")
                        if (dbPerms.comercial?.read) dbViews.push("COM")
                        if (dbPerms.administracion?.read) dbViews.push("ADMIN")

                        // Special case: Only 'admin' (superadmin) gets all views unconditionally
                        const dbRoleNorm = (dbRole || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        const isSuperAdmin = dbRoleNorm === "admin" // Only exact 'admin' role

                        if (isSuperAdmin) {
                            setAllowedViews(["LAB", "COM", "ADMIN"])
                        } else if (dbViews.length > 0) {
                            setAllowedViews([...new Set(dbViews)])
                        }
                    }

                }
            } catch (e) {
                // Fallback - Iframe running with URL context
            } finally {
                setLoading(false)
            }
        }

        fetchIdentityAndPerms()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlKey, supabase])

    return {
        userId,
        role,
        loading,
        needsAuth,
        allowedViews,
        permissions,
        getCanView: (mode: ViewMode) => allowedViews.includes(mode),
        getCanWrite: (mode: ViewMode) => {
            // Priority 1: URL explicit flags (for smooth Iframe experience)
            if (qIsAdmin) return true
            if (qCanWrite) return true

            // Priority 2: Superadmin bypass (only exact 'admin' role)
            const rNorm = (role || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            if (rNorm === 'admin') return true

            // Priority 3: Granular Matrix Permissions from Database
            if (mode === "LAB") {
                return permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }
            if (mode === "COM") {
                return permissions?.comercial?.write || false
            }
            if (mode === "ADMIN") {
                return permissions?.administracion?.write || false
            }
            return false
        }

    }
}
