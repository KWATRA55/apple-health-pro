/**
 * longevity-guards.ts
 *
 * Guards that determine whether biological age and pace of aging values
 * are renderable (backed by real biomarkers) vs. fallback/placeholder values.
 *
 * Core principle: confidence === 0 means the algorithm had no real inputs
 * and fell back to chronological age / pace 1.0. These must NOT be shown
 * as if they're real measurements.
 */

export interface LongevityValidity {
    /** Whether biological age is backed by real biomarker data */
    hasValidBioAge: boolean
    /** Whether pace of aging is backed by real biomarker data */
    hasValidPace: boolean
    /** Whether at least one longevity metric is displayable */
    hasRenderableLongevity: boolean
    /** The confidence level (0–1) */
    confidence: number
    /** Reason why values are invalid (for UI messaging) */
    reason: string | null
}

/**
 * Check whether the biological age value is valid (not a fallback).
 *
 * Invalid cases:
 *  - null/undefined/zero/negative
 *  - confidence === 0 (algorithm had no real inputs, returned chronological age)
 *  - bioAge equals chronological age AND confidence < 0.3 (likely fallback)
 *  - age > 150 (implausible)
 *
 * @param biologicalAge - The biological age value
 * @param chronologicalAge - The user's chronological age
 * @param confidence - The computation confidence (0–1), typically from bioAgeConfidence
 * @returns true if the biological age is backed by real data
 */
export function hasValidBioAge(
    biologicalAge: number | null | undefined,
    chronologicalAge: number,
    confidence?: number | null,
): boolean {
    if (biologicalAge == null) return false
    if (biologicalAge <= 0) return false
    if (biologicalAge > 150) return false

    // Zero confidence means the algorithm returned fallback values
    if (confidence != null && confidence <= 0) return false

    // If bioAge is exactly chronological age and confidence is low/zero,
    // this is almost certainly a fallback
    if (
        biologicalAge === chronologicalAge &&
        (confidence == null || confidence < 0.3)
    ) {
        return false
    }

    return true
}

/**
 * Check whether the pace of aging value is valid (not a fallback).
 *
 * Invalid cases:
 *  - null/undefined/zero/negative
 *  - confidence === 0 (algorithm had no real inputs, returned 1.0)
 *  - pace exactly 1.0 AND confidence < 0.3 (likely fallback)
 *  - pace < 0.5 or > 3.0 (outside algorithm bounds)
 *
 * @param paceOfAging - The pace of aging ratio
 * @param confidence - The computation confidence (0–1)
 * @returns true if the pace of aging is backed by real data
 */
export function hasValidPace(
    paceOfAging: number | null | undefined,
    confidence?: number | null,
): boolean {
    if (paceOfAging == null) return false
    if (paceOfAging <= 0) return false

    // Zero confidence means the algorithm returned fallback values (1.0)
    if (confidence != null && confidence <= 0) return false

    // Pace exactly 1.0 is the algorithm's fallback; only trust it if confidence exists
    if (paceOfAging === 1.0 && (confidence == null || confidence < 0.3)) {
        return false
    }

    // Algorithm caps at 2.5x and floors at 0.4x
    if (paceOfAging < 0.4 || paceOfAging > 3.0) return false

    return true
}

/**
 * Combined check: are either biological age or pace of aging renderable?
 *
 * @param biologicalAge - The biological age value
 * @param paceOfAging - The pace of aging ratio
 * @param chronologicalAge - The user's chronological age
 * @param confidence - The computation confidence (0–1)
 * @returns A LongevityValidity object with all validity flags
 */
export function hasRenderableLongevity(
    biologicalAge: number | null | undefined,
    paceOfAging: number | null | undefined,
    chronologicalAge: number,
    confidence?: number | null,
): LongevityValidity {
    const validBioAge = hasValidBioAge(biologicalAge, chronologicalAge, confidence)
    const validPace = hasValidPace(paceOfAging, confidence)

    let reason: string | null = null
    if (!validBioAge && !validPace) {
        if (biologicalAge == null && paceOfAging == null) {
            reason = 'No longevity data available'
        } else if (confidence != null && confidence <= 0) {
            reason = 'Insufficient biomarker data for longevity computation'
        } else {
            reason = 'Longevity values are not backed by recent data'
        }
    }

    return {
        hasValidBioAge: validBioAge,
        hasValidPace: validPace,
        hasRenderableLongevity: validBioAge || validPace,
        confidence: confidence ?? 0,
        reason,
    }
}
