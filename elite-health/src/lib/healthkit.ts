/**
 * V4 HealthKit Pipeline — Real Data from Apple Watch Ultra 2 + iPhone 15 Pro
 *
 * Targets @kingstinct/react-native-healthkit@14 (NitroModules API).
 * Every query is bounded by the device's LOCAL timezone.
 * Diagnostic logging prefixed with [HK] for easy filtering in Metro console.
 */

let HealthKit: any = null
let _hkModuleLoaded = false

try {
  const mod = require('@kingstinct/react-native-healthkit')
  HealthKit = mod
  _hkModuleLoaded = true
  console.log('[HK] ✅ HealthKit module loaded. Keys:', Object.keys(mod).filter(k => k.startsWith('query') || k.startsWith('is') || k === 'default' || k === 'requestAuthorization').join(', '))
  // If the module has a .default, log that too
  if (mod.default) {
    console.log('[HK] Module has .default export with keys:', Object.keys(mod.default).filter(k => k.startsWith('query') || k.startsWith('is')).join(', '))
  }
} catch (e) {
  console.warn('[HK] ❌ HealthKit module not found (running in Expo Go). Mocks will be used.', e)
}

import type {
  VitalsRecord,
  SleepRecord,
  ActivityRecord,
  RunningDynamics,
  WeightRecord,
  MobilityRecord,
  EnvironmentalRecord,
  CardioMetabolicRecord
} from './types'
import { normalizeSpO2, normalizeSkinTempDelta } from './utils/metric-normalization'
import { insertRawSample, insertRawSamples } from './db'

// ── Identifier Constants (v14 uses raw string literals, not runtime objects) ─

const Q = {
  HRV: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' as const,
  RHR: 'HKQuantityTypeIdentifierRestingHeartRate' as const,
  SPO2: 'HKQuantityTypeIdentifierOxygenSaturation' as const,
  RR: 'HKQuantityTypeIdentifierRespiratoryRate' as const,
  WRIST_TEMP: 'HKQuantityTypeIdentifierAppleSleepingWristTemperature' as const,
  BODY_MASS: 'HKQuantityTypeIdentifierBodyMass' as const,
  LEAN_BODY_MASS: 'HKQuantityTypeIdentifierLeanBodyMass' as const,
  RUNNING_POWER: 'HKQuantityTypeIdentifierRunningPower' as const,
  GROUND_CONTACT: 'HKQuantityTypeIdentifierRunningGroundContactTime' as const,
  VERTICAL_OSC: 'HKQuantityTypeIdentifierRunningVerticalOscillation' as const,
  STRIDE_LENGTH: 'HKQuantityTypeIdentifierRunningStrideLength' as const,
  ACTIVE_ENERGY: 'HKQuantityTypeIdentifierActiveEnergyBurned' as const,
  HEART_RATE: 'HKQuantityTypeIdentifierHeartRate' as const,
  STEP_COUNT: 'HKQuantityTypeIdentifierStepCount' as const,

  // New cardiovascular & metabolic
  VO2_MAX: 'HKQuantityTypeIdentifierVO2Max' as const,
  WALKING_HR_AVG: 'HKQuantityTypeIdentifierWalkingHeartRateAverage' as const,
  RESTING_ENERGY: 'HKQuantityTypeIdentifierBasalEnergyBurned' as const,
  PHYSICAL_EFFORT: 'HKQuantityTypeIdentifierPhysicalEffort' as const,
  // New biomechanical & mobility
  WALKING_SPEED: 'HKQuantityTypeIdentifierWalkingSpeed' as const,
  WALKING_STEP_LENGTH: 'HKQuantityTypeIdentifierWalkingStepLength' as const,
  WALKING_ASYMMETRY: 'HKQuantityTypeIdentifierWalkingAsymmetryPercentage' as const,
  DOUBLE_SUPPORT: 'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage' as const,
  STAIR_SPEED_UP: 'HKQuantityTypeIdentifierStairAscentSpeed' as const,
  STAIR_SPEED_DOWN: 'HKQuantityTypeIdentifierStairDescentSpeed' as const,
  FLIGHTS_CLIMBED: 'HKQuantityTypeIdentifierFlightsClimbed' as const,
  // Environmental & lifestyle
  TIME_IN_DAYLIGHT: 'HKQuantityTypeIdentifierTimeInDaylight' as const,
  HEADPHONE_AUDIO: 'HKQuantityTypeIdentifierHeadphoneAudioExposure' as const,
  EXERCISE_MINUTES: 'HKQuantityTypeIdentifierAppleExerciseTime' as const,
  STAND_MINUTES: 'HKQuantityTypeIdentifierAppleStandTime' as const,
  BREATHING_DISTURBANCES: 'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances' as const,
  HR_RECOVERY: 'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute' as const,
} as const

const C = {
  SLEEP: 'HKCategoryTypeIdentifierSleepAnalysis' as const,
  MINDFUL: 'HKCategoryTypeIdentifierMindfulSession' as const,
} as const

// CategoryValueSleepAnalysis enum values (from HealthKit)
const SLEEP_VALUES = {
  inBed: 0,
  asleepUnspecified: 1,
  asleep: 1,
  awake: 2,
  asleepCore: 3,
  asleepDeep: 4,
  asleepREM: 5,
} as const

// ── Timezone Boundary Utilities ─────────────────────────────────────────────

export function startOfDayLocal(date: Date = new Date()): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T00:00:00.000`
}

export function endOfDayLocal(date: Date = new Date()): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T23:59:59.999`
}

export function localDateString(date: Date = new Date()): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateToStartDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function localDateToEndDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

export function localDateToStartISO(dateStr: string): string {
  return localDateToStartDate(dateStr).toISOString()
}

export function localDateToEndISO(dateStr: string): string {
  return localDateToEndDate(dateStr).toISOString()
}

function dateFilter(dateStr: string) {
  return {
    date: {
      startDate: localDateToStartDate(dateStr),
      endDate: localDateToEndDate(dateStr),
    },
  }
}

function logQueryError(context: string, dateStr: string, error: any) {
  const errMsg = error?.message || String(error);
  if (errMsg.includes('Protected health data is inaccessible')) {
    console.warn(`[HK] ❌ ${context} query failed for ${dateStr} because the iOS device/simulator is LOCKED. Please unlock the screen to allow access to encrypted health database.`);
  } else {
    console.warn(`[HK] ❌ ${context} query failed for ${dateStr}:`, error);
  }
}

// ── Phase B: Raw Sample Dual-Write Helpers ───────────────────────────────────

let _currentSyncRunId: number | null = null

export function setCurrentSyncRunId(id: number | null): void {
  _currentSyncRunId = id
}

export function getCurrentSyncRunId(): number | null {
  return _currentSyncRunId
}

function buildCanonicalId(sourceId: string, metricName: string, startTime: string): string {
  return `${sourceId}::${metricName}::${startTime}`
}

function deriveLocalDayKey(isoString: string): string {
  return isoString.slice(0, 10)
}

function hkSampleToRaw(params: {
  sourceUUID?: string
  sourceApp?: string
  sourceDevice?: string
  domain: string
  metricName: string
  value?: number
  unit?: string
  startTime: string
  endTime: string
  timezone?: string
  metadata?: Record<string, unknown>
}): {
  canonical_id: string
  source_type: string
  source_app: string | null
  source_device: string | null
  domain: string
  metric_name: string
  value: number | null
  unit: string | null
  start_time: string
  end_time: string
  local_day_key: string
  timezone: string | null
  metadata_json: string | null
  sync_run_id: number | null
  status: string
} {
  const sourceId = params.sourceUUID ?? `${params.domain}/${params.metricName}/${params.startTime}`
  return {
    canonical_id: buildCanonicalId(sourceId, params.metricName, params.startTime),
    source_type: 'healthkit',
    source_app: params.sourceApp ?? null,
    source_device: params.sourceDevice ?? null,
    domain: params.domain,
    metric_name: params.metricName,
    value: params.value ?? null,
    unit: params.unit ?? null,
    start_time: params.startTime,
    end_time: params.endTime,
    local_day_key: deriveLocalDayKey(params.startTime),
    timezone: params.timezone ?? null,
    metadata_json: params.metadata ? JSON.stringify(params.metadata) : null,
    sync_run_id: _currentSyncRunId ?? null,
    status: 'active',
  }
}

// ── HealthKit Availability ─────────────────────────────────────────────────

// Cache the result so we only check once per session
let _hkAvailableCache: boolean | null = null

function hkAvailable(): boolean {
  if (_hkAvailableCache !== null) return _hkAvailableCache

  if (!HealthKit) {
    console.log('[HK] hkAvailable → false (module not loaded)')
    _hkAvailableCache = false
    return false
  }

  try {
    // Try named export first (how v14 exports it)
    if (typeof HealthKit.isHealthDataAvailable === 'function') {
      const result = HealthKit.isHealthDataAvailable()
      console.log('[HK] hkAvailable (named export) →', result)
      _hkAvailableCache = result === true
      return _hkAvailableCache
    }
    // Try .default (some bundler configurations)
    if (typeof HealthKit.default?.isHealthDataAvailable === 'function') {
      const result = HealthKit.default.isHealthDataAvailable()
      console.log('[HK] hkAvailable (.default) →', result)
      // If .default works, redirect all calls through it
      HealthKit = HealthKit.default
      _hkAvailableCache = result === true
      return _hkAvailableCache
    }
    console.log('[HK] hkAvailable → false (isHealthDataAvailable not found on module)')
    _hkAvailableCache = false
    return false
  } catch (e) {
    console.warn('[HK] hkAvailable → false (exception):', e)
    _hkAvailableCache = false
    return false
  }
}

// ── HealthKit Permissions ──────────────────────────────────────────────────

export const requestHealthPermissions = async (): Promise<boolean> => {
  try {
    if (!hkAvailable()) {
      console.log('[HK] HealthKit not available — skipping permissions. No mock data will be generated.')
      return false
    }

    console.log('[HK] Requesting HealthKit authorization...')
    // v14 requestAuthorization takes { toRead, toShare }
    const result = await HealthKit.requestAuthorization({
      toRead: [
        Q.HRV, Q.RHR, Q.SPO2, Q.RR, Q.WRIST_TEMP,
        Q.BODY_MASS, Q.LEAN_BODY_MASS,
        Q.RUNNING_POWER, Q.GROUND_CONTACT, Q.VERTICAL_OSC, Q.STRIDE_LENGTH,
        Q.ACTIVE_ENERGY, Q.HEART_RATE, Q.STEP_COUNT,
        Q.VO2_MAX, Q.WALKING_HR_AVG, Q.RESTING_ENERGY, Q.PHYSICAL_EFFORT,
        Q.WALKING_SPEED, Q.WALKING_STEP_LENGTH, Q.WALKING_ASYMMETRY,
        Q.DOUBLE_SUPPORT, Q.STAIR_SPEED_UP, Q.STAIR_SPEED_DOWN, Q.FLIGHTS_CLIMBED,
        Q.TIME_IN_DAYLIGHT, Q.HEADPHONE_AUDIO, Q.EXERCISE_MINUTES, Q.STAND_MINUTES,
        Q.BREATHING_DISTURBANCES, Q.HR_RECOVERY,
        C.SLEEP, C.MINDFUL,
        'HKWorkoutTypeIdentifier',
      ],
      toShare: [],
    })
    console.log('[HK] ✅ Authorization result:', result)
    return true
  } catch (error) {
    console.warn('[HK] ❌ Authorization error:', error)
    return true
  }
}

// ── Vitals Fetch ───────────────────────────────────────────────────────────

export const fetchVitalsForDate = async (dateStr: string): Promise<VitalsRecord | null> => {
  console.log(`[HK] fetchVitalsForDate(${dateStr}) — hkAvailable=${hkAvailable()}`)
  if (hkAvailable()) {
    try {
      const filter = dateFilter(dateStr)
      const opts = { limit: 1, filter, ascending: false } as const

      console.log(`[HK] Querying vitals for ${dateStr}...`)
      const [hrvSamples, rhrSamples, spo2Samples, respSamples, tempSamples] =
        await Promise.all([
          HealthKit.queryQuantitySamples(Q.HRV, { ...opts, unit: 'ms' }),
          HealthKit.queryQuantitySamples(Q.RHR, { ...opts, unit: 'count/min' }),
          HealthKit.queryQuantitySamples(Q.SPO2, { ...opts, unit: '%' }),
          HealthKit.queryQuantitySamples(Q.RR, { ...opts, unit: 'count/min' }),
          HealthKit.queryQuantitySamples(Q.WRIST_TEMP, { ...opts, unit: 'degC' }),
        ])

      console.log(`[HK] Vitals query results — HRV:${hrvSamples?.length} RHR:${rhrSamples?.length} SpO2:${spo2Samples?.length} RR:${respSamples?.length} Temp:${tempSamples?.length}`)

      const hrvSample = hrvSamples?.[0]
      const rhrSample = rhrSamples?.[0]

      // Return real data even if only partial (don't require both HRV+RHR)
      if (hrvSample || rhrSample) {
        const vitals = {
          id: Date.now(),
          timestamp: `${dateStr}T06:30:00.000Z`, // Force timestamp to be anchored to the requested date
          hrv: hrvSample?.quantity ?? 0,
          rhr: rhrSample?.quantity ?? 0,
          spo2: normalizeSpO2(spo2Samples?.[0]?.quantity) ?? 0,
          respiratoryRate: respSamples?.[0]?.quantity ?? 0,
          skinTempDelta: normalizeSkinTempDelta(tempSamples?.[0]?.quantity) ?? 0,
        }
        // Validate: if both HRV and RHR are implausible (zero or out-of-range), treat as no data
        const { isPlausibleHRV, isPlausibleRHR } = require('./utils/validation')
        if (!isPlausibleHRV(vitals.hrv) && !isPlausibleRHR(vitals.rhr)) {
          console.log(`[HK] Vitals data found but all metrics invalid for ${dateStr}, returning null`)
          return null
        }
        console.log(`[HK] ✅ Real vitals: HRV=${vitals.hrv || '--'} RHR=${vitals.rhr || '--'} SpO2=${vitals.spo2 || '--'} RR=${vitals.respiratoryRate || '--'} Temp=${vitals.skinTempDelta || '--'}`)

        // Phase B: Dual-write raw samples alongside normalized vitals
        const vitalsRawSamples: Array<{
          canonical_id: string; source_type: string; source_app: string | null; source_device: string | null
          domain: string; metric_name: string; value: number | null; unit: string | null
          start_time: string; end_time: string; local_day_key: string; timezone: string | null
          metadata_json: string | null; sync_run_id: number | null; status: string
        }> = []
        const hkSource = (s: any) => s?.sourceRevision?.source
        const ts = `${dateStr}T06:30:00.000Z`

        if (hrvSample) vitalsRawSamples.push(hkSampleToRaw({
          sourceUUID: hrvSample.uuid, sourceApp: hkSource(hrvSample)?.bundleIdentifier,
          sourceDevice: hkSource(hrvSample)?.name,
          domain: 'vitals', metricName: 'hrv', value: hrvSample.quantity, unit: 'ms',
          startTime: ts, endTime: ts,
        }))
        if (rhrSample) vitalsRawSamples.push(hkSampleToRaw({
          sourceUUID: rhrSample.uuid, sourceApp: hkSource(rhrSample)?.bundleIdentifier,
          sourceDevice: hkSource(rhrSample)?.name,
          domain: 'vitals', metricName: 'rhr', value: rhrSample.quantity, unit: 'count/min',
          startTime: ts, endTime: ts,
        }))
        if (spo2Samples?.[0]) vitalsRawSamples.push(hkSampleToRaw({
          sourceUUID: spo2Samples[0].uuid, sourceApp: hkSource(spo2Samples[0])?.bundleIdentifier,
          sourceDevice: hkSource(spo2Samples[0])?.name,
          domain: 'vitals', metricName: 'spo2', value: normalizeSpO2(spo2Samples[0].quantity) ?? 0, unit: '%',
          startTime: ts, endTime: ts,
        }))
        if (respSamples?.[0]) vitalsRawSamples.push(hkSampleToRaw({
          sourceUUID: respSamples[0].uuid, sourceApp: hkSource(respSamples[0])?.bundleIdentifier,
          sourceDevice: hkSource(respSamples[0])?.name,
          domain: 'vitals', metricName: 'respiratory_rate', value: respSamples[0].quantity, unit: 'count/min',
          startTime: ts, endTime: ts,
        }))
        if (tempSamples?.[0]) vitalsRawSamples.push(hkSampleToRaw({
          sourceUUID: tempSamples[0].uuid, sourceApp: hkSource(tempSamples[0])?.bundleIdentifier,
          sourceDevice: hkSource(tempSamples[0])?.name,
          domain: 'vitals', metricName: 'skin_temp', value: normalizeSkinTempDelta(tempSamples[0].quantity) ?? 0, unit: 'degC',
          startTime: ts, endTime: ts,
        }))
        if (vitalsRawSamples.length > 0) {
          insertRawSamples(vitalsRawSamples).catch(err => console.warn('[HK] Raw sample dual-write (vitals) failed:', err))
        }

        return vitals
      }

      // No vitals data — return null (NOT zeros)
      console.log(`[HK] No vitals samples found for ${dateStr}, returning null`)
      return null
    } catch (e) {
      logQueryError('Vitals', dateStr, e)
      return null
    }
  }

  // HealthKit not available — return null, NO mock data
  console.log(`[HK] HealthKit unavailable — returning null for vitals on ${dateStr}`)
  return null
}

export const fetchTodayVitals = async (): Promise<VitalsRecord | null> => {
  return fetchVitalsForDate(localDateString())
}

// ── Sleep Fetch ────────────────────────────────────────────────────────────

export const fetchSleepForDate = async (dateStr: string): Promise<SleepRecord | null> => {
  console.log(`[HK] fetchSleepForDate(${dateStr}) — hkAvailable=${hkAvailable()}`)
  if (hkAvailable()) {
    try {
      // Sleep for "dateStr" spans the PREVIOUS evening → next morning.
      // e.g., sleep on May 18 = samples from May 17 @ 19:00 → May 18 @ 14:00
      const [y, m, d] = dateStr.split('-').map(Number)
      const windowStart = new Date(y, m - 1, d - 1, 19, 0, 0, 0)  // 7pm prev day
      const windowEnd = new Date(y, m - 1, d, 14, 0, 0, 0)       // 2pm same day

      const sleepSamples = await HealthKit.queryCategorySamples(C.SLEEP, {
        limit: 0,
        filter: {
          date: { startDate: windowStart, endDate: windowEnd },
        },
        ascending: true,
      })

      console.log(`[HK] Sleep query for ${dateStr}: ${sleepSamples?.length ?? 0} samples found`)
      if (sleepSamples?.[0]) {
        console.log(`[HK] First sleep sample:`, JSON.stringify({
          value: (sleepSamples[0] as any).value,
          startDate: sleepSamples[0].startDate,
          endDate: sleepSamples[0].endDate,
        }))
        let inBedMins = 0
        let asleepMins = 0
        let remMins = 0
        let deepMins = 0
        let coreMins = 0
        let awakeMins = 0

        let minStartMs = Infinity
        let maxEndMs = -Infinity

        for (const sample of sleepSamples) {
          const startMs = sample.startDate instanceof Date
            ? sample.startDate.getTime()
            : new Date(sample.startDate).getTime()
          const endMs = sample.endDate instanceof Date
            ? sample.endDate.getTime()
            : new Date(sample.endDate).getTime()

          if (startMs < minStartMs) minStartMs = startMs
          if (endMs > maxEndMs) maxEndMs = endMs

          const durationMins = (endMs - startMs) / 60000
          if (durationMins <= 0) continue

          const value: number = (sample as any).value ?? (sample as any).categoryType?.value

          if (value === SLEEP_VALUES.inBed) {
            inBedMins += durationMins
          } else if (value === SLEEP_VALUES.asleepUnspecified || value === SLEEP_VALUES.asleep) {
            asleepMins += durationMins
          } else if (value === SLEEP_VALUES.awake) {
            awakeMins += durationMins
          } else if (value === SLEEP_VALUES.asleepCore) {
            coreMins += durationMins
          } else if (value === SLEEP_VALUES.asleepDeep) {
            deepMins += durationMins
          } else if (value === SLEEP_VALUES.asleepREM) {
            remMins += durationMins
          }
        }

        const bedtimeStart = minStartMs !== Infinity ? new Date(minStartMs).toISOString() : undefined
        const wakeTimeEnd = maxEndMs !== -Infinity ? new Date(maxEndMs).toISOString() : undefined

        // Use staged sleep (Watch Ultra data) if available
        const hasStagedData = (coreMins + deepMins + remMins) > 0
        if (hasStagedData || asleepMins > 0 || awakeMins > 0) {
          const effectiveAsleep = coreMins + deepMins + remMins + asleepMins
          const sleepRecord = {
            id: Date.now(),
            date: dateStr,
            totalDurationMins: Math.round(effectiveAsleep + awakeMins),
            remMins: Math.round(remMins),
            deepMins: Math.round(deepMins),
            coreMins: Math.round(coreMins || asleepMins),
            awakeMins: Math.round(awakeMins),
            sleepNeedHours: 8,
            sleepDebtHours: undefined,
            bedtimeStart,
            wakeTimeEnd,
          }

          // Phase B: Dual-write raw sleep samples
          const sleepRawSamples: Array<{
            canonical_id: string; source_type: string; source_app: string | null; source_device: string | null
            domain: string; metric_name: string; value: number | null; unit: string | null
            start_time: string; end_time: string; local_day_key: string; timezone: string | null
            metadata_json: string | null; sync_run_id: number | null; status: string
          }> = []
          const hkSource = (s: any) => s?.sourceRevision?.source
          const bedStart = bedtimeStart ?? `${dateStr}T22:00:00.000Z`
          const wakeEnd = wakeTimeEnd ?? `${dateStr}T06:00:00.000Z`

          // Emit one raw sample per sleep stage segment (aggregate)
          if (remMins > 0) sleepRawSamples.push(hkSampleToRaw({ sourceUUID: sleepSamples[0].uuid, sourceApp: hkSource(sleepSamples[0])?.bundleIdentifier, sourceDevice: hkSource(sleepSamples[0])?.name, domain: 'sleep', metricName: 'rem', value: Math.round(remMins), unit: 'min', startTime: bedStart, endTime: wakeEnd }))
          if (deepMins > 0) sleepRawSamples.push(hkSampleToRaw({ sourceUUID: sleepSamples[0].uuid, sourceApp: hkSource(sleepSamples[0])?.bundleIdentifier, sourceDevice: hkSource(sleepSamples[0])?.name, domain: 'sleep', metricName: 'deep', value: Math.round(deepMins), unit: 'min', startTime: bedStart, endTime: wakeEnd }))
          if (coreMins > 0) sleepRawSamples.push(hkSampleToRaw({ sourceUUID: sleepSamples[0].uuid, sourceApp: hkSource(sleepSamples[0])?.bundleIdentifier, sourceDevice: hkSource(sleepSamples[0])?.name, domain: 'sleep', metricName: 'core', value: Math.round(coreMins), unit: 'min', startTime: bedStart, endTime: wakeEnd }))
          if (asleepMins > 0 && !hasStagedData) sleepRawSamples.push(hkSampleToRaw({ sourceUUID: sleepSamples[0].uuid, sourceApp: hkSource(sleepSamples[0])?.bundleIdentifier, sourceDevice: hkSource(sleepSamples[0])?.name, domain: 'sleep', metricName: 'asleep', value: Math.round(asleepMins), unit: 'min', startTime: bedStart, endTime: wakeEnd }))
          if (awakeMins > 0) sleepRawSamples.push(hkSampleToRaw({ sourceUUID: sleepSamples[0].uuid, sourceApp: hkSource(sleepSamples[0])?.bundleIdentifier, sourceDevice: hkSource(sleepSamples[0])?.name, domain: 'sleep', metricName: 'awake', value: Math.round(awakeMins), unit: 'min', startTime: bedStart, endTime: wakeEnd }))
          sleepRawSamples.push(hkSampleToRaw({ sourceUUID: sleepSamples[0].uuid, sourceApp: hkSource(sleepSamples[0])?.bundleIdentifier, sourceDevice: hkSource(sleepSamples[0])?.name, domain: 'sleep', metricName: 'total_duration', value: Math.round(effectiveAsleep + awakeMins), unit: 'min', startTime: bedStart, endTime: wakeEnd }))

          if (sleepRawSamples.length > 0) {
            insertRawSamples(sleepRawSamples).catch(err => console.warn('[HK] Raw sample dual-write (sleep) failed:', err))
          }

          return sleepRecord
        }

        // Fallback: only inBed data (iPhone without Watch) — do NOT fabricate sleep stages
        // Return sleep duration only with zero stages. Sleep algorithms check totalDurationMins > 0
        // and treat zero stage breakdowns as "no stage data available".
        if (inBedMins > 60) {
          const estimatedTotal = Math.round(inBedMins * 0.85)
          const sleepRecord = {
            id: Date.now(),
            date: dateStr,
            totalDurationMins: estimatedTotal,
            remMins: 0,
            deepMins: 0,
            coreMins: 0,
            awakeMins: 0,
            sleepNeedHours: 8,
            sleepDebtHours: undefined,
            bedtimeStart,
            wakeTimeEnd,
          }

          // Phase B: Dual-write raw sleep sample (inBed fallback)
          const hkSource = (s: any) => s?.sourceRevision?.source
          const bedStart = bedtimeStart ?? `${dateStr}T22:00:00.000Z`
          const wakeEnd = wakeTimeEnd ?? `${dateStr}T06:00:00.000Z`
          insertRawSample(hkSampleToRaw({ sourceUUID: sleepSamples[0].uuid, sourceApp: hkSource(sleepSamples[0])?.bundleIdentifier, sourceDevice: hkSource(sleepSamples[0])?.name, domain: 'sleep', metricName: 'total_duration', value: estimatedTotal, unit: 'min', startTime: bedStart, endTime: wakeEnd })).catch(err => console.warn('[HK] Raw sample dual-write (sleep/inBed) failed:', err))

          return sleepRecord
        }

        // No sleep data for this date — return null (NOT zeros)
        console.log(`No sleep samples found for ${dateStr} in HealthKit.`)
        return null
      }

      // Empty result — return null (NOT zeros)
      console.log(`No sleep samples found for ${dateStr} in HealthKit.`)
      return null
    } catch (e) {
      logQueryError('Sleep', dateStr, e)
      return null
    }
  }

  // HealthKit not available — return null, NO mock data
  console.log(`[HK] HealthKit unavailable — returning null for sleep on ${dateStr}`)
  return null
}

export const fetchTodaySleep = async (dateStr: string): Promise<SleepRecord | null> => {
  return fetchSleepForDate(dateStr || localDateString())
}

// ── Activities Fetch ───────────────────────────────────────────────────────

const WORKOUT_TYPE_MAP: Record<number, string> = {
  1: 'American Football', 2: 'Archery', 3: 'Australian Football', 4: 'Badminton',
  5: 'Baseball', 6: 'Basketball', 7: 'Bowling', 8: 'Boxing', 9: 'Climbing',
  10: 'Cricket', 11: 'Cross Training', 12: 'Curling', 13: 'Cycling',
  14: 'Dance', 15: 'Elliptical', 16: 'Equestrian Sports', 17: 'Fencing',
  18: 'Fishing', 19: 'Functional Training', 20: 'Golf', 21: 'Gymnastics',
  22: 'Handball', 23: 'Hiking', 24: 'Hockey', 25: 'Hunting',
  26: 'Lacrosse', 27: 'Martial Arts', 28: 'Mind & Body', 29: 'Paddling',
  30: 'Play', 31: 'Pre & Post Natal', 32: 'Racquetball', 33: 'Rowing',
  34: 'Rugby', 35: 'Running', 36: 'Sailing', 37: 'Skating Sports',
  38: 'Snow Sports', 39: 'Soccer', 40: 'Softball', 41: 'Squash',
  42: 'Stair Climbing', 43: 'Surfing Sports', 44: 'Swimming',
  45: 'Table Tennis', 46: 'Tai Chi', 47: 'Tennis', 48: 'Track & Field',
  49: 'Volleyball', 50: 'Walking', 51: 'Water Fitness',
  52: 'Traditional Strength Training', 53: 'Wrestling', 54: 'Yoga',
  55: 'Barre', 56: 'Core Training', 57: 'Cross Country Skiing',
  58: 'Downhill Skiing', 59: 'Flexibility', 60: 'High Intensity Interval Training',
  61: 'Jump Rope', 62: 'Kickboxing', 63: 'Pilates', 64: 'Snowboarding',
  65: 'Stairs', 66: 'Step Training', 67: 'Wheelchair Walk Pace',
  68: 'Wheelchair Run Pace', 69: 'Mixed Cardio', 70: 'Hand Cycling',
  71: 'Disc Sports', 72: 'Fitness Gaming', 73: 'Social Dance',
  74: 'Cardio Dance', 75: 'Cool Down', 76: 'Cooldown', 77: 'Pickleball',
  78: 'Coaching', 79: 'Recovery', 80: 'Other',
}

export const fetchActivitiesForDate = async (dateStr: string): Promise<ActivityRecord[]> => {
  if (hkAvailable()) {
    console.log(`fetchActivitiesForDate(${dateStr}) — hkAvailable=true`)
    try {
      const filter = dateFilter(dateStr)
      console.log(`Querying activities for ${dateStr}...`)

      const workouts = await HealthKit.queryWorkoutSamples({
        limit: 20,
        filter,
        ascending: false,
      })

      if (workouts && workouts.length > 0) {
        const records: ActivityRecord[] = []
        for (const w of workouts) {
          const start = w.startDate instanceof Date ? w.startDate : new Date(w.startDate)
          const end = w.endDate instanceof Date ? w.endDate : new Date(w.endDate)
          const durationMins = Math.round((end.getTime() - start.getTime()) / 60000)
          const workoutTypeId = typeof w.workoutActivityType === 'number'
            ? w.workoutActivityType
            : 80

          // Query actual heart rate samples during the workout session
          let hrSamples: { quantity: number; startDate: any }[] = []
          try {
            hrSamples = await HealthKit.queryQuantitySamples(Q.HEART_RATE, {
              filter: {
                date: { startDate: start, endDate: end },
              },
              unit: 'count/min',
              ascending: true,
              limit: 500,
            })
          } catch (hrErr) {
            console.warn(`[HK] Failed to fetch HR samples for workout on ${dateStr}:`, hrErr)
          }

          let hrZones = [0, 0, 0, 0, 0]
          let maxHR = 0
          let avgHR = 0

          if (hrSamples && hrSamples.length > 0) {
            const hrValues = hrSamples.map(s => s.quantity)
            maxHR = Math.round(Math.max(...hrValues))
            avgHR = Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)

            // Group into 5 zones based on max heart rate (standard 190 bpm default)
            const maxLimit = 190
            const z1Limit = maxLimit * 0.6
            const z2Limit = maxLimit * 0.7
            const z3Limit = maxLimit * 0.8
            const z4Limit = maxLimit * 0.9

            let z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0
            for (const val of hrValues) {
              if (val < z1Limit) z1++
              else if (val < z2Limit) z2++
              else if (val < z3Limit) z3++
              else if (val < z4Limit) z4++
              else z5++
            }

            const total = hrValues.length
            hrZones = [
              Math.round((z1 / total) * durationMins),
              Math.round((z2 / total) * durationMins),
              Math.round((z3 / total) * durationMins),
              Math.round((z4 / total) * durationMins),
              Math.round((z5 / total) * durationMins),
            ]
          } else {
            // Fallback default zones if watch wasn't worn or failed to return samples
            hrZones = [
              Math.round(durationMins * 0.3),
              Math.round(durationMins * 0.25),
              Math.round(durationMins * 0.2),
              Math.round(durationMins * 0.15),
              Math.round(durationMins * 0.1),
            ]
            maxHR = 145
            avgHR = 120
          }

          records.push({
            id: Date.now(),
            timestamp: `${dateStr}T${start.toISOString().split('T')[1]}`,
            activeCalories: Math.round(w.totalEnergyBurned?.quantity ?? 0),
            workoutType: WORKOUT_TYPE_MAP[workoutTypeId] ?? 'Other',
            durationMins,
            hrZones,
            maxHR,
            strainScore: null,
            avgHR,
          })
        }

        // Phase B: Dual-write raw workout/activity samples
        const activityRawSamples: Array<{
          canonical_id: string; source_type: string; source_app: string | null; source_device: string | null
          domain: string; metric_name: string; value: number | null; unit: string | null
          start_time: string; end_time: string; local_day_key: string; timezone: string | null
          metadata_json: string | null; sync_run_id: number | null; status: string
        }> = []
        for (const w of workouts) {
          const start = w.startDate instanceof Date ? w.startDate : new Date(w.startDate)
          const end = w.endDate instanceof Date ? w.endDate : new Date(w.endDate)
          const startISO = start.toISOString()
          const endISO = end.toISOString()
          const hkSource = (sample: any) => sample?.sourceRevision?.source
          const sourceApp = hkSource(w)?.bundleIdentifier ?? null
          const sourceDev = hkSource(w)?.name ?? null
          const durationMins = Math.round((end.getTime() - start.getTime()) / 60000)
          const workoutType = WORKOUT_TYPE_MAP[typeof w.workoutActivityType === 'number' ? w.workoutActivityType : 80] ?? 'Other'

          activityRawSamples.push(hkSampleToRaw({
            sourceUUID: w.uuid, sourceApp, sourceDevice: sourceDev,
            domain: 'activity', metricName: 'workout_duration', value: durationMins, unit: 'min',
            startTime: startISO, endTime: endISO,
            metadata: { workoutType, activeCalories: Math.round(w.totalEnergyBurned?.quantity ?? 0) },
          }))
          if (w.totalEnergyBurned?.quantity != null) {
            activityRawSamples.push(hkSampleToRaw({
              sourceUUID: w.uuid, sourceApp, sourceDevice: sourceDev,
              domain: 'activity', metricName: 'active_energy', value: Math.round(w.totalEnergyBurned.quantity), unit: 'kcal',
              startTime: startISO, endTime: endISO,
              metadata: { workoutType },
            }))
          }
        }
        if (activityRawSamples.length > 0) {
          insertRawSamples(activityRawSamples).catch(err => console.warn('[HK] Raw sample dual-write (activity) failed:', err))
        }

        return records
      }
      return []
    } catch (e) {
      logQueryError('Activities', dateStr, e)
      return []
    }
  }

  // HealthKit not available — return empty array, NO mock data
  console.log(`[HK] HealthKit unavailable — returning [] for activities on ${dateStr}`)
  return []
}

export const fetchTodayActivities = async (): Promise<ActivityRecord[]> => {
  return fetchActivitiesForDate(localDateString())
}

// ── Running Dynamics Fetch ─────────────────────────────────────────────────

export const fetchRunningDynamicsForDate = async (dateStr: string): Promise<RunningDynamics | null> => {
  if (hkAvailable()) {
    console.log(`fetchRunningDynamicsForDate(${dateStr}) — hkAvailable=true`)
    try {
      const filter = dateFilter(dateStr)
      console.log(`Querying running dynamics for ${dateStr}...`)
      const opts = { limit: 1, filter, ascending: false } as const

      const [power, gct, vert, stride] = await Promise.all([
        HealthKit.queryQuantitySamples(Q.RUNNING_POWER, { ...opts, unit: 'W' }),
        HealthKit.queryQuantitySamples(Q.GROUND_CONTACT, { ...opts, unit: 'ms' }),
        HealthKit.queryQuantitySamples(Q.VERTICAL_OSC, { ...opts, unit: 'cm' }),
        HealthKit.queryQuantitySamples(Q.STRIDE_LENGTH, { ...opts, unit: 'm' }),
      ])

      // Only return dynamics if we have at least one real value (> 0)
      const hasData = (power?.[0]?.quantity ?? 0) > 0
        || (gct?.[0]?.quantity ?? 0) > 0
        || (vert?.[0]?.quantity ?? 0) > 0
        || (stride?.[0]?.quantity ?? 0) > 0

      if (hasData) {
        const dynamics = {
          id: Date.now(),
          timestamp: `${dateStr}T08:30:00.000Z`,
          runningPower: power?.[0]?.quantity ?? 0,
          groundContactTime: gct?.[0]?.quantity ?? 0,
          verticalOscillation: vert?.[0]?.quantity ?? 0,
          strideLength: stride?.[0]?.quantity ?? 0,
        }

        // Phase B: Dual-write raw running dynamics samples
        const dynRawSamples: Array<{
          canonical_id: string; source_type: string; source_app: string | null; source_device: string | null
          domain: string; metric_name: string; value: number | null; unit: string | null
          start_time: string; end_time: string; local_day_key: string; timezone: string | null
          metadata_json: string | null; sync_run_id: number | null; status: string
        }> = []
        const hkSrc = (s: any) => s?.sourceRevision?.source
        const ts = dynamics.timestamp
        if (power?.[0]) dynRawSamples.push(hkSampleToRaw({ sourceUUID: power[0].uuid, sourceApp: hkSrc(power[0])?.bundleIdentifier, sourceDevice: hkSrc(power[0])?.name, domain: 'running', metricName: 'running_power', value: dynamics.runningPower, unit: 'W', startTime: ts, endTime: ts }))
        if (gct?.[0]) dynRawSamples.push(hkSampleToRaw({ sourceUUID: gct[0].uuid, sourceApp: hkSrc(gct[0])?.bundleIdentifier, sourceDevice: hkSrc(gct[0])?.name, domain: 'running', metricName: 'ground_contact_time', value: dynamics.groundContactTime, unit: 'ms', startTime: ts, endTime: ts }))
        if (vert?.[0]) dynRawSamples.push(hkSampleToRaw({ sourceUUID: vert[0].uuid, sourceApp: hkSrc(vert[0])?.bundleIdentifier, sourceDevice: hkSrc(vert[0])?.name, domain: 'running', metricName: 'vertical_oscillation', value: dynamics.verticalOscillation, unit: 'cm', startTime: ts, endTime: ts }))
        if (stride?.[0]) dynRawSamples.push(hkSampleToRaw({ sourceUUID: stride[0].uuid, sourceApp: hkSrc(stride[0])?.bundleIdentifier, sourceDevice: hkSrc(stride[0])?.name, domain: 'running', metricName: 'stride_length', value: dynamics.strideLength, unit: 'm', startTime: ts, endTime: ts }))
        if (dynRawSamples.length > 0) {
          insertRawSamples(dynRawSamples).catch(err => console.warn('[HK] Raw sample dual-write (running dynamics) failed:', err))
        }

        return dynamics
      }
      return null
    } catch (e) {
      logQueryError('Running dynamics', dateStr, e)
      return null
    }
  }

  // HealthKit not available — return null, NO mock data
  console.log(`[HK] HealthKit unavailable — returning null for running dynamics on ${dateStr}`)
  return null
}

export const fetchTodayRunningDynamics = async (): Promise<RunningDynamics | null> => {
  return fetchRunningDynamicsForDate(localDateString())
}

// ── Heart Rate Samples (for 24h spline chart) ──────────────────────────────

export interface HeartRateSample {
  timestamp: string
  bpm: number
}

export const fetchHeartRateSamplesForDate = async (dateStr: string): Promise<HeartRateSample[]> => {
  if (hkAvailable()) {
    try {
      const filter = dateFilter(dateStr)

      const samples = await HealthKit.queryQuantitySamples(Q.HEART_RATE, {
        limit: 288,
        filter,
        unit: 'count/min',
        ascending: true,
      })

      if (samples && samples.length > 0) {
        return samples.map((s: any) => ({
          timestamp: s.startDate instanceof Date
            ? s.startDate.toISOString()
            : String(s.startDate ?? s.timestamp ?? ''),
          bpm: s.quantity ?? 0,
        }))
      }
    } catch (e) {
      console.warn(`Failed to read HR samples for ${dateStr}, returning empty.`, e)
    }
  }

  // HealthKit not available — return empty array, NO mock data
  console.log(`[HK] HealthKit unavailable — returning [] for HR samples on ${dateStr}`)
  return []
}

// ── Mobility Fetch ──────────────────────────────────────────────────────────

export const fetchMobilityForDate = async (dateStr: string): Promise<MobilityRecord | null> => {
  console.log(`[HK] fetchMobilityForDate(${dateStr}) — hkAvailable=${hkAvailable()}`)
  if (hkAvailable()) {
    try {
      const filter = dateFilter(dateStr)
      const opts = { limit: 100, filter, ascending: false } as const
      const singleOpts = { limit: 1, filter, ascending: false } as const

      console.log(`[HK] Querying mobility for ${dateStr}...`)
      const [
        stepSamples,
        speedSamples,
        stepLengthSamples,
        asymmetrySamples,
        doubleSupportSamples,
        stairUpSamples,
        stairDownSamples,
        flightsSamples,
      ] = await Promise.all([
        HealthKit.queryQuantitySamples(Q.STEP_COUNT, { ...opts, unit: 'count' }),
        HealthKit.queryQuantitySamples(Q.WALKING_SPEED, { ...singleOpts, unit: 'm/s' }),
        HealthKit.queryQuantitySamples(Q.WALKING_STEP_LENGTH, { ...singleOpts, unit: 'm' }),
        HealthKit.queryQuantitySamples(Q.WALKING_ASYMMETRY, { ...singleOpts, unit: '%' }),
        HealthKit.queryQuantitySamples(Q.DOUBLE_SUPPORT, { ...singleOpts, unit: '%' }),
        HealthKit.queryQuantitySamples(Q.STAIR_SPEED_UP, { ...singleOpts, unit: 'm/s' }),
        HealthKit.queryQuantitySamples(Q.STAIR_SPEED_DOWN, { ...singleOpts, unit: 'm/s' }),
        HealthKit.queryQuantitySamples(Q.FLIGHTS_CLIMBED, { ...opts, unit: 'count' }),
      ])

      const totalSteps = stepSamples?.reduce((acc: number, s: any) => acc + (s.quantity ?? 0), 0) ?? 0
      const totalFlights = flightsSamples?.reduce((acc: number, s: any) => acc + (s.quantity ?? 0), 0) ?? 0

      if (totalSteps > 0 || speedSamples?.[0] || asymmetrySamples?.[0]) {
        const record = {
          id: Date.now(),
          date: dateStr,
          steps: Math.round(totalSteps),
          walkingSpeed: speedSamples?.[0]?.quantity ?? 0,
          walkingStepLength: stepLengthSamples?.[0]?.quantity ?? 0,
          walkingAsymmetry: asymmetrySamples?.[0]?.quantity ?? 0,
          doubleSupport: doubleSupportSamples?.[0]?.quantity ?? 0,
          stairSpeedUp: stairUpSamples?.[0]?.quantity ?? 0,
          stairSpeedDown: stairDownSamples?.[0]?.quantity ?? 0,
          flightsClimbed: Math.round(totalFlights),
        }
        console.log(`[HK] ✅ Real mobility: steps=${record.steps} asymmetry=${record.walkingAsymmetry}%`)

        // Phase B: Dual-write raw mobility samples
        const mobRawSamples: Array<{
          canonical_id: string; source_type: string; source_app: string | null; source_device: string | null
          domain: string; metric_name: string; value: number | null; unit: string | null
          start_time: string; end_time: string; local_day_key: string; timezone: string | null
          metadata_json: string | null; sync_run_id: number | null; status: string
        }> = []
        const hkSrcMob = (s: any) => s?.sourceRevision?.source
        const dayTs = `${dateStr}T12:00:00.000Z`
        if (totalSteps > 0) mobRawSamples.push(hkSampleToRaw({ sourceUUID: stepSamples?.[0]?.uuid, sourceApp: hkSrcMob(stepSamples?.[0])?.bundleIdentifier, sourceDevice: hkSrcMob(stepSamples?.[0])?.name, domain: 'mobility', metricName: 'steps', value: Math.round(totalSteps), unit: 'count', startTime: dayTs, endTime: dayTs }))
        if (speedSamples?.[0]) mobRawSamples.push(hkSampleToRaw({ sourceUUID: speedSamples[0].uuid, sourceApp: hkSrcMob(speedSamples[0])?.bundleIdentifier, sourceDevice: hkSrcMob(speedSamples[0])?.name, domain: 'mobility', metricName: 'walking_speed', value: speedSamples[0].quantity, unit: 'm/s', startTime: dayTs, endTime: dayTs }))
        if (stepLengthSamples?.[0]) mobRawSamples.push(hkSampleToRaw({ sourceUUID: stepLengthSamples[0].uuid, sourceApp: hkSrcMob(stepLengthSamples[0])?.bundleIdentifier, sourceDevice: hkSrcMob(stepLengthSamples[0])?.name, domain: 'mobility', metricName: 'walking_step_length', value: stepLengthSamples[0].quantity, unit: 'm', startTime: dayTs, endTime: dayTs }))
        if (asymmetrySamples?.[0]) mobRawSamples.push(hkSampleToRaw({ sourceUUID: asymmetrySamples[0].uuid, sourceApp: hkSrcMob(asymmetrySamples[0])?.bundleIdentifier, sourceDevice: hkSrcMob(asymmetrySamples[0])?.name, domain: 'mobility', metricName: 'walking_asymmetry', value: asymmetrySamples[0].quantity, unit: '%', startTime: dayTs, endTime: dayTs }))
        if (doubleSupportSamples?.[0]) mobRawSamples.push(hkSampleToRaw({ sourceUUID: doubleSupportSamples[0].uuid, sourceApp: hkSrcMob(doubleSupportSamples[0])?.bundleIdentifier, sourceDevice: hkSrcMob(doubleSupportSamples[0])?.name, domain: 'mobility', metricName: 'double_support', value: doubleSupportSamples[0].quantity, unit: '%', startTime: dayTs, endTime: dayTs }))
        if (stairUpSamples?.[0]) mobRawSamples.push(hkSampleToRaw({ sourceUUID: stairUpSamples[0].uuid, sourceApp: hkSrcMob(stairUpSamples[0])?.bundleIdentifier, sourceDevice: hkSrcMob(stairUpSamples[0])?.name, domain: 'mobility', metricName: 'stair_speed_up', value: stairUpSamples[0].quantity, unit: 'm/s', startTime: dayTs, endTime: dayTs }))
        if (stairDownSamples?.[0]) mobRawSamples.push(hkSampleToRaw({ sourceUUID: stairDownSamples[0].uuid, sourceApp: hkSrcMob(stairDownSamples[0])?.bundleIdentifier, sourceDevice: hkSrcMob(stairDownSamples[0])?.name, domain: 'mobility', metricName: 'stair_speed_down', value: stairDownSamples[0].quantity, unit: 'm/s', startTime: dayTs, endTime: dayTs }))
        if (totalFlights > 0) mobRawSamples.push(hkSampleToRaw({ sourceUUID: flightsSamples?.[0]?.uuid, sourceApp: hkSrcMob(flightsSamples?.[0])?.bundleIdentifier, sourceDevice: hkSrcMob(flightsSamples?.[0])?.name, domain: 'mobility', metricName: 'flights_climbed', value: Math.round(totalFlights), unit: 'count', startTime: dayTs, endTime: dayTs }))
        if (mobRawSamples.length > 0) {
          insertRawSamples(mobRawSamples).catch(err => console.warn('[HK] Raw sample dual-write (mobility) failed:', err))
        }

        return record
      }
      // No mobility data — return null
      console.log(`[HK] No mobility data for ${dateStr}, returning null`)
      return null
    } catch (e) {
      logQueryError('Mobility', dateStr, e)
      return null
    }
  }

  // HealthKit not available — return null, NO mock data
  console.log(`[HK] HealthKit unavailable — returning null for mobility on ${dateStr}`)
  return null
}

// ── Environmental Fetch ──────────────────────────────────────────────────────

export const fetchEnvironmentalForDate = async (dateStr: string): Promise<EnvironmentalRecord | null> => {
  console.log(`[HK] fetchEnvironmentalForDate(${dateStr}) — hkAvailable=${hkAvailable()}`)
  if (hkAvailable()) {
    try {
      const filter = dateFilter(dateStr)
      const opts = { limit: 100, filter, ascending: false } as const
      const singleOpts = { limit: 1, filter, ascending: false } as const

      console.log(`[HK] Querying environmental for ${dateStr}...`)
      // Unit strings: min (minute), dBASPL (decibel A-weighted sound pressure level)
      const [daylightSamples, audioSamples, exerciseSamples, standSamples, mindfulSamples] = await Promise.all([
        HealthKit.queryQuantitySamples(Q.TIME_IN_DAYLIGHT, { ...opts, unit: 'min' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.HEADPHONE_AUDIO, { ...singleOpts, unit: 'dBASPL' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.EXERCISE_MINUTES, { ...opts, unit: 'min' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.STAND_MINUTES, { ...opts, unit: 'min' }).catch(() => null),
        HealthKit.queryCategorySamples(C.MINDFUL, { limit: 100, filter, ascending: true }).catch(() => null),
      ])

      const totalDaylight = daylightSamples?.reduce((acc: number, s: any) => acc + (s.quantity ?? 0), 0) ?? 0
      const totalExercise = exerciseSamples?.reduce((acc: number, s: any) => acc + (s.quantity ?? 0), 0) ?? 0
      const totalStand = standSamples?.reduce((acc: number, s: any) => acc + (s.quantity ?? 0), 0) ?? 0

      let totalMindfulMins = 0
      if (mindfulSamples && mindfulSamples.length > 0) {
        for (const sample of mindfulSamples) {
          const startMs = sample.startDate instanceof Date
            ? sample.startDate.getTime()
            : new Date(sample.startDate).getTime()
          const endMs = sample.endDate instanceof Date
            ? sample.endDate.getTime()
            : new Date(sample.endDate).getTime()
          const durationMins = (endMs - startMs) / 60000
          if (durationMins > 0) {
            totalMindfulMins += durationMins
          }
        }
      }

      if (totalDaylight > 0 || audioSamples?.[0] || totalExercise > 0 || totalMindfulMins > 0) {
        const record = {
          id: Date.now(),
          date: dateStr,
          timeInDaylight: Math.round(totalDaylight),
          headphoneAudio: audioSamples?.[0]?.quantity ?? 0,
          exerciseMinutes: Math.round(totalExercise),
          standMinutes: Math.round(totalStand),
          standHours: Math.round(totalStand / 60), // basic estimation of hours they actually stood at least 1 min
          mindfulMinutes: Math.round(totalMindfulMins),
        }
        console.log(`[HK] ✅ Real environmental: daylight=${record.timeInDaylight} min audio=${record.headphoneAudio} dB mindful=${record.mindfulMinutes} min`)

        // Phase B: Dual-write raw environmental samples
        const envRawSamples: Array<{
          canonical_id: string; source_type: string; source_app: string | null; source_device: string | null
          domain: string; metric_name: string; value: number | null; unit: string | null
          start_time: string; end_time: string; local_day_key: string; timezone: string | null
          metadata_json: string | null; sync_run_id: number | null; status: string
        }> = []
        const hkSrcEnv = (s: any) => s?.sourceRevision?.source
        const dayTs = `${dateStr}T12:00:00.000Z`
        if (totalDaylight > 0) envRawSamples.push(hkSampleToRaw({ sourceUUID: daylightSamples?.[0]?.uuid, sourceApp: hkSrcEnv(daylightSamples?.[0])?.bundleIdentifier, sourceDevice: hkSrcEnv(daylightSamples?.[0])?.name, domain: 'environmental', metricName: 'time_in_daylight', value: Math.round(totalDaylight), unit: 'min', startTime: dayTs, endTime: dayTs }))
        if (audioSamples?.[0]) envRawSamples.push(hkSampleToRaw({ sourceUUID: audioSamples[0].uuid, sourceApp: hkSrcEnv(audioSamples[0])?.bundleIdentifier, sourceDevice: hkSrcEnv(audioSamples[0])?.name, domain: 'environmental', metricName: 'headphone_audio', value: audioSamples[0].quantity, unit: 'dBASPL', startTime: dayTs, endTime: dayTs }))
        if (totalExercise > 0) envRawSamples.push(hkSampleToRaw({ sourceUUID: exerciseSamples?.[0]?.uuid, sourceApp: hkSrcEnv(exerciseSamples?.[0])?.bundleIdentifier, sourceDevice: hkSrcEnv(exerciseSamples?.[0])?.name, domain: 'environmental', metricName: 'exercise_minutes', value: Math.round(totalExercise), unit: 'min', startTime: dayTs, endTime: dayTs }))
        if (totalStand > 0) envRawSamples.push(hkSampleToRaw({ sourceUUID: standSamples?.[0]?.uuid, sourceApp: hkSrcEnv(standSamples?.[0])?.bundleIdentifier, sourceDevice: hkSrcEnv(standSamples?.[0])?.name, domain: 'environmental', metricName: 'stand_minutes', value: Math.round(totalStand), unit: 'min', startTime: dayTs, endTime: dayTs }))
        if (totalMindfulMins > 0) envRawSamples.push(hkSampleToRaw({ sourceUUID: mindfulSamples?.[0]?.uuid, sourceApp: hkSrcEnv(mindfulSamples?.[0])?.bundleIdentifier, sourceDevice: hkSrcEnv(mindfulSamples?.[0])?.name, domain: 'environmental', metricName: 'mindful_minutes', value: Math.round(totalMindfulMins), unit: 'min', startTime: dayTs, endTime: dayTs }))
        if (envRawSamples.length > 0) {
          insertRawSamples(envRawSamples).catch(err => console.warn('[HK] Raw sample dual-write (environmental) failed:', err))
        }

        return record
      }
      // No environmental data — return null
      console.log(`[HK] No environmental data for ${dateStr}, returning null`)
      return null
    } catch (e) {
      logQueryError('Environmental', dateStr, e)
      return null
    }
  }

  // HealthKit not available — return null, NO mock data
  console.log(`[HK] HealthKit unavailable — returning null for environmental on ${dateStr}`)
  return null
}

// ── CardioMetabolic Fetch ────────────────────────────────────────────────────

export const fetchCardioMetabolicForDate = async (dateStr: string): Promise<CardioMetabolicRecord | null> => {
  console.log(`[HK] fetchCardioMetabolicForDate(${dateStr}) — hkAvailable=${hkAvailable()}`)
  if (hkAvailable()) {
    try {
      const filter = dateFilter(dateStr)
      const opts = { limit: 1, filter, ascending: false } as const
      const multiOpts = { limit: 100, filter, ascending: false } as const

      console.log(`[HK] Querying cardiometabolic for ${dateStr}...`)
      // Unit strings: ml/(kg*min) (VO2 max), count/min (walking HR), kcal (resting energy), count/hr (sleeping breathing disturbances)
      const [
        vo2Samples,
        walkingHRSamples,
        restingEnergySamples,
        effortSamples,
        breathingSamples,
        hrvSamples,
        rhrSamples,
        recoverySamples,
      ] = await Promise.all([
        HealthKit.queryQuantitySamples(Q.VO2_MAX, { ...opts, unit: 'ml/(kg*min)' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.WALKING_HR_AVG, { ...opts, unit: 'count/min' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.RESTING_ENERGY, { ...opts, unit: 'kcal' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.PHYSICAL_EFFORT, { ...opts, unit: 'kcal/(kg*hr)' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.BREATHING_DISTURBANCES, { ...opts, unit: 'count/hr' }).catch(() => null), // might not be supported on all versions
        HealthKit.queryQuantitySamples(Q.HRV, { ...opts, unit: 'ms' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.RHR, { ...opts, unit: 'count/min' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.HR_RECOVERY, { ...opts, unit: 'count/min' }).catch(() => null),
      ])

      if (vo2Samples?.[0] || restingEnergySamples?.[0] || walkingHRSamples?.[0] || recoverySamples?.[0]) {
        const totalRestingEnergy = restingEnergySamples?.reduce((acc: number, s: any) => acc + (s.quantity ?? 0), 0) ?? 0
        const record = {
          id: Date.now(),
          date: dateStr,
          vo2Max: vo2Samples?.[0]?.quantity ?? 0,
          walkingHRavg: walkingHRSamples?.[0]?.quantity ?? 0,
          restingEnergy: totalRestingEnergy,
          physicalEffort: effortSamples?.[0]?.quantity ?? 0,
          restingHeartRate: rhrSamples?.[0]?.quantity ?? 0,
          hrv: hrvSamples?.[0]?.quantity ?? 0,
          breathingDisturbances: breathingSamples?.[0]?.quantity ?? 0,
          hrRecovery: recoverySamples?.[0]?.quantity ?? 0,
        }
        console.log(`[HK] ✅ Real cardiometabolic: vo2Max=${record.vo2Max} restingEnergy=${record.restingEnergy} hrRecovery=${record.hrRecovery}`)

        // Phase B: Dual-write raw cardiometabolic samples
        const cardioRawSamples: Array<{
          canonical_id: string; source_type: string; source_app: string | null; source_device: string | null
          domain: string; metric_name: string; value: number | null; unit: string | null
          start_time: string; end_time: string; local_day_key: string; timezone: string | null
          metadata_json: string | null; sync_run_id: number | null; status: string
        }> = []
        const hkSrcCardio = (s: any) => s?.sourceRevision?.source
        const dayTs = `${dateStr}T12:00:00.000Z`
        if (vo2Samples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: vo2Samples[0].uuid, sourceApp: hkSrcCardio(vo2Samples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(vo2Samples[0])?.name, domain: 'cardio_metabolic', metricName: 'vo2_max', value: vo2Samples[0].quantity, unit: 'ml/(kg*min)', startTime: dayTs, endTime: dayTs }))
        if (walkingHRSamples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: walkingHRSamples[0].uuid, sourceApp: hkSrcCardio(walkingHRSamples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(walkingHRSamples[0])?.name, domain: 'cardio_metabolic', metricName: 'walking_hr_avg', value: walkingHRSamples[0].quantity, unit: 'count/min', startTime: dayTs, endTime: dayTs }))
        if (restingEnergySamples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: restingEnergySamples[0].uuid, sourceApp: hkSrcCardio(restingEnergySamples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(restingEnergySamples[0])?.name, domain: 'cardio_metabolic', metricName: 'resting_energy', value: totalRestingEnergy, unit: 'kcal', startTime: dayTs, endTime: dayTs }))
        if (effortSamples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: effortSamples[0].uuid, sourceApp: hkSrcCardio(effortSamples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(effortSamples[0])?.name, domain: 'cardio_metabolic', metricName: 'physical_effort', value: effortSamples[0].quantity, unit: 'kcal/(kg*hr)', startTime: dayTs, endTime: dayTs }))
        if (breathingSamples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: breathingSamples[0].uuid, sourceApp: hkSrcCardio(breathingSamples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(breathingSamples[0])?.name, domain: 'cardio_metabolic', metricName: 'breathing_disturbances', value: breathingSamples[0].quantity, unit: 'count/hr', startTime: dayTs, endTime: dayTs }))
        if (hrvSamples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: hrvSamples[0].uuid, sourceApp: hkSrcCardio(hrvSamples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(hrvSamples[0])?.name, domain: 'cardio_metabolic', metricName: 'hrv', value: hrvSamples[0].quantity, unit: 'ms', startTime: dayTs, endTime: dayTs }))
        if (rhrSamples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: rhrSamples[0].uuid, sourceApp: hkSrcCardio(rhrSamples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(rhrSamples[0])?.name, domain: 'cardio_metabolic', metricName: 'rhr', value: rhrSamples[0].quantity, unit: 'count/min', startTime: dayTs, endTime: dayTs }))
        if (recoverySamples?.[0]) cardioRawSamples.push(hkSampleToRaw({ sourceUUID: recoverySamples[0].uuid, sourceApp: hkSrcCardio(recoverySamples[0])?.bundleIdentifier, sourceDevice: hkSrcCardio(recoverySamples[0])?.name, domain: 'cardio_metabolic', metricName: 'hr_recovery', value: recoverySamples[0].quantity, unit: 'count/min', startTime: dayTs, endTime: dayTs }))
        if (cardioRawSamples.length > 0) {
          insertRawSamples(cardioRawSamples).catch(err => console.warn('[HK] Raw sample dual-write (cardiometabolic) failed:', err))
        }

        return record
      }
      // No cardiometabolic data — return null
      console.log(`[HK] No cardiometabolic data for ${dateStr}, returning null`)
      return null
    } catch (e) {
      logQueryError('CardioMetabolic', dateStr, e)
      return null
    }
  }

  // HealthKit not available — return null, NO mock data
  console.log(`[HK] HealthKit unavailable — returning null for cardiometabolic on ${dateStr}`)
  return null
}

export const fetchWeightForDate = async (dateStr: string): Promise<WeightRecord | null> => {
  console.log(`[HK] fetchWeightForDate(${dateStr}) — hkAvailable=${hkAvailable()}`)
  if (hkAvailable()) {
    try {
      const filter = dateFilter(dateStr)
      const opts = { limit: 1, filter, ascending: false } as const

      console.log(`[HK] Querying weight (body mass) for ${dateStr}...`)
      const [weightSamples, leanSamples] = await Promise.all([
        HealthKit.queryQuantitySamples(Q.BODY_MASS, { ...opts, unit: 'kg' }).catch(() => null),
        HealthKit.queryQuantitySamples(Q.LEAN_BODY_MASS, { ...opts, unit: '%' }).catch(() => null),
      ])

      const weightSample = weightSamples?.[0]
      if (weightSample && weightSample.quantity > 0) {
        const weightRecord = {
          id: Date.now(),
          timestamp: `${dateStr}T12:00:00.000Z`,
          weightKg: weightSample.quantity,
          leanBodyMassPercent: leanSamples?.[0]?.quantity ?? null,
        }

        // Phase B: Dual-write raw weight samples
        const hkSrcWt = (s: any) => s?.sourceRevision?.source
        const ts = weightRecord.timestamp
        insertRawSample(hkSampleToRaw({ sourceUUID: weightSample.uuid, sourceApp: hkSrcWt(weightSample)?.bundleIdentifier, sourceDevice: hkSrcWt(weightSample)?.name, domain: 'weight', metricName: 'weight_kg', value: weightSample.quantity, unit: 'kg', startTime: ts, endTime: ts })).catch(err => console.warn('[HK] Raw sample dual-write (weight) failed:', err))
        if (leanSamples?.[0] && leanSamples[0].quantity > 0) {
          insertRawSample(hkSampleToRaw({ sourceUUID: leanSamples[0].uuid, sourceApp: hkSrcWt(leanSamples[0])?.bundleIdentifier, sourceDevice: hkSrcWt(leanSamples[0])?.name, domain: 'weight', metricName: 'lean_body_mass_percent', value: leanSamples[0].quantity, unit: '%', startTime: ts, endTime: ts })).catch(err => console.warn('[HK] Raw sample dual-write (lean mass) failed:', err))
        }

        return weightRecord
      }
      return null
    } catch (e) {
      logQueryError('Weight', dateStr, e)
      return null
    }
  }

  // HealthKit not available — return null, NO mock data
  console.log(`[HK] HealthKit unavailable — returning null for weight on ${dateStr}`)
  return null
}

