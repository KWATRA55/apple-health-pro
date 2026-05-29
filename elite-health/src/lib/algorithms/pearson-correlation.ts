export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'pearson-correlation';

/**
 * Pearson correlation coefficient (r) and coefficient of determination (R²).
 * Used by the Correlation Explorer to quantify lifestyle impact on biometric baselines.
 */

export interface CorrelationResult {
  r: number
  r2: number
  n: number
  pValue: number | null
  significance: 'strong' | 'moderate' | 'weak' | 'none'
  direction: 'positive' | 'negative'
}

/**
 * Computes the Pearson product-moment correlation coefficient between two arrays.
 * Returns r, R², sample count, and significance classification.
 */
export function pearsonCorrelation(x: number[], y: number[]): CorrelationResult {
  const n = Math.min(x.length, y.length)

  if (n < 3) {
    return { r: 0, r2: 0, n, pValue: null, significance: 'none', direction: 'positive' }
  }

  const sumX = x.slice(0, n).reduce((a, b) => a + b, 0)
  const sumY = y.slice(0, n).reduce((a, b) => a + b, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let cov = 0
  let varX = 0
  let varY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  if (varX === 0 || varY === 0) {
    return { r: 0, r2: 0, n, pValue: null, significance: 'none', direction: 'positive' }
  }

  const r = cov / Math.sqrt(varX * varY)
  const clampedR = Math.max(-1, Math.min(1, r))
  const r2 = clampedR * clampedR

  const absR = Math.abs(clampedR)
  let significance: CorrelationResult['significance'] = 'none'
  if (absR >= 0.7) significance = 'strong'
  else if (absR >= 0.4) significance = 'moderate'
  else if (absR >= 0.2) significance = 'weak'

  return {
    r: Math.round(clampedR * 10000) / 10000,
    r2: Math.round(r2 * 10000) / 10000,
    n,
    pValue: approximatePValue(clampedR, n),
    significance,
    direction: clampedR >= 0 ? 'positive' : 'negative',
  }
}

/**
 * Approximate two-tailed p-value from Pearson r using t-distribution.
 */
function approximatePValue(r: number, n: number): number {
  if (n <= 2) return 1
  const t = r * Math.sqrt((n - 2) / (1 - r * r))
  const df = n - 2
  // Rough approximation using normal distribution
  const z = Math.abs(t)
  // Abramowitz & Stegun approximation for normal CDF
  const b1 = 0.31938153
  const b2 = -0.356563782
  const b3 = 1.781477937
  const b4 = -1.821255978
  const b5 = 1.330274429
  const p = 0.2316419
  const t2 = 1 / (1 + p * z)
  const poly = b1 * t2 + b2 * t2 * t2 + b3 * t2 * t2 * t2 + b4 * t2 * t2 * t2 * t2 + b5 * t2 * t2 * t2 * t2 * t2
  const normalCdf = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-z * z / 2) * poly
  return Math.round((2 * (1 - normalCdf)) * 10000) / 10000
}

/**
 * Computes the percentage impact of a binary habit on a recovery score.
 * Returns the delta from baseline as a percentage.
 */
export function computeHabitImpactPercent(
  scoresWithHabit: number[],
  allScores: number[]
): { avgImpactPercent: number; r: number; r2: number; n: number } {
  if (scoresWithHabit.length < 3 || allScores.length < 3) {
    return { avgImpactPercent: 0, r: 0, r2: 0, n: scoresWithHabit.length }
  }

  const allMean = allScores.reduce((a, b) => a + b, 0) / allScores.length
  const habitMean = scoresWithHabit.reduce((a, b) => a + b, 0) / scoresWithHabit.length
  const delta = habitMean - allMean
  const avgImpactPercent = allMean > 0 ? Math.round((delta / allMean) * 100) : 0

  // Build paired arrays for Pearson: binary habit indicator vs scores
  const habitIndicator: number[] = []
  const scoreValues: number[] = []

  for (const score of allScores) {
    habitIndicator.push(scoresWithHabit.includes(score) ? 1 : 0)
    scoreValues.push(score)
  }

  const correlation = pearsonCorrelation(habitIndicator, scoreValues)

  return {
    avgImpactPercent,
    r: correlation.r,
    r2: correlation.r2,
    n: scoresWithHabit.length,
  }
}
