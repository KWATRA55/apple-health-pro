/**
 * Data Validation Utility
 * 
 * Guards against zero/invalid data flowing from HealthKit through the pipeline to the UI.
 * Used by both healthkit.ts (to return null instead of zero-filled records) and
 * store.ts (to reject invalid records before DB insertion).
 */

// ── Individual Metric Plausibility Checks ────────────────────────────────────

export function isPlausibleHRV(value: number): boolean {
    return value > 0 && value >= 10 && value <= 250
}

export function isPlausibleRHR(value: number): boolean {
    return value > 0 && value >= 30 && value <= 200
}

export function isPlausibleSpO2(value: number): boolean {
    return value > 0 && value >= 80 && value <= 100
}

export function isPlausibleRespiratoryRate(value: number): boolean {
    return value > 0 && value >= 4 && value <= 40
}

export function isPlausibleSkinTempDelta(value: number | null): boolean {
    if (value == null) return false
    // Skin temp delta should be within reasonable range
    return Math.abs(value) <= 3
}

export function isPlausibleSleepDuration(mins: number): boolean {
    return mins >= 60 && mins <= 1440 // At least 1 hour, max 24 hours
}

export function isPlausibleVO2Max(value: number): boolean {
    return value > 0 && value >= 10 && value <= 85
}

export function isPlausibleRecoveryScore(value: number): boolean {
    return value >= 1 && value <= 100
}

export function isPlausibleStrainScore(value: number): boolean {
    return value >= 1 && value <= 21
}

export function isPlausiblePaceOfAging(value: number): boolean {
    return value > 0 && value <= 3
}

// ── Record-Level Validators ──────────────────────────────────────────────────

export interface VitalsInput {
    hrv: number
    rhr: number
    spo2: number
    respiratoryRate: number
    skinTempDelta: number | null
}

/**
 * Returns true if the vitals record has at least ONE plausible metric.
 * A record where ALL metrics are zero/impossible is invalid.
 */
export function isValidVitals(v: VitalsInput): boolean {
    const hasHRV = isPlausibleHRV(v.hrv)
    const hasRHR = isPlausibleRHR(v.rhr)
    const hasSpO2 = isPlausibleSpO2(v.spo2)
    const hasRR = isPlausibleRespiratoryRate(v.respiratoryRate)
    const hasTemp = isPlausibleSkinTempDelta(v.skinTempDelta)

    // At least one core metric must be plausible (HRV or RHR)
    return hasHRV || hasRHR

    // For completeness we could also check individual fields:
    // Spo2: only valid if > 0 → must pass plausibility
    // RR: only valid if > 0 → must pass plausibility
    // Skin temp: always recorded by watch, but if 0 it's invalid
}

/**
 * Check if ALL vitals fields are zero (clearly no data was fetched).
 */
export function areAllVitalsZero(v: VitalsInput): boolean {
    return v.hrv === 0 && v.rhr === 0 && v.spo2 === 0 && v.respiratoryRate === 0 && (v.skinTempDelta == null || v.skinTempDelta === 0)
}

export interface SleepInput {
    totalDurationMins: number
    remMins: number
    deepMins: number
    coreMins: number
    awakeMins: number
}

export function isValidSleep(s: SleepInput): boolean {
    return isPlausibleSleepDuration(s.totalDurationMins)
}

export function isAllSleepZero(s: SleepInput): boolean {
    return s.totalDurationMins === 0 && s.remMins === 0 && s.deepMins === 0 && s.coreMins === 0 && s.awakeMins === 0
}

export interface ActivityInput {
    hrZones: number[]
    maxHR: number
    avgHR: number
    durationMins: number
}

export function isValidActivity(a: ActivityInput): boolean {
    // HR zones should have at least one non-zero zone
    const hasHRZones = a.hrZones.some(z => z > 0)
    const hasHR = a.maxHR > 0 || a.avgHR > 0
    const hasDuration = a.durationMins > 0
    return hasHRZones || hasHR || hasDuration
}

export interface MobilityInput {
    steps: number
    walkingSpeed: number
    walkingAsymmetry: number
    doubleSupport: number
}

export function isValidMobility(m: MobilityInput): boolean {
    // At least steps should be > 0 for a valid record
    return m.steps > 0 || m.walkingSpeed > 0
}

export function isAllMobilityZero(m: MobilityInput): boolean {
    return m.steps === 0 && m.walkingSpeed === 0 && m.walkingAsymmetry === 0 && m.doubleSupport === 0
}

export interface EnvironmentalInput {
    timeInDaylight: number
    headphoneAudio: number
    exerciseMinutes: number
    standMinutes: number
    mindfulMinutes?: number
}

export function isValidEnvironmental(e: EnvironmentalInput): boolean {
    return e.timeInDaylight > 0 || e.headphoneAudio > 0 || e.exerciseMinutes > 0 || e.standMinutes > 0 || (e.mindfulMinutes ?? 0) > 0
}

export interface CardioMetabolicInput {
    vo2Max: number
    walkingHRavg: number
    restingEnergy: number
}

export function isValidCardioMetabolic(c: CardioMetabolicInput): boolean {
    return isPlausibleVO2Max(c.vo2Max) || c.restingEnergy > 0
}

export function isAllCardioMetabolicZero(c: CardioMetabolicInput): boolean {
    return c.vo2Max === 0 && c.walkingHRavg === 0 && c.restingEnergy === 0
}

// ── Utility: strip zero fields from an object ────────────────────────────────

/**
 * Returns a new object with zero-value and null fields removed.
 * Useful for cleaning biometric context before sending to Gemini.
 */
export function stripZerosAndNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
        if (value === 0 || value === null || value === undefined) continue
        if (typeof value === 'number' && isNaN(value)) continue
        result[key] = value
    }
    return result as Partial<T>
}
