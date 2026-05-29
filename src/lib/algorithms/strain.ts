import { ZONE_WEIGHTS } from './hr-zones'

export interface StrainInput {
  hrZones: number[]
  age: number
}

export function computeStrain(hrZones: number[]): number {
  const SCALE_FACTOR = 2.5

  let weightedSum = 0
  for (let i = 0; i < hrZones.length; i++) {
    weightedSum += (hrZones[i] || 0) * (ZONE_WEIGHTS[i] || 1)
  }

  const strain = Math.log(1 + weightedSum) * SCALE_FACTOR
  return Math.round(strain * 10) / 10
}

export function computeCumulativeStrain(activities: { hrZones: number[] }[]): number {
  if (activities.length === 0) return 0

  let totalWeightedSum = 0
  for (const activity of activities) {
    for (let i = 0; i < activity.hrZones.length; i++) {
      totalWeightedSum += (activity.hrZones[i] || 0) * (ZONE_WEIGHTS[i] || 1)
    }
  }

  const strain = Math.log(1 + totalWeightedSum) * 2.5
  return Math.round(strain * 10) / 10
}

export function interpretStrain(score: number): { level: string; color: string; description: string } {
  if (score < 5) return { level: 'Light', color: '#34c759', description: 'Low cardiovascular load. Recovery day.' }
  if (score < 10) return { level: 'Moderate', color: '#ff9f0a', description: 'Good training stimulus. Building base.' }
  if (score < 14) return { level: 'High', color: '#ff6b35', description: 'Challenging workload. Prioritize recovery.' }
  if (score < 18) return { level: 'Very High', color: '#ff3b30', description: 'Intense strain. Extended recovery needed.' }
  return { level: 'Maximal', color: '#ff3b30', description: 'Peak output. Deliberate rest required.' }
}
