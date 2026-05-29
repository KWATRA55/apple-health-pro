export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'running-form';

import type { RunningDynamics } from '../types'

export interface FormDegradation {
  degraded: boolean
  metric: string
  percentChange: number
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH'
  explanation: string
}

/**
 * Detects running form degradation week-over-week
 * @param recent The most recent running dynamics
 * @param baseline The average dynamics over the past 7-14 days
 */
export function computeFormDegradation(
  recent: RunningDynamics | null,
  baseline: RunningDynamics[]
): FormDegradation {
  if (!recent || baseline.length === 0) {
    return { degraded: false, metric: 'N/A', percentChange: 0, riskLevel: 'LOW', explanation: 'Insufficient data' }
  }

  const avgGCT = baseline.reduce((sum, d) => sum + d.groundContactTime, 0) / baseline.length
  const avgOscillation = baseline.reduce((sum, d) => sum + d.verticalOscillation, 0) / baseline.length

  const gctChange = (recent.groundContactTime - avgGCT) / avgGCT
  const oscChange = (recent.verticalOscillation - avgOscillation) / avgOscillation

  if (gctChange > 0.10) {
    return {
      degraded: true,
      metric: 'Ground Contact Time',
      percentChange: gctChange * 100,
      riskLevel: 'HIGH',
      explanation: `Ground contact time increased by ${(gctChange * 100).toFixed(1)}% above baseline. This pattern is associated with elevated injury risk. Consider form assessment.`,
    }
  }

  if (oscChange > 0.15) {
    return {
      degraded: true,
      metric: 'Vertical Oscillation',
      percentChange: oscChange * 100,
      riskLevel: 'MODERATE',
      explanation: `Vertical oscillation increased by ${(oscChange * 100).toFixed(1)}%. Inefficient stride detected due to fatigue.`,
    }
  }

  return {
    degraded: false,
    metric: 'Stable',
    percentChange: 0,
    riskLevel: 'LOW',
    explanation: 'Biomechanics are stable.',
  }
}
