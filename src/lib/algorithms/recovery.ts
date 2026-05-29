import { zScorePopulation, clamp } from '@/lib/utils/z-score'
import type { RecoveryResult, VitalsRecord, SleepRecord } from '@/lib/types'

interface RecoveryInput {
  vitals: { hrv: number; rhr: number }[]
  todayVitals?: { hrv: number; rhr: number } | null
  sleepRecord?: { totalDurationMins: number; sleepNeedHours: number } | null
}

export function computeRecoveryFromData(input: RecoveryInput): RecoveryResult {
  const { vitals, todayVitals, sleepRecord } = input

  const hrvValues = vitals.filter(v => v.hrv > 0).map(v => v.hrv)
  const rhrValues = vitals.filter(v => v.rhr > 0).map(v => v.rhr)

  const currentHRV = todayVitals?.hrv ?? (hrvValues.length > 0 ? hrvValues[hrvValues.length - 1] : 50)
  const currentRHR = todayVitals?.rhr ?? (rhrValues.length > 0 ? rhrValues[rhrValues.length - 1] : 60)

  const { z: zHRV } = zScorePopulation(hrvValues.length >= 3 ? hrvValues : [currentHRV], currentHRV)
  const { z: zRHR } = zScorePopulation(rhrValues.length >= 3 ? rhrValues : [currentRHR], currentRHR)

  let sleepQualityFactor = 0.5
  if (sleepRecord && sleepRecord.sleepNeedHours > 0) {
    const actualHours = sleepRecord.totalDurationMins / 60
    const neededHours = sleepRecord.sleepNeedHours
    const sleepRatio = Math.min(actualHours / neededHours, 2)
    sleepQualityFactor = 1 / (1 + Math.exp(-4 * (sleepRatio - 0.85)))
  }

  const normalizedHRV = clamp((zHRV + 2) / 4, 0, 1)
  const normalizedRHR = clamp((-zRHR + 2) / 4, 0, 1)

  const rawScore = (normalizedHRV * 0.5 + normalizedRHR * 0.3 + sleepQualityFactor * 0.2) * 100
  const recoveryScore = clamp(Math.round(rawScore), 0, 100)

  let zone: 'green' | 'yellow' | 'red' = 'yellow'
  if (recoveryScore >= 67) zone = 'green'
  else if (recoveryScore <= 33) zone = 'red'

  return {
    recoveryScore,
    hrvZScore: Math.round(zHRV * 100) / 100,
    rhrZScore: Math.round(zRHR * 100) / 100,
    zone,
    sleepQualityFactor: Math.round(sleepQualityFactor * 100) / 100,
  }
}
