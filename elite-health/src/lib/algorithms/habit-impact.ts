export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'habit-impact';

/**
 * Multi-dimensional habit impact engine.
 * Correlates journal habits, workout timing, daylight, audio, and strain
 * with next-day biometric outcomes: HRV, RHR, Recovery, Sleep Duration, Sleep Quality.
 */

import { pearsonCorrelation, type CorrelationResult } from './pearson-correlation'

export interface HabitDataPoint {
  date: string
  habits: string[]
  recoveryScore: number
}

export interface HabitInsight {
  habit: string
  avgImpactPercent: number
  direction: 'positive' | 'negative'
}

/** A single day's aligned data: today's behaviors → tomorrow's biometrics */
export interface PairedDay {
  date: string
  /** Journal habits logged today */
  habits: string[]
  /** Workout end hour (24h float), null if no workout */
  workoutEndHour: number | null
  /** Workout type (e.g. 'running', 'cycling') */
  workoutType: string | null
  /** Minutes of daylight exposure today */
  daylightMins: number
  /** Headphone audio level (dB) today */
  audioLevel: number
  /** Today's strain score */
  strainScore: number

  /** Next-day biometrics */
  nextDayHrv: number
  nextDayRhr: number
  nextDayRecovery: number
  nextDaySleepMins: number
  nextDaySleepEfficiency: number
}

export interface MultiMetricInsight {
  /** Label for the behavior/factor */
  factor: string
  /** Category for grouping */
  category: 'habit' | 'workout_timing' | 'workout_type' | 'daylight' | 'audio' | 'strain'
  /** Direction of the association */
  direction: 'positive' | 'negative'
  /** Which biometric metric this impacts */
  impactedMetric: string
  /** Pearson correlation result */
  correlation: CorrelationResult
  /** Average percent difference when habit present vs absent */
  avgImpactPercent: number
  /** Plain-language description */
  description: string
}

/**
 * Computes the impact of specific habits on recovery scores the following day.
 * @param records Array of historical habit data points with the *next day's* recovery score
 */
export function computeHabitImpact(records: HabitDataPoint[]): HabitInsight[] {
  const habitImpacts: Record<string, number[]> = {}

  // Baseline average recovery (of days with no habits or all days)
  const allScores = records.map(r => r.recoveryScore)
  const baselineAvg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 50

  records.forEach(record => {
    record.habits.forEach(habit => {
      if (!habitImpacts[habit]) {
        habitImpacts[habit] = []
      }
      habitImpacts[habit].push(record.recoveryScore)
    })
  })

  const insights: HabitInsight[] = []

  for (const [habit, scores] of Object.entries(habitImpacts)) {
    if (scores.length < 3) continue // Need at least 3 occurrences to form an insight

    const avgScoreWithHabit = scores.reduce((a, b) => a + b, 0) / scores.length
    const diff = avgScoreWithHabit - baselineAvg
    const percentImpact = (diff / baselineAvg) * 100

    insights.push({
      habit,
      avgImpactPercent: Math.round(percentImpact),
      direction: percentImpact >= 0 ? 'positive' : 'negative',
    })
  }

  // Sort by highest magnitude impact
  return insights.sort((a, b) => Math.abs(b.avgImpactPercent) - Math.abs(a.avgImpactPercent))
}

/**
 * Build paired-day dataset from state arrays.
 * Each row: today's behaviors → next-day's biometrics.
 */
export function buildPairedDays(input: {
  journalEntries: { date: string; habits: string[] }[]
  activities: { timestamp: string; workoutType: string; durationMins: number }[]
  environmental: { date: string; timeInDaylight: number; headphoneAudio: number }[]
  scores: { date: string; recoveryScore: number; strainScore: number }[]
  vitals: { timestamp: string; hrv: number; rhr: number }[]
  sleep: { date: string; totalDurationMins: number; remMins: number; deepMins: number; coreMins: number }[]
}): PairedDay[] {
  const { journalEntries, activities, environmental, scores, vitals, sleep } = input

  // Index by date
  const journalsByDate = new Map<string, string[]>()
  for (const j of journalEntries) {
    journalsByDate.set(j.date, j.habits)
  }

  // Workout: group by date, get latest end hour & type
  const workoutByDate = new Map<string, { endHour: number; type: string }>()
  for (const a of activities) {
    const date = a.timestamp.slice(0, 10)
    const hour = parseInt(a.timestamp.slice(11, 13), 10) + a.durationMins / 60
    const existing = workoutByDate.get(date)
    if (!existing || hour > existing.endHour) {
      workoutByDate.set(date, { endHour: hour, type: a.workoutType })
    }
  }

  const envByDate = new Map<string, { daylight: number; audio: number }>()
  for (const e of environmental) {
    envByDate.set(e.date, { daylight: e.timeInDaylight, audio: e.headphoneAudio })
  }

  const scoresByDate = new Map<string, { recovery: number; strain: number }>()
  for (const s of scores) {
    scoresByDate.set(s.date, { recovery: s.recoveryScore, strain: s.strainScore })
  }

  const vitalsByDate = new Map<string, { hrv: number; rhr: number }>()
  for (const v of vitals) {
    const date = v.timestamp.slice(0, 10)
    if (!vitalsByDate.has(date)) {
      vitalsByDate.set(date, { hrv: v.hrv, rhr: v.rhr })
    }
  }

  const sleepByDate = new Map<string, { duration: number; efficiency: number }>()
  for (const s of sleep) {
    sleepByDate.set(s.date, {
      duration: s.totalDurationMins,
      efficiency: s.totalDurationMins > 0
        ? ((s.remMins + s.deepMins + s.coreMins) / s.totalDurationMins) * 100
        : 0,
    })
  }

  // Collect all unique dates
  const allDates = new Set<string>()
  for (const d of journalEntries) allDates.add(d.date)
  for (const d of scores) allDates.add(d.date)
  const sorted = [...allDates].sort()

  const paired: PairedDay[] = []

  for (let i = 0; i < sorted.length - 1; i++) {
    const today = sorted[i]
    const tomorrow = sorted[i + 1]

    const habits = journalsByDate.get(today) ?? []
    const workout = workoutByDate.get(today)
    const env = envByDate.get(today)
    const score = scoresByDate.get(today)
    const nextVitals = vitalsByDate.get(tomorrow)
    const nextSleep = sleepByDate.get(tomorrow)
    const nextScore = scoresByDate.get(tomorrow)

    // Need at least next-day biometrics
    if (!nextVitals && !nextSleep && !nextScore) continue

    paired.push({
      date: today,
      habits,
      workoutEndHour: workout?.endHour ?? null,
      workoutType: workout?.type ?? null,
      daylightMins: env?.daylight ?? 0,
      audioLevel: env?.audio ?? 0,
      strainScore: score?.strain ?? 0,
      nextDayHrv: nextVitals?.hrv ?? 0,
      nextDayRhr: nextVitals?.rhr ?? 0,
      nextDayRecovery: nextScore?.recovery ?? 0,
      nextDaySleepMins: nextSleep?.duration ?? 0,
      nextDaySleepEfficiency: nextSleep?.efficiency ?? 0,
    })
  }

  return paired
}

const METRIC_LABELS: Record<string, string> = {
  nextDayHrv: 'HRV',
  nextDayRhr: 'Resting HR',
  nextDayRecovery: 'Recovery',
  nextDaySleepMins: 'Sleep Duration',
  nextDaySleepEfficiency: 'Sleep Efficiency',
}

const METRIC_DIRECTION: Record<string, 'higherIsBetter' | 'lowerIsBetter'> = {
  nextDayHrv: 'higherIsBetter',
  nextDayRhr: 'lowerIsBetter',
  nextDayRecovery: 'higherIsBetter',
  nextDaySleepMins: 'higherIsBetter',
  nextDaySleepEfficiency: 'higherIsBetter',
}

/**
 * Compute correlation between a binary factor (present/absent) and a numeric metric.
 */
function binaryCorrelation(
  days: PairedDay[],
  getValue: (d: PairedDay) => number,
  isPresent: (d: PairedDay) => boolean,
): CorrelationResult {
  const x: number[] = []
  const y: number[] = []
  for (const d of days) {
    const val = getValue(d)
    if (val === 0) continue
    x.push(isPresent(d) ? 1 : 0)
    y.push(val)
  }
  return pearsonCorrelation(x, y)
}

/**
 * Compute correlation between a continuous factor and a numeric metric.
 */
function continuousCorrelation(
  days: PairedDay[],
  getX: (d: PairedDay) => number,
  getY: (d: PairedDay) => number,
): CorrelationResult {
  const x: number[] = []
  const y: number[] = []
  for (const d of days) {
    const xv = getX(d)
    const yv = getY(d)
    if (xv === 0 && yv === 0) continue
    x.push(xv)
    y.push(yv)
  }
  return pearsonCorrelation(x, y)
}

/**
 * Compute the average percent impact of a binary factor.
 */
function binaryImpactPercent(days: PairedDay[], getValue: (d: PairedDay) => number, isPresent: (d: PairedDay) => boolean): number {
  const withHabit: number[] = []
  const withoutHabit: number[] = []
  for (const d of days) {
    const v = getValue(d)
    if (v === 0) continue
    if (isPresent(d)) withHabit.push(v)
    else withoutHabit.push(v)
  }
  if (withHabit.length < 2 || withoutHabit.length < 2) return 0
  const avgWith = withHabit.reduce((a, b) => a + b, 0) / withHabit.length
  const avgWithout = withoutHabit.reduce((a, b) => a + b, 0) / withoutHabit.length
  if (avgWithout === 0) return 0
  return Math.round(((avgWith - avgWithout) / avgWithout) * 100)
}

/**
 * Main correlation engine: takes paired days and produces multi-metric insights.
 */
export function computeCorrelationInsights(days: PairedDay[]): MultiMetricInsight[] {
  if (days.length < 5) return []

  const insights: MultiMetricInsight[] = []

  // --- 1. Journal habits → all 5 metrics ---
  const allHabits = new Set<string>()
  for (const d of days) d.habits.forEach(h => allHabits.add(h))

  const metricGetters: Array<{ key: string; fn: (d: PairedDay) => number }> = [
    { key: 'nextDayHrv', fn: d => d.nextDayHrv },
    { key: 'nextDayRhr', fn: d => d.nextDayRhr },
    { key: 'nextDayRecovery', fn: d => d.nextDayRecovery },
    { key: 'nextDaySleepMins', fn: d => d.nextDaySleepMins },
    { key: 'nextDaySleepEfficiency', fn: d => d.nextDaySleepEfficiency },
  ]

  for (const habit of allHabits) {
    const isPresent = (d: PairedDay) => d.habits.includes(habit)
    const daysWithHabit = days.filter(isPresent)
    if (daysWithHabit.length < 3) continue

    for (const { key, fn } of metricGetters) {
      const corr = binaryCorrelation(days, fn, isPresent)
      if (corr.significance === 'none') continue

      const impact = binaryImpactPercent(days, fn, isPresent)
      const dir = METRIC_DIRECTION[key]
      const effectivePositive =
        dir === 'higherIsBetter' ? corr.direction === 'positive' : corr.direction === 'negative'

      insights.push({
        factor: habit,
        category: 'habit',
        direction: effectivePositive ? 'positive' : 'negative',
        impactedMetric: METRIC_LABELS[key],
        correlation: corr,
        avgImpactPercent: impact,
        description:
          impact !== 0
            ? `${habit} → ${METRIC_LABELS[key]} ${impact > 0 ? '+' : ''}${impact}% (r=${corr.r.toFixed(2)})`
            : `${habit} ↔ ${METRIC_LABELS[key]} (r=${corr.r.toFixed(2)}, weak effect)`,
      })
    }
  }

  // --- 2. Workout timing (evening >18h vs morning ≤12h) → HRV, Sleep ---
  const eveningWorkoutDays = days.filter(d => d.workoutEndHour !== null && d.workoutEndHour > 18)
  const morningWorkoutDays = days.filter(d => d.workoutEndHour !== null && d.workoutEndHour <= 12)
  if (eveningWorkoutDays.length >= 3 && morningWorkoutDays.length >= 3) {
    const isEvening = (d: PairedDay) => d.workoutEndHour !== null && d.workoutEndHour > 18
    for (const { key, fn } of metricGetters.filter(m => m.key === 'nextDayHrv' || m.key === 'nextDaySleepMins' || m.key === 'nextDaySleepEfficiency')) {
      const corr = binaryCorrelation(days.filter(d => d.workoutEndHour !== null), fn, isEvening)
      if (corr.significance === 'none') continue
      const impact = binaryImpactPercent(days.filter(d => d.workoutEndHour !== null), fn, isEvening)
      const dir = METRIC_DIRECTION[key]
      const effectivePositive = dir === 'higherIsBetter' ? corr.direction === 'positive' : corr.direction === 'negative'

      insights.push({
        factor: 'Evening Workouts (after 6PM)',
        category: 'workout_timing',
        direction: effectivePositive ? 'positive' : 'negative',
        impactedMetric: METRIC_LABELS[key],
        correlation: corr,
        avgImpactPercent: impact,
        description:
          impact < 0
            ? `Evening workouts reduce ${METRIC_LABELS[key]} by ${Math.abs(impact)}% (r=${corr.r.toFixed(2)})`
            : `Evening workouts → ${METRIC_LABELS[key]} ${impact > 0 ? '+' : ''}${impact}% (r=${corr.r.toFixed(2)})`,
      })
    }
  }

  // --- 3. Daylight exposure → HRV, Sleep ---
  const highDaylightDays = days.filter(d => d.daylightMins >= 30)
  const lowDaylightDays = days.filter(d => d.daylightMins < 30 && d.daylightMins > 0)
  if (highDaylightDays.length >= 3 && lowDaylightDays.length >= 3) {
    const isHighDaylight = (d: PairedDay) => d.daylightMins >= 30
    for (const { key, fn } of metricGetters.filter(m => m.key === 'nextDayHrv' || m.key === 'nextDaySleepMins' || m.key === 'nextDaySleepEfficiency')) {
      const corr = binaryCorrelation(days.filter(d => d.daylightMins > 0), fn, isHighDaylight)
      if (corr.significance === 'none') continue
      const impact = binaryImpactPercent(days.filter(d => d.daylightMins > 0), fn, isHighDaylight)
      const dir = METRIC_DIRECTION[key]
      const effectivePositive = dir === 'higherIsBetter' ? corr.direction === 'positive' : corr.direction === 'negative'

      insights.push({
        factor: 'Morning Sunlight (30+ min)',
        category: 'daylight',
        direction: effectivePositive ? 'positive' : 'negative',
        impactedMetric: METRIC_LABELS[key],
        correlation: corr,
        avgImpactPercent: impact,
        description:
          impact > 0
            ? `Morning sunlight boosts ${METRIC_LABELS[key]} by ${impact}% (r=${corr.r.toFixed(2)})`
            : `Morning sunlight → ${METRIC_LABELS[key]} ${impact}% (r=${corr.r.toFixed(2)})`,
      })
    }
  }

  // --- 4. High audio exposure → Sleep ---
  const loudDays = days.filter(d => d.audioLevel > 75)
  const quietDays = days.filter(d => d.audioLevel <= 75 && d.audioLevel > 0)
  if (loudDays.length >= 3 && quietDays.length >= 3) {
    const isLoud = (d: PairedDay) => d.audioLevel > 75
    for (const { key, fn } of metricGetters.filter(m => m.key === 'nextDaySleepMins' || m.key === 'nextDaySleepEfficiency')) {
      const corr = binaryCorrelation(days.filter(d => d.audioLevel > 0), fn, isLoud)
      if (corr.significance === 'none') continue
      const impact = binaryImpactPercent(days.filter(d => d.audioLevel > 0), fn, isLoud)

      insights.push({
        factor: 'High Audio Exposure (>75dB)',
        category: 'audio',
        direction: corr.direction === 'positive' ? 'positive' : 'negative',
        impactedMetric: METRIC_LABELS[key],
        correlation: corr,
        avgImpactPercent: impact,
        description:
          impact < 0
            ? `Loud environments reduce ${METRIC_LABELS[key]} by ${Math.abs(impact)}% (r=${corr.r.toFixed(2)})`
            : `Audio exposure → ${METRIC_LABELS[key]} ${impact}% (r=${corr.r.toFixed(2)})`,
      })
    }
  }

  // --- 5. High strain (>12) → next-day HRV suppression ---
  const highStrainDays = days.filter(d => d.strainScore > 12)
  const lowStrainDays = days.filter(d => d.strainScore <= 12 && d.strainScore > 0)
  if (highStrainDays.length >= 3 && lowStrainDays.length >= 3) {
    const isHigh = (d: PairedDay) => d.strainScore > 12
    for (const { key, fn } of metricGetters.filter(m => m.key === 'nextDayHrv' || m.key === 'nextDayRecovery')) {
      const corr = binaryCorrelation(days.filter(d => d.strainScore > 0), fn, isHigh)
      if (corr.significance === 'none') continue
      const impact = binaryImpactPercent(days.filter(d => d.strainScore > 0), fn, isHigh)

      insights.push({
        factor: 'High Strain Days (>12)',
        category: 'strain',
        direction: corr.direction === 'positive' ? 'positive' : 'negative',
        impactedMetric: METRIC_LABELS[key],
        correlation: corr,
        avgImpactPercent: impact,
        description:
          impact < 0
            ? `High strain suppresses next-day ${METRIC_LABELS[key]} by ${Math.abs(impact)}% (r=${corr.r.toFixed(2)})`
            : `High strain → ${METRIC_LABELS[key]} ${impact}% (r=${corr.r.toFixed(2)})`,
      })
    }
  }

  // Sort by |r| magnitude (strongest correlations first)
  return insights.sort((a, b) => Math.abs(b.correlation.r) - Math.abs(a.correlation.r))
}

/**
 * Convert MultiMetricInsight[] to CorrelationInsight[] for the existing UI.
 */
export function toCorrelationInsights(
  insights: MultiMetricInsight[],
): import('../../lib/types').CorrelationInsight[] {
  return insights.map(i => ({
    habit: `${i.factor} → ${i.impactedMetric}`,
    avgImpactPercent: i.avgImpactPercent,
    direction: i.direction,
    r: i.correlation.r,
    r2: i.correlation.r2,
    significance: i.correlation.significance,
    observations: i.correlation.n,
  }))
}
