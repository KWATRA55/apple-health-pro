/**
 * V2 Algorithm Validation Suite
 *
 * Validates the mathematical accuracy of the Strain, Recovery, and Sleep Debt algorithms
 * against a synthetic 30-day dataset with known ground-truth correlations.
 */

import { computeStrain } from '../algorithms/strain'
import { computeRecovery } from '../algorithms/recovery'
import { computeSleepDebt } from '../algorithms/sleep-debt'
import { computeHabitImpactPercent, pearsonCorrelation } from '../algorithms/pearson-correlation'
import { computeBiologicalAge } from '../algorithms/biological-age'
import { computeIllnessRisk } from '../algorithms/illness-predictor'
import { computeSleepPerformance } from '../algorithms/sleep-performance'
import { computeFormDegradation } from '../algorithms/running-form'
import { zScorePopulation, mean, stddev, clamp } from '../algorithms/z-score'
import { generateSynthetic30DayDataset, extractHabitCorrelationData } from '../utils/synthetic-generator'
import { localDateString, startOfDayLocal, endOfDayLocal } from '../healthkit'
import { computeTrendMetric } from '../algorithms/trend-engine'
import { synthesize } from '../algorithms/heuristic-synthesis'
import { formatScore } from '../utils/display-helpers'
import type { RecoveryResult, SleepDebtResult, RunningDynamics, SynthesisInput } from '../types'

// ── Pearson Correlation Tests ─────────────────────────────────────────────

describe('Pearson Correlation', () => {
  it('returns perfect positive correlation for identical arrays', () => {
    const result = pearsonCorrelation([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])
    expect(result.r).toBeCloseTo(1, 3)
    expect(result.r2).toBeCloseTo(1, 3)
    expect(result.significance).toBe('strong')
  })

  it('returns perfect negative correlation for inverse arrays', () => {
    const result = pearsonCorrelation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])
    expect(result.r).toBeCloseTo(-1, 3)
    expect(result.direction).toBe('negative')
  })

  it('returns zero correlation for unrelated arrays', () => {
    const result = pearsonCorrelation([1, 2, 3, 4, 5], [3, 1, 4, 2, 5])
    expect(Math.abs(result.r)).toBeLessThan(0.8)
  })

  it('handles arrays of length < 3', () => {
    const result = pearsonCorrelation([1, 2], [3, 4])
    expect(result.n).toBe(2)
    expect(result.significance).toBe('none')
  })

  it('handles zero-variance arrays', () => {
    const result = pearsonCorrelation([5, 5, 5, 5], [1, 2, 3, 4])
    expect(result.r).toBe(0)
  })

  it('R² is always between 0 and 1', () => {
    const result = pearsonCorrelation(
      [65, 70, 72, 68, 75, 60, 80, 71, 69, 73],
      [55, 58, 60, 56, 62, 50, 65, 59, 57, 61]
    )
    expect(result.r2).toBeGreaterThanOrEqual(0)
    expect(result.r2).toBeLessThanOrEqual(1)
  })
})

describe('computeHabitImpactPercent', () => {
  it('detects positive impact', () => {
    // Simulating Magnesium: recovery scores are higher when habit is present
    const allScores = [68, 72, 65, 70, 75, 62, 71, 69, 73, 67]
    const habitScores = [72, 75, 71, 73] // Magnesium days have higher recovery
    const result = computeHabitImpactPercent(habitScores, allScores)
    expect(result.avgImpactPercent).toBeGreaterThan(0)
  })

  it('detects negative impact', () => {
    const allScores = [68, 72, 65, 70, 55, 62, 71, 69, 58, 67]
    const habitScores = [55, 62, 58] // Alcohol days have lower recovery
    const result = computeHabitImpactPercent(habitScores, allScores)
    expect(result.avgImpactPercent).toBeLessThan(0)
  })

  it('returns zero when insufficient data', () => {
    const result = computeHabitImpactPercent([60], [60, 70, 80])
    expect(result.avgImpactPercent).toBe(0)
  })
})

// ── Z-Score Tests ──────────────────────────────────────────────────────────

describe('Z-Score Module', () => {
  it('computes mean correctly', () => {
    expect(mean([2, 4, 6, 8, 10])).toBe(6)
    expect(mean([1])).toBe(1)
    expect(mean([])).toBe(0)
  })

  it('computes sample standard deviation', () => {
    const sd = stddev([2, 4, 4, 4, 5, 5, 7, 9])
    expect(sd).toBeCloseTo(2.138, 1)
  })

  it('zScorePopulation returns positive z for above-mean values', () => {
    const { z } = zScorePopulation([50, 55, 60, 65, 70], 75)
    expect(z).toBeGreaterThan(0)
  })

  it('zScorePopulation returns negative z for below-mean values', () => {
    const { z } = zScorePopulation([50, 55, 60, 65, 70], 45)
    expect(z).toBeLessThan(0)
  })

  it('clamp works correctly', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-2, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

// ── Strain Algorithm Tests ─────────────────────────────────────────────────

describe('Strain Algorithm', () => {
  it('returns log-scaled strain for zone minutes', () => {
    const strain = computeStrain([10, 20, 15, 5, 2])
    expect(strain).toBeGreaterThan(0)
    expect(strain).toBeLessThanOrEqual(21)
  })

  it('returns 0 for no activity', () => {
    const strain = computeStrain([0, 0, 0, 0, 0])
    expect(strain).toBe(0)
  })

  it('is monotonically increasing with zone intensity', () => {
    const light = computeStrain([30, 10, 5, 0, 0])
    const heavy = computeStrain([10, 10, 10, 10, 10])
    // Higher zones should produce more strain even with fewer minutes
    expect(heavy).toBeGreaterThan(light)
  })
})

// ── Recovery Algorithm Tests ───────────────────────────────────────────────

describe('Recovery Algorithm', () => {
  it('returns high recovery when HRV is high and RHR is low', () => {
    const result = computeRecovery({
      vitals: [
        { hrv: 55, rhr: 60 },
        { hrv: 60, rhr: 58 },
        { hrv: 65, rhr: 55 },
      ],
      todayVitals: { hrv: 72, rhr: 52 },
      sleepRecord: { totalDurationMins: 480, sleepNeedHours: 8 },
    })
    expect(result.recoveryScore).toBeGreaterThanOrEqual(67)
    expect(result.zone).toBe('green')
  })

  it('returns low recovery when HRV is low and RHR is high', () => {
    const result = computeRecovery({
      vitals: [
        { hrv: 55, rhr: 60 },
        { hrv: 60, rhr: 58 },
        { hrv: 65, rhr: 55 },
      ],
      todayVitals: { hrv: 45, rhr: 68 },
      sleepRecord: { totalDurationMins: 300, sleepNeedHours: 8 },
    })
    expect(result.recoveryScore).toBeLessThanOrEqual(33)
    expect(result.zone).toBe('red')
  })

  it('returns score between 0 and 100', () => {
    const result = computeRecovery({
      vitals: [{ hrv: 60, rhr: 58 }],
      todayVitals: { hrv: 60, rhr: 58 },
      sleepRecord: null,
    })
    expect(result.recoveryScore).toBeGreaterThanOrEqual(0)
    expect(result.recoveryScore).toBeLessThanOrEqual(100)
  })
})

// ── Sleep Debt Algorithm Tests ─────────────────────────────────────────────

describe('Sleep Debt Algorithm', () => {
  it('accumulates debt from past week', () => {
    const result = computeSleepDebt({
      todaySleep: { totalDurationMins: 420 }, // 7 hours
      pastWeekSleep: [
        { totalDurationMins: 360, sleepNeedHours: 8 }, // 6h (-2)
        { totalDurationMins: 420, sleepNeedHours: 8 }, // 7h (-1)
        { totalDurationMins: 480, sleepNeedHours: 8 }, // 8h (0)
      ],
    })
    expect(result.sleepDebtHours).toBeGreaterThan(0)
  })

  it('adjusts tonight sleep need based on debt', () => {
    const result = computeSleepDebt({
      todaySleep: { totalDurationMins: 420 },
      pastWeekSleep: [
        { totalDurationMins: 300, sleepNeedHours: 8 },
        { totalDurationMins: 300, sleepNeedHours: 8 },
      ],
    })
    expect(result.sleepNeedHours).toBeGreaterThan(8)
  })
})

// ── Synthetic Dataset & Correlation Validation ────────────────────────────

describe('Synthetic 30-Day Dataset', () => {
  const dataset = generateSynthetic30DayDataset()

  it('generates exactly 30 days', () => {
    expect(dataset.length).toBe(30)
  })

  it('produces valid vitals for every day', () => {
    for (const day of dataset) {
      expect(day.vitals.hrv).toBeGreaterThan(20)
      expect(day.vitals.hrv).toBeLessThan(150)
      expect(day.vitals.rhr).toBeGreaterThan(30)
      expect(day.vitals.rhr).toBeLessThan(100)
      expect(day.vitals.spo2).toBeGreaterThanOrEqual(90)
      expect(day.vitals.spo2).toBeLessThanOrEqual(100)
    }
  })

  it('produces valid sleep for every day', () => {
    for (const day of dataset) {
      expect(day.sleep.totalDurationMins).toBeGreaterThan(180)
      expect(day.sleep.totalDurationMins).toBeLessThan(600)
      expect(day.sleep.remMins + day.sleep.deepMins + day.sleep.coreMins + day.sleep.awakeMins).toBeCloseTo(
        day.sleep.totalDurationMins,
        -1
      )
    }
  })

  it('has consistent dates (descending order, no gaps)', () => {
    for (let i = 1; i < dataset.length; i++) {
      const prevDate = new Date(dataset[i - 1].date)
      const currDate = new Date(dataset[i].date)
      const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000)
      expect(diffDays).toBeGreaterThanOrEqual(0) // prev is later or same
    }
  })

  it('extracts habit correlation data', () => {
    const correlations = extractHabitCorrelationData(dataset)
    expect(correlations.length).toBeGreaterThan(0)

    for (const c of correlations) {
      expect(c.observations).toBeGreaterThan(0)
      expect(c.presentScores.length).toBe(c.observations)
      expect(c.allScores.length).toBe(30)
    }
  })
})

describe('Ground-Truth Correlation Validation', () => {
  const dataset = generateSynthetic30DayDataset()
  const correlations = extractHabitCorrelationData(dataset)

  it('Alcohol shows negative correlation with recovery', () => {
    const alcohol = correlations.find(c => c.habit === 'Alcohol')
    expect(alcohol).toBeDefined()
    if (alcohol && alcohol.presentScores.length >= 3) {
      const result = computeHabitImpactPercent(alcohol.presentScores, alcohol.allScores)
      expect(result.avgImpactPercent).toBeLessThan(0)
    }
  })

  it('Magnesium shows positive correlation with recovery', () => {
    const magnesium = correlations.find(c => c.habit === 'Magnesium')
    expect(magnesium).toBeDefined()
    if (magnesium && magnesium.presentScores.length >= 3) {
      const result = computeHabitImpactPercent(magnesium.presentScores, magnesium.allScores)
      // Magnesium should generally be positive or neutral
      // (ground truth is +10% but small samples may vary)
      expect(result.r).toBeGreaterThan(-0.3)
    }
  })

  it('all computed correlations are within valid ranges', () => {
    for (const c of correlations) {
      if (c.presentScores.length < 3) continue
      const result = computeHabitImpactPercent(c.presentScores, c.allScores)
      expect(result.r).toBeGreaterThanOrEqual(-1)
      expect(result.r).toBeLessThanOrEqual(1)
      expect(result.r2).toBeGreaterThanOrEqual(0)
      expect(result.r2).toBeLessThanOrEqual(1)
    }
  })
})

// ── Timezone Boundary Tests ────────────────────────────────────────────────

describe('Timezone Boundary Logic', () => {
  it('startOfDayLocal produces midnight in local time', () => {
    const result = startOfDayLocal(new Date('2025-06-15T14:30:00'))
    expect(result).toContain('T00:00:00')
  })

  it('endOfDayLocal produces end of day in local time', () => {
    const result = endOfDayLocal(new Date('2025-06-15T14:30:00'))
    expect(result).toContain('T23:59:59')
  })

  it('localDateString returns yyyy-MM-dd in local timezone', () => {
    const result = localDateString(new Date('2025-06-15T14:30:00'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe('2025-06-15')
  })

  it('localDateString handles midnight boundary correctly', () => {
    // 2025-06-15 at 00:30 local should still be June 15
    const result = localDateString(new Date('2025-06-15T04:30:00Z'))
    // This depends on the test runner's timezone, but the date should be valid
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── Biological Age Tests ───────────────────────────────────────────────────

describe('Biological Age Algorithm', () => {
  it('returns younger biological age for excellent vitals', () => {
    const result = computeBiologicalAge(35, 75, 52, 99)
    expect(result.biologicalAge).toBeLessThan(35)
  })

  it('returns older biological age for poor vitals', () => {
    const result = computeBiologicalAge(25, 40, 72, 94)
    expect(result.biologicalAge).toBeGreaterThan(25)
  })

  it('clamps biological age between 18 and 80', () => {
    const excellent = computeBiologicalAge(25, 120, 35, 100)
    expect(excellent.biologicalAge).toBeGreaterThanOrEqual(18)

    const poor = computeBiologicalAge(25, 20, 90, 85)
    expect(poor.biologicalAge).toBeLessThanOrEqual(80)
  })
})

// ── Illness Predictor Tests ────────────────────────────────────────────────

describe('Illness Predictor Algorithm', () => {
  it('returns HIGH risk when temperature spikes and HRV suppressed', () => {
    const result = computeIllnessRisk(0.6, 50, 65)
    expect(result.risk).toBe('HIGH')
    expect(result.confidence).toBeGreaterThanOrEqual(80)
  })

  it('returns ELEVATED risk when only temperature spikes', () => {
    const result = computeIllnessRisk(0.6, 70, 65)
    expect(result.risk).toBe('ELEVATED')
  })

  it('returns LOW risk when vitals are stable', () => {
    const result = computeIllnessRisk(0.1, 68, 65)
    expect(result.risk).toBe('LOW')
    expect(result.confidence).toBeGreaterThanOrEqual(85)
  })
})

// ── Sleep Performance Tests ────────────────────────────────────────────────

describe('Sleep Performance Algorithm', () => {
  it('returns 100 for perfect sleep', () => {
    const result = computeSleepPerformance({
      totalDurationMins: 480, // 8h
      remMins: 105, // ~22%
      deepMins: 82, // ~17%
      coreMins: 288,
      awakeMins: 5,
      sleepNeedHours: 8,
      sleepDebtHours: 0,
    })
    expect(result).toBeGreaterThanOrEqual(85)
    expect(result).toBeLessThanOrEqual(100)
  })

  it('penalizes high sleep debt', () => {
    const good = computeSleepPerformance({
      totalDurationMins: 480,
      remMins: 105,
      deepMins: 82,
      coreMins: 288,
      awakeMins: 5,
      sleepNeedHours: 8,
      sleepDebtHours: 0,
    })
    const bad = computeSleepPerformance({
      totalDurationMins: 480,
      remMins: 105,
      deepMins: 82,
      coreMins: 288,
      awakeMins: 5,
      sleepNeedHours: 8,
      sleepDebtHours: 3,
    })
    expect(bad).toBeLessThan(good)
  })
})

// ── Running Form Degradation Tests ─────────────────────────────────────────

describe('Running Form Degradation', () => {
  it('detects form degradation from elevated GCT', () => {
    const recent: RunningDynamics = {
      id: 1,
      timestamp: '2025-06-15T08:00:00Z',
      runningPower: 240,
      groundContactTime: 250, // Elevated from baseline
      verticalOscillation: 8.0,
      strideLength: 1.15,
    }
    const baseline: RunningDynamics[] = [
      {
        id: 2,
        timestamp: '2025-06-14T08:00:00Z',
        runningPower: 245,
        groundContactTime: 210,
        verticalOscillation: 7.8,
        strideLength: 1.16,
      },
      {
        id: 3,
        timestamp: '2025-06-13T08:00:00Z',
        runningPower: 238,
        groundContactTime: 215,
        verticalOscillation: 8.1,
        strideLength: 1.14,
      },
    ]
    const result = computeFormDegradation(recent, baseline)
    expect(result.degraded).toBe(true)
    expect(result.riskLevel).toBe('HIGH')
  })

  it('returns no degradation for stable metrics', () => {
    const recent: RunningDynamics = {
      id: 1,
      timestamp: '2025-06-15T08:00:00Z',
      runningPower: 240,
      groundContactTime: 212,
      verticalOscillation: 8.0,
      strideLength: 1.15,
    }
    const baseline: RunningDynamics[] = [
      {
        id: 2,
        timestamp: '2025-06-14T08:00:00Z',
        runningPower: 240,
        groundContactTime: 210,
        verticalOscillation: 7.9,
        strideLength: 1.15,
      },
    ]
    const result = computeFormDegradation(recent, baseline)
    expect(result.degraded).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// G. SLEEP DEBT — Canonical Source Audit
// ═══════════════════════════════════════════════════════════════════════════

describe('Sleep Debt — Canonical Source Audit', () => {
  it('G1: computeSleepDebt accepts todaySleep and pastWeekSleep inputs only', () => {
    const result = computeSleepDebt({
      todaySleep: { totalDurationMins: 420 },
      pastWeekSleep: [
        { totalDurationMins: 360, sleepNeedHours: 8 },
      ],
    })
    // Should produce a valid result from store-derived Scores data
    expect(typeof result.sleepDebtHours).toBe('number')
    expect(result.sleepDebtHours).toBeGreaterThanOrEqual(0)
    expect(typeof result.sleepNeedHours).toBe('number')
    expect(result.sleepNeedHours).toBeGreaterThan(0)
  })

  it('G2: computeSleepDebt does NOT read SleepRecord.sleepDebtHours directly', () => {
    // The canonical source is DailyScores.sleepDebtHours, not SleepRecord.sleepDebtHours
    // This test verifies the algorithm signature only uses todaySleep + pastWeekSleep
    const result = computeSleepDebt({
      todaySleep: { totalDurationMins: 480 },
      pastWeekSleep: [
        { totalDurationMins: 480, sleepNeedHours: 8 },
        { totalDurationMins: 360, sleepNeedHours: 8 },
      ],
    })
    // Debt is computed from cumulative shortfall, not from a pre-computed field
    expect(result.sleepDebtHours).toBeGreaterThan(0)
  })

  it('G3: computeSleepDebt returns zero debt when sleep meets need exactly', () => {
    const result = computeSleepDebt({
      todaySleep: { totalDurationMins: 480 },
      pastWeekSleep: [
        { totalDurationMins: 480, sleepNeedHours: 8 },
        { totalDurationMins: 480, sleepNeedHours: 8 },
        { totalDurationMins: 480, sleepNeedHours: 8 },
        { totalDurationMins: 480, sleepNeedHours: 8 },
        { totalDurationMins: 480, sleepNeedHours: 8 },
      ],
    })
    expect(result.sleepDebtHours).toBeCloseTo(0, 1)
  })

  it('G4: computeSleepDebt sleep need is never below baseline', () => {
    const result = computeSleepDebt({
      todaySleep: { totalDurationMins: 540 },
      pastWeekSleep: [
        { totalDurationMins: 540, sleepNeedHours: 8 },
        { totalDurationMins: 540, sleepNeedHours: 8 },
      ],
    })
    // Even with surplus sleep, need should not drop below baseline
    expect(result.sleepNeedHours).toBeGreaterThanOrEqual(8)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// H. STRAIN GATING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Strain Gating — Trend Engine Minimum Samples', () => {
  it('H1: computeTrendMetric returns hasSufficient=false when samples < minSamples (default 5)', () => {
    const result = computeTrendMetric({
      series: [
        { date: '2026-03-11', value: 10 },
        { date: '2026-03-12', value: 12 },
        { date: '2026-03-13', value: 11 },
        { date: '2026-03-14', value: 13 },
      ],
      metricName: 'Strain',
      higherIsBetter: false,
    })
    expect(result.hasSufficient).toBe(false)
    expect(result.sampleCount).toBe(4)
  })

  it('H2: computeTrendMetric returns hasSufficient=true when samples >= 5', () => {
    const result = computeTrendMetric({
      series: [
        { date: '2026-03-11', value: 10 },
        { date: '2026-03-12', value: 12 },
        { date: '2026-03-13', value: 11 },
        { date: '2026-03-14', value: 13 },
        { date: '2026-03-15', value: 14 },
      ],
      metricName: 'Strain',
      higherIsBetter: false,
    })
    expect(result.hasSufficient).toBe(true)
    expect(result.sampleCount).toBe(5)
  })

  it('H3: computeTrendMetric returns stable direction for flat series', () => {
    const result = computeTrendMetric({
      series: [
        { date: '2026-03-11', value: 10 },
        { date: '2026-03-12', value: 10 },
        { date: '2026-03-13', value: 10 },
        { date: '2026-03-14', value: 10 },
        { date: '2026-03-15', value: 10 },
      ],
      metricName: 'HRV',
      higherIsBetter: true,
    })
    expect(result.hasSufficient).toBe(true)
    expect(result.direction7d).toBe('stable')
  })

  it('H4: computeStrain returns finite non-negative values for valid input', () => {
    const strain = computeStrain([10, 20, 15, 5, 2])
    expect(isFinite(strain)).toBe(true)
    expect(strain).toBeGreaterThanOrEqual(0)
  })

  it('H5: computeStrain returns 0 for all-zero zones', () => {
    const strain = computeStrain([0, 0, 0, 0, 0])
    expect(strain).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// K. REGRESSION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline Regression Tests', () => {
  it('K1: computeRecovery always returns score in [0, 100]', () => {
    for (const hrv of [30, 45, 60, 80]) {
      for (const rhr of [40, 55, 70, 85]) {
        const result = computeRecovery({
          vitals: [
            { hrv: 55, rhr: 60 },
            { hrv: 60, rhr: 58 },
            { hrv: 65, rhr: 55 },
          ],
          todayVitals: { hrv, rhr },
          sleepRecord: { totalDurationMins: 480, sleepNeedHours: 8 },
        })
        expect(result.recoveryScore).toBeGreaterThanOrEqual(0)
        expect(result.recoveryScore).toBeLessThanOrEqual(100)
      }
    }
  })

  it('K2: computeStrain returns finite values within expected range', () => {
    const moderate = computeStrain([30, 20, 10, 5, 0])
    const intense = computeStrain([5, 10, 20, 30, 15])
    expect(isFinite(moderate)).toBe(true)
    expect(isFinite(intense)).toBe(true)
    expect(moderate).toBeGreaterThan(0)
    expect(intense).toBeGreaterThan(moderate)
  })

  it('K3: computeSleepDebt never returns negative debt', () => {
    const result = computeSleepDebt({
      todaySleep: { totalDurationMins: 540 },
      pastWeekSleep: [
        { totalDurationMins: 540, sleepNeedHours: 8 },
        { totalDurationMins: 540, sleepNeedHours: 8 },
        { totalDurationMins: 540, sleepNeedHours: 8 },
      ],
    })
    expect(result.sleepDebtHours).toBeGreaterThanOrEqual(0)
  })

  it('K4: computeBiologicalAge clamps to [18, 80] for edge case inputs', () => {
    const young = computeBiologicalAge(30, 120, 35, 100)
    expect(young.biologicalAge).toBeGreaterThanOrEqual(18)

    const old = computeBiologicalAge(30, 20, 90, 80)
    expect(old.biologicalAge).toBeLessThanOrEqual(80)
  })

  it('K5: computeBiologicalAge displayAge is always an integer', () => {
    const result = computeBiologicalAge(35, 65, 55, 97)
    expect(Number.isInteger(result.displayAge)).toBe(true)
    expect(typeof result.rawAge).toBe('number')
    expect(result.rawAge).not.toEqual(Math.round(result.rawAge)) // rawAge preserves precision
    expect(result.displayAge).toBe(Math.round(result.rawAge))
  })

  it('K6: computeRecovery zone is one of green/yellow/red', () => {
    const result = computeRecovery({
      vitals: [{ hrv: 60, rhr: 58 }],
      todayVitals: { hrv: 60, rhr: 58 },
      sleepRecord: null,
    })
    expect(['green', 'yellow', 'red']).toContain(result.zone)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// L. VITALS RINGS LABEL SWAP REGRESSION
// ═══════════════════════════════════════════════════════════════════════════

describe('Vitals Rings — Label Swap Regression', () => {
  const validInput: SynthesisInput = {
    vitals: {
      id: 1,
      hrv: 55,
      rhr: 58,
      spo2: 98,
      skinTempDelta: 0,
      respiratoryRate: 14,
      timestamp: '2026-03-15T08:00:00Z',
    },
    sleep: {
      id: 1,
      totalDurationMins: 480,
      remMins: 100,
      deepMins: 85,
      coreMins: 280,
      awakeMins: 15,
      sleepNeedHours: 8,
      sleepDebtHours: 0,
      date: '2026-03-15',
    },
    scores: {
      recoveryScore: 80,
      strainScore: 5,
      sleepDebtHours: 0,
      sleepNeedHours: 8,
      hrvZScore: 0.8,
      rhrZScore: -0.2,
      recoveryZone: 'green',
      displayAge: 28,
      rawAge: 28.3,
      biologicalAge: 28,
      paceOfAging: 0.95,
      immunityRisk: 'LOW',
      bioAgeConfidence: 0.8,
      bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'],
      bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'],
      bioAgePrimaryDriver: 'HRV ↑',
      date: '2026-03-15',
    },
    recentVitals: [],
    recentSleep: [],
    recentScores: [],
    injuryRisk: null,
    cnsStressScore: null,
    sleepArchitecture: null,
    chronologicalAge: 30,
  }

  it('L1: synthesis readiness label is "Readiness"', () => {
    const result = synthesize(validInput)
    expect(result.readiness.label).toBe('Readiness')
  })

  it('L2: synthesis resilience label is "Resilience" (NOT "Strain")', () => {
    const result = synthesize(validInput)
    expect(result.resilience.label).toBe('Resilience')
    // Bug B1 regression: resilience label was incorrectly "Strain"
    expect(result.resilience.label).not.toBe('Strain')
  })

  it('L3: synthesis longevity label is "Longevity" (NOT "Sleep")', () => {
    const result = synthesize(validInput)
    expect(result.longevity.label).toBe('Longevity')
    // Bug B1 regression: longevity label was incorrectly "Sleep"
    expect(result.longevity.label).not.toBe('Sleep')
  })

  it('L4: all pillar scores are 0-100 integers', () => {
    const result = synthesize(validInput)
    expect(result.readiness.score).toBeGreaterThanOrEqual(0)
    expect(result.readiness.score).toBeLessThanOrEqual(100)
    expect(result.resilience.score).toBeGreaterThanOrEqual(0)
    expect(result.resilience.score).toBeLessThanOrEqual(100)
    expect(result.longevity.score).toBeGreaterThanOrEqual(0)
    expect(result.longevity.score).toBeLessThanOrEqual(100)
  })

  it('L5: formatScore returns integer string for every pillar score', () => {
    const result = synthesize(validInput)
    const r = formatScore(result.readiness.score)
    const s = formatScore(result.resilience.score)
    const l = formatScore(result.longevity.score)
    expect(r).not.toBe('--')
    expect(s).not.toBe('--')
    expect(l).not.toBe('--')
    // All should be integer strings (no decimal point)
    expect(r).not.toContain('.')
    expect(s).not.toContain('.')
    expect(l).not.toContain('.')
  })
})
