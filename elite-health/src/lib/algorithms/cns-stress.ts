export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'cns-stress';

import type { CnsStressScore } from '../types'

export function computeCnsStress(
  headphoneAudio: number,
  timeInDaylight: number,
  hrvToday: number,
  hrvBaseline: number,
  sleepDurationMins: number,
  sleepNeedMins: number,
  mindfulMinutes: number = 0
): CnsStressScore {
  const hrvSuppressionPercent = hrvBaseline > 0
    ? ((hrvBaseline - hrvToday) / hrvBaseline) * 100
    : 0
  const sleepDeficitPercent = sleepNeedMins > 0
    ? ((sleepNeedMins - sleepDurationMins) / sleepNeedMins) * 100
    : 0

  const audioOverload = headphoneAudio > 80.0
  const daylightDeficit = timeInDaylight < 20.0
  const hrvSuppressed = hrvSuppressionPercent >= 10.0
  const sleepDeprived = sleepDeficitPercent >= 20.0

  let cnsScore = 20

  if (audioOverload) cnsScore += 25
  else if (headphoneAudio > 70.0) cnsScore += 10

  if (daylightDeficit) cnsScore += 20
  else if (timeInDaylight < 40.0) cnsScore += 10

  if (hrvSuppressed) cnsScore += 25
  else if (hrvSuppressionPercent > 0) cnsScore += Math.min(15, hrvSuppressionPercent)

  if (sleepDeprived) cnsScore += 20
  else if (sleepDeficitPercent > 0) cnsScore += Math.min(15, sleepDeficitPercent)

  // Parasympathetic offset: each mindful minute reduces CNS stress score by 1.5 points (up to a max of 30 points)
  const mindfulReduction = Math.min(30, mindfulMinutes * 1.5)
  cnsScore = Math.max(0, Math.min(100, cnsScore - mindfulReduction))

  let risk: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW'
  let confidence = 85
  let explanation = 'Central Nervous System is balanced with adequate recovery and healthy environmental exposure.'

  if (audioOverload && daylightDeficit && hrvSuppressed) {
    risk = 'HIGH'
    explanation = `High CNS strain detected. Critical combination of high auditory load (${headphoneAudio.toFixed(0)}dB), severe daylight deficit (${timeInDaylight.toFixed(0)}m), and HRV suppression (-${hrvSuppressionPercent.toFixed(0)}%). Circadian rhythms and autonomic reserve are compromised.`
  } else if (cnsScore > 65) {
    risk = 'HIGH'
    explanation = `High CNS strain score (${cnsScore.toFixed(0)}/100). High autonomic stress and environmental deficits. Prioritize parasympathetic activation (rest, meditation).`
  } else if (cnsScore > 40) {
    risk = 'MODERATE'
    explanation = `Moderate CNS strain detected. Circadian inputs are low or auditory load is elevated. HRV reserve is holding, but recovery capacity is limited.`
  }

  if (mindfulMinutes > 0) {
    explanation += ` Mindful session of ${mindfulMinutes}m provided active parasympathetic recovery mitigation.`
  }

  return {
    risk,
    confidence,
    audioLoad: headphoneAudio,
    daylightDeficit: Math.max(0, 45 - timeInDaylight),
    hrvSuppression: Math.max(0, hrvSuppressionPercent),
    explanation,
  }
}
