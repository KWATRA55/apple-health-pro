export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'strain';

const ZONE_WEIGHTS = [1, 2, 4, 8, 16]

export function computeStrain(hrZones: number[]): number {
  const SCALE_FACTOR = 2.5
  let weightedSum = 0
  for (let i = 0; i < hrZones.length; i++) {
    weightedSum += (hrZones[i] || 0) * (ZONE_WEIGHTS[i] || 1)
  }
  const strain = Math.log(1 + weightedSum) * SCALE_FACTOR
  return Math.round(strain * 10) / 10
}

export function maxHR(age: number): number {
  return 220 - age
}

export function getHRZones(age: number): { name: string; minBPM: number; maxBPM: number; weight: number }[] {
  const max = maxHR(age)
  return [
    { name: 'Z1 Recovery', minBPM: max * 0.5, maxBPM: max * 0.6, weight: ZONE_WEIGHTS[0] },
    { name: 'Z2 Endurance', minBPM: max * 0.6, maxBPM: max * 0.7, weight: ZONE_WEIGHTS[1] },
    { name: 'Z3 Tempo', minBPM: max * 0.7, maxBPM: max * 0.8, weight: ZONE_WEIGHTS[2] },
    { name: 'Z4 Threshold', minBPM: max * 0.8, maxBPM: max * 0.9, weight: ZONE_WEIGHTS[3] },
    { name: 'Z5 VO2 Max', minBPM: max * 0.9, maxBPM: max * 1.0, weight: ZONE_WEIGHTS[4] },
  ]
}

export function interpretStrain(score: number): { level: string; color: string } {
  if (score < 5) return { level: 'Light', color: '#1DB954' }
  if (score < 10) return { level: 'Moderate', color: '#FFD700' }
  if (score < 14) return { level: 'High', color: '#FF9500' }
  if (score < 18) return { level: 'Very High', color: '#FF3B30' }
  return { level: 'Maximal', color: '#FF3B30' }
}

export { ZONE_WEIGHTS }
