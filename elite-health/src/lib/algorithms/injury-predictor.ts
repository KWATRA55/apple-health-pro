export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'injury-predictor';

import type { InjuryRisk } from '../types'

/**
 * Injury Risk Predictor — Gait Biomechanics Engine
 *
 * Analyzes walking asymmetry, double support time, stair speed,
 * and ground contact time to estimate lower-limb injury risk.
 *
 * All explanation text uses calm, plain-English language designed
 * to inform without alarming.
 */

export function computeInjuryRisk(
  walkingAsymmetry: number,
  asymmetryBaseline: number,
  doubleSupport: number,
  doubleSupportBaseline: number,
  stairSpeedDown: number,
  stairSpeedDownBaseline: number,
  groundContactTime: number,
  groundContactTimeBaseline: number
): InjuryRisk {
  const asymmetryDelta = walkingAsymmetry - asymmetryBaseline
  const doubleSupportDelta = doubleSupport - doubleSupportBaseline
  const stairDownDeclinePercent = stairSpeedDownBaseline > 0
    ? ((stairSpeedDownBaseline - stairSpeedDown) / stairSpeedDownBaseline) * 100
    : 0
  const gctElevation = groundContactTime - groundContactTimeBaseline

  const highAsymmetry = walkingAsymmetry > 5.0
  const doubleSupportSpike = doubleSupportDelta >= 2.0
  const stairSpeedDrop = stairDownDeclinePercent >= 10.0
  const gctSpike = gctElevation > 15

  if (walkingAsymmetry > 5.0 && (doubleSupportSpike || stairSpeedDrop)) {
    return {
      risk: 'HIGH',
      confidence: 88,
      primaryMetric: 'Walking Asymmetry',
      secondaryMetrics: [
        doubleSupportSpike ? 'Double Support' : '',
        stairSpeedDrop ? 'Stair Speed Down' : ''
      ].filter(Boolean),
      explanation: `Your walking pattern shows a slight imbalance today. Your body is spending more time on one leg than the other, which can add extra strain over time. This is often temporary — consider a lighter training day and checking in again tomorrow.`,
    }
  }

  if (walkingAsymmetry > 3.0 || doubleSupportDelta > 1.5 || stairSpeedDrop || gctSpike) {
    return {
      risk: 'MODERATE',
      confidence: 65,
      primaryMetric: walkingAsymmetry > 3.0 ? 'Walking Asymmetry' : 'Double Support Compensation',
      secondaryMetrics: [
        gctSpike ? 'Running Ground Contact Time' : '',
        stairSpeedDrop ? 'Stair Speed Down' : ''
      ].filter(Boolean),
      explanation: `Your walking pattern has shifted slightly from your usual baseline. This kind of variation is common and often resolves on its own. Pay attention to how your joints feel during today's activity, and consider adding a few minutes of mobility work if anything feels tight.`,
    }
  }

  return {
    risk: 'LOW',
    confidence: 95,
    primaryMetric: 'Gait Symmetry',
    secondaryMetrics: [],
    explanation: 'Your walking pattern looks balanced and consistent with your baseline. No signs of uneven loading or compensation.',
  }
}
