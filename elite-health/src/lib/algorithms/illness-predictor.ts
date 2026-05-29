export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'illness-predictor';

export type ImmunityRisk = 'LOW' | 'ELEVATED' | 'HIGH'

export interface IllnessPrediction {
  risk: ImmunityRisk
  confidence: number
  explanation: string
}

/**
 * Predicts illness based on wrist temperature anomalies, RHR elevation, breathing disturbances, and SpO2.
 */
export function computeIllnessRisk(
  skinTempDelta: number,
  hrv: number,
  hrvBaseline: number,
  breathingDisturbances: number,
  rhrToday: number,
  rhrBaseline: number,
  spo2Today: number
): IllnessPrediction {
  // Only compute baseline-dependent signals when baseline is real (>0)
  const hasHRVBaseline = hrvBaseline !== undefined && hrvBaseline > 0
  const hasRHRBaseline = rhrBaseline !== undefined && rhrBaseline > 0
  const tempSpike = skinTempDelta >= 0.5
  const breathingSpike = breathingDisturbances !== undefined && breathingDisturbances >= 8.0
  const rhrSpike = hasRHRBaseline ? (rhrToday !== undefined && rhrToday >= rhrBaseline + 4) : false
  const spo2Decline = spo2Today !== undefined && spo2Today > 0 && spo2Today < 95
  const hrvSuppressed = hasHRVBaseline ? (hrv > 0 && hrv < hrvBaseline * 0.85) : false

  const signals = [
    tempSpike,
    breathingSpike,
    rhrSpike,
    spo2Decline,
    hrvSuppressed
  ]
  const activeSignals = signals.filter(Boolean).length

  if ((tempSpike && breathingSpike && rhrSpike) || (tempSpike && hrvSuppressed)) {
    return {
      risk: 'HIGH',
      confidence: 92,
      explanation: `Critical immune warning: ${tempSpike ? `elevated skin temp (+${skinTempDelta.toFixed(1)}°C)` : ''}${hrvSuppressed ? ' with significant HRV suppression' : ''}. High probability of systemic infection/illness.`,
    }
  }

  if (activeSignals >= 2) {
    return {
      risk: 'ELEVATED',
      confidence: 70,
      explanation: `Multiple early warning metrics active (Active signals: ${activeSignals}/5). Immune system under stress. Recommend active recovery.`,
    }
  }

  if (activeSignals === 1) {
    let marker = 'Early strain'
    if (tempSpike) marker = `Temp spike (+${skinTempDelta.toFixed(1)}°C)`
    if (breathingSpike) marker = `Breathing disturbances (${breathingDisturbances.toFixed(1)}/hr)`
    if (rhrSpike && hasRHRBaseline) marker = `Elevated RHR (+${(rhrToday! - rhrBaseline!).toFixed(0)} BPM)`
    if (spo2Decline) marker = `Oxygen desaturation (${spo2Today!.toFixed(1)}%)`
    if (hrvSuppressed) marker = 'HRV suppression'

    return {
      risk: 'ELEVATED',
      confidence: 50,
      explanation: `Single biological marker alert: ${marker}. Monitor symptoms closely.`,
    }
  }

  return {
    risk: 'LOW',
    confidence: 95,
    explanation: 'Vitals are stable. No immunological or respiratory stress patterns detected.',
  }
}
