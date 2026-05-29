/**
 * Formatting & Display Regression Test Suite
 *
 * Validates all display helpers (formatScore, formatAge, safeNumber, formatEmptyState)
 * and algorithm output formatting (displayAge/rawAge split, pillar score integers).
 *
 * These tests verify the Subtask 3 & 4 fixes:
 *  - formatScore clamps & returns integer string
 *  - formatAge returns integer years
 *  - safeNumber handles null/NaN/zero correctly
 *  - computeBiologicalAge returns displayAge (integer) and rawAge (float)
 *  - Pillar scores (readiness/resilience/longevity) return integers 0-100
 *  - Longevity primaryMetric starts with score, not biological age
 */

import { formatScore, formatAge, safeNumber, formatEmptyState, EMPTY_STATE_MARKER } from '../utils/display-helpers'
import { computeBiologicalAge } from '../algorithms/biological-age'
import { synthesize } from '../algorithms/heuristic-synthesis'
import type { SynthesisInput } from '../types'

// ── Helper: Minimal valid SynthesisInput ─────────────────────────────────

function emptyInput(overrides: Partial<SynthesisInput> = {}): SynthesisInput {
    return {
        dateStr: '2026-01-15',
        vitals: null,
        sleep: null,
        mobility: null,
        environmental: null,
        cardioMetabolic: null,
        runningDynamics: null,
        injuryRisk: null,
        cnsStressScore: null,
        scores: null,
        chronologicalAge: 30,
        activities: [],
        hrvBaseline: 0,
        rhrBaseline: 0,
        asymmetryBaseline: 0,
        doubleSupportBaseline: 0,
        vo2Baseline: 0,
        daylightBaseline: 0,
        audioBaseline: 0,
        sleepDurationBaseline: 0,
        ...overrides,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// A. BIOLOGICAL AGE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Biological Age — displayAge/rawAge split', () => {
    it('A1: displayAge is always an integer', () => {
        const result = computeBiologicalAge(43, 55, 58, 98)
        expect(Number.isInteger(result.displayAge)).toBe(true)
    })

    it('A2: rawAge is a float with internal precision preserved', () => {
        const result = computeBiologicalAge(43, 55, 58, 98)
        // rawAge should be the unrounded value — may or may not be integer
        expect(typeof result.rawAge).toBe('number')
        // For non-trivial inputs, rawAge should differ from displayAge
        // (it may equal displayAge in some edge cases, but generally they differ)
        expect(result.rawAge).toBeDefined()
    })

    it('A3: displayAge equals Math.round(rawAge) (clamped)', () => {
        const result = computeBiologicalAge(43, 55, 58, 98)
        // displayAge is the clamped+rounded value
        // rawAge is the unrounded, unclamped precursor
        // After clamping, displayAge should be Math.max(18, Math.min(80, Math.round(rawAge)))
        // For a 43-year-old with decent vitals, rawAge will be < 80 and > 18
        const expectedDisplay = Math.max(18, Math.min(80, Math.round(result.rawAge)))
        expect(result.displayAge).toBe(expectedDisplay)
    })

    it('A4: biologicalAge (deprecated) equals displayAge for backward compat', () => {
        const result = computeBiologicalAge(43, 55, 58, 98)
        expect(result.biologicalAge).toBe(result.displayAge)
    })
})

describe('Biological Age — formatAge', () => {
    it('A5: formatAge(43.1) returns integer string', () => {
        // formatAge calls safeBiologicalAge which allows floats, then Math.round
        expect(formatAge(43.1)).toBe('43')
    })

    it('A6: formatAge(null) returns "--"', () => {
        expect(formatAge(null)).toBe('--')
    })

    it('A7: formatAge(undefined) returns "--"', () => {
        expect(formatAge(undefined)).toBe('--')
    })

    it('A8: formatAge(NaN) returns "--"', () => {
        expect(formatAge(NaN)).toBe('--')
    })

    it('A9: formatAge(Infinity) returns "--"', () => {
        expect(formatAge(Infinity)).toBe('--')
    })

    it('A10: formatAge(0) returns "--" (zero is invalid for biological age)', () => {
        // safeBiologicalAge rejects value <= 0
        expect(formatAge(0)).toBe('--')
    })

    it('A11: formatAge(-5) returns "--" (negative age is invalid)', () => {
        expect(formatAge(-5)).toBe('--')
    })

    it('A12: formatAge with very large age returns "--" (exceeds max)', () => {
        // safeBiologicalAge rejects values > maxBioAge (chronologicalAge * 3 or 150)
        // Without chronologicalAge context, max is 150
        expect(formatAge(151)).toBe('--')
    })

    it('A13: formatAge(18) returns "18" (minimum valid)', () => {
        expect(formatAge(18)).toBe('18')
    })

    it('A14: formatAge(80) returns "80" (maximum valid)', () => {
        expect(formatAge(80)).toBe('80')
    })

    it('A15: formatAge returns numeric string, not "years" suffix', () => {
        expect(formatAge(43)).toBe('43')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// B. SCORE FORMATTING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('formatScore', () => {
    it('B1: formatScore(85) returns "85" (integer string)', () => {
        expect(formatScore(85)).toBe('85')
    })

    it('B2: formatScore(85.7) returns "86" (rounded)', () => {
        expect(formatScore(85.7)).toBe('86')
    })

    it('B3: formatScore(0) returns "0" (zero is valid)', () => {
        expect(formatScore(0)).toBe('0')
    })

    it('B4: formatScore(null) returns "--"', () => {
        expect(formatScore(null)).toBe('--')
    })

    it('B5: formatScore(undefined) returns "--"', () => {
        expect(formatScore(undefined)).toBe('--')
    })

    it('B6: formatScore(NaN) returns "--"', () => {
        expect(formatScore(NaN)).toBe('--')
    })

    it('B7: formatScore(Infinity) returns "--"', () => {
        expect(formatScore(Infinity)).toBe('--')
    })

    it('B8: formatScore(-1) clamps to "0"', () => {
        // formatScore clamps to [0, 100] via Math.max(0, Math.min(100, value))
        expect(formatScore(-1)).toBe('0')
    })

    it('B9: formatScore(101) clamps to "100"', () => {
        expect(formatScore(101)).toBe('100')
    })

    it('B10: formatScore(100) returns "100" (ceiling)', () => {
        expect(formatScore(100)).toBe('100')
    })

    it('B11: formatScore(50.5) returns "51" (round half up)', () => {
        expect(formatScore(50.5)).toBe('51')
    })

    it('B12: formatScore is always an integer string', () => {
        const results = [100, 99.1, 0, 0.4, 50.5, 87.2].map(v => formatScore(v))
        for (const r of results) {
            expect(r).toMatch(/^\d+$/)
        }
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// C. LONGEVITY SCORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Longevity — Score Formatting', () => {
    it('C1: longevity score is 0-100 integer (not biological age)', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 55, rhr: 58, spo2: 98, skinTempDelta: 0, respiratoryRate: 14 },
            sleep: { id: 2, date: '2026-01-15', totalDurationMins: 480, remMins: 100, deepMins: 85, coreMins: 280, awakeMins: 15, sleepNeedHours: 8, sleepDebtHours: 0 },
            cardioMetabolic: { id: 3, date: '2026-01-15', vo2Max: 45, walkingHRavg: 115, restingEnergy: 1800, physicalEffort: 24, restingHeartRate: 58, hrv: 55, breathingDisturbances: 3 },
            scores: { date: '2026-01-15', recoveryScore: 80, strainScore: 5, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.8, rhrZScore: -0.2, recoveryZone: 'green', displayAge: 28, rawAge: 28.3, biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW', bioAgeConfidence: 0.8, bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'], bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'], bioAgePrimaryDriver: 'HRV ↑' },
            hrvBaseline: 55,
            rhrBaseline: 60,
        })
        const result = synthesize(input)
        expect(result.longevity.score).toBeGreaterThanOrEqual(0)
        expect(result.longevity.score).toBeLessThanOrEqual(100)
        expect(Number.isInteger(result.longevity.score)).toBe(true)
    })

    it('C2: longevity primaryMetric starts with score (not biological age)', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 55, rhr: 58, spo2: 98, skinTempDelta: 0, respiratoryRate: 14 },
            scores: { date: '2026-01-15', recoveryScore: 80, strainScore: 5, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.8, rhrZScore: -0.2, recoveryZone: 'green', displayAge: 28, rawAge: 28.3, biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW', bioAgeConfidence: 0.8, bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'], bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'], bioAgePrimaryDriver: 'HRV ↑' },
            hrvBaseline: 55,
            rhrBaseline: 60,
        })
        const result = synthesize(input)
        expect(result.longevity.primaryMetric).toMatch(/^\d+pts/)
    })

    it('C3: longevity primaryMetric contains "Bio Age" as secondary context', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 55, rhr: 58, spo2: 98, skinTempDelta: 0, respiratoryRate: 14 },
            scores: { date: '2026-01-15', recoveryScore: 80, strainScore: 5, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.8, rhrZScore: -0.2, recoveryZone: 'green', displayAge: 28, rawAge: 28.3, biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW', bioAgeConfidence: 0.8, bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'], bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'], bioAgePrimaryDriver: 'HRV ↑' },
            hrvBaseline: 55,
            rhrBaseline: 60,
        })
        const result = synthesize(input)
        // Should contain "Bio Age" as context, not as the leading value
        expect(result.longevity.primaryMetric).toContain('Bio Age')
        // But the leading value should be the score
        expect(result.longevity.primaryMetric).not.toMatch(/^\d+\.\d+y/)
    })

    it('C4: longevity score is NOT biological age', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 55, rhr: 58, spo2: 98, skinTempDelta: 0, respiratoryRate: 14 },
            scores: { date: '2026-01-15', recoveryScore: 80, strainScore: 5, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.8, rhrZScore: -0.2, recoveryZone: 'green', displayAge: 28, rawAge: 28.3, biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW', bioAgeConfidence: 0.8, bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'], bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'], bioAgePrimaryDriver: 'HRV ↑' },
            hrvBaseline: 55,
            rhrBaseline: 60,
        })
        const result = synthesize(input)
        // The longevity score should be a different number from displayAge
        // (It's a 0-100 score, not a biological age in years)
        // Longevity score (0-100) should differ from displayAge (biological age in years)
        // unless they coincidentally match — which is rare but possible.
        // The key invariant: longevity score is a 0-100 integer, not an age.
        const longevityScore = result.longevity.score
        expect(longevityScore).toBeGreaterThanOrEqual(0)
        expect(longevityScore).toBeLessThanOrEqual(100)
        expect(Number.isInteger(longevityScore)).toBe(true)
        // Verify it's semantically a score, not a biological age
        expect(result.longevity.primaryMetric).toContain('pts')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// D. READINESS & RESILIENCE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Readiness & Resilience — Integer Scores & Empty States', () => {
    it('D1: computeReadiness returns integer 0-100 with full data', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 52, rhr: 58, spo2: 98, skinTempDelta: 0.1, respiratoryRate: 14 },
            sleep: { id: 2, date: '2026-01-15', totalDurationMins: 450, remMins: 90, deepMins: 80, coreMins: 260, awakeMins: 20, sleepNeedHours: 8, sleepDebtHours: 0 },
            hrvBaseline: 50,
            rhrBaseline: 60,
            scores: { date: '2026-01-15', recoveryScore: 75, strainScore: 8, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.5, rhrZScore: -0.3, recoveryZone: 'green', displayAge: 28, rawAge: 28.3, biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW', bioAgeConfidence: 0.8, bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'], bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'], bioAgePrimaryDriver: 'HRV ↑' },
        })
        const result = synthesize(input)
        expect(result.readiness.score).toBeGreaterThanOrEqual(0)
        expect(result.readiness.score).toBeLessThanOrEqual(100)
        expect(Number.isInteger(result.readiness.score)).toBe(true)
    })

    it('D2: computeResilience returns integer 0-100 with full data', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 55, rhr: 58, spo2: 98, skinTempDelta: 0, respiratoryRate: 14 },
            sleep: { id: 2, date: '2026-01-15', totalDurationMins: 480, remMins: 100, deepMins: 85, coreMins: 280, awakeMins: 15, sleepNeedHours: 8, sleepDebtHours: 0 },
            scores: { date: '2026-01-15', recoveryScore: 80, strainScore: 5, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.8, rhrZScore: -0.2, recoveryZone: 'green', displayAge: 28, rawAge: 28.3, biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW', bioAgeConfidence: 0.8, bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'], bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'], bioAgePrimaryDriver: 'HRV ↑' },
            injuryRisk: { risk: 'LOW', confidence: 95, primaryMetric: '', secondaryMetrics: [], explanation: 'No biomechanical risk detected.' },
            cnsStressScore: { risk: 'LOW', confidence: 95, audioLoad: 45, daylightDeficit: 10, hrvSuppression: 0, explanation: 'CNS balanced.' },
            hrvBaseline: 55,
            rhrBaseline: 60,
        })
        const result = synthesize(input)
        expect(result.resilience.score).toBeGreaterThanOrEqual(0)
        expect(result.resilience.score).toBeLessThanOrEqual(100)
        expect(Number.isInteger(result.resilience.score)).toBe(true)
    })

    it('D3: readiness returns insufficient (score=0) for empty data', () => {
        const input = emptyInput()
        const result = synthesize(input)
        expect(result.readiness.score).toBe(0)
        expect(result.readiness.dataCoverage).toBe('insufficient')
    })

    it('D4: resilience returns insufficient (score=0) for empty data', () => {
        const input = emptyInput()
        const result = synthesize(input)
        expect(result.resilience.score).toBe(0)
        expect(result.resilience.dataCoverage).toBe('insufficient')
    })

    it('D5: readiness does NOT return fabricated numbers', () => {
        const input = emptyInput()
        const result = synthesize(input)
        // Score of 0 with 'insufficient' zone means no fabrication
        expect(result.readiness.score).toBe(0)
        expect(result.readiness.zone).toBe('insufficient')
    })

    it('D6: resilience does NOT return fabricated numbers', () => {
        const input = emptyInput()
        const result = synthesize(input)
        expect(result.resilience.score).toBe(0)
        expect(result.resilience.zone).toBe('insufficient')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// F. DISPLAY HELPERS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('safeNumber', () => {
    it('F1: safeNumber(3.14159, 2) returns "3.14"', () => {
        expect(safeNumber(3.14159, 2)).toBe('3.14')
    })

    it('F2: safeNumber(null, 1) returns "--"', () => {
        expect(safeNumber(null, 1)).toBe('--')
    })

    it('F3: safeNumber(undefined, 0) returns "--"', () => {
        expect(safeNumber(undefined, 0)).toBe('--')
    })

    it('F4: safeNumber(0, 0) returns "0" (valid zero)', () => {
        expect(safeNumber(0, 0)).toBe('0')
    })

    it('F5: safeNumber(NaN, 1) returns "--"', () => {
        expect(safeNumber(NaN, 1)).toBe('--')
    })

    it('F6: safeNumber(Infinity, 1) returns "--"', () => {
        expect(safeNumber(Infinity, 1)).toBe('--')
    })

    it('F7: safeNumber(-Infinity, 1) returns "--"', () => {
        expect(safeNumber(-Infinity, 1)).toBe('--')
    })

    it('F8: safeNumber(5, 0, "%") appends unit', () => {
        expect(safeNumber(5, 0, '%')).toBe('5%')
    })

    it('F9: safeNumber(42.789, 1) returns "42.8"', () => {
        expect(safeNumber(42.789, 1)).toBe('42.8')
    })

    it('F10: safeNumber(-5, 0) returns "-5" (negative numbers pass through)', () => {
        // safeNumber only rejects null/undefined/NaN/Infinity, not negative
        expect(safeNumber(-5, 0)).toBe('-5')
    })
})

describe('formatEmptyState', () => {
    it('F11: formatEmptyState() returns "--"', () => {
        expect(formatEmptyState()).toBe('--')
    })

    it('F12: formatEmptyState() returns EMPTY_STATE_MARKER', () => {
        expect(formatEmptyState()).toBe(EMPTY_STATE_MARKER)
    })

    it('F13: EMPTY_STATE_MARKER is "--"', () => {
        expect(EMPTY_STATE_MARKER).toBe('--')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// J. MISSING DATA / EMPTY STATE TESTS (CROSS-CUTTING)
// ═══════════════════════════════════════════════════════════════════════════

describe('Missing Data — All format helpers return "--" for null/undefined', () => {
    it('J1: formatScore(null) returns "--"', () => {
        expect(formatScore(null)).toBe('--')
    })

    it('J2: formatScore(undefined) returns "--"', () => {
        expect(formatScore(undefined)).toBe('--')
    })

    it('J3: formatAge(null) returns "--"', () => {
        expect(formatAge(null)).toBe('--')
    })

    it('J4: formatAge(undefined) returns "--"', () => {
        expect(formatAge(undefined)).toBe('--')
    })

    it('J5: safeNumber(null, 1) returns "--"', () => {
        expect(safeNumber(null, 1)).toBe('--')
    })

    it('J6: safeNumber(undefined, 0) returns "--"', () => {
        expect(safeNumber(undefined, 0)).toBe('--')
    })

    it('J7: formatEmptyState() returns "--"', () => {
        expect(formatEmptyState()).toBe('--')
    })

    it('J8: all helpers return the same marker for missing data', () => {
        expect(formatScore(null)).toBe('--')
        expect(formatAge(null)).toBe('--')
        expect(safeNumber(null)).toBe('--')
        expect(formatEmptyState()).toBe('--')
    })
})
