export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'biological-age';

/**
 * Biological Age & Pace of Aging Engine
 *
 * Computes an estimated biological age and pace-of-aging multiplier
 * from a weighted composite of HealthKit biomarkers.
 *
 * Inputs (in order of weight):
 *   - HRV (resting heart rate variability, ms)
 *   - RHR (resting heart rate, bpm)
 *   - VO₂ Max (cardiorespiratory fitness, mL/kg/min)
 *   - SpO₂ (resting oxygen saturation, %)
 *   - Sleep quality (sleep duration / sleep need, 0–1)
 *
 * Confidence scales with number of valid inputs present.
 * Pace of aging is hard-capped at 2.5× to prevent extreme outputs
 * from sparse data.
 *
 * Instrumentation: logs inputs used, inputs missing, confidence,
 * and primary driver to console for debugging/QA.
 */

export interface BiologicalAgeResult {
  /** Integer display age (rounded, clamped [18,80]) — use for UI */
  displayAge: number;
  /** Raw unrounded biological age for internal calculations, trend computation, and exports */
  rawAge: number;
  /** @deprecated Use displayAge for UI, rawAge for calculations. Kept for backward compat. */
  biologicalAge: number;
  paceOfAging: number;
  /** 0–1 confidence based on how many inputs were usable */
  confidence: number;
  /** Names of biomarkers actually used in the computation */
  inputsUsed: string[];
  /** Names of biomarkers that were missing or invalid */
  inputsMissing: string[];
  /** Which input had the largest contribution (positive or negative) */
  primaryDriver: string;
}

/** Population reference values at age 25 */
const REF_25 = {
  hrv: 65,
  rhr: 62,
  spo2: 98,
  vo2max: 43, // mL/kg/min
} as const;

/** Population reference values at age 40 */
const REF_40 = {
  hrv: 55,
  rhr: 66,
  spo2: 97,
  vo2max: 36, // mL/kg/min
} as const;

/** Maximum allowed pace-of-aging multiplier */
const MAX_PACE = 2.5;

/**
 * Compute a z-score-like deviation for a single biomarker.
 * Positive = younger than reference (good for HRV, VO₂ Max, SpO₂).
 * Negative = older than reference (good for RHR).
 */
function biomarkerScore(
  value: number,
  ref25: number,
  ref40: number,
  higherIsBetter: boolean,
): number {
  const denominator = ref40 - ref25;
  if (Math.abs(denominator) < 1e-6) return 0;
  const raw = (value - ref25) / denominator;
  return higherIsBetter ? raw : -raw;
}

/**
 * How much this biomarker contributed to the composite.
 * Absolute value indicates magnitude; sign matches biomarkerScore direction.
 */
function contribution(
  value: number,
  ref25: number,
  ref40: number,
  weight: number,
  higherIsBetter: boolean,
): number {
  return biomarkerScore(value, ref25, ref40, higherIsBetter) * weight;
}

export function computeBiologicalAge(
  chronologicalAge: number,
  hrv: number,
  rhr: number,
  spo2: number,
  vo2max?: number | null,
  sleepQuality?: number | null,
): BiologicalAgeResult {
  // --- Determine which inputs are valid ---
  const hasHRV = hrv > 0 && hrv < 300;
  const hasRHR = rhr > 0 && rhr < 200;
  const hasSpO2 = spo2 > 0 && spo2 <= 100;
  const hasVO2Max = vo2max != null && vo2max > 10 && vo2max < 80;
  const hasSleepQuality = sleepQuality != null && sleepQuality > 0 && sleepQuality <= 1;

  const inputsUsed: string[] = [];
  const inputsMissing: string[] = [];

  if (hasHRV) inputsUsed.push('HRV');
  else inputsMissing.push('HRV');

  if (hasRHR) inputsUsed.push('RHR');
  else inputsMissing.push('RHR');

  if (hasSpO2) inputsUsed.push('SpO₂');
  else inputsMissing.push('SpO₂');

  if (hasVO2Max) inputsUsed.push('VO₂ Max');
  else inputsMissing.push('VO₂ Max');

  if (hasSleepQuality) inputsUsed.push('Sleep quality');
  else inputsMissing.push('Sleep quality');

  const totalPossible = 5;
  const activeCount = inputsUsed.length;

  // No usable inputs — return neutral baseline
  if (activeCount === 0) {
    console.log('[biological-age] No usable inputs. Returning neutral baseline.');
    return {
      displayAge: chronologicalAge,
      rawAge: chronologicalAge,
      biologicalAge: chronologicalAge,
      paceOfAging: 1.0,
      confidence: 0,
      inputsUsed: [],
      inputsMissing: ['HRV', 'RHR', 'SpO₂', 'VO₂ Max', 'Sleep quality'],
      primaryDriver: 'insufficient data',
    };
  }

  // --- Weights (sum to 1.0 with all inputs present) ---
  const weightHRV = 0.30;
  const weightRHR = 0.25;
  const weightSpO2 = 0.10;
  const weightVO2Max = 0.20;
  const weightSleepQuality = 0.15;

  // --- Per-biomarker contributions ---
  const contribs: { name: string; value: number }[] = [];

  const hrvContrib = hasHRV
    ? contribution(hrv, REF_25.hrv, REF_40.hrv, weightHRV, true)
    : 0;
  if (hasHRV) contribs.push({ name: 'HRV', value: hrvContrib });

  const rhrContrib = hasRHR
    ? contribution(rhr, REF_25.rhr, REF_40.rhr, weightRHR, false)
    : 0;
  if (hasRHR) contribs.push({ name: 'RHR', value: rhrContrib });

  const spo2Contrib = hasSpO2
    ? contribution(spo2, REF_25.spo2, REF_40.spo2, weightSpO2, true)
    : 0;
  if (hasSpO2) contribs.push({ name: 'SpO₂', value: spo2Contrib });

  const vo2maxContrib = hasVO2Max
    ? contribution(vo2max!, REF_25.vo2max, REF_40.vo2max, weightVO2Max, true)
    : 0;
  if (hasVO2Max) contribs.push({ name: 'VO₂ Max', value: vo2maxContrib });

  // Sleep quality: higher quality → younger biological age
  const sleepContrib = hasSleepQuality
    ? (sleepQuality! - 0.85) * weightSleepQuality * 2  // 0.85 = baseline sleep ratio
    : 0;
  if (hasSleepQuality) contribs.push({ name: 'Sleep quality', value: sleepContrib });

  // Normalize: divide by sum of active weights so missing inputs don't skew result
  const activeWeight =
    (hasHRV ? weightHRV : 0) +
    (hasRHR ? weightRHR : 0) +
    (hasSpO2 ? weightSpO2 : 0) +
    (hasVO2Max ? weightVO2Max : 0) +
    (hasSleepQuality ? weightSleepQuality : 0);

  const totalContrib =
    hrvContrib + rhrContrib + spo2Contrib + vo2maxContrib + sleepContrib;
  const compositeScore = activeWeight > 0 ? totalContrib / activeWeight : 0;

  // --- Biological age computation ---
  // Each 0.1 in composite ≈ 1 year of biological age shift
  const ageShift = compositeScore * 10;
  const biologicalAge = chronologicalAge + ageShift;
  const clampedAge = Math.round(Math.max(18, Math.min(80, biologicalAge)));

  // --- Pace of aging ---
  const ageRange = Math.max(1, chronologicalAge - 18);
  let paceOfAging = 1.0 + (clampedAge - chronologicalAge) / ageRange;

  // Hard cap at MAX_PACE (2.5×) to prevent extreme values
  paceOfAging = Math.max(0.1, Math.min(MAX_PACE, paceOfAging));
  const clampedPace = Math.round(paceOfAging * 100) / 100;

  // --- Confidence (0–1) ---
  // 2 inputs = 0.4, 3 = 0.6, 4 = 0.8, 5 = 1.0
  const confidence = Math.round((activeCount / totalPossible) * 100) / 100;

  // --- Primary driver (largest absolute contribution) ---
  let primaryDriver = 'balanced inputs';
  if (contribs.length > 0) {
    const sorted = [...contribs].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const top = sorted[0];
    const direction = top.value > 0 ? '↑' : '↓';
    primaryDriver = `${top.name} ${direction}`;
  }

  // --- Instrumentation logging ---
  console.log(
    '[biological-age]',
    `chronological=${chronologicalAge}, bio=${clampedAge}, pace=${clampedPace}×`,
    `| confidence=${confidence} | inputs=[${inputsUsed.join(', ')}]`,
    `| missing=[${inputsMissing.join(', ')}]`,
    `| driver=${primaryDriver}`,
  );

  return {
    displayAge: clampedAge,
    rawAge: biologicalAge,
    biologicalAge: clampedAge,
    paceOfAging: clampedPace,
    confidence,
    inputsUsed,
    inputsMissing,
    primaryDriver,
  };
}
