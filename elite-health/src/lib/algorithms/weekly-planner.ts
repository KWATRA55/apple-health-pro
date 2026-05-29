export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'weekly-planner';

import type {
    HealthState,
    DailyScores,
    SleepRecord,
    ActivityRecord,
    JournalEntry,
    InjuryRisk,
    CnsStressScore,
    TrendReport,
    EnvironmentalRecord,
} from '../types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DayPlan {
    /** ISO date string for this day */
    date: string
    /** Day label (e.g., "MON", "Today") */
    label: string
    /** Recommended strain target (0-21) */
    recommendedStrain: number
    /** Suggested workout type */
    workoutType: string
    /** Target bedtime (e.g., "10:00 PM") */
    targetBedtime: string
    /** Active recovery protocols */
    recoveryProtocols: string[]
    /** Nutrition focus area */
    nutritionFocus: string
    /** Warning flags for this day */
    warningFlags: string[]
    /** Intensity label for UI rendering */
    intensityLabel: 'REST' | 'LIGHT' | 'MODERATE' | 'HARD' | 'INTENSE'
}

export interface WeeklyPlan {
    /** The 7-day plan */
    days: DayPlan[]
    /** Overarching weekly theme */
    weeklyFocus: string
    /** Projected outcomes after following the plan */
    projectedOutcomes: {
        estimatedRecoveryByDay7: number
        estimatedStrainAccumulation: number
        projectedSleepDebtResolution: number
    }
    /** When the plan was generated */
    generatedAt: string
    /** Confidence in the plan (0-100) */
    confidence: number
}

export interface WeeklyPlannerInput {
    /** Current scores (most recent day) */
    currentScores: DailyScores | null
    /** Current sleep record */
    currentSleep: SleepRecord | null
    /** Recent scores (last 14 days) for trend analysis */
    recentScores: DailyScores[]
    /** Recent sleep records */
    recentSleep: SleepRecord[]
    /** Recent activities for workout pattern detection */
    recentActivities: ActivityRecord[]
    /** Environmental data for daylight/audio context */
    recentEnvironmental: EnvironmentalRecord[]
    /** Injury risk assessment */
    injuryRisk: InjuryRisk | null
    /** CNS stress assessment */
    cnsStressScore: CnsStressScore | null
    /** Journal habits for preference detection */
    journalEntries: JournalEntry[]
    /** Date to start the plan from */
    startDate: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const WORKOUT_TYPES: Record<string, string[]> = {
    endurance: ['Zone 2 Run', 'Long Easy Ride', 'Ruck March', 'Swim (Steady State)'],
    threshold: ['Tempo Run', 'Threshold Intervals', 'Sweet Spot Cycling', 'Hill Repeats'],
    hiit: ['HIIT Circuit', 'Sprint Intervals', 'Tabata', 'Fartlek'],
    strength: ['Heavy Lifts', 'Push/Pull Circuit', 'Olympic Lifting', 'Strength Endurance'],
    mobility: ['Yoga Flow', 'Dynamic Stretching', 'Foam Rolling', 'Pilates'],
    recovery: ['Walking', 'Light Swim', 'Restorative Yoga', 'Breathwork'],
    impact: ['Running', 'Jump Rope', 'Plyometrics', 'Basketball'],
    lowImpact: ['Swimming', 'Cycling', 'Rowing', 'Elliptical'],
}

const NUTRITION_FOCUS: Record<string, string> = {
    recovery: 'High Protein + Anti-inflammatory',
    endurance: 'Carb Loading + Electrolytes',
    strength: 'Protein Timing + Creatine',
    sleep: 'Magnesium + Tart Cherry',
    cns: 'Omega-3 + Adaptogens',
    default: 'Balanced Macros + Hydration',
}

const RECOVERY_PROTOCOLS: Record<string, string[]> = {
    cns: ['Box breathing 4-4-6-2', 'Cold exposure (3 min)', 'NSDR 20 min'],
    muscle: ['Compression therapy', 'Epsom salt bath', 'Light mobility work'],
    sleep: ['No screens 90 min before bed', 'Room temp 65°F', 'Magnesium glycinate'],
    general: ['10 min meditation', 'Hydration target: 3L', 'Walk after meals'],
}

// ── Core Algorithm ───────────────────────────────────────────────────────────

export function generateWeeklyPlan(input: WeeklyPlannerInput): WeeklyPlan {
    const {
        currentScores,
        currentSleep,
        recentScores,
        recentSleep,
        recentActivities,
        recentEnvironmental,
        injuryRisk,
        cnsStressScore,
        journalEntries,
        startDate,
    } = input

    // ── Assess current state ────────────────────────────────────────────────
    const recoveryScore = currentScores?.recoveryScore ?? 50
    const recoveryZone = currentScores?.recoveryZone ?? 'yellow'
    const sleepDebtHours = currentSleep?.sleepDebtHours ?? 0
    const strainScore = currentScores?.strainScore ?? 8
    const cnsRisk = cnsStressScore?.risk ?? 'LOW'
    const injuryRiskLevel = injuryRisk?.risk ?? 'LOW'
    const paceOfAging = currentScores?.paceOfAging ?? 1.0

    // Recent trends
    const recentRecoveryValues = recentScores.map(s => s.recoveryScore).filter(s => s > 0)
    const avgRecentRecovery = recentRecoveryValues.length > 0
        ? recentRecoveryValues.reduce((a, b) => a + b, 0) / recentRecoveryValues.length
        : 50
    const greenStreak = countTrailingGreens(recentScores)
    const avgRecentStrain = recentScores.length > 0
        ? recentScores.reduce((a, s) => a + s.strainScore, 0) / recentScores.length
        : 8
    const avgSleepDebt = recentSleep.length > 0
        ? recentSleep.reduce((a, s) => a + (s.sleepDebtHours ?? 0), 0) / recentSleep.length
        : 0

    // Workout pattern analysis
    const workoutTypes = recentActivities.map(a => a.workoutType).filter(Boolean)
    const hasRunning = workoutTypes.some(t => t.toLowerCase().includes('run'))
    const hasCycling = workoutTypes.some(t => t.toLowerCase().includes('cycle') || t.toLowerCase().includes('bike'))
    const hasSwimming = workoutTypes.some(t => t.toLowerCase().includes('swim'))
    const hasStrength = workoutTypes.some(t =>
        t.toLowerCase().includes('strength') || t.toLowerCase().includes('weight') || t.toLowerCase().includes('lift')
    )
    const hasHIIT = workoutTypes.some(t => t.toLowerCase().includes('hiit') || t.toLowerCase().includes('interval'))

    // Daylight / audio analysis
    const avgDaylight = recentEnvironmental.length > 0
        ? recentEnvironmental.reduce((a, e) => a + e.timeInDaylight, 0) / recentEnvironmental.length
        : 40
    const avgAudio = recentEnvironmental.length > 0
        ? recentEnvironmental.reduce((a, e) => a + e.headphoneAudio, 0) / recentEnvironmental.length
        : 65

    // Habit preferences
    const habitSet = new Set(journalEntries.flatMap(j => j.habits))
    const prefersWeights = habitSet.has('Weight Training') || habitSet.has('Gym')
    const prefersCardio = habitSet.has('Running') || habitSet.has('Cardio')
    const prefersYoga = habitSet.has('Yoga') || habitSet.has('Stretching')

    // ── Determine weekly focus ──────────────────────────────────────────────
    let weeklyFocus: string
    let baseStrain: number
    let strainRampDays: number

    if (sleepDebtHours > 1.5 || recoveryZone === 'red') {
        weeklyFocus = 'Sleep Debt Resolution & Recovery'
        baseStrain = 3
        strainRampDays = 5
    } else if (cnsRisk === 'HIGH' || (cnsRisk === 'MODERATE' && recoveryScore < 50)) {
        weeklyFocus = 'Parasympathetic Reactivation'
        baseStrain = 4
        strainRampDays = 4
    } else if (injuryRiskLevel === 'HIGH' || injuryRiskLevel === 'MODERATE') {
        weeklyFocus = 'Structural Integrity & Prehab'
        baseStrain = 5
        strainRampDays = 3
    } else if (greenStreak >= 4 && avgRecentRecovery >= 70) {
        weeklyFocus = 'Performance Escalation'
        baseStrain = 10
        strainRampDays = 2
    } else if (avgRecentRecovery >= 60) {
        weeklyFocus = 'Progressive Overload'
        baseStrain = 8
        strainRampDays = 3
    } else {
        weeklyFocus = 'Balanced Development'
        baseStrain = 7
        strainRampDays = 3
    }

    // ── Generate 7-day plan ─────────────────────────────────────────────────
    const startDt = new Date(startDate + 'T00:00:00')
    const days: DayPlan[] = []

    for (let i = 0; i < 7; i++) {
        const date = new Date(startDt)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        const dayOfWeek = date.getDay()
        const label = i === 0 ? 'Today' : DAY_LABELS[dayOfWeek]

        // Strain ramping: days 1-N are at base, then ramp up
        const rampFactor = i < strainRampDays
            ? 1.0
            : 1.0 + (i - strainRampDays + 1) * 0.15
        let recommendedStrain = Math.round(baseStrain * rampFactor * 10) / 10
        recommendedStrain = Math.min(21, Math.max(1, recommendedStrain))

        // Workout type selection
        let workoutType: string
        let intensityLabel: DayPlan['intensityLabel']

        if (recommendedStrain <= 3) {
            workoutType = pickWorkout('recovery', i)
            intensityLabel = 'REST'
        } else if (recommendedStrain <= 6) {
            workoutType = pickWorkout('mobility', i)
            intensityLabel = 'LIGHT'
        } else if (recommendedStrain <= 10) {
            if (prefersWeights && i % 3 === 1) {
                workoutType = pickWorkout('strength', i)
            } else if (hasRunning && i % 2 === 0) {
                workoutType = pickWorkout('endurance', i)
            } else {
                workoutType = pickWorkout('endurance', i)
            }
            intensityLabel = 'MODERATE'
        } else if (recommendedStrain <= 15) {
            if (hasStrength && i % 3 === 1) {
                workoutType = pickWorkout('strength', i)
            } else if (hasHIIT && i % 2 === 0) {
                workoutType = pickWorkout('hiit', i)
            } else {
                workoutType = pickWorkout('threshold', i)
            }
            intensityLabel = 'HARD'
        } else {
            workoutType = pickWorkout('hiit', i)
            intensityLabel = 'INTENSE'
        }

        // If injury risk, swap impact for low-impact
        if ((injuryRiskLevel === 'HIGH' || injuryRiskLevel === 'MODERATE') && intensityLabel !== 'REST') {
            workoutType = pickWorkout('lowImpact', i)
            intensityLabel = intensityLabel === 'HARD' ? 'MODERATE' : intensityLabel
        }

        // If CNS stress is high, cap intensity
        if (cnsRisk === 'HIGH' && intensityLabel === 'HARD') {
            intensityLabel = 'MODERATE'
            recommendedStrain = Math.min(recommendedStrain, 8)
        }

        // Target bedtime: earlier if sleep debt
        let targetBedtime: string
        if (i < 3 && sleepDebtHours > 0.5) {
            targetBedtime = '9:30 PM'
        } else if (i < 5 && sleepDebtHours > 0.3) {
            targetBedtime = '10:00 PM'
        } else if (recommendedStrain > 15) {
            targetBedtime = '9:45 PM'  // High strain days need more sleep
        } else {
            targetBedtime = '10:30 PM'
        }

        // Recovery protocols
        const recoveryProtocols: string[] = []
        if (cnsRisk !== 'LOW') {
            recoveryProtocols.push(...RECOVERY_PROTOCOLS.cns.slice(0, 2))
        }
        if (recommendedStrain > 12) {
            recoveryProtocols.push(RECOVERY_PROTOCOLS.muscle[0])
        }
        if (sleepDebtHours > 0.5) {
            recoveryProtocols.push(RECOVERY_PROTOCOLS.sleep[0])
        }
        if (recoveryProtocols.length === 0) {
            recoveryProtocols.push(RECOVERY_PROTOCOLS.general[0])
        }

        // Nutrition focus
        let nutritionFocus: string
        if (cnsRisk !== 'LOW') {
            nutritionFocus = NUTRITION_FOCUS.cns
        } else if (recommendedStrain <= 3) {
            nutritionFocus = NUTRITION_FOCUS.sleep
        } else if (recommendedStrain > 12) {
            nutritionFocus = NUTRITION_FOCUS.endurance
        } else if (workoutType.toLowerCase().includes('strength') || workoutType.toLowerCase().includes('lift')) {
            nutritionFocus = NUTRITION_FOCUS.strength
        } else {
            nutritionFocus = NUTRITION_FOCUS.default
        }

        // Warning flags
        const warningFlags: string[] = []
        if (cnsRisk !== 'LOW') {
            warningFlags.push(`${cnsRisk} CNS STRESS — prioritize sleep & low-intensity`)
        }
        if (injuryRiskLevel !== 'LOW') {
            warningFlags.push(`${injuryRiskLevel} INJURY RISK — avoid impact training`)
        }
        if (sleepDebtHours > 1) {
            warningFlags.push('SLEEP DEBT CRITICAL — early bedtime mandatory')
        }
        if (recommendedStrain > 18) {
            warningFlags.push('EXTREME STRAIN — ensure recovery protocols')
        }

        days.push({
            date: dateStr,
            label,
            recommendedStrain,
            workoutType,
            targetBedtime,
            recoveryProtocols,
            nutritionFocus,
            warningFlags,
            intensityLabel,
        })
    }

    // ── Projected outcomes ──────────────────────────────────────────────────
    const totalStrain = days.reduce((a, d) => a + d.recommendedStrain, 0)
    const sleepDebtReduction = Math.min(sleepDebtHours, sleepDebtHours * 0.5 + (days.filter(d => d.targetBedtime < '10:00 PM').length * 0.15))

    const projectedOutcomes = {
        estimatedRecoveryByDay7: Math.round(
            Math.min(100, recoveryScore + (sleepDebtHours > 1 ? 10 : 5) + (greenStreak >= 3 ? 5 : 0))
        ),
        estimatedStrainAccumulation: Math.round(totalStrain * 10) / 10,
        projectedSleepDebtResolution: Math.round(Math.max(0, sleepDebtHours - sleepDebtReduction) * 10) / 10,
    }

    // ── Confidence ──────────────────────────────────────────────────────────
    const dataPoints = recentScores.length + recentSleep.length + recentActivities.length
    let confidence = Math.min(85, 30 + dataPoints * 2)

    if (recentScores.length >= 14) confidence += 10
    if (recentSleep.length >= 14) confidence += 5

    return {
        days,
        weeklyFocus,
        projectedOutcomes,
        generatedAt: new Date().toISOString(),
        confidence: Math.min(100, confidence),
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function countTrailingGreens(scores: DailyScores[]): number {
    let count = 0
    const sorted = [...scores].sort((a, b) => b.date.localeCompare(a.date))
    for (const s of sorted) {
        if (s.recoveryZone === 'green') count++
        else break
    }
    return count
}

function pickWorkout(category: string, seed: number): string {
    const options = WORKOUT_TYPES[category] || WORKOUT_TYPES.endurance
    return options[seed % options.length]
}

// ── Selector for store ───────────────────────────────────────────────────────

export function generateWeeklyPlanSelector(state: HealthState): WeeklyPlan | null {
    // Defer import to avoid circular dependency at module load time
    const { memoizedCompute } = require('../store') as typeof import('../store')
    return memoizedCompute('weeklyPlan', state, () => {
        const sortedScores = [...state.scores].sort((a, b) => b.date.localeCompare(a.date))
        const sortedSleep = [...state.sleep].sort((a, b) => b.date.localeCompare(a.date))
        const sortedActivities = [...state.activities].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        const sortedEnv = [...state.environmental].sort((a, b) => b.date.localeCompare(a.date))

        // Guard: require at least 7 days of BOTH scores AND sleep to generate a meaningful plan
        const hasMinScores = sortedScores.length >= 7
        const hasMinSleep = sortedSleep.filter(s => s.totalDurationMins > 0).length >= 7
        if (!hasMinScores || !hasMinSleep) return null

        const today = new Date().toISOString().split('T')[0]

        return generateWeeklyPlan({
            currentScores: sortedScores[0] ?? null,
            currentSleep: sortedSleep[0] ?? null,
            recentScores: sortedScores.slice(0, 14),
            recentSleep: sortedSleep.slice(0, 14),
            recentActivities: sortedActivities.slice(0, 21),
            recentEnvironmental: sortedEnv.slice(0, 14),
            injuryRisk: state.injuryRisk,
            cnsStressScore: state.cnsStressScore,
            journalEntries: state.journalEntries,
            startDate: today,
        })
    })
}
