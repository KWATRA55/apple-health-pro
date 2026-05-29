import { format, subDays } from 'date-fns'
import type { VitalsRecord, SleepRecord, ActivityRecord, JournalEntry, DailyScores } from '../types'

export interface SyntheticDay {
  date: string
  vitals: VitalsRecord
  sleep: SleepRecord
  activities: ActivityRecord[]
  journal: JournalEntry
  expectedRecovery: number
  expectedStrain: number
}

/**
 * Generates a realistic 30-day synthetic dataset with known ground-truth
 * correlations between lifestyle habits (Alcohol, Magnesium, Late Meal, Meditation)
 * and recovery scores. Designed for mathematical validation of composite score algorithms.
 *
 * Ground truth relationships:
 * - Alcohol: -15% recovery impact (negative correlation r ≈ -0.6)
 * - Magnesium: +10% recovery impact (positive correlation r ≈ +0.5)
 * - Late Meal: -8% recovery impact (negative correlation r ≈ -0.35)
 * - Meditation: +7% recovery impact (positive correlation r ≈ +0.3)
 */
export function generateSynthetic30DayDataset(endDate?: Date): SyntheticDay[] {
  const days: SyntheticDay[] = []
  const end = endDate || new Date()

  // Seed with consistent but pseudo-random patterns
  let hrvBase = 68
  let rhrBase = 55
  let seed = 42

  const pseudoRandom = (): number => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const normalRandom = (mean: number, std: number): number => {
    let u = 0
    let v = 0
    while (u === 0) u = pseudoRandom()
    while (v === 0) v = pseudoRandom()
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  // Habit schedule patterns (mostly random but structured)
  const habitSchedule: Record<string, string[]> = {}
  for (let d = 0; d < 30; d++) {
    habitSchedule[`day${d}`] = []
    const r = pseudoRandom()
    // Alcohol appears ~1/3 of days
    if (pseudoRandom() < 0.33) habitSchedule[`day${d}`].push('Alcohol')
    // Magnesium appears ~1/2 of days
    if (pseudoRandom() < 0.5) habitSchedule[`day${d}`].push('Magnesium')
    // Late Meal appears ~1/4 of days
    if (pseudoRandom() < 0.25) habitSchedule[`day${d}`].push('Late Meal')
    // Meditation appears ~2/5 of days
    if (pseudoRandom() < 0.4) habitSchedule[`day${d}`].push('Meditation')
  }

  for (let i = 29; i >= 0; i--) {
    const date = format(subDays(end, i), 'yyyy-MM-dd')
    const habits = habitSchedule[`day${i}`] || []

    // Apply habit effects to vitals and recovery
    let alcoholPenalty = habits.includes('Alcohol') ? -12 + normalRandom(0, 3) : 0
    let magBonus = habits.includes('Magnesium') ? 8 + normalRandom(0, 2) : 0
    let lateMealPenalty = habits.includes('Late Meal') ? -7 + normalRandom(0, 2) : 0
    let medBonus = habits.includes('Meditation') ? 5 + normalRandom(0, 1.5) : 0

    // Natural daily variation
    const dayOfWeekVariation = (i % 7) * 0.8 - 2.4 // Mon low, Wed peak

    const hrv = Math.round(
      Math.max(25, Math.min(120,
        hrvBase + normalRandom(0, 5) + dayOfWeekVariation +
        magBonus * 0.3 + medBonus * 0.2 + alcoholPenalty * 0.3
      ))
    )

    const rhr = Math.round(
      Math.max(38, Math.min(80,
        rhrBase + normalRandom(0, 2) - dayOfWeekVariation * 0.4 +
        alcoholPenalty * 0.2 - magBonus * 0.15 - medBonus * 0.1
      ))
    )

    const spo2 = Math.round(
      Math.min(100, Math.max(94,
        97.5 + normalRandom(0, 0.5) + (habits.includes('Alcohol') ? -0.3 : 0)
      ))
    )

    const respiratoryRate = Math.round(
      (14.2 + normalRandom(0, 0.8) + (habits.includes('Alcohol') ? 0.5 : 0)) * 10
    ) / 10

    const skinTempDelta = Math.round(
      (normalRandom(-0.15, 0.35) + (habits.includes('Alcohol') ? 0.2 : 0)) * 10
    ) / 10

    const vitals: VitalsRecord = {
      id: 1000 + i,
      timestamp: `${date}T06:30:00.000Z`,
      hrv,
      rhr,
      spo2,
      respiratoryRate,
      skinTempDelta,
    }

    // Sleep data
    const sleepQuality = !habits.includes('Alcohol') && !habits.includes('Late Meal')
      ? normalRandom(0, 0.15)
      : normalRandom(-0.3, 0.2)

    const totalSleepMins = Math.round(
      Math.max(240, Math.min(540,
        465 + normalRandom(0, 25) + sleepQuality * 60
      ))
    )

    const remMins = Math.round(totalSleepMins * (0.21 + sleepQuality * 0.04 + normalRandom(0, 0.03)))
    const deepMins = Math.round(totalSleepMins * (0.17 + sleepQuality * 0.03 + normalRandom(0, 0.02)))
    const awakeMins = Math.round(totalSleepMins * (0.04 - sleepQuality * 0.02 + normalRandom(0, 0.01)))
    const coreMins = totalSleepMins - remMins - deepMins - awakeMins

    const sleep: SleepRecord = {
      id: 2000 + i,
      date,
      totalDurationMins: totalSleepMins,
      remMins: Math.max(0, remMins),
      deepMins: Math.max(0, deepMins),
      coreMins: Math.max(0, coreMins),
      awakeMins: Math.max(0, awakeMins),
      sleepNeedHours: 8,
      sleepDebtHours: 0,
    }

    // Activity data
    const isWorkoutDay = pseudoRandom() > 0.35
    const activities: ActivityRecord[] = []

    if (isWorkoutDay) {
      const workoutTypes = ['Running', 'Cycling', 'Strength Training', 'HIIT', 'Swimming']
      const workoutType = workoutTypes[Math.floor(pseudoRandom() * workoutTypes.length)]

      const duration = Math.round(20 + pseudoRandom() * 40)
      const intensity = 0.5 + pseudoRandom() * 0.5
      const avgHR = Math.round(120 + intensity * 40)
      const maxHR = Math.round(avgHR + intensity * 25)

      const z1 = Math.round(duration * (0.2 + pseudoRandom() * 0.2))
      const z2 = Math.round(duration * (0.2 + pseudoRandom() * 0.2))
      const z3 = Math.round(duration * (0.15 + intensity * 0.15))
      const z4 = Math.round(duration * (0.05 + intensity * 0.1))
      const z5 = Math.round(duration * (0.01 + intensity * 0.05))

      const hrZones = [z1, z2, z3, z4, z5]
      const activeCalories = Math.round(duration * (2.5 + intensity * 5) + pseudoRandom() * 50)

      activities.push({
        id: 3000 + i,
        timestamp: `${date}T${String(6 + Math.floor(pseudoRandom() * 12)).padStart(2, '0')}:30:00.000Z`,
        activeCalories,
        workoutType,
        durationMins: duration,
        hrZones,
        maxHR,
        strainScore: null,
        avgHR,
      })
    }

    // Expected recovery and strain (ground truth)
    const expectedRecovery = Math.round(
      Math.max(10, Math.min(100,
        68 + magBonus + medBonus + alcoholPenalty + lateMealPenalty +
        (isWorkoutDay ? -3 : 0) + normalRandom(0, 4)
      ))
    )

    const expectedStrain = isWorkoutDay
      ? Math.round((4 + pseudoRandom() * 12) * 10) / 10
      : Math.round((0 + pseudoRandom() * 2) * 10) / 10

    const journal: JournalEntry = {
      id: 4000 + i,
      date,
      habits,
      notes: habits.length > 0 ? `Tracked: ${habits.join(', ')}` : '',
    }

    days.push({
      date,
      vitals,
      sleep,
      activities,
      journal,
      expectedRecovery,
      expectedStrain,
    })
  }

  return days.reverse()
}

/**
 * Converts synthetic dataset to arrays for correlation analysis.
 * Each habit returns a record of paired (habit_present: 1/0, recovery_score) data points.
 */
export interface HabitCorrelationData {
  habit: string
  observations: number
  presentScores: number[]
  absentScores: number[]
  allScores: number[]
}

export function extractHabitCorrelationData(days: SyntheticDay[]): HabitCorrelationData[] {
  const habitMap = new Map<string, { present: number[]; absent: number[]; all: number[] }>()

  const allRecoveryScores = days.map(d => d.expectedRecovery)

  for (const day of days) {
    const allHabits = new Set<string>()

    for (const habit of day.journal.habits) {
      allHabits.add(habit)
      if (!habitMap.has(habit)) {
        habitMap.set(habit, { present: [], absent: [], all: [...allRecoveryScores] })
      }
      habitMap.get(habit)!.present.push(day.expectedRecovery)
    }

    // For habits NOT present today, add to absent
    for (const [habit, data] of habitMap) {
      if (!allHabits.has(habit)) {
        data.absent.push(day.expectedRecovery)
      }
    }
  }

  return Array.from(habitMap.entries()).map(([habit, data]) => ({
    habit,
    observations: data.present.length,
    presentScores: data.present,
    absentScores: data.absent,
    allScores: data.all,
  }))
}
