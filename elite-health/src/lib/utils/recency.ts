/**
 * Recency-Aware Metric Display System
 *
 * Every health metric must answer: "Is this from the selected date,
 * a recent fallback, or unavailable?" This module provides the unified
 * API for all screens to make that determination.
 *
 * ## Recency Rules (per user spec)
 * - RHR/HRV/SpO2/respiratory rate/skin temp delta: selected date, else latest within 3 days
 * - Sleep-derived: selected date, else previous within 2 days
 * - Cardiac strain/activity: selected date only
 * - Running dynamics: selected date if qualifying run exists, else latest within 14 days, labeled
 * - VO2 Max: selected date if present, else latest within 30 days, labeled
 * - Biological age/pace of aging: selected date derived value if valid, else latest within 7 days, labeled
 *
 * ## Return Shape
 * ```
 * { value, sourceDate, recencyDays, isExactDate, isRecentFallback, isUnavailable, reason }
 * ```
 */

import { useHealthStore } from '../store'
import type { HealthState } from '../types'
import {
    safeHRV, safeRHR, safeSpO2, safeRespiratoryRate, safeSkinTempDelta,
    safeVO2Max, safeBiologicalAge, safePaceOfAging, safeStrainScore,
    safeSleepDurationMins
} from './display-helpers'
import { formatDateLocal } from '../date'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RecencyResult {
    /** The actual value, or null if unavailable */
    value: number | null
    /** The date string this value came from (YYYY-MM-DD), or null */
    sourceDate: string | null
    /** Days between sourceDate and the queried date, or null if unavailable */
    recencyDays: number | null
    /** True if the value comes from the exact requested date */
    isExactDate: boolean
    /** True if the value is from a recent-but-different date (not the requested one) */
    isRecentFallback: boolean
    /** True if no value could be found at all */
    isUnavailable: boolean
    /**
     * Canonical status for provenance tracking.
     * - 'fresh': exact-date match from canonical source
     * - 'stale': recent fallback used — data is older than requested date
     * - 'missing': no data available
     */
    canonicalStatus: 'fresh' | 'stale' | 'missing'
    /** Confidence modifier: 1.0 for exact, 0.8 for 1d fallback, 0.6 for 2-3d, 0.4 for older */
    confidence: number
    /** Human-readable reason for the state */
    reason?: string
}

export type MetricCategory =
    | 'vitals-hrv'
    | 'vitals-rhr'
    | 'vitals-spo2'
    | 'vitals-respiratoryRate'
    | 'vitals-skinTempDelta'
    | 'sleep-duration'
    | 'sleep-debt'
    | 'strain'
    | 'running-power'
    | 'running-gct'
    | 'running-vertOsc'
    | 'running-strideLength'
    | 'vo2max'
    | 'biologicalAge'
    | 'paceOfAging'

interface RecencyRule {
    maxDaysBack: number      // How many days back to search for a recent fallback
    isDateStrict: boolean    // If true, only exact date (no recent fallback)
    safeExtractor: (state: HealthState, dateStr: string) => number | null
    label: string            // Human-readable metric name for reason messages
}

// ── Metric Extractors ────────────────────────────────────────────────────────

function extractHRV(state: HealthState, dateStr: string): number | null {
    const v = state.vitals.find(v => v.timestamp.startsWith(dateStr))
    return safeHRV(v?.hrv)
}

function extractRHR(state: HealthState, dateStr: string): number | null {
    const v = state.vitals.find(v => v.timestamp.startsWith(dateStr))
    return safeRHR(v?.rhr)
}

function extractSpO2(state: HealthState, dateStr: string): number | null {
    const v = state.vitals.find(v => v.timestamp.startsWith(dateStr))
    return safeSpO2(v?.spo2)
}

function extractRespiratoryRate(state: HealthState, dateStr: string): number | null {
    const v = state.vitals.find(v => v.timestamp.startsWith(dateStr))
    return safeRespiratoryRate(v?.respiratoryRate)
}

function extractSkinTempDelta(state: HealthState, dateStr: string): number | null {
    const v = state.vitals.find(v => v.timestamp.startsWith(dateStr))
    return safeSkinTempDelta(v?.skinTempDelta)
}

function extractSleepDuration(state: HealthState, dateStr: string): number | null {
    const s = state.sleep.find(s => s.date === dateStr)
    return safeSleepDurationMins(s?.totalDurationMins)
}

function extractSleepDebt(state: HealthState, dateStr: string): number | null {
    const sc = state.scores.find(s => s.date === dateStr)
    const debt = sc?.sleepDebtHours
    if (debt == null || isNaN(debt)) return null
    // Sleep debt only valid if there's corresponding sleep data
    const hasSleep = state.sleep.some(s => s.date === dateStr)
    if (!hasSleep) return null
    return Math.round(debt * 10) / 10
}

function extractStrain(state: HealthState, dateStr: string): number | null {
    const sc = state.scores.find(s => s.date === dateStr)
    return safeStrainScore(sc?.strainScore)
}

function extractRunningPower(state: HealthState, dateStr: string): number | null {
    const d = state.runningDynamics.find(d => d.timestamp.startsWith(dateStr))
    if (d && d.runningPower > 0) return Math.round(d.runningPower)
    return null
}

function extractRunningGCT(state: HealthState, dateStr: string): number | null {
    const d = state.runningDynamics.find(d => d.timestamp.startsWith(dateStr))
    if (d && d.groundContactTime > 0) return Math.round(d.groundContactTime)
    return null
}

function extractRunningVertOsc(state: HealthState, dateStr: string): number | null {
    const d = state.runningDynamics.find(d => d.timestamp.startsWith(dateStr))
    if (d && d.verticalOscillation > 0) return Math.round(d.verticalOscillation * 10) / 10
    return null
}

function extractRunningStrideLength(state: HealthState, dateStr: string): number | null {
    const d = state.runningDynamics.find(d => d.timestamp.startsWith(dateStr))
    if (d && d.strideLength > 0) return Math.round(d.strideLength * 100) / 100
    return null
}

function extractVO2Max(state: HealthState, dateStr: string): number | null {
    const c = state.cardioMetabolic.find(c => c.date === dateStr)
    return safeVO2Max(c?.vo2Max)
}

function extractBiologicalAge(state: HealthState, dateStr: string): number | null {
    const sc = state.scores.find(s => s.date === dateStr)
    // Prefer displayAge (integer) over biologicalAge; fall back for backwards compat
    const raw = sc?.displayAge ?? sc?.biologicalAge
    return safeBiologicalAge(raw)
}

function extractPaceOfAging(state: HealthState, dateStr: string): number | null {
    const sc = state.scores.find(s => s.date === dateStr)
    return safePaceOfAging(sc?.paceOfAging)
}

// ── Recency Rules Map ────────────────────────────────────────────────────────

const RECENCY_RULES: Record<MetricCategory, RecencyRule> = {
    'vitals-hrv': { maxDaysBack: 3, isDateStrict: false, safeExtractor: extractHRV, label: 'HRV' },
    'vitals-rhr': { maxDaysBack: 3, isDateStrict: false, safeExtractor: extractRHR, label: 'RHR' },
    'vitals-spo2': { maxDaysBack: 3, isDateStrict: false, safeExtractor: extractSpO2, label: 'SpO₂' },
    'vitals-respiratoryRate': { maxDaysBack: 3, isDateStrict: false, safeExtractor: extractRespiratoryRate, label: 'Respiratory Rate' },
    'vitals-skinTempDelta': { maxDaysBack: 3, isDateStrict: false, safeExtractor: extractSkinTempDelta, label: 'Skin Temp Delta' },
    'sleep-duration': { maxDaysBack: 2, isDateStrict: false, safeExtractor: extractSleepDuration, label: 'Sleep Duration' },
    'sleep-debt': { maxDaysBack: 2, isDateStrict: false, safeExtractor: extractSleepDebt, label: 'Sleep Debt' },
    'strain': { maxDaysBack: 0, isDateStrict: true, safeExtractor: extractStrain, label: 'Strain' },
    'running-power': { maxDaysBack: 14, isDateStrict: false, safeExtractor: extractRunningPower, label: 'Running Power' },
    'running-gct': { maxDaysBack: 14, isDateStrict: false, safeExtractor: extractRunningGCT, label: 'Ground Contact Time' },
    'running-vertOsc': { maxDaysBack: 14, isDateStrict: false, safeExtractor: extractRunningVertOsc, label: 'Vertical Oscillation' },
    'running-strideLength': { maxDaysBack: 14, isDateStrict: false, safeExtractor: extractRunningStrideLength, label: 'Stride Length' },
    'vo2max': { maxDaysBack: 30, isDateStrict: false, safeExtractor: extractVO2Max, label: 'VO₂ Max' },
    'biologicalAge': { maxDaysBack: 7, isDateStrict: false, safeExtractor: extractBiologicalAge, label: 'Biological Age' },
    'paceOfAging': { maxDaysBack: 7, isDateStrict: false, safeExtractor: extractPaceOfAging, label: 'Pace of Aging' },
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Try to get a metric value for an exact date.
 * Returns null if no valid data exists on that date.
 */
export function getMetricForExactDate(
    category: MetricCategory,
    dateStr: string,
    state?: HealthState,
): number | null {
    const s = state ?? useHealthStore.getState()
    const rule = RECENCY_RULES[category]
    return rule.safeExtractor(s, dateStr)
}

/**
 * Get the latest valid metric within the allowed lookback window.
 * Returns null if nothing found within the window.
 */
export function getLatestValidMetric(
    category: MetricCategory,
    dateStr: string,
    state?: HealthState,
): { value: number; sourceDate: string; recencyDays: number } | null {
    const s = state ?? useHealthStore.getState()
    const rule = RECENCY_RULES[category]

    if (rule.isDateStrict) return null

    // Search backward from dateStr up to maxDaysBack
    for (let offset = 1; offset <= rule.maxDaysBack; offset++) {
        const searchDate = shiftDateBack(dateStr, offset)
        const value = rule.safeExtractor(s, searchDate)
        if (value !== null) {
            return { value, sourceDate: searchDate, recencyDays: offset }
        }
    }

    return null
}

/**
 * Unified display metric resolver.
 *
 * Priority:
 * 1. Exact date match → isExactDate: true
 * 2. Recent fallback within window → isRecentFallback: true
 * 3. Nothing found → isUnavailable: true
 */
export function getDisplayMetric(
    category: MetricCategory,
    dateStr: string,
    state?: HealthState,
): RecencyResult {
    const s = state ?? useHealthStore.getState()
    const rule = RECENCY_RULES[category]

    // Try exact date first
    const exactValue = rule.safeExtractor(s, dateStr)
    if (exactValue !== null) {
        return {
            value: exactValue,
            sourceDate: dateStr,
            recencyDays: 0,
            isExactDate: true,
            isRecentFallback: false,
            isUnavailable: false,
            canonicalStatus: 'fresh',
            confidence: 1.0,
        }
    }

    // If strict, stop here
    if (rule.isDateStrict) {
        return {
            value: null,
            sourceDate: null,
            recencyDays: null,
            isExactDate: false,
            isRecentFallback: false,
            isUnavailable: true,
            canonicalStatus: 'missing',
            confidence: 0,
            reason: `No ${rule.label} data for ${dateStr}`,
        }
    }

    // Try recent fallback — downgrade confidence based on recency
    const recent = getLatestValidMetric(category, dateStr, s)
    if (recent) {
        const fallbackConfidence = recent.recencyDays === 1 ? 0.8 : recent.recencyDays <= 3 ? 0.6 : 0.4
        return {
            value: recent.value,
            sourceDate: recent.sourceDate,
            recencyDays: recent.recencyDays,
            isExactDate: false,
            isRecentFallback: true,
            isUnavailable: false,
            canonicalStatus: 'stale',
            confidence: fallbackConfidence,
            reason: `Latest valid reading · ${recent.recencyDays}d ago`,
        }
    }

    // Nothing found
    return {
        value: null,
        sourceDate: null,
        recencyDays: null,
        isExactDate: false,
        isRecentFallback: false,
        isUnavailable: true,
        canonicalStatus: 'missing',
        confidence: 0,
        reason: `No recent ${rule.label} sample`,
    }
}

/**
 * Generate a user-facing recency label for a given result.
 */
export function getDisplayRecencyLabel(result: RecencyResult): string | null {
    if (result.isExactDate) return null // No label needed for exact matches
    if (result.isUnavailable) return 'UNAVAILABLE'
    if (result.isRecentFallback) {
        if (result.recencyDays === 1) return 'YESTERDAY'
        if (result.recencyDays != null && result.recencyDays <= 3) return `${result.recencyDays}D AGO`
        return 'LATEST'
    }
    return null
}

/**
 * Get a display-friendly recency badge for each recency state.
 * Returns { text, color, backgroundColor } for rendering.
 */
export function getRecencyBadge(result: RecencyResult): {
    text: string
    color: string
    backgroundColor: string
} | null {
    if (result.isExactDate) return null // No badge needed

    if (result.isUnavailable) {
        return {
            text: 'NO DATA',
            color: '#9CA3AF',
            backgroundColor: 'rgba(156, 163, 175, 0.12)',
        }
    }

    if (result.isRecentFallback) {
        const days = result.recencyDays ?? 99
        if (days === 1) {
            return {
                text: 'YESTERDAY',
                color: '#FBBF24',
                backgroundColor: 'rgba(251, 191, 36, 0.12)',
            }
        }
        if (days <= 7) {
            return {
                text: `${days}D AGO`,
                color: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
            }
        }
        return {
            text: 'LATEST',
            color: '#9CA3AF',
            backgroundColor: 'rgba(156, 163, 175, 0.12)',
        }
    }

    return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Shift a date string backward by N days.
 * Uses local date arithmetic to avoid UTC issues.
 */
function shiftDateBack(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() - days)
    return formatDateLocal(d)
}

/**
 * Convenience: get metric value for display (number or null).
 * Skips the full object when you just need the value.
 */
export function getMetricValue(
    category: MetricCategory,
    dateStr: string,
    state?: HealthState,
): number | null {
    return getDisplayMetric(category, dateStr, state).value
}

// ── Batch Helpers ────────────────────────────────────────────────────────────

/**
 * Get display metrics for multiple categories at once.
 * Efficient for screens that need several metrics for the same date.
 */
export function getDisplayMetrics(
    categories: MetricCategory[],
    dateStr: string,
    state?: HealthState,
): Record<MetricCategory, RecencyResult> {
    const s = state ?? useHealthStore.getState()
    const results = {} as Record<MetricCategory, RecencyResult>
    for (const cat of categories) {
        results[cat] = getDisplayMetric(cat, dateStr, s)
    }
    return results
}

/**
 * Check if a set of categories all have exact-date values (no fallbacks).
 * Useful for determining whether to show a "sync more data" prompt.
 */
export function allExactDate(
    results: Record<MetricCategory, RecencyResult>,
): boolean {
    return Object.values(results).every(r => r.isExactDate)
}

/**
 * Check if ALL categories are unavailable.
 */
export function allUnavailable(
    results: Record<MetricCategory, RecencyResult>,
): boolean {
    return Object.values(results).every(r => r.isUnavailable)
}

/**
 * Count how many categories have data (exact or recent).
 */
export function countAvailable(
    results: Record<MetricCategory, RecencyResult>,
): number {
    return Object.values(results).filter(r => !r.isUnavailable).length
}
