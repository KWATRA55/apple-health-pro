/**
 * metric-normalization.ts
 *
 * Normalizes raw HealthKit and sensor values into display-safe, semantically
 * correct representations before they enter the store.
 *
 * Key responsibilities:
 *  1. SpO2: HealthKit may return decimal fraction (0.97) instead of percent (97).
 *     We detect this and convert to percent.
 *  2. Skin temperature: AppleSleepingWristTemperature returns absolute temp (~36°C),
 *     not a delta from baseline. We compute the delta from a 14-day rolling mean
 *     or pass through if already a small delta value.
 *  3. Generic metric payload normalizer that applies all transforms in one pass.
 */

// ── SpO2 Normalization ────────────────────────────────────────────────────────
//
// HealthKit HKQuantityTypeIdentifierOxygenSaturation returns values in percent
// (0.0–1.0). Some SDK versions/regions return the raw fraction (0.95), others
// return the percent (95). This detector normalizes to percent.
//
// Detection heuristic: if value < 1.0, it's a fraction; multiply by 100.
// Values >= 1.0 are assumed already in percent (clamped 0–100).

export function normalizeSpO2(rawValue: number | null | undefined): number | null {
    if (rawValue == null) return null
    if (typeof rawValue !== 'number' || isNaN(rawValue)) return null
    if (rawValue <= 0) return null

    // Idempotency guard: if already normalized to percent range, return as-is.
    // This prevents double-conversion when data passes through normalization twice.
    if (rawValue >= 50 && rawValue <= 100) return Math.round(rawValue)

    // If value is < 1.0, it's a decimal fraction (HealthKit norm)
    if (rawValue < 1.0) {
        const pct = rawValue * 100
        // Sanity: if the conversion yields something implausible, reject
        if (pct < 50 || pct > 100) return null
        return Math.round(pct)
    }

    // Edge case: value 1.0 exactly — ambiguous. Treat as 100% (decimal fraction 1.0).
    if (rawValue === 1.0) return 100

    // Value in implausible range (1.01–49.99) — reject
    return null
}

// ── Skin Temperature Normalization ────────────────────────────────────────────
//
// HealthKit HKQuantityTypeIdentifierAppleSleepingWristTemperature returns
// absolute wrist temperature in °C (typically 34–38°C). The app's data model
// expects a *delta* from baseline (°C deviation), typically in the range
// -3.0 to +3.0.
//
// If a baseline array is provided, we compute the delta from the rolling mean.
// Otherwise, if the value is already in a plausible delta range (±3°C), we
// pass it through. Large absolute values (> 30°C) are treated as absolute
// temperatures and converted to a delta using the personal rolling baseline.
// When no personal baseline exists, returns null (no fabricated delta).

export function normalizeSkinTempDelta(
    rawValue: number | null | undefined,
    baselineValues?: number[],
): number | null {
    if (rawValue == null) return null
    if (typeof rawValue !== 'number' || isNaN(rawValue)) return null

    // Already looks like a plausible delta (±3°C)
    if (Math.abs(rawValue) <= 3.0) {
        // Zero delta is suspicious — could be a placeholder. Check if baseline
        // suggests otherwise.
        if (rawValue === 0 && baselineValues && baselineValues.length > 0) {
            return computeDelta(rawValue, baselineValues)
        }
        return rawValue
    }

    // Looks like an absolute temperature (> 30°C) — convert to delta
    if (rawValue > 30 && rawValue < 42) {
        const baseline = computeBaselineMean(baselineValues)
        if (baseline == null) return null
        const delta = rawValue - baseline
        // Clamp to plausible delta range
        if (Math.abs(delta) > 3.0) return null
        return Math.round(delta * 100) / 100
    }

    return null
}

function computeDelta(
    absoluteTemp: number,
    baselineValues: number[],
): number | null {
    const baseline = computeBaselineMean(baselineValues)
    if (baseline == null) return null
    const delta = absoluteTemp - baseline
    if (Math.abs(delta) > 3.0) return null
    return Math.round(delta * 100) / 100
}

function computeBaselineMean(values: number[] | undefined): number | null {
    if (!values || values.length === 0) return null
    // If values look like absolute temps (> 30), compute mean directly
    if (values.every(v => v > 30)) {
        return values.reduce((a, b) => a + b, 0) / values.length
    }
    // If values look like deltas, we can't derive an absolute baseline
    return null
}

// ── Generic Metric Payload Normalizer ─────────────────────────────────────────
//
// Accepts a partial vitals record and applies all normalization transforms.
// Used at the HealthKit ingestion boundary to ensure clean data enters the store.

export interface RawVitalsPayload {
    hrv?: number | null
    rhr?: number | null
    spo2?: number | null
    respiratoryRate?: number | null
    skinTempDelta?: number | null
}

export interface NormalizedVitalsPayload {
    hrv: number | null
    rhr: number | null
    spo2: number | null
    respiratoryRate: number | null
    skinTempDelta: number | null
}

export function normalizeMetricPayload(
    raw: RawVitalsPayload,
    skinTempBaseline?: number[],
): NormalizedVitalsPayload {
    return {
        hrv: raw.hrv != null && raw.hrv > 0 && raw.hrv < 200 ? raw.hrv : null,
        rhr: raw.rhr != null && raw.rhr > 30 && raw.rhr < 220 ? raw.rhr : null,
        spo2: normalizeSpO2(raw.spo2),
        respiratoryRate:
            raw.respiratoryRate != null &&
                raw.respiratoryRate > 6 &&
                raw.respiratoryRate < 40
                ? raw.respiratoryRate
                : null,
        skinTempDelta: normalizeSkinTempDelta(raw.skinTempDelta, skinTempBaseline),
    }
}
