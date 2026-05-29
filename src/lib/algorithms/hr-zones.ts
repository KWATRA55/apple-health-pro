import type { HRZoneThresholds, HRZoneDefinition } from '@/lib/types'

const ZONE_WEIGHTS = [1, 2, 4, 8, 16]

export function maxHR(age: number): number {
  return 220 - age
}

export function getHRZoneThresholds(age: number): HRZoneThresholds {
  const max = maxHR(age)
  return {
    zone1: [max * 0.5, max * 0.6],
    zone2: [max * 0.6, max * 0.7],
    zone3: [max * 0.7, max * 0.8],
    zone4: [max * 0.8, max * 0.9],
    zone5: [max * 0.9, max * 1.0],
  }
}

export function getHRZones(age: number): HRZoneDefinition[] {
  const thresholds = getHRZoneThresholds(age)
  return [
    { name: 'Zone 1 — Recovery', minBPM: thresholds.zone1[0], maxBPM: thresholds.zone1[1], weight: ZONE_WEIGHTS[0] },
    { name: 'Zone 2 — Endurance', minBPM: thresholds.zone2[0], maxBPM: thresholds.zone2[1], weight: ZONE_WEIGHTS[1] },
    { name: 'Zone 3 — Tempo', minBPM: thresholds.zone3[0], maxBPM: thresholds.zone3[1], weight: ZONE_WEIGHTS[2] },
    { name: 'Zone 4 — Threshold', minBPM: thresholds.zone4[0], maxBPM: thresholds.zone4[1], weight: ZONE_WEIGHTS[3] },
    { name: 'Zone 5 — VO2 Max', minBPM: thresholds.zone5[0], maxBPM: thresholds.zone5[1], weight: ZONE_WEIGHTS[4] },
  ]
}

export function getZoneWeight(zoneIndex: number): number {
  return ZONE_WEIGHTS[zoneIndex] ?? 1
}

export { ZONE_WEIGHTS }
