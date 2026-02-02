
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useSearchParams } from "next/navigation"

export type ViewMode = "LAB" | "COM" | "ADMIN"

export function useCurrentUser() {
    const supabase = useMemo(() => createClient(), [])
    const searchParams = useSearchParams()

    // We expect "userId" in the iframe URL
    const userIdParam = searchParams.get("userId")

    const [role, setRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [allowedViews, setAllowedViews] = useState<ViewMode[]>([])
    const [canWrite, setCanWrite] = useState(false)

    useEffect(() => {
        async function fetchRole() {
            if (!userIdParam) {
                setLoading(false)
                return
            }

            try {
                const { data, error } = await supabase
                    .from("perfiles")
                    .select("role")
                    .eq("id", userIdParam)
                    .single()

                if (error || !data) {
                    setRole(null)
                    setLoading(false)
                    return
                }

                const userRole = data.role.toLowerCase()
                setRole(userRole)

                // canWrite is true if the role doesn't contain "lectura" 
                // and it's not a generic guest role if that existed.
                setCanWrite(!userRole.includes("lectura"))

                // Determine allowed views based on role
                const views: ViewMode[] = ["LAB"] // Everyone gets Lab

                if (userRole.includes("admin") || userRole.includes("comercial")) {
                    views.push("COM")
                }

                if (userRole.includes("admin") || userRole.includes("administracion")) {
                    views.push("ADMIN")
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
        canWrite,
        canView: (mode: ViewMode) => allowedViews.includes(mode)
    }
}
