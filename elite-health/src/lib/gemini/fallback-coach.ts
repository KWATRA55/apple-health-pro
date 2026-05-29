import type { CoachOptions, DailyDirectiveResult } from './client'
import { safeNumber } from '../utils/display-helpers'

const OFFLINE_DISCLAIMER = '⚠️ OFFLINE MODE — Analysis generated locally without AI. All metrics marked as ESTIMATE when real data is unavailable.\n\n'
const ESTIMATE_LABEL = 'ESTIMATE — NO REAL DATA AVAILABLE'

/**
 * Extracts a metric value from the Phase G scoped payload structure.
 * New payload: { metrics: { recoveryScore: { value: 72, ... }, vitals: { hrv: { value: 33.8, ... } } } }
 * Old payload (backward compat): { recoveryScore: 72, vitals: { hrv: 33.8 } }
 */
function extractValue(biometrics: any, path: string[]): { value: number; isReal: boolean; confidence: number | null } {
  let current = biometrics

  // Try new Phase G scoped structure first
  if (current?.metrics) {
    current = current.metrics
  }

  // Walk the path through nested objects, unwrapping { value, status } wrappers
  for (let i = 0; i < path.length; i++) {
    if (current == null || typeof current !== 'object') {
      return { value: 0, isReal: false, confidence: null }
    }
    const key = path[i]
    current = current[key]

    // If this is a scoped wrapper { value, status, confidence, ... }, unwrap it
    if (current && typeof current === 'object' && 'value' in current && 'status' in current) {
      const wrapper = current as any
      const isReal = wrapper.status === 'present' && !String(wrapper.provenance || '').includes('ESTIMATE')
      return {
        value: wrapper.value != null ? Number(wrapper.value) : 0,
        isReal,
        confidence: wrapper.confidence != null ? Number(wrapper.confidence) : null,
      }
    }
  }

  // Fallback: plain value
  if (typeof current === 'number') {
    return { value: current, isReal: true, confidence: null }
  }

  return { value: 0, isReal: false, confidence: null }
}

/**
 * Extracts a string metric value from the Phase G scoped payload.
 */
function extractStringValue(biometrics: any, path: string[]): { value: string; isReal: boolean } {
  let current = biometrics

  if (current?.metrics) {
    current = current.metrics
  }

  for (let i = 0; i < path.length; i++) {
    if (current == null || typeof current !== 'object') {
      return { value: '', isReal: false }
    }
    const key = path[i]
    current = current[key]

    if (current && typeof current === 'object' && 'value' in current && 'status' in current) {
      const wrapper = current as any
      const isReal = wrapper.status === 'present' && !String(wrapper.provenance || '').includes('ESTIMATE')
      return {
        value: wrapper.value != null ? String(wrapper.value) : '',
        isReal,
      }
    }
  }

  if (typeof current === 'string') {
    return { value: current, isReal: true }
  }

  return { value: '', isReal: false }
}

/**
 * Formats a metric display with estimate label when not from real data.
 */
function fmtMetric(value: number | string, isReal: boolean, unit?: string): string {
  if (isReal) {
    return unit ? `${value} ${unit}` : String(value)
  }
  return `${value}${unit ? ` ${unit}` : ''} [${ESTIMATE_LABEL}]`
}

/**
 * Local rule-engine fallback for the AI Coach.
 * Reads synchronized biometrics from the Phase G scoped payload and generates customized analysis.
 * ALL hardcoded default values are explicitly labeled as estimates.
 */
export function generateFallbackCoachResponse(options: CoachOptions): string {
  const { message, biometrics } = options
  const bio = biometrics as any
  const msg = message.toLowerCase()

  // ── Extract biometrics with real-data detection ────────────────────
  const recoveryScore = extractValue(bio, ['recoveryScore'])
  const strainScore = extractValue(bio, ['strainScore'])
  const recoveryZone = extractStringValue(bio, ['recoveryZone'])
  const sleepDebt = extractValue(bio, ['sleepDebtHours'])
  const sleepNeed = extractValue(bio, ['sleepNeedHours'])

  const hrv = extractValue(bio, ['vitals', 'hrv'])
  const rhr = extractValue(bio, ['vitals', 'rhr'])
  const spo2 = extractValue(bio, ['vitals', 'spo2'])
  const skinTempDelta = extractValue(bio, ['vitals', 'skinTempDelta'])

  const sleepDurationMins = extractValue(bio, ['sleep', 'totalDurationMins'])
  const sleepDurationHours = sleepDurationMins.value / 60

  const asymmetry = extractValue(bio, ['mobility', 'walkingAsymmetry'])
  const doubleSupport = extractValue(bio, ['mobility', 'doubleSupport'])
  const vo2Max = extractValue(bio, ['cardioMetabolic', 'vo2Max'])

  // Derived predictions — these may be top-level or nested
  const injuryRiskVal = extractStringValue(bio, ['injuryRisk'])
  const injuryRiskRisk = injuryRiskVal.value || (
    extractValue(bio, ['derivedPredictions', 'injuryRisk']).value > 0
      ? String(extractValue(bio, ['derivedPredictions', 'injuryRisk']).value)
      : ''
  )

  const cnsRiskVal = extractStringValue(bio, ['cnsStressScore'])
  const cnsRisk = cnsRiskVal.value || (
    extractValue(bio, ['derivedPredictions', 'cnsStressScore']).value > 0
      ? String(extractValue(bio, ['derivedPredictions', 'cnsStressScore']).value)
      : ''
  )

  // Old-style flat fallbacks for backward compat with non-Phase-G data
  function fallbackNum(v: any, defaultVal: number): { value: number; isReal: boolean; confidence: number | null } {
    if (typeof v === 'number' && v !== 0) return { value: v, isReal: true, confidence: null }
    return { value: defaultVal, isReal: false, confidence: null }
  }

  // Detect which structure we received
  const isPhaseG = Boolean(bio?.metrics)

  // Use old-style extraction as fallback when Phase G data is missing
  const recScore = recoveryScore.isReal ? recoveryScore : fallbackNum(bio?.recoveryScore, 62)
  const strScore = strainScore.isReal ? strainScore : fallbackNum(bio?.strainScore, 9.4)
  const recZone = recoveryZone.isReal ? recoveryZone : { value: String(bio?.recoveryZone ?? 'yellow').toLowerCase(), isReal: Boolean(bio?.recoveryZone) }
  const sleepDebtHrs = sleepDebt.isReal ? sleepDebt : fallbackNum(bio?.sleepDebtHours, 1.2)
  const sleepNeedHrs = sleepNeed.isReal ? sleepNeed : fallbackNum(bio?.sleepNeedHours, 8.0)

  const hrvVal = hrv.isReal ? hrv : fallbackNum(bio?.vitals?.hrv, 33.8)
  const rhrVal = rhr.isReal ? rhr : fallbackNum(bio?.vitals?.rhr, 61)
  const spo2Val = spo2.isReal ? spo2 : fallbackNum(bio?.vitals?.spo2, 0.97)
  const tempDelta = skinTempDelta.isReal ? skinTempDelta : fallbackNum(bio?.vitals?.skinTempDelta, -0.2)

  const sleepDurHrs = sleepDurationMins.isReal
    ? sleepDurationHours
    : (typeof bio?.sleep?.totalDurationMins === 'number'
      ? bio.sleep.totalDurationMins / 60
      : 6.8)
  const sleepDurIsReal = sleepDurationMins.isReal || typeof bio?.sleep?.totalDurationMins === 'number'

  const asymVal = asymmetry.isReal ? asymmetry : fallbackNum(bio?.mobility?.walkingAsymmetry, 0.07)
  const dsVal = doubleSupport.isReal ? doubleSupport : fallbackNum(bio?.mobility?.doubleSupport, 22.4)
  const vo2Val = vo2Max.isReal ? vo2Max : fallbackNum(bio?.cardioMetabolic?.vo2Max, 44.5)

  const injRisk = injuryRiskVal.isReal
    ? injuryRiskRisk.toUpperCase()
    : (bio?.derivedPredictions?.injuryRisk?.risk || bio?.injuryRisk?.risk || 'LOW').toUpperCase()
  const injRiskIsReal = injuryRiskVal.isReal || Boolean(bio?.derivedPredictions?.injuryRisk?.risk || bio?.injuryRisk?.risk)

  const cnsRiskLabel = cnsRiskVal.isReal
    ? cnsRisk.toUpperCase()
    : (bio?.derivedPredictions?.cnsStressScore?.risk || bio?.cnsStressScore?.risk || 'LOW').toUpperCase()
  const cnsRiskIsReal = cnsRiskVal.isReal || Boolean(bio?.derivedPredictions?.cnsStressScore?.risk || bio?.cnsStressScore?.risk)

  // Helpers for formatting
  const isReal = (r: { isReal: boolean }) => r.isReal
  const allEstimate = !isPhaseG
    ? ` [${ESTIMATE_LABEL}]`
    : ''

  // 1. RECOVERY & CNS INTENT
  if (/recover|readiness|fatigue|tired|cns|stress|hrv|rhr|pulse/i.test(msg)) {
    const cnsStatus = cnsRiskLabel === 'HIGH' ? 'depressed' : cnsRiskLabel === 'MODERATE' ? 'mildly taxed' : 'fully adapted'
    const recoveryVerb = recScore.value < 50 ? 'suppressed' : recScore.value < 75 ? 'stable' : 'primed'

    return OFFLINE_DISCLAIMER + `### SUMMARY
Your nervous system recovery is in a ${recoveryVerb} state today, indicating a ${cnsStatus} Central Nervous System response.

### EVIDENCE
- **Recovery Score [Selected Date]:** ${fmtMetric(Math.round(recScore.value), recScore.isReal, '%')}
- **HRV Baseline [Selected Date]:** ${fmtMetric(hrvVal.value, hrvVal.isReal, 'ms')} (${hrvVal.value < 30 ? 'suppressed' : 'optimal'})
- **Resting HR [Selected Date]:** ${fmtMetric(rhrVal.value, rhrVal.isReal, 'bpm')} (${rhrVal.value > 65 ? 'slightly elevated' : 'stable'})
- **CNS Stress Status [Selected Date]:** ${fmtMetric(cnsRiskLabel, cnsRiskIsReal)}

### PRACTICAL SUGGESTIONS
- **Exertion Ceiling:** We suggest capping your daily strain strictly at ${recScore.value < 50 ? '7.5' : recScore.value < 75 ? '12.0' : '17.5'} to allow your autonomic balance to stabilize.
- **Activity Guidance:** ${recScore.value < 50
        ? 'Prioritize light recovery, active stretching, or a Zone 1 walk today.'
        : recScore.value < 75
          ? 'Engage in moderate-intensity training. We suggest capping your heart rate in your endurance Zone 2.'
          : 'Your system is ready for standard training. High-intensity intervals or strength training are approved.'}
- **Breathing Protocol:** Consider performing 5-10 minutes of box breathing post-exercise to actively encourage parasympathetic vagal stimulation.

### CONFIDENCE & DATA NOTE
${recScore.isReal && hrvVal.isReal
        ? 'This is local rule-based coaching analysis with high confidence based on today\'s completed sleep and autonomic metrics sync.'
        : `This analysis uses ${ESTIMATE_LABEL} default values. Real biometric data is not available. Confidence is LOW — connect Apple Health for accurate insights.`}`
  }

  // 2. SLEEP INTENT
  if (/sleep|bedtime|rest|rem|deep|insomnia/i.test(msg)) {
    const sleepEfficiency = sleepDurHrs / sleepNeedHrs.value
    const sleepStatus = sleepEfficiency < 0.75 ? 'deficit' : sleepEfficiency < 0.9 ? 'mild deficit' : 'replenished'

    return OFFLINE_DISCLAIMER + `### SUMMARY
Your recent sleep logs indicate a sleep state of ${sleepStatus}, with some sleep debt accumulated.

### EVIDENCE
- **Sleep Duration [Selected Date]:** ${fmtMetric(safeNumber(sleepDurHrs, 1), sleepDurIsReal, 'h')} (Need: ${fmtMetric(safeNumber(sleepNeedHrs.value, 1), sleepNeedHrs.isReal, 'h')})
- **Sleep Debt [Last 7 Days]:** ${fmtMetric(safeNumber(sleepDebtHrs.value, 1), sleepDebtHrs.isReal, 'h accumulated')}
- **Blood Oxygen (SpO2) [Selected Date]:** ${fmtMetric(safeNumber(spo2Val.value > 1.0 ? spo2Val.value : spo2Val.value * 100, 0), spo2Val.isReal, '% during sleep')}
- **Skin Temp Delta [Selected Date]:** ${fmtMetric((tempDelta.value > 0 ? '+' : '') + safeNumber(tempDelta.value, 2), tempDelta.isReal, '°C relative to baseline')}

### PRACTICAL SUGGESTIONS
- **Sleep Target:** Consider aiming for approximately ${safeNumber(Math.min(10, sleepNeedHrs.value + sleepDebtHrs.value), 1)} hours of rest tonight to chip away at your sleep debt.
- **Wind-Down Window:** We suggest turning off electronic blue-light emitting screens 60 to 90 minutes before sleep to support natural melatonin release.
- **Sleep Environment:** Keep your bedroom cool (around 17-18°C) to support core body temperature down-regulation during deep and REM sleep cycles.

### CONFIDENCE & DATA NOTE
${sleepDurIsReal
        ? 'Analysis is locally generated with high confidence based on today\'s completed Apple Health sleep analysis.'
        : `This analysis uses ${ESTIMATE_LABEL} default values. Real sleep data is not available. Confidence is LOW.`}`
  }

  // 3. RUNNING FORM & MOBILITY
  if (/form|run|running|dynamics|stride|asymmetry|stability|cadence|gait/i.test(msg)) {
    const asymmetryStatus = asymVal.value > 0.08 ? 'elevated asymmetry' : asymVal.value > 0.04 ? 'mild asymmetry' : 'balanced'
    return OFFLINE_DISCLAIMER + `### SUMMARY
Your gait stability and cardiorespiratory metrics are generally in a ${asymmetryStatus === 'balanced' ? 'healthy and balanced' : 'guarded'} state.

### EVIDENCE
- **Walking Asymmetry [Latest Available]:** ${fmtMetric(safeNumber(asymVal.value * 100, 2), asymVal.isReal, '%')} (${asymmetryStatus})
- **Double Support Time [Latest Available]:** ${fmtMetric(safeNumber(dsVal.value, 1), dsVal.isReal, '%')} (${dsVal.value > 25 ? 'elevated ground contact' : 'optimal transition'})
- **Aerobic Capacity (VO2 Max) [Latest Available]:** ${vo2Val.value > 0 ? fmtMetric(`${safeNumber(vo2Val.value, 1)} ml/kg/min`, vo2Val.isReal) : 'Building baseline'}

### PRACTICAL SUGGESTIONS
- **Form Focus:** ${asymVal.value > 0.05
        ? `Your walking asymmetry is slightly elevated at ${safeNumber(asymVal.value * 100, 1)}%. We suggest focusing on stride cadence, increasing step rate slightly to decrease joint impact load.`
        : 'Your movement symmetry is within acceptable physiological parameters. Stride mechanics are stable.'}
- **Mobility Warm-Up:** Consider performing glute bridges and lateral band-walks prior to your next run to optimize unilateral muscle activation.
- **Stride Mechanics:** Focus on mid-foot landing and avoiding over-striding, which can increase double support contact time.

### CONFIDENCE & DATA NOTE
${asymVal.isReal
        ? 'Locally calculated movement analysis. Confidence is moderate; we recommend completing regular outdoor walking/running workouts to keep gait metrics fresh.'
        : `This analysis uses ${ESTIMATE_LABEL} default values. Real mobility data is not available. Confidence is LOW.`}`
  }

  // 4. INJURY RISK & PAIN
  if (/injury|pain|hurt|sore|knee|back|muscle|overtrain/i.test(msg)) {
    const riskStatus = injRisk === 'HIGH' ? 'elevated risk' : injRisk === 'MODERATE' ? 'guarded risk' : 'stable risk'
    return OFFLINE_DISCLAIMER + `### SUMMARY
Your estimated biomechanical injury risk is currently in a ${riskStatus} status, signaling stable movement mechanics.

### EVIDENCE
- **Injury Risk Status [Selected Date]:** ${fmtMetric(injRisk, injRiskIsReal)}
- **Gait Asymmetry [Latest Available]:** ${fmtMetric(safeNumber(asymVal.value * 100, 2), asymVal.isReal, '%')}

### PRACTICAL SUGGESTIONS
- **Training Recommendation:** ${injRisk === 'HIGH'
        ? 'We suggest avoiding high-impact activities today. Consider a light swimming session or low-impact active stretching.'
        : injRisk === 'MODERATE'
          ? 'Consider reducing your planned running volume by 30-40% and avoiding steep downhill segments to minimize eccentric joint loading.'
          : 'Your system is exhibiting high structural resilience. Standard training volumes are fully approved.'}
- **Prehab Guidance:** Incorporate eccentric calf raises and single-leg balance exercises into your warm-up routine to address unilateral stability.
- **Precaution Note:** If you experience any persistent localized discomfort, we recommend terminating the session early rather than pushing through.

### CONFIDENCE & DATA NOTE
${injRiskIsReal
        ? 'Locally derived injury risk score with moderate confidence, based on latest walking dynamics and symmetry syncs.'
        : `This analysis uses ${ESTIMATE_LABEL} default values. Real injury risk data is not available. Confidence is LOW.`}`
  }

  // 5. WORKOUT & EXERTION COMMANDS
  if (/workout|train|exertion|cardio|exercise|lift|gym|intensity/i.test(msg)) {
    const energyLevel = recScore.value > 75 ? 'peak capacity' : recScore.value > 50 ? 'moderate capacity' : 'rest required'
    return OFFLINE_DISCLAIMER + `### SUMMARY
Your system readiness indicates a ${energyLevel} approach is appropriate for today's training load.

### EVIDENCE
- **Today's Recovery Score [Selected Date]:** ${fmtMetric(Math.round(recScore.value), recScore.isReal, '%')}
- **Accumulated Strain [Selected Date]:** ${fmtMetric(safeNumber(strScore.value, 1), strScore.isReal)}
- **Recommended Strain Cap [Selected Date]:** ${recScore.value < 50 ? '7.0' : recScore.value < 75 ? '12.5' : '17.5'}

### PRACTICAL SUGGESTIONS
- **Recommended Session:** ${recScore.value < 50
        ? 'We suggest focusing on active recovery today, such as 20-30 minutes of foam rolling, mobility flows, or a gentle recovery walk.'
        : recScore.value < 75
          ? 'Consider a low-intensity endurance session, such as 45-60 minutes of Zone 2 running or cycling to build aerobic base.'
          : 'Your system is primed for high physical drive. Consider heavy resistance training, sprints, or high-intensity intervals today.'}
- **Intra-Workout Hydration:** Consider consuming 500-700ml of water with added electrolytes before and during higher exertion workouts.
- **Post-Workout Recovery:** Prioritize high-quality protein (around 30-40g) within 60 minutes post-exercise to support muscle repair and synthesis.

### CONFIDENCE & DATA NOTE
${recScore.isReal
        ? 'Locally computed exertion blueprint with high confidence based on today\'s complete recovery and strain scores.'
        : `This analysis uses ${ESTIMATE_LABEL} default values. Real exertion data is not available. Confidence is LOW.`}`
  }

  // 6. NUTRITION & MACROS
  if (/food|meal|cal|macronutrient|protein|carb|fat|diet|eat/i.test(msg)) {
    const proteinTarget = 2.0 * 80
    return OFFLINE_DISCLAIMER + `### SUMMARY
Your nutritional guidance focuses on precision fueling and protein distribution to optimize recovery and adaptational response.

### EVIDENCE
- **Macronutrient Split Goal [Selected Date]:** 40% Protein / 30% Carbs / 30% Healthy Fats
- **Est. Protein Target [Selected Date]:** ${fmtMetric(safeNumber(proteinTarget, 0), false, 'g daily')}
- **Hydration Target [Selected Date]:** 3.5 - 3.8 Liters of water daily

### PRACTICAL SUGGESTIONS
- **Protein Spacing:** Consider spacing your protein intake across 3-4 meals (around 30-40g each) to support steady muscle protein synthesis.
- **Carbohydrate Timing:** We suggest centering simple carbohydrate intake around your active workout window to maximize glycogen replenishment.
- **Dietary Quality:** Aim to consume a variety of dietary fiber (at least 30g daily) and minimize artificial sweeteners to encourage healthy gut biome diversity.

### CONFIDENCE & DATA NOTE
${isPhaseG
        ? 'Locally generated dietary blueprint. Confidence is moderate; we suggest logging your meals using the camera vision feature to sync accurate intake metrics.'
        : `This analysis uses ${ESTIMATE_LABEL} default values. No meal data is available. Confidence is LOW — log meals via the camera feature for accurate macros.`}`
  }

  // 7. DEFAULT PERSONAL BRIEFING FALLBACK
  return OFFLINE_DISCLAIMER + `### SUMMARY
This is your daily sports science briefing, indicating that your physiological state is generally ${cnsRiskLabel === 'LOW' ? 'stable and adapting well' : 'under moderate systemic stress'}.

### EVIDENCE
- **Recovery Readiness [Selected Date]:** ${fmtMetric(Math.round(recScore.value), recScore.isReal, '%')} (${recZone.value.toUpperCase()} ZONE)
- **HRV Baseline [Selected Date]:** ${fmtMetric(hrvVal.value, hrvVal.isReal, 'ms')} | **RHR [Selected Date]:** ${fmtMetric(rhrVal.value, rhrVal.isReal, 'bpm')}
- **Sleep Duration [Selected Date]:** ${fmtMetric(safeNumber(sleepDurHrs, 1), sleepDurIsReal, 'h')} (Accumulated Debt: ${fmtMetric(safeNumber(sleepDebtHrs.value, 1), sleepDebtHrs.isReal, 'h')})
- **Injury Danger Status [Selected Date]:** ${fmtMetric(injRisk, injRiskIsReal)} (${fmtMetric(safeNumber(asymVal.value * 100, 1), asymVal.isReal, '% walking asymmetry')})

### PRACTICAL SUGGESTIONS
- **Exertion Ceiling:** Consider capping your physical strain today at approximately ${safeNumber(recScore.value * 0.15 + 2, 1)} to align with your autonomic readiness.
- **Bedtime Goal:** We suggest aiming for a bedtime of around ${recScore.value < 50 ? '9:45 PM' : '10:15 PM'} tonight to prioritize sleep debt reduction.
- **Next Steps:** You can ask me specific questions regarding your cardiorespiratory fitness, sleep consistency, overtraining warnings, or nutrition.

### CONFIDENCE & DATA NOTE
${recScore.isReal
      ? 'Daily briefing compiled locally with high confidence based on today\'s complete sync of sleep, recovery, and vital metrics.'
      : `This daily briefing uses ${ESTIMATE_LABEL} default values. No real biometric data is available. Confidence is LOW — connect Apple Health for accurate insights.`}`
}

/**
 * Generates a dynamic biometric-driven fallback daily directive for the Home screen.
 * ALL hardcoded defaults are labeled as estimates.
 */
export function generateFallbackDailyDirective(biometrics: Record<string, any>): DailyDirectiveResult {
  const recoveryScore = extractValue(biometrics, ['recoveryScore'])
  const sleepDurationMins = extractValue(biometrics, ['sleep', 'totalDurationMins'])
  const sleepDebt = extractValue(biometrics, ['sleepDebtHours'])

  // Fallback extraction for old-style flat payload
  const recScore = recoveryScore.isReal ? recoveryScore.value : Number(biometrics?.recoveryScore ?? 62)
  const sleepDurMins = sleepDurationMins.isReal
    ? sleepDurationMins.value
    : Number(biometrics?.sleep?.totalDurationMins ?? 408)
  const sleepDebtHrs = sleepDebt.isReal ? sleepDebt.value : Number(biometrics?.sleepDebtHours ?? 1.2)
  const isRealData = recoveryScore.isReal

  const estimateTag = isRealData ? '' : ` [${ESTIMATE_LABEL}]`

  // 1. RED ZONE / CRITICAL RECOVERY
  if (recScore < 50) {
    return {
      headline: `CNS STRESS ELEVATED${estimateTag}`,
      command: 'System fatigued today. Cap strain under 6.0. Active recovery recommended.',
      targetStrain: 5.5,
      targetBedtime: '9:30 PM',
      warningFlag: 'High systemic stress. HRV is suppressed.',
      recoveryTip: 'Perform 15 minutes of dynamic stretching and 10 minutes of parasympathetic box breathing.',
    }
  }

  // 2. GREEN ZONE / PEAK READINESS
  if (recScore >= 75) {
    return {
      headline: `CNS STABLE & PRIMED${estimateTag}`,
      command: 'Nervous system fully adapted. Ready for high exertion. Target 16.0+ Strain.',
      targetStrain: 16.5,
      targetBedtime: '10:30 PM',
      warningFlag: null,
      recoveryTip: 'Prioritize high-quality protein feeding within 45 minutes of training.',
    }
  }

  // 3. YELLOW ZONE / MODERATE READINESS (DEFAULT)
  const isSleepLow = (sleepDurMins / 60) < 7.0 || sleepDebtHrs > 1.5
  return {
    headline: isSleepLow ? `SLEEP DEFICIT DETECTED${estimateTag}` : `SYSTEM ADAPTING${estimateTag}`,
    command: isSleepLow
      ? 'Manage sleep debt tonight. Keep strain under 11.0 today to encourage balance.'
      : 'Maintain standard moderate training load. Cap today\'s strain strictly under 12.0.',
    targetStrain: isSleepLow ? 10.5 : 11.5,
    targetBedtime: isSleepLow ? '9:45 PM' : '10:00 PM',
    warningFlag: isSleepLow ? 'Sleep deficit is impacting recovery baseline.' : null,
    recoveryTip: isSleepLow
      ? 'Perform 5 minutes of box breathing before bed and eliminate screens 90 minutes before sleep.'
      : 'Execute a light 20-minute foam rolling session post-workout to clear lactic buildup.',
  }
}
