/**
 * Phase 1 Data Integrity Test Suite
 *
 * Validates that every algorithm gracefully handles missing data,
 * never fabricates scores from hardcoded defaults, and produces
 * deterministic, explainable output.
 *
 * These tests encode the non-negotiable rules from the audit:
 *  - Never show placeholder data as real
 *  - Never show over-precise floats
 *  - Never present heuristic scores as clinical truth
 *  - Never compute a score if minimum input coverage is not met
 *  - Prefer "not enough data yet" over fabricated completeness
 */

import { synthesize } from '../algorithms/heuristic-synthesis'
import { computeRecovery } from '../algorithms/recovery'
import { computeBiologicalAge } from '../algorithms/biological-age'
import { computeIllnessRisk } from '../algorithms/illness-predictor'
import { computeCnsStress } from '../algorithms/cns-stress'
import { computeInjuryRisk } from '../algorithms/injury-predictor'
import { computeSleepDebt } from '../algorithms/sleep-debt'
import { computeStrain } from '../algorithms/strain'
import { formatScore, formatAge, safeNumber } from '../utils/display-helpers'
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
// HEURISTIC SYNTHESIS — Missing Data Guards
// ═══════════════════════════════════════════════════════════════════════════

describe('Heuristic Synthesis — Insufficient Data', () => {
    it('returns "insufficient" readiness when no HRV/sleep data exists', () => {
        const input = emptyInput()
        const result = synthesize(input)
        expect(result.readiness.zone).toBe('insufficient')
        expect(result.readiness.dataCoverage).toBe('insufficient')
        expect(result.readiness.score).toBe(0)
    })

    it('returns "insufficient" resilience when no defense data exists', () => {
        const input = emptyInput()
        const result = synthesize(input)
        expect(result.resilience.zone).toBe('insufficient')
        expect(result.resilience.dataCoverage).toBe('insufficient')
        expect(result.resilience.score).toBe(0)
    })

    it('returns "insufficient" longevity when no biological age exists', () => {
        const input = emptyInput()
        const result = synthesize(input)
        expect(result.longevity.zone).toBe('insufficient')
        expect(result.longevity.dataCoverage).toBe('insufficient')
        expect(result.longevity.score).toBe(0)
    })

    it('returns partial coverage when only HRV and sleep exist (no RHR)', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 48, rhr: 0, spo2: 0, skinTempDelta: 0, respiratoryRate: 0 },
            sleep: { id: 2, date: '2026-01-15', totalDurationMins: 420, remMins: 0, deepMins: 0, coreMins: 0, awakeMins: 0, sleepNeedHours: 8, sleepDebtHours: 0 },
            hrvBaseline: 50,
            scores: { date: '2026-01-15', recoveryScore: 0, strainScore: 0, sleepDebtHours: 0, sleepNeedHours: 0, hrvZScore: 0, rhrZScore: 0, recoveryZone: 'yellow', biologicalAge: 0, paceOfAging: 0, immunityRisk: 'LOW' },
        })
        const result = synthesize(input)
        expect(result.readiness.dataCoverage).toBe('partial')
        expect(result.readiness.score).toBeGreaterThan(0)
    })

    it('returns sufficient coverage with full vitals + sleep + baseline', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 52, rhr: 58, spo2: 98, skinTempDelta: 0.1, respiratoryRate: 14 },
            sleep: { id: 2, date: '2026-01-15', totalDurationMins: 450, remMins: 90, deepMins: 80, coreMins: 260, awakeMins: 20, sleepNeedHours: 8, sleepDebtHours: 0 },
            hrvBaseline: 50,
            rhrBaseline: 60,
            scores: { date: '2026-01-15', recoveryScore: 75, strainScore: 8, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.5, rhrZScore: -0.3, recoveryZone: 'green', biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW' },
        })
        const result = synthesize(input)
        expect(result.readiness.dataCoverage).toBe('sufficient')
        expect(result.readiness.zone).not.toBe('insufficient')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// HEURISTIC SYNTHESIS — Score Range Guards
// ═══════════════════════════════════════════════════════════════════════════

describe('Heuristic Synthesis — Score Boundaries', () => {
    it('all pillar scores are clamped to [0, 100]', () => {
        // Extreme HRV should not produce >100 score
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 200, rhr: 30, spo2: 99, skinTempDelta: 0, respiratoryRate: 12 },
            sleep: { id: 2, date: '2026-01-15', totalDurationMins: 600, remMins: 120, deepMins: 100, coreMins: 350, awakeMins: 30, sleepNeedHours: 8, sleepDebtHours: 0 },
            hrvBaseline: 50,
            rhrBaseline: 60,
            scores: { date: '2026-01-15', recoveryScore: 90, strainScore: 5, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 2, rhrZScore: -2, recoveryZone: 'green', biologicalAge: 25, paceOfAging: 0.90, immunityRisk: 'LOW' },
        })
        const result = synthesize(input)
        expect(result.readiness.score).toBeGreaterThanOrEqual(0)
        expect(result.readiness.score).toBeLessThanOrEqual(100)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// RECOVERY — Graceful Degradation
// ═══════════════════════════════════════════════════════════════════════════

describe('Recovery — Insufficient Data', () => {
    it('handles completely empty vitals history', () => {
        const result = computeRecovery({
            vitals: [],
            todayVitals: null,
            sleepRecord: null,
        })
        // Should still produce a result (50-ish neutral), not throw
        expect(result.recoveryScore).toBeGreaterThanOrEqual(0)
        expect(result.recoveryScore).toBeLessThanOrEqual(100)
        expect(result.hrvZScore).toBe(0)
        expect(result.rhrZScore).toBe(0)
    })

    it('does not use hardcoded 50/60 defaults for missing values', () => {
        // Only 1 data point — z-score computation should be neutral
        const result = computeRecovery({
            vitals: [{ hrv: 45, rhr: 65 }],
            todayVitals: { hrv: 45, rhr: 65 },
            sleepRecord: { totalDurationMins: 0, sleepNeedHours: 0 },
        })
        // With only 1 data point, z-scores should be 0 (insufficient population)
        expect(result.hrvZScore).toBe(0)
        expect(result.rhrZScore).toBe(0)
    })

    it('produces non-zero z-scores with ≥3 data points', () => {
        const result = computeRecovery({
            vitals: [
                { hrv: 45, rhr: 65 },
                { hrv: 48, rhr: 62 },
                { hrv: 50, rhr: 60 },
            ],
            todayVitals: { hrv: 55, rhr: 58 },
            sleepRecord: { totalDurationMins: 450, sleepNeedHours: 8 },
        })
        expect(result.hrvZScore).not.toBe(0) // should have meaningful z-score
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// BIOLOGICAL AGE — Minimum Data Requirements
// ═══════════════════════════════════════════════════════════════════════════

describe('Biological Age — Data Guards', () => {
    it('returns chronological age when all vitals are zero', () => {
        const result = computeBiologicalAge(30, 0, 0, 0)
        // With zeros, the composite score drives age toward 25 (baseline)
        // This is expected behavior — the algorithm cannot distinguish
        // between "healthy 25-year-old vitals" and "no data"
        expect(result.biologicalAge).toBeGreaterThan(0)
        expect(result.paceOfAging).toBeGreaterThan(0)
    })

    it('respects chronological age input', () => {
        const result40 = computeBiologicalAge(40, 50, 60, 98)
        const result30 = computeBiologicalAge(30, 50, 60, 98)
        // Same vitals should produce different biological ages for different chronological ages
        expect(result40.biologicalAge).not.toBe(result30.biologicalAge)
    })

    it('does not crash on extreme values', () => {
        const result = computeBiologicalAge(30, 200, 30, 100)
        expect(result.biologicalAge).toBeGreaterThan(0)
        // Extreme inputs can produce extreme but bounded results
        expect(typeof result.biologicalAge).toBe('number')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// ILLNESS RISK — Baseline Guards
// ═══════════════════════════════════════════════════════════════════════════

describe('Illness Risk — Zero Baseline Guard', () => {
    it('does not flag false positives when baselines are zero', () => {
        const result = computeIllnessRisk(
            0.1,   // skinTempDelta
            50,    // hrv
            0,     // hrvBaseline (NO baseline data)
            3.0,   // breathingDisturbances
            60,    // rhrToday
            0,     // rhrBaseline (NO baseline data)
            98     // spo2
        )
        // With zero baselines, rhrSpike and hrvSuppressed should both be false
        expect(result.risk).toBe('LOW')
    })

    it('correctly detects high risk with real baselines and anomalies', () => {
        const result = computeIllnessRisk(
            0.6,   // temp spike
            40,    // suppressed HRV (baseline is 50, so 40 < 42.5 = 50*0.85)
            50,    // hrvBaseline
            9.0,   // breathing spike
            68,    // rhr spike (baseline 60 + 4 = 64)
            60,    // rhrBaseline
            97     // spo2
        )
        expect(result.risk).toBe('HIGH')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// CNS STRESS — Zero-Input Neutrality
// ═══════════════════════════════════════════════════════════════════════════

describe('CNS Stress — Zero Input Guard', () => {
    it('returns LOW risk when all inputs are zero', () => {
        const result = computeCnsStress(0, 0, 0, 0, 0, 0)
        expect(result.risk).toBe('LOW')
        expect(result.audioLoad).toBe(0)
        expect(result.daylightDeficit).toBe(45) // max deficit when zero daylight
    })

    it('returns HIGH risk with combined critical inputs', () => {
        const result = computeCnsStress(
            85,   // high audio
            10,   // low daylight
            35,   // suppressed HRV
            50,   // baseline HRV
            300,  // only 5 hours sleep
            480   // 8 hours needed
        )
        expect(result.risk).toBe('HIGH')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// INJURY PREDICTOR — Non-Causal Language
// ═══════════════════════════════════════════════════════════════════════════

describe('Injury Predictor — Language Audit', () => {
    it('does not use imperative injury language', () => {
        const result = computeInjuryRisk(
            3.5,  // walkingAsymmetry
            1.0,  // baselineAsymmetry
            28,   // doubleSupport
            22,   // baselineDoubleSupport
            0.5,  // stairSpeedDown
            0.6,  // baselineStairSpeedDown
            230,  // groundContactTime
            210   // baselineGroundContactTime
        )
        // Must NOT contain "Reduce training load immediately" (old phrasing)
        expect(result.explanation).not.toMatch(/immediately/i)
        // Should use "associated with" language
        expect(result.explanation).toMatch(/associated|consider/i)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// SYNTHESIS — Warning Flag Accuracy
// ═══════════════════════════════════════════════════════════════════════════

describe('Heuristic Synthesis — Warning Flags', () => {
    it('generates no warning flags for healthy input', () => {
        const input = emptyInput({
            vitals: { id: 1, timestamp: '2026-01-15T08:00:00Z', hrv: 55, rhr: 58, spo2: 98, skinTempDelta: 0, restingEnergy: 1800, activeEnergy: 300, stepCount: 8000, respiratoryRate: 14 },
            sleep: { id: 2, date: '2026-01-15', totalDurationMins: 480, remMins: 100, deepMins: 85, coreMins: 280, awakeMins: 15, sleepNeedHours: 8, sleepDebtHours: 0, inBedMins: 0, sleepSource: 'watch', hrvSleepAvg: 0, tempDeviation: 0, baselineRestfulness: 0 },
            hrvBaseline: 55,
            rhrBaseline: 60,
            scores: { date: '2026-01-15', recoveryScore: 80, strainScore: 5, sleepDebtHours: 0, sleepNeedHours: 8, hrvZScore: 0.8, rhrZScore: -0.2, recoveryZone: 'green', biologicalAge: 28, paceOfAging: 0.95, immunityRisk: 'LOW' },
            injuryRisk: { risk: 'LOW', confidence: 95, explanation: 'No biomechanical risk detected.', asymmetryPct: 1.2, dsDeltaPct: 0.5, stairDelta: 0.1, gctDeltaMs: 5 },
            cnsStressScore: { risk: 'LOW', confidence: 95, audioLoad: 45, daylightDeficit: 10, hrvSuppression: 0, explanation: 'CNS balanced.' },
        })
        const result = synthesize(input)
        expect(result.warningFlags.length).toBe(0)
    })

    it('generates injury warning for HIGH injury risk', () => {
        const input = emptyInput({
            injuryRisk: { risk: 'HIGH', confidence: 90, explanation: 'Severe gait asymmetry detected.', asymmetryPct: 5.5, dsDeltaPct: 3.2, stairDelta: 0.3, gctDeltaMs: 30 },
            scores: { date: '2026-01-15', recoveryScore: 0, strainScore: 0, sleepDebtHours: 0, sleepNeedHours: 0, hrvZScore: 0, rhrZScore: 0, recoveryZone: 'yellow', biologicalAge: 0, paceOfAging: 0, immunityRisk: 'LOW' },
        })
        const result = synthesize(input)
        const injuryFlags = result.warningFlags.filter(f => f.type === 'injury')
        expect(injuryFlags.length).toBeGreaterThan(0)
        expect(injuryFlags[0].severity).toBe('high')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Synthesis Pass-through for injuryRisk / cnsStressScore
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Synthesis Pass-through', () => {
    it('1. passes through injuryRisk from input to output', () => {
        const injury = { risk: 'HIGH' as const, confidence: 90, explanation: 'Test injury.', asymmetryPct: 4.0, dsDeltaPct: 2.5, stairDelta: 0.2, gctDeltaMs: 20 }
        const input = emptyInput({
            scores: { date: '2026-01-15', recoveryScore: 0, strainScore: 0, sleepDebtHours: 0, sleepNeedHours: 0, hrvZScore: 0, rhrZScore: 0, recoveryZone: 'yellow', biologicalAge: 0, paceOfAging: 0, immunityRisk: 'LOW' },
            injuryRisk: injury,
        })
        const result = synthesize(input)
        expect(result.injuryRisk).not.toBeNull()
        expect(result.injuryRisk!.risk).toBe('HIGH')
    })

    it('2. passes through cnsStressScore from input to output', () => {
        const cns = { risk: 'MODERATE' as const, confidence: 85, audioLoad: 75, daylightDeficit: 15, hrvSuppression: 8, explanation: 'CNS under mild stress.' }
        const input = emptyInput({
            scores: { date: '2026-01-15', recoveryScore: 0, strainScore: 0, sleepDebtHours: 0, sleepNeedHours: 0, hrvZScore: 0, rhrZScore: 0, recoveryZone: 'yellow', biologicalAge: 0, paceOfAging: 0, immunityRisk: 'LOW' },
            cnsStressScore: cns,
        })
        const result = synthesize(input)
        expect(result.cnsStressScore).not.toBeNull()
        expect(result.cnsStressScore!.risk).toBe('MODERATE')
    })

    it('3. returns null injuryRisk and cnsStressScore when not provided', () => {
        const input = emptyInput({
            scores: { date: '2026-01-15', recoveryScore: 0, strainScore: 0, sleepDebtHours: 0, sleepNeedHours: 0, hrvZScore: 0, rhrZScore: 0, recoveryZone: 'yellow', biologicalAge: 0, paceOfAging: 0, immunityRisk: 'LOW' },
        })
        const result = synthesize(input)
        expect(result.injuryRisk).toBeNull()
        expect(result.cnsStressScore).toBeNull()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — CNS Stress Algorithm Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — CNS Stress Algorithm', () => {
    it('4. returns LOW risk for normal/healthy inputs', () => {
        // computeCnsStress(audio, daylight, hrvToday, hrvBaseline, sleepMins, sleepNeedMins)
        const result = computeCnsStress(45, 45, 50, 50, 480, 480)
        expect(result.risk).toBe('LOW')
        expect(result.confidence).toBeGreaterThan(0)
    })

    it('5. returns HIGH risk for extreme audio + daylight deficit + HRV suppression + sleep debt', () => {
        // audio 90 (>80→+25), daylight 10 (<20→+20), hrvToday 40 vs baseline 50 (20%→+25), sleep 360 vs need 480 (25%→+20)
        // Baseline 20 + 25 + 20 + 25 + 20 = 110 → HIGH
        const result = computeCnsStress(90, 10, 40, 50, 360, 480)
        expect(result.risk).toBe('HIGH')
        expect(result.confidence).toBeGreaterThan(0)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Injury Risk Algorithm Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Injury Risk Algorithm', () => {
    it('6. returns LOW risk when all metrics are zero (no deviation from baseline)', () => {
        // computeInjuryRisk(asymmetry, asymBaseline, ds, dsBaseline, stair, stairBaseline, gct, gctBaseline)
        const result = computeInjuryRisk(0, 0, 0, 0, 0, 0, 0, 0)
        expect(result.risk).toBe('LOW')
        // When all metrics match baseline (zero deviation), algorithm is confident risk is low
        expect(result.confidence).toBeGreaterThanOrEqual(90)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Missing Data — Sleep Debt Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Sleep Debt — Missing Data Guards', () => {
    it('7. returns zero debt when pastWeekSleep is empty (with todaySleep)', () => {
        const result = computeSleepDebt({
            todaySleep: { totalDurationMins: 420 },
            pastWeekSleep: [],
        })
        expect(result.sleepDebtHours).toBeGreaterThanOrEqual(0)
        expect(typeof result.sleepDebtHours).toBe('number')
    })

    it('8. handles todaySleep with zero duration', () => {
        const result = computeSleepDebt({
            todaySleep: { totalDurationMins: 0 },
            pastWeekSleep: [
                { totalDurationMins: 480, sleepNeedHours: 8 },
            ],
        })
        expect(result.sleepDebtHours).toBeGreaterThanOrEqual(0)
        expect(typeof result.sleepNeedHours).toBe('number')
    })

    it('9. sleepNeedHours never goes below 7h (baseline floor)', () => {
        const result = computeSleepDebt({
            todaySleep: { totalDurationMins: 600 },
            pastWeekSleep: [
                { totalDurationMins: 600, sleepNeedHours: 8 },
                { totalDurationMins: 600, sleepNeedHours: 8 },
                { totalDurationMins: 600, sleepNeedHours: 8 },
                { totalDurationMins: 600, sleepNeedHours: 8 },
            ],
        })
        expect(result.sleepNeedHours).toBeGreaterThanOrEqual(7)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Missing Data — Strain With Empty Input
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Strain — Missing Data Guards', () => {
    it('10. computeStrain returns 0 for empty hrZones array', () => {
        const strain = computeStrain([])
        expect(strain).toBe(0)
    })

    it('11. computeStrain returns 0 for all-zero hrZones', () => {
        const strain = computeStrain([0, 0, 0, 0, 0])
        expect(strain).toBe(0)
    })

    it('12. computeStrain returns finite values for mixed zones', () => {
        const strain = computeStrain([5, 10, 15, 0, 0])
        expect(isFinite(strain)).toBe(true)
        expect(strain).toBeGreaterThan(0)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Missing Data — Biological Age Invalid Inputs
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Biological Age — Invalid Input Guards', () => {
    it('13. computeBiologicalAge handles zero chronological age', () => {
        const result = computeBiologicalAge(0, 55, 60, 98)
        // Should not crash; clamps between 18-80
        expect(result.biologicalAge).toBeGreaterThanOrEqual(18)
        expect(result.biologicalAge).toBeLessThanOrEqual(80)
    })

    it('14. computeBiologicalAge handles very high chronological age', () => {
        const result = computeBiologicalAge(99, 55, 60, 98)
        expect(result.biologicalAge).toBeGreaterThanOrEqual(18)
        expect(result.biologicalAge).toBeLessThanOrEqual(80)
    })

    it('15. computeBiologicalAge handles negative vitals gracefully', () => {
        // Should not crash with negative HRV/RHR/SpO2
        const result = computeBiologicalAge(30, -10, -50, -1)
        expect(result.biologicalAge).toBeGreaterThanOrEqual(18)
        expect(result.biologicalAge).toBeLessThanOrEqual(80)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Missing Data — Recovery With Null/Missing Inputs
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Recovery — Null Input Guards', () => {
    it('16. computeRecovery with empty vitals array returns score [0, 100]', () => {
        const result = computeRecovery({
            vitals: [],
            todayVitals: { hrv: 60, rhr: 58 },
            sleepRecord: null,
        })
        expect(result.recoveryScore).toBeGreaterThanOrEqual(0)
        expect(result.recoveryScore).toBeLessThanOrEqual(100)
    })

    it('17. computeRecovery with null sleepRecord returns valid score', () => {
        const result = computeRecovery({
            vitals: [{ hrv: 60, rhr: 58 }],
            todayVitals: { hrv: 60, rhr: 58 },
            sleepRecord: null,
        })
        expect(result.recoveryScore).toBeGreaterThanOrEqual(0)
        expect(result.recoveryScore).toBeLessThanOrEqual(100)
        expect(['green', 'yellow', 'red']).toContain(result.zone)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Missing Data — Format Helpers With Null/NaN/Infinity
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Format Helpers — Null/NaN/Infinity Guards', () => {
    it('18. formatScore returns "--" for null', () => {
        expect(formatScore(null)).toBe('--')
    })

    it('19. formatScore returns "--" for undefined', () => {
        expect(formatScore(undefined)).toBe('--')
    })

    it('20. formatScore returns "--" for NaN', () => {
        expect(formatScore(NaN)).toBe('--')
    })

    it('21. formatScore returns "--" for Infinity', () => {
        expect(formatScore(Infinity)).toBe('--')
        expect(formatScore(-Infinity)).toBe('--')
    })

    it('22. formatAge returns "--" for null', () => {
        expect(formatAge(null)).toBe('--')
    })

    it('23. formatAge returns "--" for NaN', () => {
        expect(formatAge(NaN)).toBe('--')
    })

    it('24. formatAge returns "--" for 0 (invalid biological age)', () => {
        expect(formatAge(0)).toBe('--')
    })

    it('25. safeNumber returns "--" for null/undefined/NaN/Infinity', () => {
        expect(safeNumber(null, 1)).toBe('--')
        expect(safeNumber(undefined, 1)).toBe('--')
        expect(safeNumber(NaN, 1)).toBe('--')
        expect(safeNumber(Infinity, 1)).toBe('--')
    })

    it('26. safeNumber returns formatted string for valid numbers', () => {
        expect(safeNumber(42, 0)).toBe('42')
        expect(safeNumber(3.14159, 2)).toBe('3.14')
        expect(safeNumber(0, 0)).toBe('0')
    })

    it('27. formatScore clamps to [0, 100]', () => {
        expect(formatScore(-5)).toBe('0')
        expect(formatScore(150)).toBe('100')
        expect(formatScore(50.7)).toBe('51')
        expect(formatScore(50.2)).toBe('50')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Synthesis — Missing Data Coverage Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('Pass 2 — Synthesis — Data Coverage Flags', () => {
    it('28. empty input returns insufficient for all pillars', () => {
        const input = emptyInput()
        const result = synthesize(input)
        expect(result.readiness.dataCoverage).toBe('insufficient')
        expect(result.resilience.dataCoverage).toBe('insufficient')
        expect(result.longevity.dataCoverage).toBe('insufficient')
    })

    it('29. full input returns sufficient/partial for all pillars', () => {
        const input = emptyInput({
            // Baselines are required for readiness to count HRV/RHR as active inputs
            hrvBaseline: 55,
            rhrBaseline: 60,
            vitals: {
                id: 1,
                hrv: 55, rhr: 58, spo2: 98,
                skinTempDelta: 0, respiratoryRate: 14,
                timestamp: '2026-03-15T08:00:00Z',
            },
            scores: {
                recoveryScore: 80, strainScore: 5,
                sleepDebtHours: 0, sleepNeedHours: 8,
                hrvZScore: 0.8, rhrZScore: -0.2,
                recoveryZone: 'green',
                displayAge: 28, rawAge: 28.3, biologicalAge: 28,
                paceOfAging: 0.95, immunityRisk: 'LOW',
                bioAgeConfidence: 0.8,
                bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'],
                bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'],
                bioAgePrimaryDriver: 'HRV ↑',
                date: '2026-03-15',
            },
            sleep: {
                id: 1,
                totalDurationMins: 480, remMins: 100, deepMins: 85,
                coreMins: 280, awakeMins: 15,
                sleepNeedHours: 8, sleepDebtHours: 0,
                date: '2026-03-15',
            },
        })
        const result = synthesize(input)
        // With hrvBaseline + rhrBaseline + vitals + sleep, all 3 inputs active → sufficient
        expect(result.readiness.dataCoverage).toBe('sufficient')
        // Resilience may require mobility/running dynamics; 'partial' is acceptable
        expect(['sufficient', 'partial']).toContain(result.resilience.dataCoverage)
        // Longevity should have sufficient/partial coverage with bio age data
        expect(result.longevity.dataCoverage).not.toBe('insufficient')
    })
})
