const SPECIAL_PROGRAMACION_COLUMN_EDITOR_EMAILS = new Set([
    "oficinatecnica2@geofal.com.pe",
    "oficinatecnica3@geofal.com.pe",
])

const SPECIAL_PROGRAMACION_EDITABLE_COLUMNS = new Set([
    "entrega_real",
    "estado_trabajo",
    "nota_lab",
    "envio_informes",
])

export function normalizeProgramacionAccessValue(value: string | null | undefined) {
    return String(value || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function hasScopedProgramacionViewAccess(
    email: string | null | undefined,
    viewMode: string | null | undefined,
    role?: string | null | undefined,
) {
    const normalizedEmail = normalizeProgramacionAccessValue(email)
    const normalizedViewMode = normalizeProgramacionAccessValue(viewMode)
    const normalizedRole = normalizeProgramacionAccessValue(role)

    // El rol asistente de ingenieria / sedes y Johanie tienen acceso COMPLETO, jamas limitado
    if (
        (normalizedRole.includes("asistente") && (normalizedRole.includes("sedes") || normalizedRole.includes("ingenieria"))) ||
        normalizedRole === "asistente_sedes_ingenieria" ||
        normalizedRole === "asistente_ingenieria" ||
        normalizedEmail === "oficinatecnica5@geofal.com.pe"
    ) {
        return false
    }

    return (
        SPECIAL_PROGRAMACION_COLUMN_EDITOR_EMAILS.has(normalizedEmail) &&
        (normalizedViewMode === "" || normalizedViewMode === "lab")
    )
}

export function hasScopedProgramacionColumnAccess(
    email: string | null | undefined,
    columnId: string,
    viewMode: string | null | undefined,
    role?: string | null | undefined,
) {
    const normalizedRole = normalizeProgramacionAccessValue(role)
    const normalizedEmail = normalizeProgramacionAccessValue(email)

    if (
        (normalizedRole.includes("asistente") && (normalizedRole.includes("sedes") || normalizedRole.includes("ingenieria"))) ||
        normalizedRole === "asistente_sedes_ingenieria" ||
        normalizedRole === "asistente_ingenieria" ||
        normalizedEmail === "oficinatecnica5@geofal.com.pe"
    ) {
        return false
    }

    return (
        hasScopedProgramacionViewAccess(email, viewMode, role) &&
        SPECIAL_PROGRAMACION_EDITABLE_COLUMNS.has(columnId)
    )
}
