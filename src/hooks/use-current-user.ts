
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
    const passedToken = searchParams.get("token")

    const [role, setRole] = useState<string | null>(qRole)
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(qUserId)
    const [needsAuth, setNeedsAuth] = useState(false)
    const [tokenApplied, setTokenApplied] = useState(false)

    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(() => {
        // Role-based mapping for known roles (before DB load)
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

        // Map role_ids to their expected views
        const roleViewMap: Record<string, ViewMode[]> = {
            'admin': ['LAB', 'COM', 'ADMIN'],
            'administrativo': ['LAB', 'ADMIN'],
            'vendor': ['LAB', 'COM'],
            'vendedor': ['LAB', 'COM'],
            'comercial': ['LAB', 'COM'],
            'laboratorio_lector': ['LAB'],
            'laboratorio_tipificador': ['LAB']
        }

        // Use exact match first
        if (roleViewMap[rNorm]) {
            return roleViewMap[rNorm]
        }

        // Heuristic fallback for unknown roles
        if (rNorm === 'admin' || qIsAdmin) return ['LAB', 'COM', 'ADMIN']
        if (rNorm.includes('comercial') || rNorm.includes('vendor') || rNorm.includes('vendedor') || rNorm.includes('asesor')) return ['LAB', 'COM']
        if (rNorm.includes('administrativo')) return ['LAB', 'ADMIN']
        if (rNorm.includes('laboratorio')) return ['LAB']

        // Default: wait for DB permissions (show only the requested mode)
        const qMode = searchParams.get("mode")?.toUpperCase()
        if (qMode === "COMERCIAL" || qMode === "COM") return ['COM']
        if (qMode === "ADMIN") return ['ADMIN']
        return ['LAB']  // Ultimate fallback
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [permissions, setPermissions] = useState<any>(() => {
        // Initial permissions: minimal until DB load completes
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const isSuperAdmin = rNorm === 'admin' || qIsAdmin
        const dynamicCanWrite = qCanWrite || isSuperAdmin

        return {
            laboratorio: {
                read: true, // Everyone with access to Programacion can read Lab (at least read-only)
                write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('laboratorio')),
                delete: false
            },
            programacion: {
                read: true,
                write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('laboratorio')),
                delete: false
            },
            comercial: {
                read: isSuperAdmin || rNorm.includes('comercial') || rNorm.includes('vendor') || rNorm.includes('vendedor') || rNorm.includes('asesor'),
                write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('comercial') || rNorm.includes('vendor') || rNorm.includes('vendedor') || rNorm.includes('asesor')),
                delete: false
            },
            administracion: {
                read: isSuperAdmin || rNorm.includes('administrativo'),
                write: dynamicCanWrite && (isSuperAdmin || rNorm.includes('administrativo')),
                delete: false
            }
        }
    })

    useEffect(() => {
        async function fetchIdentityAndPerms() {
            setLoading(true)

            // 0. Session Auth Bridge (for RLS)
            if (passedToken && !tokenApplied) {
                console.log("[useCurrentUser] Setting session token from parent URL...")
                try {
                    await supabase.auth.setSession({
                        access_token: passedToken,
                        refresh_token: ""
                    })
                    setTokenApplied(true)
                } catch (e) {
                    console.error("[useCurrentUser] Error setting bridged session:", e)
                }
            }

            // 1. Get User ID (either from URL or Supabase Session)
            let currentUid = qUserId
            const sourceOfTruthIsUrl = !!qUserId

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


            // 4. Fetch Profile & Permissions Matrix
            try {
                const { data: profile, error: profileError } = await supabase
                    .from("perfiles")
                    .select("role, role_definitions!fk_perfiles_role(permissions)")
                    .eq("id", currentUid)
                    .single()

                if (profileError) {
                    setLoading(false)
                    return
                }

                if (profile) {
                    const dbRole = (profile as any).role?.toLowerCase()
                    if (!sourceOfTruthIsUrl) setRole(dbRole)

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const roleDef = Array.isArray((profile as any).role_definitions)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ? (profile as any).role_definitions[0]
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        : (profile as any).role_definitions

                    const dbPerms = roleDef?.permissions
                    if (dbPerms && Object.keys(dbPerms).length > 0) {
                        setPermissions(dbPerms)

                        // Build allowed views strictly from database permissions
                        const dbViews: ViewMode[] = []
                        if (dbPerms.laboratorio?.read || dbPerms.programacion?.read) dbViews.push("LAB")
                        if (dbPerms.comercial?.read) dbViews.push("COM")
                        if (dbPerms.administracion?.read) dbViews.push("ADMIN")

                        // Special case: Ensure Administrativo and Vendor always have LAB access
                        const dbRoleNorm = (dbRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        const isVendor = dbRoleNorm.includes('vendedor') || dbRoleNorm.includes('comercial') || dbRoleNorm.includes('vendor') || dbRoleNorm.includes('asesor')
                        const isAdminRole = dbRoleNorm.includes('administrativo')

                        if (isVendor) {
                            dbViews.push("LAB")
                            dbViews.push("COM")
                        }
                        if (isAdminRole) {
                            dbViews.push("LAB")
                            dbViews.push("ADMIN")
                        }

                        // Special case: Only 'admin' (superadmin) gets all views unconditionally
                        const isSuperAdmin = dbRoleNorm === "admin"

                        if (isSuperAdmin) {
                            setAllowedViews(["LAB", "COM", "ADMIN"])
                        } else {
                            setAllowedViews([...new Set(dbViews)] as ViewMode[])
                        }
                    }

                }
            } catch (_) {
                // Fallback
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
            const rNorm = (role || qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const isSuperAdmin = rNorm === 'admin' || qIsAdmin

            // Priority 1: Superadmin always has access
            if (isSuperAdmin) return true

            // Logic shared with EditableCell: block write if viewing LAB as non-lab staff
            if (mode === "LAB") {
                const isLabStaff = rNorm.includes('laboratorio')
                if (!isLabStaff) return false
                return qCanWrite || permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }

            // Priority 3: Default behavior for other views
            if (qCanWrite) return true

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
