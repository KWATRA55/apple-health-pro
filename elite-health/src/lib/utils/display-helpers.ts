/**
 * Display-Safe Value Helpers
 *
 * Guards against rendering zero/invalid/NaN values in the UI.
 * Every value displayed to the user should pass through one of these helpers
 * to ensure the UI never shows "oxygen 1%", "breathing 0.0/min", etc.
 *
 * Usage:
 *   <MetricValue value={safeVital(record.hrv, 'hrv')} />
 *   <Text>{formatVital(vitals.spo2, 'spo2', '%')}</Text>
 *
 * Confidence-Aware Variants (safeBiologicalAgeWithConfidence, safePaceOfAgingWithConfidence):
 *   These check bioAgeConfidence to reject zero-confidence fallback values
 *   (where bioAge === chronologicalAge and pace === 1.0 are placeholders).
 *   Use these in UI rendering paths where displaying a fake value is misleading.
 */

// ── Individual Metric Display Guards ─────────────────────────────────────────

/** HRV: valid range 10-250ms */
export function safeHRV(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 10 || value > 250) return null
    return Math.round(value)
}

/** RHR: valid range 30-200bpm */
export function safeRHR(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 30 || value > 200) return null
    return Math.round(value)
}

/** SpO2: valid range 80-100% */
export function safeSpO2(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 80 || value > 100) return null
    return Math.round(value)
}

/** Respiratory Rate: valid range 4-40 breaths/min */
export function safeRespiratoryRate(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 4 || value > 40) return null
    return Math.round(value * 10) / 10
}

/** Skin Temp Delta: valid range ±3°C from baseline */
export function safeSkinTempDelta(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value === 0) return null
    if (Math.abs(value) > 3) return null
    return Math.round(value * 10) / 10
}

/** Sleep Duration: valid range 1-24 hours (60-1440 mins) */
export function safeSleepDurationMins(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 60 || value > 1440) return null
    return value
}

/** Sleep Duration Hours (for display) */
export function safeSleepDurationHours(value: number | null | undefined): number | null {
    const mins = safeSleepDurationMins(value == null ? null : value * 60)
    if (mins == null) return null
    return Math.round((mins / 60) * 10) / 10
}

/** VO2 Max: valid range 10-85 ml/kg/min */
export function safeVO2Max(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 10 || value > 85) return null
    return Math.round(value * 10) / 10
}

/** Recovery Score: valid range 1-100 */
export function safeRecoveryScore(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 1 || value > 100) return null
    return Math.round(value)
}

/** Strain Score: valid range 0-21 */
export function safeStrainScore(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 0 || value > 21) return null
    return Math.round(value * 10) / 10
}

/** Pace of Aging: valid range 0.1-3.0 */
export function safePaceOfAging(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value <= 0 || value > 3) return null
    return Math.round(value * 100) / 100
}

/**
 * Confidence-aware pace of aging guard.
 * Returns null when confidence is zero (fallback placeholder),
 * otherwise delegates to safePaceOfAging.
 */
export function safePaceOfAgingWithConfidence(
    value: number | null | undefined,
    confidence?: number | null,
): number | null {
    if (confidence != null && confidence <= 0) return null
    return safePaceOfAging(value)
}

/** Biological Age: must be > 0, < 150 */
export function safeBiologicalAge(value: number | null | undefined, chronologicalAge?: number): number | null {
    if (value == null || isNaN(value)) return null
    if (value <= 0) return null
    // With v2 algorithm (2.5× cap), max bio age = chronologicalAge * 2.5.
    // Allow 3× as safety margin for edge cases (young age + extreme inputs).
    const maxBioAge = chronologicalAge != null && chronologicalAge > 0
        ? Math.max(chronologicalAge * 3, 80)
        : 150
    if (value > maxBioAge) {
        console.log(`[SAFE-BIO-AGE] Rejected stale/implausible bio age: ${value} (chrono: ${chronologicalAge}, max allowed: ${maxBioAge})`)
        return null
    }
    return Math.round(value * 10) / 10
}

/**
 * Confidence-aware biological age guard.
 * Returns null when:
 *  - confidence is 0 (algorithm fallback — no real biomarker inputs)
 *  - bioAge equals chronologicalAge AND confidence < 0.3 (likely placeholder)
 * Otherwise delegates to safeBiologicalAge.
 */
export function safeBiologicalAgeWithConfidence(
    value: number | null | undefined,
    chronologicalAge: number,
    confidence?: number | null,
): number | null {
    const safe = safeBiologicalAge(value, chronologicalAge)
    if (safe == null) return null
    if (confidence != null && confidence <= 0) return null
    if (safe === chronologicalAge && (confidence == null || confidence < 0.3)) return null
    return safe
}

/** Steps: must be > 0 */
export function safeSteps(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value <= 0) return null
    return Math.round(value)
}

/** Sleep Debt Hours: valid range -20 to +20 */
export function safeSleepDebtHours(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (Math.abs(value) > 20) return null
    return Math.round(value * 10) / 10
}

/** Walking Speed: valid range 0.1-3.0 m/s */
export function safeWalkingSpeed(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value <= 0 || value > 3) return null
    return Math.round(value * 100) / 100
}

/** Time in Daylight: valid range 0-1440 mins */
export function safeDaylightMins(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 0 || value > 1440) return null
    return Math.round(value)
}

/** Headphone Audio: valid range 0-120 dB */
export function safeAudioLevel(value: number | null | undefined): number | null {
    if (value == null || isNaN(value)) return null
    if (value < 0 || value > 120) return null
    return Math.round(value)
}

// ── Formatted Display Helpers ────────────────────────────────────────────────

/**
 * Format a vital metric for display.
 * Returns '--' for invalid/null values instead of rendering zeros.
 */
export function formatVital(
    value: number | null | undefined,
    metric: 'hrv' | 'rhr' | 'spo2' | 'respiratoryRate' | 'skinTempDelta' | 'vo2Max' | 'recovery' | 'strain' | 'paceOfAging' | 'biologicalAge' | 'sleepDebt' | 'steps' | 'walkingSpeed' | 'daylight' | 'audio',
    unit?: string,
): string {
    let safe: number | null = null
    switch (metric) {
        case 'hrv': safe = safeHRV(value); break
        case 'rhr': safe = safeRHR(value); break
        case 'spo2': safe = safeSpO2(value); break
        case 'respiratoryRate': safe = safeRespiratoryRate(value); break
        case 'skinTempDelta': safe = safeSkinTempDelta(value); break
        case 'vo2Max': safe = safeVO2Max(value); break
        case 'recovery': safe = safeRecoveryScore(value); break
        case 'strain': safe = safeStrainScore(value); break
        case 'paceOfAging': safe = safePaceOfAging(value); break
        case 'biologicalAge': safe = safeBiologicalAge(value); break
        case 'sleepDebt': safe = safeSleepDebtHours(value); break
        case 'steps': safe = safeSteps(value); break
        case 'walkingSpeed': safe = safeWalkingSpeed(value); break
        case 'daylight': safe = safeDaylightMins(value); break
        case 'audio': safe = safeAudioLevel(value); break
    }

    if (safe === null) return '--'
    if (unit) return `${safe}${unit}`
    return String(safe)
}

/**
 * Returns a display string for any metric, or '--' if value is invalid.
 * Generic fallback for metrics not covered by formatVital.
 */
export function safeNumber(
    value: number | null | undefined,
    decimals = 0,
    unit?: string,
): string {
    if (value == null || isNaN(value)) return '--'
    if (!isFinite(value)) return '--'

    const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
    if (unit) return `${rounded}${unit}`
    return String(rounded)
}

// ── Canonical Display Formatters ──────────────────────────────────────────────

/**
 * Format a pillar score (Readiness, Resilience, Longevity) as integer 0–100.
 * Returns '--' for null/missing values.
 */
export function formatScore(value: number | null | undefined): string {
    if (value == null || isNaN(value) || !isFinite(value)) return '--'
    return String(Math.round(Math.max(0, Math.min(100, value))))
}

/**
 * Format biological age for display — integer years only.
 * Use `displayAge` from DailyScores, not `biologicalAge`.
 * Returns '--' for null/missing values.
 */
export function formatAge(value: number | null | undefined): string {
    if (value == null || isNaN(value) || !isFinite(value)) return '--'
    const valid = safeBiologicalAge(value)
    if (valid === null) return '--'
    return String(Math.round(valid))
}

/**
 * Empty state marker string. Consistent across all components.
 */
export const EMPTY_STATE_MARKER = '--' as const

/**
 * Returns a consistent empty-state display string.
 * Use this for any metric that is missing, null, or invalid.
 * Always returns '--' to match formatVital / safeNumber convention.
 */
export function formatEmptyState(): string {
    return EMPTY_STATE_MARKER
}
