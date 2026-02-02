
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
        // Optimistic Initialization: Start with LABORATORY + whatever the URL explicitly asks for
        const views: ViewMode[] = ["LAB"]
        const qMode = searchParams.get("mode")?.toUpperCase()
        if (qMode === "COMERCIAL" || qMode === "COM") views.push("COM")
        if (qMode === "ADMIN") views.push("ADMIN")

        // Role-based heuristics for initial state (Inclusive matching)
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const isHighLevel = qIsAdmin || rNorm.includes("admin") || rNorm.includes("geren") || rNorm.includes("administra") || rNorm.includes("direc") || rNorm.includes("jefe")

        if (isHighLevel) {
            if (!views.includes("COM")) views.push("COM")
            if (!views.includes("ADMIN")) views.push("ADMIN")
        }

        // Remove duplicates and return
        return Array.from(new Set(views)) as ViewMode[]
    })

    const [permissions, setPermissions] = useState<any>(() => {
        // Initial permissions based on URL flags until DB load completes
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const isHighLevel = qIsAdmin || rNorm.includes("admin") || rNorm.includes("geren") || rNorm.includes("administra") || rNorm.includes("direc") || rNorm.includes("jefe")
        const dynamicCanWrite = qCanWrite || isHighLevel

        return {
            laboratorio: { read: true, write: dynamicCanWrite, delete: false },
            programacion: { read: true, write: dynamicCanWrite, delete: false },
            comercial: { read: true, write: dynamicCanWrite, delete: false },
            administracion: { read: true, write: dynamicCanWrite, delete: false }
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

            // 3. Optimized view calculation based on URL Role/Admin flags & requested mode
            const views: ViewMode[] = ["LAB"]
            const qMode = searchParams.get("mode")?.toUpperCase()
            if (qMode === "COMERCIAL" || qMode === "COM") views.push("COM")
            if (qMode === "ADMIN") views.push("ADMIN")

            const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const isHighLevel = qIsAdmin || rNorm.includes("admin") || rNorm.includes("geren") || rNorm.includes("administra") || rNorm.includes("direc") || rNorm.includes("jefe")
            if (isHighLevel) {
                if (!views.includes("COM")) views.push("COM")
                if (!views.includes("ADMIN")) views.push("ADMIN")
            }
            setAllowedViews(Array.from(new Set(views)) as ViewMode[])

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

                        const dbViews: ViewMode[] = []
                        if (dbPerms.laboratorio?.read) dbViews.push("LAB")
                        if (dbPerms.comercial?.read) dbViews.push("COM")
                        if (dbPerms.administracion?.read) dbViews.push("ADMIN")

                        // High-level overrides (Recursive fallback)
                        const dbRoleNorm = (dbRole || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        const isHighLevelDb = qIsAdmin || dbRoleNorm.includes("admin") || dbRoleNorm.includes("geren") || dbRoleNorm.includes("administra") || dbRoleNorm.includes("direc") || dbRoleNorm.includes("jefe")

                        if (isHighLevelDb) {
                            setAllowedViews(["LAB", "COM", "ADMIN"])
                        } else if (dbViews.length > 0) {
                            setAllowedViews([...new Set(dbViews)])
                        }
                    }
                }
            } catch (e) {
                console.log("[Auth] Fallback - Iframe running with URL context")
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
            // Priority 1: Instant URL Overrides (for smooth Iframe experience)
            if (qIsAdmin) return true
            if (qCanWrite) return true

            // Priority 2: Role-based Bypass (for Management)
            const rNorm = (role || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            if (rNorm.includes("admin") || rNorm.includes("geren") || rNorm.includes("administra") || rNorm.includes("direc") || rNorm.includes("jefe")) return true

            // Priority 3: Granular Matrix Permissions (The "Security Guard")
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
