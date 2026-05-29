export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'sleep-performance';

export interface SleepPerformanceInput {
  totalDurationMins: number
  remMins: number
  deepMins: number
  coreMins: number
  awakeMins: number
  sleepNeedHours: number
  sleepDebtHours: number
}

export function computeSleepPerformance(input: SleepPerformanceInput): number {
  const actualHours = input.totalDurationMins / 60
  const neededHours = input.sleepNeedHours

  const durationScore = Math.min(1, actualHours / neededHours)

  const sleepTime = input.remMins + input.deepMins + input.coreMins
  if (sleepTime === 0) return 0

  const remRatio = input.remMins / sleepTime
  const deepRatio = input.deepMins / sleepTime

  const idealRem = 0.22
  const idealDeep = 0.17

  const remScore = 1 - Math.min(1, Math.abs(remRatio - idealRem) / idealRem)
  const deepScore = 1 - Math.min(1, Math.abs(deepRatio - idealDeep) / idealDeep)

  let sleepQuality = (remScore * 0.35 + deepScore * 0.35 + durationScore * 0.3) * 100

  if (input.sleepDebtHours > 2) sleepQuality *= 0.85
  else if (input.sleepDebtHours > 1) sleepQuality *= 0.92

  const awakeRatio = input.awakeMins / input.totalDurationMins
  if (awakeRatio > 0.1) sleepQuality *= 0.9

  return Math.round(Math.min(100, Math.max(0, sleepQuality)))
}
