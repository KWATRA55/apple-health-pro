export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'sleep-debt';

import type { SleepDebtResult } from '../types'

const BASELINE_SLEEP_NEED = 8

interface SleepInput {
  todaySleep?: { totalDurationMins: number } | null
  pastWeekSleep: { totalDurationMins: number; sleepNeedHours?: number }[]
}

export function computeSleepDebt(input: SleepInput): SleepDebtResult {
  const { todaySleep, pastWeekSleep } = input

  let accumulatedDebtHours = 0
  for (const record of pastWeekSleep) {
    const actualHours = record.totalDurationMins / 60
    const neededHours = record.sleepNeedHours || BASELINE_SLEEP_NEED
    accumulatedDebtHours += Math.max(0, neededHours - actualHours)
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
