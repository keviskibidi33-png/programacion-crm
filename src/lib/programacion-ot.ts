const DEFAULT_OT_SUFFIX = '-26'

export function normalizeProgramacionOtValue(value: unknown): string {
    const raw = String(value ?? '').trim()
    if (!raw) return ''

    const digits = raw.match(/\d+/)?.[0]
    if (!digits) return raw

    return `${digits}${DEFAULT_OT_SUFFIX}`
}
