export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 1
  const avg = mean(values)
  const squaredDiffs = values.map(v => (v - avg) ** 2)
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function zScore(value: number, avg: number, sd: number): number {
  if (sd === 0) return 0
  return (value - avg) / sd
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeZScore(z: number): number {
  return 1 / (1 + Math.exp(-z))
}

export function zScorePopulation(values: number[], value: number): { z: number; mu: number; sigma: number } {
  const mu = mean(values)
  const sigma = stddev(values)
  const z = zScore(value, mu, sigma)
  return { z, mu, sigma }
}
