import type { SleepDebtResult, SleepRecord } from '@/lib/types'

const BASELINE_SLEEP_NEED = 8

interface SleepInput {
  todaySleep?: { totalDurationMins: number } | null
  pastWeekSleep: { totalDurationMins: number; sleepNeedHours?: number }[]
}

export function computeSleepDebtFromData(input: SleepInput): SleepDebtResult {
  const { todaySleep, pastWeekSleep } = input

  let accumulatedDebtHours = 0

  for (const record of pastWeekSleep) {
    const actualHours = record.totalDurationMins / 60
    const neededHours = record.sleepNeedHours || BASELINE_SLEEP_NEED
    const dailyShortfall = Math.max(0, neededHours - actualHours)
    accumulatedDebtHours += dailyShortfall
  }

  const avgDailyDebt = pastWeekSleep.length > 0 ? accumulatedDebtHours / pastWeekSleep.length : 0
  const adjustedNeedHours = BASELINE_SLEEP_NEED + avgDailyDebt * 0.5

  return {
    sleepNeedHours: Math.round(adjustedNeedHours * 10) / 10,
    sleepDebtHours: Math.round(accumulatedDebtHours * 10) / 10,
    baselineHours: BASELINE_SLEEP_NEED,
    totalSleepMins: todaySleep?.totalDurationMins ?? 0,
  }
}

export function getSleepQualityScore(remMins: number, deepMins: number, totalMins: number): number {
  if (totalMins === 0) return 0
  const remRatio = remMins / totalMins
  const deepRatio = deepMins / totalMins

  const remScore = remRatio >= 0.2 && remRatio <= 0.25 ? 1 : Math.max(0, 1 - Math.abs(remRatio - 0.225) * 5)
  const deepScore = deepRatio >= 0.15 && deepRatio <= 0.20 ? 1 : Math.max(0, 1 - Math.abs(deepRatio - 0.175) * 5)

  return Math.round((remScore * 0.5 + deepScore * 0.5) * 100)
}
