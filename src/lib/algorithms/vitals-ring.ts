import type { VitalsRingData, RingSegment, RecoveryResult } from '@/lib/types'

export function buildVitalsRing(recovery: RecoveryResult): VitalsRingData {
  const segments: RingSegment[] = [
    {
      label: 'HRV',
      value: Math.max(0, Math.min(100, (recovery.hrvZScore + 3) * 16.67)),
      maxValue: 100,
      color: '#34c759',
      percentage: Math.round(Math.max(0, Math.min(100, (recovery.hrvZScore + 3) * 16.67))),
    },
    {
      label: 'RHR',
      value: Math.max(0, Math.min(100, (-recovery.rhrZScore + 3) * 16.67)),
      maxValue: 100,
      color: '#007aff',
      percentage: Math.round(Math.max(0, Math.min(100, (-recovery.rhrZScore + 3) * 16.67))),
    },
    {
      label: 'Sleep',
      value: Math.round(recovery.sleepQualityFactor * 100),
      maxValue: 100,
      color: '#ff9f0a',
      percentage: Math.round(recovery.sleepQualityFactor * 100),
    },
    {
      label: 'Recovery',
      value: recovery.recoveryScore,
      maxValue: 100,
      color: getRecoveryColor(recovery.zone),
      percentage: recovery.recoveryScore,
    },
  ]

  return {
    recoveryScore: recovery.recoveryScore,
    recoveryZone: recovery.zone,
    segments,
    centerLabel: 'Recovery',
    centerValue: `${recovery.recoveryScore}%`,
  }
}

function getRecoveryColor(zone: 'green' | 'yellow' | 'red'): string {
  switch (zone) {
    case 'green': return '#34c759'
    case 'yellow': return '#ff9f0a'
    case 'red': return '#ff3b30'
  }
}

export function buildMultiRing(scores: {
  recovery: number
  hrv: number
  rhr: number
  sleep: number
  strain: number
}): RingSegment[] {
  return [
    { label: 'Recovery', value: scores.recovery, maxValue: 100, color: '#34c759', percentage: scores.recovery },
    { label: 'HRV', value: scores.hrv, maxValue: 100, color: '#007aff', percentage: scores.hrv },
    { label: 'RHR', value: scores.rhr, maxValue: 100, color: '#5ac8fa', percentage: scores.rhr },
    { label: 'Sleep', value: scores.sleep, maxValue: 100, color: '#ff9f0a', percentage: scores.sleep },
  ]
}
