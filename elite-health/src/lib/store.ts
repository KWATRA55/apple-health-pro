import { create } from 'zustand'
import { getDB, getOne, getAll, runQuery, withTransaction, setSyncMeta, startSyncRun, updateSyncRun, completeSyncRun, insertDerivedOutput } from './db'
import { computeRecovery } from './algorithms/recovery'
import { computeStrain } from './algorithms/strain'
import { computeSleepDebt } from './algorithms/sleep-debt'
import { computeBiologicalAge } from './algorithms/biological-age'
import { computeIllnessRisk } from './algorithms/illness-predictor'
import { computeInjuryRisk as runInjuryPredictor } from './algorithms/injury-predictor'
import { computeCnsStress as runCnsStressPredictor } from './algorithms/cns-stress'
import { synthesize } from './algorithms/heuristic-synthesis'
import { computeTrendReport } from './algorithms/trend-engine'
import { buildPairedDays, computeCorrelationInsights, toCorrelationInsights } from './algorithms/habit-impact'
import { getRollingWindow } from './date'
import { getAlgorithmVersion } from './algorithms/registry'
import { computeSleepPerformance } from './algorithms/sleep-performance'
import {
  requestHealthPermissions,
  fetchVitalsForDate,
  fetchSleepForDate,
  fetchActivitiesForDate,
  fetchRunningDynamicsForDate,
  fetchMobilityForDate,
  fetchEnvironmentalForDate,
  fetchCardioMetabolicForDate,
  fetchWeightForDate,
  localDateString,
  getCurrentSyncRunId,
  setCurrentSyncRunId,
} from './healthkit'
import {
  areAllVitalsZero,
  isValidSleep,
  isValidMobility,
  isValidEnvironmental,
  isValidCardioMetabolic,
  isAllSleepZero,
  isAllMobilityZero,
} from './utils/validation'
import { invalidateAllCaches } from './utils/cache'
import type {
  HealthState,
  VitalsRecord,
  SleepRecord,
  ActivityRecord,
  MealRecord,
  DailyScores,
  RunningDynamics,
  WeightRecord,
  JournalEntry,
  SleepArchitecture,
  MobilityRecord,
  EnvironmentalRecord,
  CardioMetabolicRecord,
  InjuryRisk,
  CnsStressScore,
  TrendReport,
} from './types'

// ── Derived Result Cache ──────────────────────────────────────────────────────
// Module-level memoization to avoid recomputing expensive selectors on every render.
// Each cache entry stores [result, fingerprint] — fingerprint is a hash of the
// source data arrays; when fingerprint matches, cached result is returned.

type CacheEntry<T> = { result: T; fingerprint: string }

function fingerprint(state: HealthState): string {
  return [
    state.vitals.length,
    state.vitals[0]?.timestamp ?? '',
    state.sleep.length,
    state.sleep[0]?.date ?? '',
    state.scores.length,
    state.scores[0]?.date ?? '',
    state.mobility.length,
    state.environmental.length,
    state.cardioMetabolic.length,
    state.activities.length,
    state.journalEntries.length,
    state.runningDynamics.length,
  ].join('|')
}

const derivedCache = new Map<string, CacheEntry<unknown>>()

export function memoizedCompute<T>(key: string, state: HealthState, compute: () => T): T {
  const fp = fingerprint(state)
  const entry = derivedCache.get(key) as CacheEntry<T> | undefined
  if (entry && entry.fingerprint === fp) return entry.result
  const result = compute()
  derivedCache.set(key, { result, fingerprint: fp })
  return result
}

export function clearDerivedCache(): void {
  derivedCache.clear()
}

export const useHealthStore = create<HealthState>((set, get) => ({
  vitals: [],
  sleep: [],
  activities: [],
  meals: [],
  scores: [],
  runningDynamics: [],
  weightHistory: [],
  journalEntries: [],
  mobility: [],
  environmental: [],
  cardioMetabolic: [],
  injuryRisk: null,
  cnsStressScore: null,
  latestVitals: null,
  latestSleep: null,
  latestScores: null,
  selectedDate: localDateString(),
  isSyncing: false,
  isLoading: false,
  lastSync: null,
  initialSyncDone: false,
  _dbLoaded: false,
  profileAge: null,
  liveWorkout: null,

  addVitals: async (v) => {
    // Guard: reject records where ALL metrics are zero (no real data)
    if (areAllVitalsZero(v)) {
      console.log('[STORE] Skipping vitals — all metrics are zero')
      return
    }
    // Guard: reject records where both HRV and RHR are implausible
    if (v.hrv === 0 && v.rhr === 0) {
      console.log('[STORE] Skipping vitals — HRV and RHR both zero')
      return
    }
    await runQuery('DELETE FROM vitals WHERE timestamp >= ? AND timestamp <= ?',
      [`${v.timestamp.split('T')[0]}T00:00:00.000Z`, `${v.timestamp.split('T')[0]}T23:59:59.999Z`])
    const syncRunId = getCurrentSyncRunId()
    await runQuery(
      'INSERT INTO vitals (timestamp, hrv, rhr, spo2, respiratory_rate, skin_temp_delta, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [v.timestamp, v.hrv, v.rhr, v.spo2, v.respiratoryRate, v.skinTempDelta, syncRunId, new Date().toISOString()]
    )
    set(state => ({ vitals: [v, ...state.vitals.filter(vt => !vt.timestamp.startsWith(v.timestamp.split('T')[0])).slice(0, 99)], latestVitals: v }))
  },

  addSleep: async (record) => {
    // Guard: reject zero-duration sleep records
    if (isAllSleepZero(record) || !isValidSleep(record)) {
      console.log('[STORE] Skipping sleep — invalid or zero-duration')
      return
    }
    const syncRunId = getCurrentSyncRunId()
    await runQuery(
      'INSERT OR REPLACE INTO sleep (date, total_duration_mins, rem_mins, deep_mins, core_mins, awake_mins, bedtime_start, wake_time_end, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.date, record.totalDurationMins, record.remMins, record.deepMins, record.coreMins, record.awakeMins, record.bedtimeStart ?? null, record.wakeTimeEnd ?? null, syncRunId, new Date().toISOString()]
    )
    set(state => ({
      sleep: [record, ...state.sleep.filter(s => s.date !== record.date).slice(0, 49)],
      latestSleep: record,
    }))
  },

  addActivity: async (record) => {
    const strain = computeStrain(record.hrZones)
    const source = record.source ?? 'manual'
    const syncRunId = getCurrentSyncRunId()
    await runQuery('DELETE FROM activity WHERE timestamp = ?', [record.timestamp])
    await runQuery(
      'INSERT INTO activity (timestamp, active_calories, workout_type, duration_mins, hr_zones, max_hr, strain_score, avg_hr, source, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.timestamp, record.activeCalories, record.workoutType, record.durationMins, JSON.stringify(record.hrZones), record.maxHR, strain, record.avgHR, source, syncRunId, new Date().toISOString()]
    )
    const withStrain = { ...record, strainScore: strain, source }
    set(state => ({ activities: [withStrain, ...state.activities.filter(a => a.timestamp !== record.timestamp).slice(0, 99)] }))
  },

  addMeal: async (record) => {
    await runQuery(
      'INSERT INTO meals (timestamp, protein_grams, carbs_grams, fat_grams, total_calories, meal_description) VALUES (?, ?, ?, ?, ?, ?)',
      [record.timestamp, record.proteinGrams, record.carbsGrams, record.fatGrams, record.totalCalories, record.mealDescription]
    )
    set(state => ({ meals: [record, ...state.meals.slice(0, 99)] }))
  },

  addJournalEntry: async (entry) => {
    await runQuery(
      'INSERT OR REPLACE INTO journal_entries (date, habits, notes) VALUES (?, ?, ?)',
      [entry.date, JSON.stringify(entry.habits), entry.notes]
    )
    set(state => ({
      journalEntries: [entry, ...state.journalEntries.filter(j => j.date !== entry.date).slice(0, 99)],
    }))
  },

  addMobility: async (record) => {
    // Guard: reject all-zero mobility records
    if (isAllMobilityZero(record) || !isValidMobility(record)) {
      console.log('[STORE] Skipping mobility — invalid or all-zero')
      return
    }
    const syncRunId = getCurrentSyncRunId()
    await runQuery(
      'INSERT OR REPLACE INTO mobility (date, steps, walking_speed, walking_step_length, walking_asymmetry, double_support, stair_speed_up, stair_speed_down, flights_climbed, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.date, record.steps, record.walkingSpeed, record.walkingStepLength, record.walkingAsymmetry, record.doubleSupport, record.stairSpeedUp, record.stairSpeedDown, record.flightsClimbed, syncRunId, new Date().toISOString()]
    )
    set(state => ({
      mobility: [record, ...state.mobility.filter(m => m.date !== record.date).slice(0, 49)]
    }))
  },

  addEnvironmental: async (record) => {
    // Guard: reject environmental records with no meaningful data
    if (!isValidEnvironmental(record)) {
      console.log('[STORE] Skipping environmental — no meaningful data')
      return
    }
    const syncRunId = getCurrentSyncRunId()
    await runQuery(
      'INSERT OR REPLACE INTO environmental (date, time_in_daylight, headphone_audio, exercise_minutes, stand_minutes, stand_hours, mindful_minutes, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.date, record.timeInDaylight, record.headphoneAudio, record.exerciseMinutes, record.standMinutes, record.standHours, record.mindfulMinutes ?? 0, syncRunId, new Date().toISOString()]
    )
    set(state => ({
      environmental: [record, ...state.environmental.filter(e => e.date !== record.date).slice(0, 49)]
    }))
  },

  addCardioMetabolic: async (record) => {
    // Guard: reject cardiometabolic records with no valid data
    if (!isValidCardioMetabolic(record)) {
      console.log('[STORE] Skipping cardioMetabolic — invalid or all-zero')
      return
    }
    const syncRunId = getCurrentSyncRunId()
    await runQuery(
      'INSERT OR REPLACE INTO cardio_metabolic (date, vo2_max, walking_hr_avg, resting_energy, physical_effort, breathing_disturbances, hr_recovery, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.date, record.vo2Max, record.walkingHRavg, record.restingEnergy, record.physicalEffort, record.breathingDisturbances, record.hrRecovery ?? 0, syncRunId, new Date().toISOString()]
    )
    set(state => ({
      cardioMetabolic: [record, ...state.cardioMetabolic.filter(c => c.date !== record.date).slice(0, 49)]
    }))
  },

  addWeight: async (record) => {
    if (!record || record.weightKg <= 0) {
      console.log('[STORE] Skipping weight — invalid or zero weight')
      return
    }
    const syncRunId = getCurrentSyncRunId()
    await runQuery(
      'INSERT OR REPLACE INTO weight_history (timestamp, weight_kg, lean_body_mass_percent, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?)',
      [record.timestamp, record.weightKg, record.leanBodyMassPercent, syncRunId, new Date().toISOString()]
    )
    set(state => ({
      weightHistory: [record, ...state.weightHistory.filter(w => w.timestamp !== record.timestamp).slice(0, 49)]
    }))
  },

  computeInjuryRisk: () => {
    const state = get()
    const todayStr = localDateString()
    const todayMobility = state.mobility.find(m => m.date === todayStr) || state.mobility[0]
    const todayDynamics = state.runningDynamics.find(r => r.timestamp.startsWith(todayStr)) || state.runningDynamics[0]

    if (!todayMobility) {
      return {
        risk: 'LOW',
        confidence: 50,
        primaryMetric: 'No Data',
        secondaryMetrics: [],
        explanation: 'Insufficient mobility data synchronized. Complete a sync to generate predictive alerts.',
      }
    }

    const mobilityHistory = state.mobility
    const dynamicsHistory = state.runningDynamics

    const asymmetryBaseline = mobilityHistory.length > 0
      ? mobilityHistory.reduce((acc, m) => acc + m.walkingAsymmetry, 0) / mobilityHistory.length
      : 1.0

    const doubleSupportBaseline = mobilityHistory.length > 0
      ? mobilityHistory.reduce((acc, m) => acc + m.doubleSupport, 0) / mobilityHistory.length
      : 28.0

    const stairSpeedDownBaseline = mobilityHistory.length > 0
      ? mobilityHistory.reduce((acc, m) => acc + m.stairSpeedDown, 0) / mobilityHistory.length
      : 0.7

    const gctBaseline = dynamicsHistory.length > 0
      ? dynamicsHistory.reduce((acc, r) => acc + r.groundContactTime, 0) / dynamicsHistory.length
      : 220

    const todayAsymmetry = todayMobility.walkingAsymmetry
    const todayDoubleSupport = todayMobility.doubleSupport
    const todayStairSpeedDown = todayMobility.stairSpeedDown
    const todayGct = todayDynamics ? todayDynamics.groundContactTime : gctBaseline

    return runInjuryPredictor(
      todayAsymmetry,
      asymmetryBaseline,
      todayDoubleSupport,
      doubleSupportBaseline,
      todayStairSpeedDown,
      stairSpeedDownBaseline,
      todayGct,
      gctBaseline
    )
  },

  computeCnsStressScore: () => {
    const state = get()
    const todayStr = localDateString()

    const todayEnv = state.environmental.find(e => e.date === todayStr) || state.environmental[0]
    const todayCardio = state.cardioMetabolic.find(c => c.date === todayStr) || state.cardioMetabolic[0]
    const todayVitals = state.vitals.find(v => v.timestamp.startsWith(todayStr)) || state.vitals[0]
    const todaySleep = state.sleep.find(s => s.date === todayStr) || state.sleep[0]

    if (!todayEnv || !todayVitals) {
      return {
        risk: 'LOW',
        confidence: 50,
        audioLoad: 60,
        daylightDeficit: 15,
        hrvSuppression: 0,
        explanation: 'Insufficient physiological or lifestyle data synchronized. Complete a sync to generate stress reports.',
      }
    }

    const vitalsHistory = state.vitals
    const hrvBaseline = vitalsHistory.length > 0
      ? vitalsHistory.reduce((acc, v) => acc + v.hrv, 0) / vitalsHistory.length
      : 65

    const audio = todayEnv.headphoneAudio
    const daylight = todayEnv.timeInDaylight
    const hrvToday = todayVitals.hrv
    const sleepDuration = todaySleep ? todaySleep.totalDurationMins : 420
    const sleepNeed = todaySleep ? (todaySleep.sleepNeedHours * 60) : 480

    return runCnsStressPredictor(
      audio,
      daylight,
      hrvToday,
      hrvBaseline,
      sleepDuration,
      sleepNeed,
      todayEnv.mindfulMinutes ?? 0
    )
  },

  computeScores: async (date) => {
    const state = get()
    const { start } = getRollingWindow(14, date)

    const vitals14 = state.vitals.filter(v => v.timestamp >= `${start}T00:00:00.000Z` && v.timestamp <= `${date}T23:59:59.999Z`)
    const todayVitals = state.vitals.find(v => v.timestamp.startsWith(date))
    const todaySleep = state.sleep.find(s => s.date === date)
    const todayActivities = state.activities.filter(a => a.timestamp.startsWith(date))

    // Guard: skip score storage when there is NO real data for this date.
    // This prevents zero-confidence placeholder scores (bioAge=chronoAge, pace=1.0)
    // from being stored and rendered as if they were real metrics.
    const hasAnyRealData =
      (todayVitals && (todayVitals.hrv > 0 || todayVitals.rhr > 0)) ||
      (todaySleep && todaySleep.totalDurationMins > 0) ||
      todayActivities.length > 0

    if (!hasAnyRealData) {
      console.log(`[COMPUTE-SCORES] No real data for ${date} — skipping score storage`)
      await runQuery('DELETE FROM daily_scores WHERE date = ?', [date])
      set(state => ({
        scores: state.scores.filter(sc => sc.date !== date),
      }))
      return null
    }

    const recovery = computeRecovery({
      vitals: vitals14.map(v => ({ hrv: v.hrv, rhr: v.rhr })),
      todayVitals: todayVitals ? { hrv: todayVitals.hrv, rhr: todayVitals.rhr } : null,
      sleepRecord: todaySleep ? { totalDurationMins: todaySleep.totalDurationMins, sleepNeedHours: todaySleep.sleepNeedHours } : null,
    })

    const pastWeekSleep = state.sleep.filter(s => s.date >= start && s.date <= date)
    const sleepDebt = computeSleepDebt({
      todaySleep: todaySleep ? { totalDurationMins: todaySleep.totalDurationMins } : null,
      pastWeekSleep: pastWeekSleep.map(s => ({ totalDurationMins: s.totalDurationMins, sleepNeedHours: s.sleepNeedHours })),
    })

    const activities = state.activities.filter(a => a.timestamp.startsWith(date))
    const dailyStrain = activities.length > 0
      ? activities.reduce((sum, a) => sum + (a.strainScore ?? 0), 0)
      : 0

    // Use profileAge if set, otherwise default to 25 until user configures it
    const chronologicalAge = get().profileAge ?? 25

    // Look up cardio-metabolic data (needed by both bio age and illness risk)
    const todayCardio = state.cardioMetabolic.find(c => c.date === date)

    // Only compute biological age when we have real vitals data (not 0 sentinels)
    const hasRealHRV = todayVitals && todayVitals.hrv > 0
    const hasRealRHR = todayVitals && todayVitals.rhr > 0
    const hasRealSpO2 = todayVitals && todayVitals.spo2 > 0
    const canComputeBioAge = vitals14.length >= 3 && hasRealHRV && hasRealRHR

    let biologicalAge = chronologicalAge
    let displayAge = chronologicalAge
    let rawAge = chronologicalAge
    let paceOfAging = 1.0
    let bioAgeConfidence = 0
    let bioAgeInputsUsed: string[] = []
    let bioAgeInputsMissing: string[] = []
    let bioAgePrimaryDriver = 'insufficient data'
    if (canComputeBioAge) {
      // Gather optional inputs for richer computation
      const vo2max = todayCardio?.vo2Max ?? null
      const sleepQuality = todaySleep && todaySleep.totalDurationMins > 0 && todaySleep.sleepNeedHours > 0
        ? Math.min(1, todaySleep.totalDurationMins / (todaySleep.sleepNeedHours * 60))
        : null
      const result = computeBiologicalAge(
        chronologicalAge,
        todayVitals!.hrv,
        todayVitals!.rhr,
        hasRealSpO2 ? todayVitals!.spo2 : 98,
        vo2max,
        sleepQuality,
      )
      biologicalAge = result.displayAge
      displayAge = result.displayAge
      rawAge = result.rawAge
      paceOfAging = result.paceOfAging
      bioAgeConfidence = result.confidence
      bioAgeInputsUsed = result.inputsUsed
      bioAgeInputsMissing = result.inputsMissing
      bioAgePrimaryDriver = result.primaryDriver
    }
    // Only use baseline when we have ≥3 data points; otherwise 0 = no baseline
    const baseline14dHRV = vitals14.length >= 3
      ? vitals14.reduce((s, v) => s + v.hrv, 0) / vitals14.length
      : 0
    const baseline14dRHR = vitals14.length >= 3
      ? vitals14.reduce((s, v) => s + v.rhr, 0) / vitals14.length
      : 0

    const illness = computeIllnessRisk(
      todayVitals?.skinTempDelta ?? 0,
      todayVitals?.hrv ?? 0,
      baseline14dHRV,
      todayCardio?.breathingDisturbances ?? 0,
      todayVitals?.rhr ?? 0,
      baseline14dRHR,
      todayVitals?.spo2 ?? 0
    )

    const scores: DailyScores = {
      date,
      recoveryScore: recovery.recoveryScore,
      strainScore: Math.round(Math.min(21, dailyStrain) * 10) / 10,
      sleepDebtHours: sleepDebt.sleepDebtHours,
      sleepNeedHours: sleepDebt.sleepNeedHours,
      hrvZScore: recovery.hrvZScore,
      rhrZScore: recovery.rhrZScore,
      recoveryZone: recovery.zone,
      biologicalAge,
      displayAge,
      rawAge,
      paceOfAging,
      immunityRisk: illness.risk,
      bioAgeConfidence,
      bioAgeInputsUsed,
      bioAgeInputsMissing,
      bioAgePrimaryDriver,
    }

    const syncRunId = getCurrentSyncRunId()
    // Gather raw sample IDs for this date for provenance linking
    let sourceRawIds: string | null = null
    try {
      const rawSamples = await getAll<{ id: number }>(
        'SELECT id FROM raw_health_samples WHERE local_day_key = ?',
        [date]
      )
      if (rawSamples.length > 0) {
        sourceRawIds = JSON.stringify(rawSamples.map(r => r.id))
      }
    } catch (_) { /* best-effort */ }

    await runQuery(
      'INSERT OR REPLACE INTO daily_scores (date, recovery_score, strain_score, sleep_debt_hours, sleep_need_hours, hrv_z_score, rhr_z_score, recovery_zone, biological_age, pace_of_aging, immunity_risk, bio_age_confidence, bio_age_inputs_used, bio_age_inputs_missing, bio_age_primary_driver, sync_run_id, source_raw_sample_ids, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [date, scores.recoveryScore, scores.strainScore, scores.sleepDebtHours, scores.sleepNeedHours, scores.hrvZScore, scores.rhrZScore, scores.recoveryZone, scores.biologicalAge, scores.paceOfAging, scores.immunityRisk, scores.bioAgeConfidence, JSON.stringify(scores.bioAgeInputsUsed), JSON.stringify(scores.bioAgeInputsMissing), scores.bioAgePrimaryDriver, syncRunId, sourceRawIds, new Date().toISOString()]
    )

    // ── Phase F: Write derived outputs with version provenance ──────────────
    try {
      // Recovery score
      await insertDerivedOutput({
        output_type: 'recovery_score',
        algorithm_name: 'recovery',
        algorithm_version: getAlgorithmVersion('recovery') || 'unknown',
        date_key: date,
        confidence: recovery.recoveryScore / 100,
        source_raw_sample_ids: sourceRawIds,
        sync_run_id: syncRunId,
        payload_json: JSON.stringify({
          recoveryScore: recovery.recoveryScore,
          hrvZScore: recovery.hrvZScore,
          rhrZScore: recovery.rhrZScore,
          zone: recovery.zone,
          sleepQualityFactor: recovery.sleepQualityFactor,
        }),
        status: 'active',
      })

      // Strain score
      await insertDerivedOutput({
        output_type: 'strain_score',
        algorithm_name: 'strain',
        algorithm_version: getAlgorithmVersion('strain') || 'unknown',
        date_key: date,
        source_raw_sample_ids: sourceRawIds,
        sync_run_id: syncRunId,
        payload_json: JSON.stringify({
          strainScore: Math.round(Math.min(21, dailyStrain) * 10) / 10,
          activityCount: todayActivities.length,
        }),
        status: 'active',
      })

      // Sleep debt
      await insertDerivedOutput({
        output_type: 'sleep_debt',
        algorithm_name: 'sleep-debt',
        algorithm_version: getAlgorithmVersion('sleep-debt') || 'unknown',
        date_key: date,
        source_raw_sample_ids: sourceRawIds,
        sync_run_id: syncRunId,
        payload_json: JSON.stringify({
          sleepDebtHours: sleepDebt.sleepDebtHours,
          sleepNeedHours: sleepDebt.sleepNeedHours,
          baselineHours: sleepDebt.baselineHours,
          totalSleepMins: sleepDebt.totalSleepMins,
        }),
        status: 'active',
      })

      // Biological age
      await insertDerivedOutput({
        output_type: 'biological_age',
        algorithm_name: 'biological-age',
        algorithm_version: getAlgorithmVersion('biological-age') || 'unknown',
        date_key: date,
        confidence: bioAgeConfidence,
        source_raw_sample_ids: sourceRawIds,
        sync_run_id: syncRunId,
        payload_json: JSON.stringify({
          biologicalAge,
          paceOfAging,
          inputsUsed: bioAgeInputsUsed,
          inputsMissing: bioAgeInputsMissing,
          primaryDriver: bioAgePrimaryDriver,
        }),
        status: 'active',
      })

      // Illness risk
      await insertDerivedOutput({
        output_type: 'illness_risk',
        algorithm_name: 'illness-predictor',
        algorithm_version: getAlgorithmVersion('illness-predictor') || 'unknown',
        date_key: date,
        source_raw_sample_ids: sourceRawIds,
        sync_run_id: syncRunId,
        payload_json: JSON.stringify({
          risk: illness.risk,
          confidence: illness.confidence,
          explanation: illness.explanation,
        }),
        status: 'active',
      })
    } catch (derivedErr) {
      console.error('[COMPUTE-SCORES] Failed to write derived_outputs:', derivedErr)
    }

    set(state => ({
      scores: [scores, ...state.scores.filter(sc => sc.date !== date).slice(0, 49)],
      latestScores: scores,
    }))

    return scores
  },

  syncHealthKit: async () => {
    if (get().isSyncing) {
      console.log('[SYNC] Already syncing — skipping duplicate trigger')
      return
    }

    set({ isSyncing: true, isLoading: true })

    // Phase B: Start a sync run for provenance tracking
    let syncRunId: number | null = null
    try {
      console.log(`[SYNC] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`[SYNC] Starting HealthKit sync...`)

      const granted = await requestHealthPermissions()
      if (!granted) {
        console.log('[SYNC] HealthKit permissions not granted or unavailable — aborting sync')
        set({ isSyncing: false, isLoading: false, lastSync: `HK unavailable (${new Date().toLocaleTimeString()})` })
        return
      }

      // Step A — Query synced dates from SQLite
      const syncedDates = await getAll<{ date: string }>(
        'SELECT DISTINCT date FROM daily_scores ORDER BY date DESC'
      )
      const syncedSet = new Set(syncedDates.map(r => r.date))

      const today = localDateString()
      const yesterday = localDateString(new Date(Date.now() - 86400000))

      const datesToSync: string[] = []
      // ALWAYS sync today and yesterday (data is still accumulating)
      datesToSync.push(today)
      if (yesterday !== today && !datesToSync.includes(yesterday)) {
        datesToSync.push(yesterday)
      }

      // Only sync historical dates that are MISSING from the DB
      for (let i = 2; i < 30; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = localDateString(d)
        if (!syncedSet.has(ds)) {
          datesToSync.push(ds)
        }
      }

      console.log(`[SYNC] Smart Cache Guard: ${syncedSet.size} dates already synced, syncing ${datesToSync.length} dates`)

      // Phase B: Initialize sync run
      const dateWindowStart = datesToSync[datesToSync.length - 1]
      const dateWindowEnd = datesToSync[0]
      syncRunId = await startSyncRun(dateWindowStart, dateWindowEnd)
      setCurrentSyncRunId(syncRunId)
      await updateSyncRun(syncRunId, { status: 'querying' })
      console.log(`[SYNC] Sync run #${syncRunId} started`)

      // Sync each date
      for (const dateStr of datesToSync) {
        console.log(`[SYNC] Fetching and writing data for ${dateStr} (parallel)...`)

        // Parallel Category Fetches
        const [vitals, sleep, activities, dynamics, mobility, environmental, cardio, weight] =
          await Promise.all([
            fetchVitalsForDate(dateStr),
            fetchSleepForDate(dateStr),
            fetchActivitiesForDate(dateStr),
            fetchRunningDynamicsForDate(dateStr),
            fetchMobilityForDate(dateStr),
            fetchEnvironmentalForDate(dateStr),
            fetchCardioMetabolicForDate(dateStr),
            fetchWeightForDate(dateStr),
          ])

        // Transactional Write
        const computedNow = new Date().toISOString()
        await withTransaction(async (db) => {
          // Vitals
          if (vitals && !areAllVitalsZero(vitals) && vitals.hrv !== 0 && vitals.rhr !== 0) {
            await db.runAsync('DELETE FROM vitals WHERE timestamp >= ? AND timestamp <= ?',
              `${dateStr}T00:00:00.000Z`, `${dateStr}T23:59:59.999Z`)
            await db.runAsync(
              'INSERT INTO vitals (timestamp, hrv, rhr, spo2, respiratory_rate, skin_temp_delta, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              vitals.timestamp, vitals.hrv, vitals.rhr, vitals.spo2, vitals.respiratoryRate, vitals.skinTempDelta, syncRunId, computedNow
            )
          }

          // Sleep
          if (sleep && !isAllSleepZero(sleep) && isValidSleep(sleep)) {
            await db.runAsync(
              'INSERT OR REPLACE INTO sleep (date, total_duration_mins, rem_mins, deep_mins, core_mins, awake_mins, bedtime_start, wake_time_end, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              sleep.date, sleep.totalDurationMins, sleep.remMins, sleep.deepMins, sleep.coreMins, sleep.awakeMins, sleep.bedtimeStart ?? null, sleep.wakeTimeEnd ?? null, syncRunId, computedNow
            )
          }

          // Activities
          if (activities && activities.length > 0) {
            for (const act of activities) {
              const strain = computeStrain(act.hrZones)
              await db.runAsync('DELETE FROM activity WHERE timestamp = ?', act.timestamp)
              await db.runAsync(
                'INSERT INTO activity (timestamp, active_calories, workout_type, duration_mins, hr_zones, max_hr, strain_score, avg_hr, source, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                act.timestamp, act.activeCalories, act.workoutType, act.durationMins, JSON.stringify(act.hrZones), act.maxHR, strain, act.avgHR, 'healthkit', syncRunId, computedNow
              )
            }
          }

          // Running Dynamics
          if (dynamics) {
            await db.runAsync(
              'INSERT OR REPLACE INTO running_dynamics (id, timestamp, running_power, ground_contact_time, vertical_oscillation, stride_length, sync_run_id, computed_at) VALUES ((SELECT id FROM running_dynamics WHERE timestamp = ?), ?, ?, ?, ?, ?, ?, ?)',
              dynamics.timestamp, dynamics.timestamp, dynamics.runningPower, dynamics.groundContactTime, dynamics.verticalOscillation, dynamics.strideLength, syncRunId, computedNow
            )
          }

          // Mobility
          if (mobility && !isAllMobilityZero(mobility) && isValidMobility(mobility)) {
            await db.runAsync(
              'INSERT OR REPLACE INTO mobility (date, steps, walking_speed, walking_step_length, walking_asymmetry, double_support, stair_speed_up, stair_speed_down, flights_climbed, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              mobility.date, mobility.steps, mobility.walkingSpeed, mobility.walkingStepLength, mobility.walkingAsymmetry, mobility.doubleSupport, mobility.stairSpeedUp, mobility.stairSpeedDown, mobility.flightsClimbed, syncRunId, computedNow
            )
          }

          // Environmental
          if (environmental && isValidEnvironmental(environmental)) {
            await db.runAsync(
              'INSERT OR REPLACE INTO environmental (date, time_in_daylight, headphone_audio, exercise_minutes, stand_minutes, stand_hours, mindful_minutes, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              environmental.date, environmental.timeInDaylight, environmental.headphoneAudio, environmental.exerciseMinutes, environmental.standMinutes, environmental.standHours, environmental.mindfulMinutes ?? 0, syncRunId, computedNow
            )
          }

          // CardioMetabolic
          if (cardio && isValidCardioMetabolic(cardio)) {
            await db.runAsync(
              'INSERT OR REPLACE INTO cardio_metabolic (date, vo2_max, walking_hr_avg, resting_energy, physical_effort, breathing_disturbances, hr_recovery, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              cardio.date, cardio.vo2Max, cardio.walkingHRavg, cardio.restingEnergy, cardio.physicalEffort, cardio.breathingDisturbances, cardio.hrRecovery ?? 0, syncRunId, computedNow
            )
          }

          // Weight
          if (weight && weight.weightKg > 0) {
            await db.runAsync(
              'INSERT OR REPLACE INTO weight_history (timestamp, weight_kg, lean_body_mass_percent, sync_run_id, computed_at) VALUES (?, ?, ?, ?, ?)',
              weight.timestamp, weight.weightKg, weight.leanBodyMassPercent, syncRunId, computedNow
            )
          }
        })
      }

      console.log(`[SYNC] Biometrics written to SQLite. Performing atomic refresh...`)

      // Hydrate all biometric data from SQLite into Zustand
      set({ _dbLoaded: false })
      await get().loadFromDB()

      // Compute scores for the synced dates (sorted oldest to newest)
      const datesForScores = [...datesToSync].sort((a, b) => a.localeCompare(b))
      console.log(`[SYNC] Computing daily scores for synced dates...`)
      for (const dateStr of datesForScores) {
        await get().computeScores(dateStr)
      }

      console.log(`[SYNC] ✅ All sync steps complete — finalizing state`)
      console.log(`[SYNC] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // Phase B: Complete the sync run
      if (syncRunId !== null) {
        await completeSyncRun(syncRunId, 'completed', `Synced ${datesToSync.length} dates`)
        console.log(`[SYNC] Sync run #${syncRunId} completed`)
      }

      invalidateAllCaches()
      await setSyncMeta('lastSyncISO', new Date().toISOString())
      set({ isSyncing: false, isLoading: false, lastSync: new Date().toISOString(), initialSyncDone: true })
      setCurrentSyncRunId(null)
    } catch (err) {
      console.error('[SYNC] ❌ syncHealthKit error:', err)
      // Phase B: Mark sync run as failed
      if (syncRunId !== null) {
        completeSyncRun(syncRunId, 'failed', `Error: ${String(err).slice(0, 200)}`).catch(() => { })
      }
      setCurrentSyncRunId(null)
      set({ isSyncing: false, isLoading: false })
    }
  },

  loadFromDB: async () => {
    if (get()._dbLoaded) return
    set({ isLoading: true })
    try {
      await getDB()
    } catch {
      // DB initialized on first use
    }

    const vitals = await getAll<VitalsRecord & { respiratory_rate: number; skin_temp_delta: number }>(
      'SELECT * FROM vitals ORDER BY timestamp DESC LIMIT 100'
    )
    const sleepRows = await getAll<SleepRecord & { total_duration_mins: number; rem_mins: number; deep_mins: number; core_mins: number; awake_mins: number; sleep_need_hours: number; sleep_debt_hours: number; bedtime_start: string | null; wake_time_end: string | null }>(
      'SELECT * FROM sleep ORDER BY date DESC LIMIT 50'
    )
    const activities = await getAll<ActivityRecord & { active_calories: number; workout_type: string; duration_mins: number; hr_zones: string; max_hr: number; strain_score: number; avg_hr: number; source: string | null }>(
      'SELECT * FROM activity ORDER BY timestamp DESC LIMIT 100'
    )
    const meals = await getAll<MealRecord & { protein_grams: number; carbs_grams: number; fat_grams: number; total_calories: number; meal_description: string }>(
      'SELECT * FROM meals ORDER BY timestamp DESC LIMIT 100'
    )
    const scores = await getAll<DailyScores & { recovery_score: number; strain_score: number; sleep_debt_hours: number; sleep_need_hours: number; hrv_z_score: number; rhr_z_score: number; recovery_zone: string; biological_age: number; pace_of_aging: number; immunity_risk: string; bio_age_confidence: number; bio_age_inputs_used: string; bio_age_inputs_missing: string; bio_age_primary_driver: string }>(
      'SELECT * FROM daily_scores ORDER BY date DESC LIMIT 50'
    )
    const runningDynamics = await getAll<RunningDynamics & { running_power: number; ground_contact_time: number; vertical_oscillation: number; stride_length: number }>(
      'SELECT * FROM running_dynamics ORDER BY timestamp DESC LIMIT 50'
    )
    const journalRows = await getAll<JournalEntry & { habits: string }>(
      'SELECT * FROM journal_entries ORDER BY date DESC LIMIT 100'
    )
    const mobilityRows = await getAll<MobilityRecord & { walking_speed: number; walking_step_length: number; walking_asymmetry: number; double_support: number; stair_speed_up: number; stair_speed_down: number; flights_climbed: number }>(
      'SELECT * FROM mobility ORDER BY date DESC LIMIT 50'
    )
    const environmentalRows = await getAll<EnvironmentalRecord & { time_in_daylight: number; headphone_audio: number; exercise_minutes: number; stand_minutes: number; stand_hours: number; mindful_minutes: number }>(
      'SELECT * FROM environmental ORDER BY date DESC LIMIT 50'
    )
    const cardioMetabolicRows = await getAll<CardioMetabolicRecord & { vo2_max: number; walking_hr_avg: number; resting_energy: number; physical_effort: number; breathing_disturbances: number; hr_recovery: number }>(
      'SELECT * FROM cardio_metabolic ORDER BY date DESC LIMIT 50'
    )
    const weightRows = await getAll<WeightRecord & { weight_kg: number; lean_body_mass_percent: number | null }>(
      'SELECT * FROM weight_history ORDER BY timestamp DESC LIMIT 50'
    )

    const nextVitals = vitals.map(v => ({ ...v, respiratoryRate: v.respiratory_rate, skinTempDelta: v.skin_temp_delta }))
    const nextSleep = sleepRows.map(s => ({ ...s, totalDurationMins: s.total_duration_mins, remMins: s.rem_mins, deepMins: s.deep_mins, coreMins: s.core_mins, awakeMins: s.awake_mins, sleepNeedHours: s.sleep_need_hours, sleepDebtHours: s.sleep_debt_hours, bedtimeStart: s.bedtime_start ?? undefined, wakeTimeEnd: s.wake_time_end ?? undefined }))
    const nextActivities = activities.map(a => ({ ...a, activeCalories: a.active_calories, workoutType: a.workout_type, durationMins: a.duration_mins, hrZones: JSON.parse(a.hr_zones || '[0,0,0,0,0]'), maxHR: a.max_hr, strainScore: a.strain_score, avgHR: a.avg_hr, source: (a as any).source as ActivityRecord['source'] }))
    const nextMeals = meals.map(m => ({ ...m, proteinGrams: m.protein_grams, carbsGrams: m.carbs_grams, fatGrams: m.fat_grams, totalCalories: m.total_calories, mealDescription: m.meal_description }))
    const nextScores = scores.map(sc => {
      const bioAge = sc.biological_age ?? 0
      return { ...sc, recoveryScore: sc.recovery_score, strainScore: sc.strain_score, sleepDebtHours: sc.sleep_debt_hours, sleepNeedHours: sc.sleep_need_hours, hrvZScore: sc.hrv_z_score, rhrZScore: sc.rhr_z_score, recoveryZone: sc.recovery_zone as 'green' | 'yellow' | 'red', biologicalAge: bioAge, displayAge: bioAge, rawAge: bioAge, paceOfAging: sc.pace_of_aging, immunityRisk: sc.immunity_risk as any, bioAgeConfidence: sc.bio_age_confidence ?? 0, bioAgeInputsUsed: JSON.parse(sc.bio_age_inputs_used || '[]'), bioAgeInputsMissing: JSON.parse(sc.bio_age_inputs_missing || '[]'), bioAgePrimaryDriver: sc.bio_age_primary_driver ?? 'unknown' }
    })
    const nextDynamics = runningDynamics.map(r => ({ ...r, runningPower: r.running_power, groundContactTime: r.ground_contact_time, verticalOscillation: r.vertical_oscillation, strideLength: r.stride_length }))
    const nextJournal = journalRows.map(j => ({ ...j, habits: JSON.parse(j.habits || '[]') }))

    const nextMobility = mobilityRows.map(m => ({ ...m, walkingSpeed: m.walking_speed, walkingStepLength: m.walking_step_length, walkingAsymmetry: m.walking_asymmetry, doubleSupport: m.double_support, stairSpeedUp: m.stair_speed_up, stairSpeedDown: m.stair_speed_down, flightsClimbed: m.flights_climbed }))
    const nextEnvironmental = environmentalRows.map(e => ({ ...e, timeInDaylight: e.time_in_daylight, headphoneAudio: e.headphone_audio, exerciseMinutes: e.exercise_minutes, standMinutes: e.stand_minutes, standHours: e.stand_hours, mindfulMinutes: e.mindful_minutes ?? 0 }))
    const nextCardio = cardioMetabolicRows.map(c => ({ ...c, vo2Max: c.vo2_max, walkingHRavg: c.walking_hr_avg, restingEnergy: c.resting_energy, physicalEffort: c.physical_effort, breathingDisturbances: c.breathing_disturbances, hrRecovery: c.hr_recovery ?? 0 }))
    const nextWeight = weightRows.map(w => ({ ...w, weightKg: w.weight_kg, leanBodyMassPercent: w.lean_body_mass_percent }))

    set({
      vitals: nextVitals,
      sleep: nextSleep,
      activities: nextActivities,
      meals: nextMeals,
      scores: nextScores,
      runningDynamics: nextDynamics,
      journalEntries: nextJournal,
      mobility: nextMobility,
      environmental: nextEnvironmental,
      cardioMetabolic: nextCardio,
      weightHistory: nextWeight,
      latestVitals: nextVitals[0] || null,
      latestSleep: nextSleep[0] || null,
      latestScores: nextScores[0] || null,
    })

    // After load, check for stale biological age values (pre-v2 algorithm or zero-confidence fallbacks)
    // and log them for debugging. The display guards will filter them at render time.
    for (const sc of nextScores) {
      const chronoAge = get().profileAge ?? 25
      const maxBioAge = Math.max(chronoAge * 3, 80)

      const isExtreme = sc.biologicalAge > maxBioAge && sc.bioAgeConfidence === 0
      const isConfidenceZeroFallback =
        sc.bioAgeConfidence === 0 &&
        sc.biologicalAge === chronoAge &&
        sc.paceOfAging === 1.0

      if (isExtreme || isConfidenceZeroFallback) {
        const reason = isExtreme
          ? `bio age ${sc.biologicalAge} > max ${maxBioAge}`
          : `bio age === chronological age (${chronoAge}) with zero confidence`
        console.log(`[LOAD-DB] Stale bio age detected for ${sc.date}: ${reason}. The v2 algorithm caps at ${(chronoAge * 2.5).toFixed(1)}. Recomputing...`)
        // Trigger async recompute for this date (fire-and-forget)
        get().computeScores(sc.date).catch(() => { })
      }
    }

    // Compute derived risk alerts
    const injuryRisk = get().computeInjuryRisk()
    const cnsStressScore = get().computeCnsStressScore()
    set({ injuryRisk, cnsStressScore, _dbLoaded: true, isLoading: false })
  },

  // Expose removeVitals for cache invalidation / forced refresh
  setSelectedDate: (date: string) => set({ selectedDate: date }),

  setProfileAge: (age: number | null) => set({ profileAge: age }),

  removeVitals: (date?: string) => {
    const state = get()
    if (date) {
      set({ vitals: state.vitals.filter(v => !v.timestamp.startsWith(date)) })
    } else {
      set({ vitals: [] })
    }
  },

  updateLiveWorkoutState: (workout) => {
    set({ liveWorkout: workout })
  },
}))

// ── Derived Selectors ─────────────────────────────────────────────────────

export function computeSynthesis(state: HealthState, dateStr: string): import('./types').SynthesisOutput | null {
  const vitals = state.vitals.find(v => v.timestamp.startsWith(dateStr)) || null
  const sleep = state.sleep.find(s => s.date === dateStr) || null
  const mobility = state.mobility.find(m => m.date === dateStr) || null
  const environmental = state.environmental.find(e => e.date === dateStr) || null
  const cardio = state.cardioMetabolic.find(c => c.date === dateStr) || null
  const dynamics = state.runningDynamics.find(r => r.timestamp.startsWith(dateStr)) || null
  const scores = state.scores.find(s => s.date === dateStr) || null
  const activities = state.activities.filter(a => a.timestamp.startsWith(dateStr))

  if (!vitals && !sleep && !scores) return null

  const hrvValues = state.vitals.filter(v => v.hrv > 0).map(v => v.hrv)
  const rhrValues = state.vitals.filter(v => v.rhr > 0).map(v => v.rhr)
  const mobilityList = state.mobility
  const cardioList = state.cardioMetabolic
  const envList = state.environmental

  // Compute baselines from actual data only — no hardcoded population defaults
  const hrvBaseline = hrvValues.length >= 3 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : 0
  const rhrBaseline = rhrValues.length >= 3 ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length : 0
  const asymmetryBaseline = mobilityList.length >= 3 ? mobilityList.reduce((a, m) => a + m.walkingAsymmetry, 0) / mobilityList.length : 0
  const doubleSupportBaseline = mobilityList.length >= 3 ? mobilityList.reduce((a, m) => a + m.doubleSupport, 0) / mobilityList.length : 0
  const vo2Baseline = cardioList.filter(c => c.vo2Max > 0).length >= 2
    ? cardioList.filter(c => c.vo2Max > 0).reduce((a, c) => a + c.vo2Max, 0) / cardioList.filter(c => c.vo2Max > 0).length
    : 0
  const daylightBaseline = envList.filter(e => e.timeInDaylight > 0).length >= 3
    ? envList.filter(e => e.timeInDaylight > 0).reduce((a, e) => a + e.timeInDaylight, 0) / envList.filter(e => e.timeInDaylight > 0).length
    : 0
  const audioBaseline = envList.filter(e => e.headphoneAudio > 0).length >= 3
    ? envList.filter(e => e.headphoneAudio > 0).reduce((a, e) => a + e.headphoneAudio, 0) / envList.filter(e => e.headphoneAudio > 0).length
    : 0
  const sleepDurationBaseline = state.sleep.filter(s => s.totalDurationMins > 0).length >= 3
    ? state.sleep.filter(s => s.totalDurationMins > 0).reduce((a, s) => a + s.totalDurationMins, 0) / state.sleep.filter(s => s.totalDurationMins > 0).length
    : 0

  const injuryRisk = state.injuryRisk ?? (
    mobilityList.length > 0 ? runInjuryPredictor(
      mobilityList[0].walkingAsymmetry,
      asymmetryBaseline,
      mobilityList[0].doubleSupport,
      doubleSupportBaseline,
      mobilityList[0].stairSpeedDown,
      mobilityList[0].stairSpeedDown || 0.7,
      dynamics?.groundContactTime ?? 210,
      210
    ) : null
  )

  const cnsStressScore = state.cnsStressScore ?? (
    (vitals && (environmental || envList.length > 0)) ? runCnsStressPredictor(
      environmental?.headphoneAudio ?? envList[0]?.headphoneAudio ?? 0,
      environmental?.timeInDaylight ?? envList[0]?.timeInDaylight ?? 0,
      vitals?.hrv ?? 0,
      hrvBaseline || 0,
      sleep?.totalDurationMins ?? 0,
      (sleep?.sleepNeedHours ?? 8) * 60,
      environmental?.mindfulMinutes ?? envList[0]?.mindfulMinutes ?? 0
    ) : null
  )

  // Use profileAge if set, fallback to 25 only when completely unconfigured
  const chronologicalAge = state.profileAge ?? 25

  return synthesize({
    dateStr,
    vitals,
    sleep,
    mobility,
    environmental,
    cardioMetabolic: cardio,
    runningDynamics: dynamics,
    injuryRisk,
    cnsStressScore,
    scores,
    chronologicalAge,
    activities,
    hrvBaseline,
    rhrBaseline,
    asymmetryBaseline,
    doubleSupportBaseline,
    vo2Baseline,
    daylightBaseline,
    audioBaseline,
    sleepDurationBaseline,
  })
}

/**
 * Compute sleep architecture from a SleepRecord.
 *
 * @param sleep - The sleep record to analyze
 * @param canonicalSleepDebtHours - Optional canonical sleep debt from DailyScores.
 *   When provided, this overrides any sleepDebtHours on the SleepRecord itself
 *   (which may not be populated by addSleep). This ensures the sleep quality
 *   score uses the same debt value as the rest of the pipeline (single source of truth).
 */
export function computeSleepArchitecture(
  sleep: SleepRecord | null,
  canonicalSleepDebtHours?: number,
): SleepArchitecture | null {
  if (!sleep || sleep.totalDurationMins <= 0) return null
  const efficiency = ((sleep.totalDurationMins - sleep.awakeMins) / sleep.totalDurationMins) * 100
  const remPct = (sleep.remMins / sleep.totalDurationMins) * 100
  const deepPct = (sleep.deepMins / sleep.totalDurationMins) * 100
  // Prefer canonical debt from scores; fall back to sleep record's own field (may be stale)
  const debtHours = canonicalSleepDebtHours ?? sleep.sleepDebtHours ?? 0
  const quality = computeSleepPerformance({
    totalDurationMins: sleep.totalDurationMins,
    remMins: sleep.remMins,
    deepMins: sleep.deepMins,
    coreMins: sleep.coreMins,
    awakeMins: sleep.awakeMins,
    sleepNeedHours: sleep.sleepNeedHours,
    sleepDebtHours: debtHours,
  })

  return {
    date: sleep.date,
    totalDurationMins: sleep.totalDurationMins,
    remMins: sleep.remMins,
    deepMins: sleep.deepMins,
    coreMins: sleep.coreMins,
    awakeMins: sleep.awakeMins,
    efficiencyPercent: Math.round(efficiency * 10) / 10,
    remPercent: Math.round(remPct * 10) / 10,
    deepPercent: Math.round(deepPct * 10) / 10,
    sleepQualityScore: quality,
  }
}

/**
 * Selector: Compute trend report from all historical data in the store.
 * Safe to call outside of React (e.g., from useHealthStore.getState()).
 */
export function computeTrendReportSelector(state: HealthState): TrendReport | null {
  return memoizedCompute('trendReport', state, () => {
    const vitals = state.vitals
      .filter(v => v.hrv > 0 || v.rhr > 0)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(v => ({
        date: v.timestamp.slice(0, 10),
        hrv: v.hrv,
        rhr: v.rhr,
        spo2: v.spo2,
        skinTempDelta: v.skinTempDelta,
        respiratoryRate: v.respiratoryRate,
      }))

    const scores = state.scores
      .filter(s => s.recoveryScore > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({
        date: s.date,
        recoveryScore: s.recoveryScore,
        strainScore: s.strainScore,
        sleepDebtHours: s.sleepDebtHours,
        paceOfAging: s.paceOfAging,
        biologicalAge: s.biologicalAge,
        rawAge: s.rawAge ?? s.biologicalAge,
        displayAge: s.displayAge ?? s.biologicalAge,
      }))

    const sleep = state.sleep
      .filter(s => s.totalDurationMins > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({
        date: s.date,
        totalDurationMins: s.totalDurationMins,
        // NOTE: sleepDebtHours is intentionally NOT mapped from SleepRecord
        // because addSleep() never populates that column. Sleep debt for trends
        // is sourced from DailyScores.sleepDebtHours (computed by computeScores).
      }))

    const cardioMetabolic = state.cardioMetabolic
      .filter(c => c.vo2Max > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(c => ({
        date: c.date,
        vo2Max: c.vo2Max,
      }))

    const mobility = state.mobility
      .filter(m => m.doubleSupport > 0 || m.walkingAsymmetry > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(m => {
        const dynamic = state.runningDynamics.find(r => r.timestamp.startsWith(m.date))
        return {
          date: m.date,
          doubleSupport: m.doubleSupport,
          walkingAsymmetry: m.walkingAsymmetry,
          strideLength: dynamic ? dynamic.strideLength : undefined,
        }
      })

    const weightHistory = state.weightHistory
      .filter(w => w.weightKg > 0)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(w => ({
        timestamp: w.timestamp,
        weightKg: w.weightKg,
        leanBodyMassPercent: w.leanBodyMassPercent,
      }))

    const environmental = state.environmental
      .filter(e => e.timeInDaylight > 0 || e.headphoneAudio > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({
        date: e.date,
        timeInDaylight: e.timeInDaylight,
        headphoneAudio: e.headphoneAudio,
      }))

    return computeTrendReport({
      vitals,
      scores,
      sleep,
      ...(cardioMetabolic.length > 0 ? { cardioMetabolic } : {}),
      ...(mobility.length > 0 ? { mobility } : {}),
      ...(weightHistory.length > 0 ? { weightHistory } : {}),
      ...(environmental.length > 0 ? { environmental } : {}),
    })
  })
}

/**
 * Compute multi-dimensional correlation insights from journal habits,
 * workout timing, daylight, audio, and strain → next-day biometrics.
 */
export function computeCorrelationInsightsSelector(state: HealthState): import('./types').CorrelationInsight[] {
  return memoizedCompute('correlationInsights', state, () => {
    const pairedDays = buildPairedDays({
      journalEntries: state.journalEntries,
      activities: state.activities,
      environmental: state.environmental,
      scores: state.scores,
      vitals: state.vitals,
      sleep: state.sleep,
    })

    if (pairedDays.length < 5) return []

    const multiInsights = computeCorrelationInsights(pairedDays)
    return toCorrelationInsights(multiInsights)
  })
}
