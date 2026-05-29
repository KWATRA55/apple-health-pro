export interface VitalsRecord {
  id: number
  timestamp: string
  hrv: number
  rhr: number
  spo2: number
  respiratoryRate: number
  /** Delta from personal 14-day rolling baseline in °C. 0 when baseline not yet computable. */
  skinTempDelta: number
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface SleepRecord {
  id: number
  date: string
  totalDurationMins: number
  remMins: number
  deepMins: number
  coreMins: number
  awakeMins: number
  sleepNeedHours: number
  sleepDebtHours?: number
  bedtimeStart?: string
  wakeTimeEnd?: string
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface ActivityRecord {
  id: number
  timestamp: string
  activeCalories: number
  workoutType: string
  durationMins: number
  hrZones: number[]
  maxHR: number
  strainScore: number | null
  avgHR: number
  /** Origin discriminator — prevents phantom/mock records from polluting the data stream.
   *  'healthkit' = synced from Apple HealthKit, 'manual' = user-logged (live workout or vision capture).
   *  Absent (undefined) = legacy row that predates source tracking. */
  source?: 'healthkit' | 'manual'
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface MealRecord {
  id: number
  timestamp: string
  proteinGrams: number
  carbsGrams: number
  fatGrams: number
  totalCalories: number
  mealDescription: string
}

export interface DailyScores {
  date: string
  recoveryScore: number
  strainScore: number
  sleepDebtHours: number
  sleepNeedHours: number
  hrvZScore: number
  rhrZScore: number
  recoveryZone: 'green' | 'yellow' | 'red'
  /** Integer display age for UI — use this in components */
  displayAge: number
  /** Raw unrounded biological age for internal calculations, trends, and exports */
  rawAge: number
  /** @deprecated Prefer displayAge for UI, rawAge for calculations. Kept for backward compat. */
  biologicalAge: number
  paceOfAging: number
  immunityRisk: 'LOW' | 'ELEVATED' | 'HIGH'
  /** 0–1 confidence based on how many biomarkers were usable */
  bioAgeConfidence: number
  /** Names of biomarkers used in the computation */
  bioAgeInputsUsed: string[]
  /** Names of biomarkers that were missing or invalid */
  bioAgeInputsMissing: string[]
  /** Which biomarker drove the result the most */
  bioAgePrimaryDriver: string
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface RecoveryResult {
  recoveryScore: number
  hrvZScore: number
  rhrZScore: number
  zone: 'green' | 'yellow' | 'red'
  sleepQualityFactor: number
}

export interface SleepDebtResult {
  sleepNeedHours: number
  sleepDebtHours: number
  baselineHours: number
  totalSleepMins: number
}

export interface SleepArchitecture {
  date: string
  totalDurationMins: number
  remMins: number
  deepMins: number
  coreMins: number
  awakeMins: number
  efficiencyPercent: number
  remPercent: number
  deepPercent: number
  sleepQualityScore: number
}

export interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface HealthState {
  vitals: VitalsRecord[]
  sleep: SleepRecord[]
  activities: ActivityRecord[]
  meals: MealRecord[]
  scores: DailyScores[]
  runningDynamics: RunningDynamics[]
  weightHistory: WeightRecord[]
  journalEntries: JournalEntry[]
  latestVitals: VitalsRecord | null
  latestSleep: SleepRecord | null
  latestScores: DailyScores | null
  selectedDate: string
  isSyncing: boolean
  isLoading: boolean
  lastSync: string | null
  initialSyncDone: boolean
  _dbLoaded: boolean

  mobility: MobilityRecord[]
  environmental: EnvironmentalRecord[]
  cardioMetabolic: CardioMetabolicRecord[]
  injuryRisk: InjuryRisk | null
  cnsStressScore: CnsStressScore | null

  profileAge: number | null

  /** Live workout state — null when no active workout session */
  liveWorkout: {
    isActive: boolean
    isPaused: boolean
    elapsedSeconds: number
    currentHR: number
    avgHR: number
    maxHR: number
    activeCalories: number
    distance: number
    currentPace: number
    hrZones: number[]
    strainAccumulation: number
    zoneDistribution: number[]
    activityType: string
    targetStrain?: number
  } | null

  addVitals: (v: VitalsRecord) => Promise<void>
  addSleep: (s: SleepRecord) => Promise<void>
  addActivity: (a: ActivityRecord) => Promise<void>
  addMeal: (m: MealRecord) => Promise<void>
  addJournalEntry: (entry: JournalEntry) => Promise<void>
  computeScores: (date: string) => Promise<DailyScores | null>
  setSelectedDate: (date: string) => void
  setProfileAge: (age: number | null) => void
  syncHealthKit: () => Promise<void>
  loadFromDB: () => Promise<void>

  addMobility: (m: MobilityRecord) => Promise<void>
  addEnvironmental: (e: EnvironmentalRecord) => Promise<void>
  addCardioMetabolic: (c: CardioMetabolicRecord) => Promise<void>
  addWeight: (w: WeightRecord) => Promise<void>
  computeInjuryRisk: () => InjuryRisk
  computeCnsStressScore: () => CnsStressScore

  /** Live workout actions */
  updateLiveWorkoutState: (state: {
    isActive: boolean
    isPaused: boolean
    elapsedSeconds: number
    currentHR: number
    avgHR: number
    maxHR: number
    activeCalories: number
    distance: number
    currentPace: number
    hrZones: number[]
    strainAccumulation: number
    zoneDistribution: number[]
    activityType: string
    targetStrain?: number
  } | null) => void
}

export interface RunningDynamics {
  id: number
  timestamp: string
  runningPower: number
  groundContactTime: number
  verticalOscillation: number
  strideLength: number
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface WeightRecord {
  id: number
  timestamp: string
  weightKg: number
  leanBodyMassPercent: number | null
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface JournalEntry {
  id: number
  date: string
  habits: string[]
  notes: string
}

export interface HeartRateSample {
  timestamp: string
  bpm: number
}

export interface SleepWindow {
  startHour: number
  endHour: number
  type: 'deep' | 'rem' | 'core' | 'awake'
}

export interface ActivityWindow {
  startHour: number
  endHour: number
  type: string
  intensity: number
}

export interface CorrelationInsight {
  habit: string
  avgImpactPercent: number
  direction: 'positive' | 'negative'
  r: number
  r2: number
  significance: 'strong' | 'moderate' | 'weak' | 'none'
  observations: number
}

export interface DailyDirectiveResult {
  headline: string
  command: string
  targetStrain: number
  targetBedtime: string
  warningFlag: string | null
  recoveryTip: string
}

export interface SynthesisInput {
  dateStr: string
  vitals: VitalsRecord | null
  sleep: SleepRecord | null
  mobility: MobilityRecord | null
  environmental: EnvironmentalRecord | null
  cardioMetabolic: CardioMetabolicRecord | null
  runningDynamics: RunningDynamics | null
  injuryRisk: InjuryRisk | null
  cnsStressScore: CnsStressScore | null
  scores: DailyScores | null
  chronologicalAge: number
  activities: ActivityRecord[]
  hrvBaseline: number
  rhrBaseline: number
  asymmetryBaseline: number
  doubleSupportBaseline: number
  vo2Baseline: number
  daylightBaseline: number
  audioBaseline: number
  sleepDurationBaseline: number
}

export interface SynthesisOutput {
  readiness: PillarScore
  resilience: PillarScore
  longevity: PillarScore
  directive: string
  headline: string
  subheadline: string
  warningFlags: WarningFlag[]
  targetStrain: number
  targetBedtime: string
  recoveryTips: string[]
  interceptTriggers: InterceptTrigger[]
  cnsStressScore: CnsStressScore | null
  injuryRisk: InjuryRisk | null
}

export interface PillarScore {
  score: number
  label: string
  zone: 'optimal' | 'attention' | 'critical' | 'insufficient'
  zoneLabel: string
  primaryMetric: string
  icon: string
  glowColor: string
  detail: string
  /** Indicates how much real data backs this score */
  dataCoverage: 'sufficient' | 'partial' | 'insufficient'
}

export interface WarningFlag {
  type: 'injury' | 'illness' | 'cns' | 'sleep' | 'recovery' | 'overtraining'
  severity: 'high' | 'moderate' | 'low'
  message: string
  title: string
}

export interface InterceptTrigger {
  type: 'workout_block' | 'rest_mandate' | 'sleep_prescription' | 'hydration_alert' | 'trend_degradation' | 'recovery_erosion' | 'cns_accumulation' | 'vo2max_alert'
  title: string
  message: string
  icon: string
  actionLabel: string
  severity: 'critical' | 'warning' | 'info'
  pill: 'readiness' | 'resilience' | 'longevity'
}

export interface MobilityRecord {
  id: number
  date: string
  steps: number
  walkingSpeed: number        // m/s
  walkingStepLength: number   // m
  walkingAsymmetry: number    // %
  doubleSupport: number       // %
  stairSpeedUp: number        // m/s
  stairSpeedDown: number      // m/s
  flightsClimbed: number
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface EnvironmentalRecord {
  id: number
  date: string
  timeInDaylight: number      // minutes
  headphoneAudio: number      // dB (daily average)
  exerciseMinutes: number
  standMinutes: number
  standHours: number
  mindfulMinutes?: number
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface CardioMetabolicRecord {
  id: number
  date: string
  vo2Max: number              // ml/kg/min
  walkingHRavg: number        // bpm
  restingEnergy: number       // kcal
  physicalEffort: number      // MET-hours
  restingHeartRate: number    // bpm
  hrv: number                 // ms
  breathingDisturbances: number // events/hour
  hrRecovery?: number         // bpm (1-minute drop)
  sync_run_id?: number
  source_raw_sample_ids?: string
  algorithm_version?: string
  computed_at?: string
}

export interface InjuryRisk {
  risk: 'LOW' | 'MODERATE' | 'HIGH'
  confidence: number          // 0-100
  primaryMetric: string
  secondaryMetrics: string[]
  explanation: string
}

export interface CnsStressScore {
  risk: 'LOW' | 'MODERATE' | 'HIGH'
  confidence: number
  audioLoad: number
  daylightDeficit: number
  hrvSuppression: number
  explanation: string
}

// ── Trend Engine Types ─────────────────────────────────────────────────────

export type MetricDirection = 'rising' | 'falling' | 'stable'

export interface TrendMetric {
  values: number[]
  dates: string[]
  slope7d: number
  slope14d: number
  slope30d: number
  mean7d: number
  mean14d: number
  mean30d: number
  volatility7d: number
  volatility14d: number
  volatility30d: number
  direction7d: MetricDirection
  acceleration: number
  recentZScore: number
  latest: number
  min14d: number
  max14d: number
  sampleCount: number
  hasSufficient: boolean
}

export type TrendPatternType =
  | 'recovery_cliff'
  | 'hrv_surge'
  | 'rhr_creep'
  | 'sleep_erosion'
  | 'strain_accumulation'
  | 'cns_fatigue'
  | 'positive_adaptation'
  | 'inflammation_spike'
  | 'vo2max_decline'

export interface TrendPattern {
  type: TrendPatternType
  metrics: string[]
  confidence: number
  description: string
  severity: 'positive' | 'neutral' | 'warning' | 'critical'
}

export interface TrendReport {
  timestamp: string
  referenceDate: string
  metrics: Record<string, TrendMetric>
  patterns: TrendPattern[]
  summary: string
}

// ── Phase F: Derived Outputs ──────────────────────────────────────────────────

export interface DerivedOutput {
  id: number;
  output_type: string;
  algorithm_name: string;
  algorithm_version: string;
  date_key: string;
  input_coverage_json?: string;
  confidence?: number;
  dependency_ids?: string;
  source_raw_sample_ids?: string;
  sync_run_id?: number;
  payload_json: string;
  status: 'active' | 'invalidated' | 'superseded';
  computed_at: string;
  invalidated_at?: string;
  created_at: string;
}

// ── Phase A: Raw Health Samples & Sync Provenance ────────────────────────────

export interface RawHealthSample {
  id: number
  canonical_id: string
  source_type: string
  source_app?: string
  source_device?: string
  domain: string
  metric_name: string
  value?: number
  unit?: string
  start_time: string
  end_time: string
  local_day_key: string
  timezone?: string
  metadata_json?: string
  ingestion_ts: string
  sync_run_id?: number
  status: 'active' | 'deleted' | 'superseded' | 'invalid'
  created_at: string
}

export interface SyncRun {
  id: number
  started_at: string
  completed_at?: string
  status: 'started' | 'querying' | 'ingesting' | 'deriving' | 'completed' | 'partial' | 'failed'
  date_window_start?: string
  date_window_end?: string
  permission_state?: string
  total_samples_returned: number
  inserted_count: number
  deduped_count: number
  updated_count: number
  deleted_count: number
  error_count: number
  parsing_errors_json?: string
  recomputations_triggered?: string
  notes?: string
  created_at: string
}

export interface ProvenanceLog {
  id: number
  record_table: string
  record_id: number
  source_type: string
  source_raw_sample_ids?: string
  sync_run_id?: number
  algorithm_version?: string
  created_at: string
}

// ── Phase D: Canonical Selectors View Model ──────────────────────────────────

export interface HealthMetricViewModel<T = number> {
  value: T | null
  displayValue: string
  status: 'present' | 'missing' | 'insufficient' | 'stale' | 'invalidated'
  scope: 'selectedDate' | 'latest' | 'rolling7d' | 'rolling30d' | 'allTime'
  effectiveDate: string // ISO date
  dateWindow?: { start: string; end: string }
  sourceKind: 'raw' | 'normalized' | 'derived' | 'manual'
  confidence: number | null // 0-100
  emptyStateReason: string | null
  provenanceSummary: string
  lastUpdated: string // ISO timestamp
  algorithmVersion?: string
  inputCoverage?: { available: number; required: number }
}

export interface RollingVitalsAggregate {
  avgHrv: number | null
  avgRhr: number | null
  avgSpo2: number | null
  sampleCount: number
  daysWithData: number
  dateRange: { start: string; end: string }
  dailyRecords: VitalsRecord[]
}

export interface RollingScoresAggregate {
  avgRecovery: number | null
  avgStrain: number | null
  avgSleepDebt: number | null
  sampleCount: number
  daysWithData: number
  dateRange: { start: string; end: string }
  dailyRecords: DailyScores[]
}

export interface RollingSleepAggregate {
  avgDurationMins: number | null
  avgRemMins: number | null
  avgDeepMins: number | null
  avgEfficiency: number | null
  sampleCount: number
  daysWithData: number
  dateRange: { start: string; end: string }
  dailyRecords: SleepRecord[]
}
