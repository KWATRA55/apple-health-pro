export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'recovery';

import { zScorePopulation, clamp } from './z-score'
import type { RecoveryResult } from '../types'

interface RecoveryInput {
  vitals: { hrv: number; rhr: number }[]
  todayVitals?: { hrv: number; rhr: number } | null
  sleepRecord?: { totalDurationMins: number; sleepNeedHours: number } | null
}

export function computeRecovery(input: RecoveryInput): RecoveryResult {
  const { vitals, todayVitals, sleepRecord } = input

  const hrvValues = vitals.filter(v => v.hrv > 0).map(v => v.hrv)
  const rhrValues = vitals.filter(v => v.rhr > 0).map(v => v.rhr)

  // Only compute when we have real data; don't fabricate defaults
  const hasTodayHRV = todayVitals && todayVitals.hrv > 0
  const hasTodayRHR = todayVitals && todayVitals.rhr > 0
  const currentHRV = hasTodayHRV ? todayVitals!.hrv : (hrvValues.length > 0 ? hrvValues[hrvValues.length - 1] : 0)
  const currentRHR = hasTodayRHR ? todayVitals!.rhr : (rhrValues.length > 0 ? rhrValues[rhrValues.length - 1] : 0)

  // Can't compute z-scores without real current values
  const hasHRVData = hrvValues.length >= 3 && currentHRV > 0
  const hasRHRData = rhrValues.length >= 3 && currentRHR > 0

  const { z: zHRV } = hasHRVData ? zScorePopulation(hrvValues, currentHRV) : { z: 0 }
  const { z: zRHR } = hasRHRData ? zScorePopulation(rhrValues, currentRHR) : { z: 0 }

  let sleepQualityFactor = 0.5
  if (sleepRecord && sleepRecord.sleepNeedHours > 0 && sleepRecord.totalDurationMins > 0) {
    const actualHours = sleepRecord.totalDurationMins / 60
    const neededHours = sleepRecord.sleepNeedHours
    const sleepRatio = Math.min(actualHours / neededHours, 2)
    sleepQualityFactor = 1 / (1 + Math.exp(-4 * (sleepRatio - 0.85)))
  }

  // Dynamic weighting: if no HRV/RHR, rely more on sleep
  const hasSleepData = sleepRecord && sleepRecord.totalDurationMins > 0 && sleepRecord.sleepNeedHours > 0
  let hrvWeight = 0.5
  let rhrWeight = 0.3
  let sleepWeight = 0.2

  if (!hasHRVData && !hasRHRData && hasSleepData) {
    hrvWeight = 0; rhrWeight = 0; sleepWeight = 1.0
  } else if (!hasHRVData && hasRHRData) {
    hrvWeight = 0; rhrWeight = 0.6; sleepWeight = 0.4
  } else if (hasHRVData && !hasRHRData) {
    hrvWeight = 0.7; rhrWeight = 0; sleepWeight = 0.3
  }

  const normalizedHRV = hasHRVData ? clamp((zHRV + 2) / 4, 0, 1) : 0.5
  const normalizedRHR = hasRHRData ? clamp((-zRHR + 2) / 4, 0, 1) : 0.5

  const rawScore = (normalizedHRV * hrvWeight + normalizedRHR * rhrWeight + sleepQualityFactor * sleepWeight) * 100
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

export function getRecoveryColor(zone: 'green' | 'yellow' | 'red'): string {
  switch (zone) {
    case 'green': return '#1DB954'
    case 'yellow': return '#FFD700'
    case 'red': return '#FF3B30'
  }
}
