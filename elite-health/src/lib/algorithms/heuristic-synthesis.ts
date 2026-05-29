export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'heuristic-synthesis';

import type {
  SynthesisInput,
  SynthesisOutput,
  PillarScore,
  WarningFlag,
  InterceptTrigger,
  CnsStressScore,
} from '../types'

export function synthesize(input: SynthesisInput): SynthesisOutput {
  const readiness = computeReadiness(input)
  const resilience = computeResilience(input)
  const longevity = computeLongevity(input)
  const warningFlags = computeWarningFlags(input, readiness, resilience, longevity)
  const directive = generateDirective(input, readiness, resilience, longevity, warningFlags)
  const intercepts = computeIntercepts(warningFlags, readiness, resilience, longevity, input)

  return {
    readiness,
    resilience,
    longevity,
    directive: directive.text,
    headline: directive.headline,
    subheadline: directive.subheadline,
    warningFlags,
    targetStrain: computeTargetStrain(readiness, resilience),
    targetBedtime: computeTargetBedtime(input),
    recoveryTips: directive.recoveryTips,
    interceptTriggers: intercepts,
    cnsStressScore: input.cnsStressScore,
    injuryRisk: input.injuryRisk,
  }
}

function computeReadiness(input: SynthesisInput): PillarScore {
  const hrv = input.vitals?.hrv ?? 0
  const rhr = input.vitals?.rhr ?? 0
  const sleepDuration = input.sleep?.totalDurationMins ?? 0
  const sleepNeed = (input.sleep?.sleepNeedHours ?? 8) * 60
  // Only use baseline from actual data; 0 means "insufficient data"
  const hrvBaseline = input.hrvBaseline > 0 ? input.hrvBaseline : 0
  const rhrBaseline = input.rhrBaseline > 0 ? input.rhrBaseline : 0

  const hasHRV = hrv > 0 && hrvBaseline > 0
  const hasRHR = rhr > 0 && rhrBaseline > 0
  const hasSleep = sleepDuration > 0 && sleepNeed > 0

  const hrvRatio = hasHRV ? hrv / hrvBaseline : 0
  const rhrRatio = hasRHR ? rhr / rhrBaseline : 0
  const sleepRatio = hasSleep ? Math.min(1, sleepDuration / sleepNeed) : 0

  // Weight dynamically based on which inputs are present
  const activeInputs = [hasHRV, hasRHR, hasSleep].filter(Boolean).length
  const dataCoverage: PillarScore['dataCoverage'] = activeInputs >= 3 ? 'sufficient' : activeInputs >= 2 ? 'partial' : 'insufficient'

  if (dataCoverage === 'insufficient') {
    return {
      score: 0,
      label: 'READINESS',
      zone: 'insufficient',
      zoneLabel: 'INSUFFICIENT',
      primaryMetric: 'Need ≥2 days of HRV + sleep data',
      icon: 'BODY',
      glowColor: '#6B7280',
      detail: 'Not enough baseline data to compute readiness. Sync 3+ days of HealthKit data.',
      dataCoverage,
    }
  }

  const hrvWeight = hasHRV ? 0.50 : 0
  const rhrWeight = hasRHR ? 0.25 : 0
  const sleepWeight = hasSleep ? 0.25 : 0
  const totalWeight = hrvWeight + rhrWeight + sleepWeight
  const normalize = totalWeight > 0 ? 1 / totalWeight : 1

  const hrvScore = hasHRV ? clamp(hrvRatio * 50, 0, 50) : 0
  const rhrScore = hasRHR ? clamp((2 - rhrRatio) * 25, 0, 25) : 0
  const sleepScore = hasSleep ? sleepRatio * 25 : 0
  const rawScore = (hrvScore + rhrScore + sleepScore) * normalize

  // Sleep floor: short sleep (< 6 h) prevents "PRIMED" label regardless of autonomic signals
  const SLEEP_FLOOR_MINS = 360 // 6 hours
  const isShortSleep = hasSleep && sleepDuration < SLEEP_FLOOR_MINS

  let zone: PillarScore['zone'] = 'attention'
  let zoneLabel = 'MODERATE'
  let glowColor = '#F59E0B'
  if (rawScore >= 75 && !isShortSleep) { zone = 'optimal'; zoneLabel = 'PRIMED'; glowColor = '#14B8A6' }
  else if (rawScore >= 75 && isShortSleep) { zone = 'attention'; zoneLabel = 'MODERATE'; glowColor = '#F59E0B' }
  else if (rawScore <= 40) { zone = 'critical'; zoneLabel = 'DEPLETED'; glowColor = '#EF4444' }

  let detail: string
  if (zone === 'optimal') {
    detail = 'Autonomic nervous system balanced. Full work capacity available.'
  } else if (zone === 'critical') {
    detail = 'HRV suppressed. Prioritize sleep and parasympathetic recovery today.'
  } else if (isShortSleep && rawScore >= 75) {
    detail = 'Autonomic signals look good, but short sleep limits recovery. Prioritize 7–9 h tonight.'
  } else {
    detail = 'Recovery in progress. Moderate output capacity.'
  }

  return {
    score: Math.round(rawScore),
    label: 'READINESS',
    zone,
    zoneLabel,
    primaryMetric: `${hrv > 0 ? Math.round(hrv) : '--'} ms HRV  ·  ${rhr > 0 ? Math.round(rhr) : '--'} bpm RHR`,
    icon: 'BODY',
    glowColor,
    detail,
    dataCoverage,
  }
}

function computeResilience(input: SynthesisInput): PillarScore {
  const immunityRisk = input.scores?.immunityRisk ?? 'LOW'
  const injuryRisk = input.injuryRisk?.risk ?? 'LOW'
  const skinTempDelta = input.vitals?.skinTempDelta ?? 0
  const breathingDisturbances = input.cardioMetabolic?.breathingDisturbances ?? 3.5
  const spo2 = input.vitals?.spo2 ?? 98
  const cnsRisk = input.cnsStressScore?.risk ?? 'LOW'

  // Count how many real data signals are present (not just defaults)
  const hasVitals = input.vitals !== null && input.vitals !== undefined
  const hasCnsScore = input.cnsStressScore !== null && input.cnsStressScore !== undefined
  const hasInjuryRisk = input.injuryRisk !== null && input.injuryRisk !== undefined
  const hasScores = input.scores !== null && input.scores !== undefined
  const activeSignals = [hasVitals, hasCnsScore, hasInjuryRisk, hasScores].filter(Boolean).length
  const dataCoverage: PillarScore['dataCoverage'] = activeSignals >= 3 ? 'sufficient' : activeSignals >= 2 ? 'partial' : 'insufficient'

  if (dataCoverage === 'insufficient') {
    return {
      score: 0,
      label: 'RESILIENCE',
      zone: 'insufficient',
      zoneLabel: 'INSUFFICIENT',
      primaryMetric: 'Need immunity, injury & CNS data',
      icon: 'SHIELD',
      glowColor: '#6B7280',
      detail: 'Not enough defense-system data to compute resilience. Sync more HealthKit data.',
      dataCoverage,
    }
  }

  // Start from neutral baseline; only penalize based on real signals
  let score = 85
  if (immunityRisk === 'HIGH') score -= 30
  else if (immunityRisk === 'ELEVATED') score -= 15
  if (injuryRisk === 'HIGH') score -= 25
  else if (injuryRisk === 'MODERATE') score -= 12
  if (Math.abs(skinTempDelta) > 0.5) score -= 8
  if (breathingDisturbances > 8) score -= 8
  if (spo2 < 95) score -= 10
  if (cnsRisk === 'HIGH') score -= 20
  else if (cnsRisk === 'MODERATE') score -= 8

  score = Math.max(5, Math.min(100, score))

  let zone: PillarScore['zone'] = 'attention'
  let zoneLabel = 'GUARDED'
  let glowColor = '#F59E0B'
  if (score >= 75) { zone = 'optimal'; zoneLabel = 'STABLE'; glowColor = '#A855F7' }
  else if (score <= 35) { zone = 'critical'; zoneLabel = 'FRAGILE'; glowColor = '#EF4444' }

  const threatCount = [immunityRisk !== 'LOW', injuryRisk !== 'LOW', cnsRisk !== 'LOW'].filter(Boolean).length
  const threatDetail = threatCount > 0
    ? `${threatCount} system${threatCount > 1 ? 's' : ''} under surveillance`
    : 'No active threat signatures'

  return {
    score,
    label: 'RESILIENCE',
    zone,
    zoneLabel,
    primaryMetric: `Immune: ${immunityRisk}  ·  Injury: ${injuryRisk}  ·  CNS: ${cnsRisk}`,
    icon: 'SHIELD',
    glowColor,
    detail: zone === 'optimal'
      ? `Immune barrier, biomechanics, and CNS all nominal. ${threatDetail}.`
      : zone === 'critical'
        ? `Multiple defense systems compromised. ${threatDetail}. Avoid high-risk activity.`
        : `Some systems under load. ${threatDetail}.`,
    dataCoverage,
  }
}

function computeLongevity(input: SynthesisInput): PillarScore {
  const hasPaceOfAging = input.scores?.paceOfAging !== undefined && input.scores?.paceOfAging !== null
  // Prefer displayAge (integer) over biologicalAge (deprecated) for UI
  const hasDisplayAge = input.scores?.displayAge !== undefined && input.scores?.displayAge !== null
  const hasBioAge = hasDisplayAge || (input.scores?.biologicalAge !== undefined && input.scores?.biologicalAge !== null)
  const paceOfAging = hasPaceOfAging ? input.scores!.paceOfAging : null
  const displayAge = hasDisplayAge ? input.scores!.displayAge : (input.scores?.biologicalAge ?? null)
  const chronologicalAge = input.chronologicalAge
  const vo2Max = input.cardioMetabolic?.vo2Max ?? 0
  const doubleSupport = input.mobility?.doubleSupport ?? 0

  // Need at minimum biological age or pace of aging data
  const activeSignals = [hasPaceOfAging || hasBioAge, vo2Max > 0, doubleSupport > 0].filter(Boolean).length
  const dataCoverage: PillarScore['dataCoverage'] = activeSignals >= 2 ? 'sufficient' : activeSignals >= 1 ? 'partial' : 'insufficient'

  if (dataCoverage === 'insufficient' || (!hasPaceOfAging && !hasBioAge)) {
    return {
      score: 0,
      label: 'LONGEVITY',
      zone: 'insufficient',
      zoneLabel: 'INSUFFICIENT',
      primaryMetric: 'Need bio age & VO₂ max data',
      icon: 'SPHERE',
      glowColor: '#6B7280',
      detail: 'Not enough longevity metrics. Sync 14+ days for biological age estimation.',
      dataCoverage,
    }
  }

  const effectivePace = paceOfAging ?? 1.0
  const effectiveBioAge = displayAge ?? chronologicalAge
  const rawAge = input.scores?.rawAge ?? effectiveBioAge
  const ageDiff = rawAge - chronologicalAge

  let score = 50 + (effectivePace <= 1.0 ? 40 : effectivePace < 1.1 ? 20 : effectivePace < 1.2 ? 5 : -15)
  if (vo2Max > 0) {
    const idealVO2 = 45 - (chronologicalAge - 25) * 0.3
    const vo2Ratio = vo2Max / idealVO2
    score += (vo2Ratio - 1) * 20
  }
  if (doubleSupport > 0) {
    const idealDS = 26 + (chronologicalAge - 25) * 0.1
    if (doubleSupport > idealDS) score -= (doubleSupport - idealDS) * 4
  }
  score = Math.max(5, Math.min(100, Math.round(score)))

  let zone: PillarScore['zone'] = 'attention'
  let zoneLabel = 'NEUTRAL'
  let glowColor = '#F59E0B'
  if (score >= 75) { zone = 'optimal'; zoneLabel = 'ROBUST'; glowColor = '#00E5FF' }
  else if (score <= 35) { zone = 'critical'; zoneLabel = 'ACCELERATING'; glowColor = '#EF4444' }

  const paceLabel = effectivePace < 1.0 ? 'Slower than chronological' : effectivePace > 1.05 ? 'Faster than chronological' : 'At chronological pace'
  const vo2Display = vo2Max > 0 ? vo2Max.toFixed(1) : '--'
  const paceDisplay = effectivePace.toFixed(2)
  // primaryMetric shows the pillar score (0–100) first, with biological age as context
  const ageDirection = ageDiff < 0 ? '↓' : ageDiff > 0 ? '↑' : ''
  return {
    score,
    label: 'LONGEVITY',
    zone,
    zoneLabel,
    primaryMetric: `${score}pts  ·  Bio Age ${effectiveBioAge}${ageDirection}  ·  Pace ${paceDisplay}×  ·  VO₂ Max ${vo2Display}`,
    icon: 'SPHERE',
    glowColor,
    detail: zone === 'optimal'
      ? `Pace of aging is ${paceLabel}. Your biomarkers read ${Math.abs(ageDiff).toFixed(1)} years ${ageDiff < 0 ? 'younger' : 'older'} than your calendar.`
      : zone === 'critical'
        ? `Pace of aging ${paceLabel}. Cardiovascular and gait metrics indicate accelerated senescence.`
        : `Pace of aging ${paceLabel}. Biomarkers aligned with expected trajectory.`,
    dataCoverage,
  }
}

function computeWarningFlags(
  input: SynthesisInput,
  readiness: PillarScore,
  resilience: PillarScore,
  longevity: PillarScore
): WarningFlag[] {
  const flags: WarningFlag[] = []

  if (input.injuryRisk?.risk === 'HIGH') {
    flags.push({ type: 'injury', severity: 'high', title: 'INJURY BIOMECHANICS', message: input.injuryRisk.explanation })
  } else if (input.injuryRisk?.risk === 'MODERATE') {
    flags.push({ type: 'injury', severity: 'moderate', title: 'GAIT ASYMMETRY DETECTED', message: input.injuryRisk.explanation })
  }

  if (input.scores?.immunityRisk === 'HIGH') {
    flags.push({ type: 'illness', severity: 'high', title: 'IMMUNE SYSTEM ALERT', message: input.scores ? 'Multiple biological markers indicate elevated illness probability.' : 'Immune risk elevated.' })
  } else if (input.scores?.immunityRisk === 'ELEVATED') {
    flags.push({ type: 'illness', severity: 'moderate', title: 'IMMUNE VIGILANCE', message: 'Early warning markers active. Prioritize rest and hydration.' })
  }

  if (input.cnsStressScore?.risk === 'HIGH') {
    flags.push({ type: 'cns', severity: 'high', title: 'CNS OVERLOAD', message: input.cnsStressScore.explanation })
  } else if (input.cnsStressScore?.risk === 'MODERATE') {
    flags.push({ type: 'cns', severity: 'moderate', title: 'CNS ELEVATED', message: input.cnsStressScore.explanation })
  }

  if (readiness.zone === 'critical') {
    flags.push({ type: 'recovery', severity: 'high', title: 'RECOVERY DEFICIT', message: 'HRV suppressed and sleep debt accumulating. Mandatory rest advised.' })
  }

  if (input.scores?.strainScore && input.scores.strainScore > 15) {
    flags.push({ type: 'overtraining', severity: 'moderate', title: 'HIGH STRAIN LOAD', message: `Strain score of ${input.scores.strainScore.toFixed(1)} detected. Recovery needed before next session.` })
  }

  return flags.sort((a, b) => (b.severity === 'high' ? 3 : b.severity === 'moderate' ? 2 : 1) - (a.severity === 'high' ? 3 : a.severity === 'moderate' ? 2 : 1))
}

function computeIntercepts(
  flags: WarningFlag[],
  readiness: PillarScore,
  resilience: PillarScore,
  longevity: PillarScore,
  input: SynthesisInput
): InterceptTrigger[] {
  const intercepts: InterceptTrigger[] = []

  if (flags.some(f => f.type === 'injury' && f.severity === 'high')) {
    intercepts.push({
      type: 'workout_block',
      title: 'KINETIC CHAIN AT RISK',
      message: 'Gait asymmetry indicates high probability of lower-limb injury. We strongly recommend against impact-based training today.',
      icon: 'WARNING',
      actionLabel: 'SWITCH TO MOBILITY',
      severity: 'critical',
      pill: 'resilience',
    })
  }

  if (flags.some(f => f.type === 'cns' && f.severity === 'high') || readiness.zone === 'critical') {
    intercepts.push({
      type: 'rest_mandate',
      title: 'CNS RECOVERY MANDATE',
      message: 'Your central nervous system is operating with depleted reserves. Training today will produce diminished returns and increased injury risk.',
      icon: 'REST',
      actionLabel: 'REST & RECHARGE',
      severity: 'critical',
      pill: 'readiness',
    })
  }

  if (readiness.zone === 'critical' || resilience.zone === 'critical') {
    intercepts.push({
      type: 'sleep_prescription',
      title: 'SLEEP PRESCRIPTION',
      message: `Target bedtime: 9:00 PM. Aim for 8.5+ hours to restore autonomic balance and immune function.`,
      icon: 'MOON',
      actionLabel: 'SET BEDTIME',
      severity: 'warning',
      pill: 'readiness',
    })
  }

  if (inputHasHighAudioAndLowDaylight(input)) {
    intercepts.push({
      type: 'hydration_alert',
      title: 'ENVIRONMENTAL RECOVERY BLOCKERS',
      message: 'Low daylight exposure and high audio load are suppressing sleep quality. Get 20+ min of morning sunlight and reduce headphone use after 6 PM.',
      icon: 'SUN',
      actionLabel: 'SEE DETAILS',
      severity: 'info',
      pill: 'resilience',
    })
  }

  return intercepts
}

function inputHasHighAudioAndLowDaylight(input: SynthesisInput): boolean {
  const env = input.environmental
  if (!env) return false
  return env.headphoneAudio > 75 && env.timeInDaylight < 30
}

function generateDirective(
  input: SynthesisInput,
  readiness: PillarScore,
  resilience: PillarScore,
  longevity: PillarScore,
  flags: WarningFlag[]
): { text: string; headline: string; subheadline: string; recoveryTips: string[] } {
  const criticalFlags = flags.filter(f => f.severity === 'high')
  const moderateFlags = flags.filter(f => f.severity === 'moderate')

  let headline = 'DAILY SYNTHESIS'
  let subheadline = ''
  let text = ''
  const recoveryTips: string[] = []

  if (criticalFlags.length > 0) {
    const primaryFlag = criticalFlags[0]
    headline = primaryFlag.title

    switch (primaryFlag.type) {
      case 'injury':
        subheadline = 'Biomechanical failure risk detected'
        text = `Your walking asymmetry has spiked to ${input.mobility?.walkingAsymmetry?.toFixed(1) ?? 'elevated'}%, signaling uneven kinetic chain loading. Avoid impact training (running, HIIT, plyometrics). Replace with low-impact mobility work: swimming, cycling, or yoga. Focus on single-leg stability exercises. Reassess in 24 hours.`
        recoveryTips.push('Avoid running, jumping, or heavy lifts')
        recoveryTips.push('Swim or cycle at low intensity (Zone 1-2)')
        recoveryTips.push('Single-leg balance drills: 3x30s per leg')
        break
      case 'illness':
        subheadline = 'Immune system under active stress'
        text = `Multiple biological markers — wrist temperature (+${input.vitals?.skinTempDelta?.toFixed(1) ?? '?'}°C), elevated breathing disturbances, and HRV suppression — indicate your body is fighting something. Do not train. Hydrate aggressively (3L+ water). Sleep by 8:30 PM. Monitor for symptom progression.`
        recoveryTips.push('Complete rest — zero training strain today')
        recoveryTips.push('3+ liters of water with electrolytes')
        recoveryTips.push('Sleep target: 9+ hours')
        break
      case 'cns':
        subheadline = 'Central nervous system depleted'
        text = `Your CNS is fried. ${input.cnsStressScore?.explanation ?? 'Low daylight, high audio load, and HRV suppression have drained your autonomic reserve.'} Walk 10k steps max, avoid HIIT, sleep by 9 PM. No screens 1 hour before bed. Parasympathetic breathing: 4-7-8 protocol, 5 min, 3x today.`
        recoveryTips.push('Max 10k steps — no structured training')
        recoveryTips.push('4-7-8 breathing: inhale 4s, hold 7s, exhale 8s')
        recoveryTips.push('Bedtime 9:00 PM, no screens after 8:00 PM')
        break
      case 'recovery':
        subheadline = 'Recovery reserves critically low'
        text = `HRV is significantly below baseline and sleep debt is compounding. Your body cannot absorb training stress today. Prioritize food quality (high protein, anti-inflammatory), hydration, and early sleep. Light walking only.`
        recoveryTips.push('High-protein meals, minimize processed foods')
        recoveryTips.push('10-min meditation or NSDR session')
        recoveryTips.push('Walking only — 8k steps max')
        break
      default:
        subheadline = 'Critical biometric alert'
        text = 'Multiple systems indicate compromised physiological state. Rest is non-negotiable today.'
        recoveryTips.push('Complete rest day — no structured training')
    }
  } else if (moderateFlags.length > 0) {
    const primaryFlag = moderateFlags[0]
    headline = primaryFlag.title
    subheadline = 'Early warning — adjust training intensity'
    text = `${primaryFlag.message} Adapt your training: reduce intensity by 30-40%, extend warm-up to 15+ minutes, and prioritize mobility cooldown. Monitor for worsening signals.`
    recoveryTips.push('Reduce training intensity by 30-40%')
    recoveryTips.push('Extended warm-up: 15+ minutes')
    recoveryTips.push('Prioritize sleep quality tonight')
  } else if (readiness.zone === 'optimal' && resilience.zone === 'optimal') {
    headline = 'ALL SYSTEMS NOMINAL'
    subheadline = 'Full capacity available'
    text = `Your autonomic nervous system is fully recovered and your immune/injury defenses are robust. Today is optimal for high-quality training. Target strain: ${computeTargetStrain(readiness, resilience).toFixed(1)}. Bedtime by 10:30 PM to protect tomorrow's readiness.`
    recoveryTips.push('Green light for high-intensity training')
    recoveryTips.push('Post-workout: 20g protein within 30 min')
    recoveryTips.push('Bedtime 10:30 PM for recovery consolidation')
  } else {
    headline = 'MODERATE CAPACITY'
    subheadline = 'Train smart — not hard'
    text = `Your body is in a transitional recovery state. You can train, but quality matters more than intensity. Keep strain under ${computeTargetStrain(readiness, resilience).toFixed(1)}. Focus on technique, mobility, and zone 2 work. Prioritize sleep tonight.`
    recoveryTips.push('Zone 2 training only — keep HR under 140 bpm')
    recoveryTips.push('Technique and mobility focus over volume')
    recoveryTips.push('Cold exposure (1-2 min) for recovery boost')
  }

  return { text, headline, subheadline, recoveryTips }
}

function computeTargetStrain(readiness: PillarScore, resilience: PillarScore): number {
  const readinessFactor = readiness.score / 100
  const resilienceFactor = resilience.score / 100
  const baseStrain = 21
  const multiplier = Math.min(readinessFactor, resilienceFactor)
  const capped = Math.round(baseStrain * multiplier * 10) / 10
  return Math.max(2, Math.min(21, capped))
}

function computeTargetBedtime(input: SynthesisInput): string {
  const sleepDebt = input.sleep?.sleepDebtHours ?? 0
  if (sleepDebt > 2) return '8:30 PM'
  if (sleepDebt > 1) return '9:00 PM'
  if (input.cnsStressScore?.risk === 'HIGH') return '9:00 PM'
  if (input.cnsStressScore?.risk === 'MODERATE') return '9:30 PM'
  return '10:30 PM'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
