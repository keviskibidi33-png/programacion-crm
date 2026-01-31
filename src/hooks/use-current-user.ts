
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

    useEffect(() => {
        async function fetchRole() {
            // DEV MODE: TOTAL BYPASS
            setAllowedViews(['LAB', 'COM', 'ADMIN'])

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
                    // console.error("Error fetching user role", error)
                    setRole(null)
                    setLoading(false) // Ensure loading stops
                    return
                }

                setRole(data.role)
                setLoading(false)
            } catch (e) {
                // console.error("Exception fetching role", e)
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
        canView: (mode: ViewMode) => allowedViews.includes(mode)
    }
}
