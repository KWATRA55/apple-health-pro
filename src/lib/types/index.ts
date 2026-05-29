export interface VitalsRecord {
  id: number
  timestamp: string
  hrv: number
  rhr: number
  spo2: number
  respiratoryRate: number
  skinTempDelta: number
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
  sleepDebtHours: number
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
}

export interface MealRecord {
  id: number
  timestamp: string
  imageBase64?: string
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
}

export interface VectorDocument {
  id: string
  content: string
  embedding: number[]
  source: string
  chunkIndex: number
  title: string
}

export interface CoachMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  imageBase64?: string
  timestamp: string
}

export interface IngestPayload {
  timestamp: string
  vitals?: Partial<VitalsRecord>
  sleep?: Partial<SleepRecord>
  activity?: Partial<ActivityRecord>
  meal?: Partial<MealRecord>
}

export interface HRZoneThresholds {
  zone1: [number, number]
  zone2: [number, number]
  zone3: [number, number]
  zone4: [number, number]
  zone5: [number, number]
}

export interface RecoveryResult {
  recoveryScore: number
  hrvZScore: number
  rhrZScore: number
  zone: 'green' | 'yellow' | 'red'
  sleepQualityFactor: number
}

export interface StrainResult {
  strainScore: number
  maxHR: number
  zoneWeights: number[]
}

export interface SleepDebtResult {
  sleepNeedHours: number
  sleepDebtHours: number
  baselineHours: number
  totalSleepMins: number
}

export interface RingSegment {
  label: string
  value: number
  maxValue: number
  color: string
  percentage: number
}

export interface VitalsRingData {
  recoveryScore: number
  recoveryZone: 'green' | 'yellow' | 'red'
  segments: RingSegment[]
  centerLabel: string
  centerValue: string
}

export interface HRZoneDefinition {
  name: string
  minBPM: number
  maxBPM: number
  weight: number
}

export interface HealthSnapshot {
  scores: DailyScores | null
  vitals: VitalsRecord | null
  sleep: SleepRecord | null
  meals: MealRecord[]
  activities: ActivityRecord[]
}
