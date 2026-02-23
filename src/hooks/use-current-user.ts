
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
    const requestedModeParam = (searchParams.get("mode") || "").toLowerCase()
    const requestedMode: ViewMode =
        requestedModeParam === "comercial" || requestedModeParam === "com"
            ? "COM"
            : requestedModeParam === "admin"
                ? "ADMIN"
                : "LAB"

    const [role, setRole] = useState<string | null>(qRole)
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(qUserId)
    const [needsAuth, setNeedsAuth] = useState(false)
    const [tokenApplied, setTokenApplied] = useState(false)

    const [allowedViews, setAllowedViews] = useState<ViewMode[]>(["LAB", "COM", "ADMIN"])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [permissions, setPermissions] = useState<any>(() => {
        // Initial permissions: minimal until DB load completes
        const rNorm = (qRole || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const isSuperAdmin = rNorm === 'admin' || qIsAdmin
        const dynamicCanWrite = qCanWrite || isSuperAdmin
        const isLabRole = (rNorm.includes('laboratorio') || rNorm.includes('tipificador')) && !rNorm.includes('lector')

        return {
            laboratorio: {
                read: true, // Everyone with access to Programacion can read Lab (at least read-only)
                write: dynamicCanWrite && (isSuperAdmin || isLabRole),
                delete: false
            },
            programacion: {
                read: true,
                write: dynamicCanWrite && (isSuperAdmin || isLabRole),
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

            const getStoredToken = (): string | null => {
                if (typeof window === "undefined") return null
                const direct = localStorage.getItem("programacion_access_token") || localStorage.getItem("token")
                if (direct) return direct

                const extractToken = (parsed: any): string | null => {
                    if (!parsed) return null
                    if (typeof parsed?.access_token === "string" && parsed.access_token) return parsed.access_token
                    if (typeof parsed?.currentSession?.access_token === "string" && parsed.currentSession.access_token) return parsed.currentSession.access_token
                    if (typeof parsed?.session?.access_token === "string" && parsed.session.access_token) return parsed.session.access_token
                    if (Array.isArray(parsed) && typeof parsed[0]?.access_token === "string" && parsed[0].access_token) return parsed[0].access_token
                    return null
                }

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue
                    const raw = localStorage.getItem(key)
                    if (!raw) continue
                    try {
                        const parsed = JSON.parse(raw)
                        const token = extractToken(parsed)
                        if (token) return token
                    } catch {
                        // ignore
                    }
                }
                return null
            }

            // 0. Session Auth Bridge (for RLS)
            const bridgeToken = passedToken || getStoredToken()
            if (bridgeToken && !tokenApplied) {
                console.log("[useCurrentUser] Setting session token from parent URL...")
                try {
                    if (typeof window !== "undefined") {
                        localStorage.setItem("programacion_access_token", bridgeToken)
                        localStorage.setItem("token", bridgeToken)
                    }
                    await supabase.auth.setSession({
                        access_token: bridgeToken,
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
                        const normalizedPerms = {
                            ...dbPerms,
                            programacion: {
                                read: true,
                                write: dbPerms.programacion?.write || false,
                                delete: dbPerms.programacion?.delete || false
                            },
                            laboratorio: {
                                read: true,
                                write: dbPerms.laboratorio?.write || false,
                                delete: dbPerms.laboratorio?.delete || false
                            },
                            comercial: {
                                read: true,
                                write: dbPerms.comercial?.write || false,
                                delete: dbPerms.comercial?.delete || false
                            },
                            administracion: {
                                read: true,
                                write: dbPerms.administracion?.write || false,
                                delete: dbPerms.administracion?.delete || false
                            }
                        }

                        setPermissions(normalizedPerms)
                        setAllowedViews(["LAB", "COM", "ADMIN"])
                    }

                }
            } catch {
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
            const canWriteFromRequestedMode = qCanWrite && mode === requestedMode

            // Priority 1: Superadmin always has access
            if (isSuperAdmin) return true

            // Logic shared with EditableCell: block write if viewing LAB as non-lab staff
            if (mode === "LAB") {
                const isLabReadOnly = rNorm.includes('lector')
                if (isLabReadOnly) return false
                return canWriteFromRequestedMode || permissions?.laboratorio?.write || permissions?.programacion?.write || false
            }

            if (mode === "COM") {
                return canWriteFromRequestedMode || permissions?.comercial?.write || false
            }
            if (mode === "ADMIN") {
                return canWriteFromRequestedMode || permissions?.administracion?.write || false
            }
            return false
        }

    }
}
