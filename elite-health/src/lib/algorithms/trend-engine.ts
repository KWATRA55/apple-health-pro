export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'trend-engine';

/**
 * Rolling Trend Analysis Engine
 *
 * Computes multi-window linear trends (7d, 14d, 30d), acceleration,
 * volatility, and pattern detection across all biometric dimensions.
 *
 * Patterns detected:
 *   - recovery_cliff: Recovery falling >1σ below 14d mean with acceleration
 *   - hrv_surge: HRV rising >1.5σ above 14d mean (positive adaptation)
 *   - rhr_creep: RHR rising >1σ above 14d mean (parasympathetic withdrawal)
 *   - sleep_erosion: Sleep debt accumulating over 7-day window
 *   - strain_accumulation: Strain consistently above recovery capacity
 *   - cns_fatigue: HRV suppressed + RHR elevated + sleep quality declining
 *   - positive_adaptation: All metrics trending favorably
 *   - inflammation_spike: Skin temp + RHR both elevated
 *   - vo2max_decline: VO2 max trending down across 30-day window
 */

import { mean, stddev, zScore } from './z-score'

// ── Types ────────────────────────────────────────────────────────────────────

export type MetricDirection = 'rising' | 'falling' | 'stable'

export interface TrendMetric {
    /** Raw values sorted chronologically */
    values: number[]
    /** ISO date strings corresponding to values */
    dates: string[]
    /** Linear regression slope (% change per day relative to mean) */
    slope7d: number
    slope14d: number
    slope30d: number
    /** Rolling arithmetic mean */
    mean7d: number
    mean14d: number
    mean30d: number
    /** Coefficient of variation (σ/μ) as a percentage */
    volatility7d: number
    volatility14d: number
    volatility30d: number
    /** Direction of the 7-day trend */
    direction7d: MetricDirection
    /** Acceleration: 7d slope vs 14d slope (positive = worsening if direction is 'rising' for RHR) */
    acceleration: number
    /** How many standard deviations the latest value is from the 14-day mean */
    recentZScore: number
    /** Latest value */
    latest: number
    /** Minimum value in 14-day window */
    min14d: number
    /** Maximum value in 14-day window */
    max14d: number
    /** Number of data points in 30-day window */
    sampleCount: number
    /** Is there enough data for a valid trend? */
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
    /** Which metric(s) triggered this pattern */
    metrics: string[]
    /** 0–1 confidence */
    confidence: number
    /** Human-readable description */
    description: string
    /** Severity for alerting */
    severity: 'positive' | 'neutral' | 'warning' | 'critical'
}

export interface TrendReport {
    /** ISO timestamp of computation */
    timestamp: string
    /** The reference date (latest date in the dataset) */
    referenceDate: string
    /** Per-metric trend analysis */
    metrics: Record<string, TrendMetric>
    /** Detected patterns */
    patterns: TrendPattern[]
    /** Human-readable 1-2 sentence summary */
    summary: string
}

// ── Input Types ──────────────────────────────────────────────────────────────

export interface TrendInput {
    /** Array of { date: string, value: number } pairs sorted chronologically */
    series: { date: string; value: number }[]
    /** Metric name for labeling */
    metricName: string
    /** Is higher better for this metric? (e.g., HRV = yes, RHR = no) */
    higherIsBetter: boolean
    /** Minimum number of data points required for valid trend */
    minSamples?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple linear regression: returns { slope, intercept, r2 }
 * y = slope * x + intercept
 */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = x.length
    if (n < 2) return { slope: 0, intercept: y[0] || 0, r2: 0 }

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
    for (let i = 0; i < n; i++) {
        sumX += x[i]
        sumY += y[i]
        sumXY += x[i] * y[i]
        sumX2 += x[i] * x[i]
        sumY2 += y[i] * y[i]
    }

    const denom = n * sumX2 - sumX * sumX
    if (denom === 0) return { slope: 0, intercept: y[0] || 0, r2: 0 }

    const slope = (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n

    // R²
    const yMean = sumY / n
    let ssRes = 0, ssTot = 0
    for (let i = 0; i < n; i++) {
        const pred = slope * x[i] + intercept
        ssRes += (y[i] - pred) ** 2
        ssTot += (y[i] - yMean) ** 2
    }
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

    return { slope, intercept, r2 }
}

/**
 * Compute slope as percentage change per day relative to the mean.
 * This normalizes slopes across metrics with different scales.
 */
function normalizedSlope(values: number[]): number {
    if (values.length < 2) return 0
    const mu = mean(values)
    if (mu === 0) return 0
    const x = values.map((_, i) => i)
    const { slope } = linearRegression(x, values)
    return (slope / mu) * 100
}

/**
 * Coefficient of variation as percentage
 */
function coefficientOfVariation(values: number[]): number {
    if (values.length < 2) return 0
    const mu = mean(values)
    if (mu === 0) return 0
    return (stddev(values) / mu) * 100
}

/**
 * Determine direction from slope
 */
function directionFromSlope(slope: number, higherIsBetter: boolean): MetricDirection {
    const threshold = 0.15 // % per day
    if (Math.abs(slope) < threshold) return 'stable'
    if (higherIsBetter) {
        return slope > 0 ? 'rising' : 'falling'
    }
    return slope > 0 ? 'rising' : 'falling'
}

// ── Core Computation ─────────────────────────────────────────────────────────

export function computeTrendMetric(input: TrendInput): TrendMetric {
    const { series, metricName: _metricName, higherIsBetter, minSamples = 5 } = input

    if (series.length < minSamples) {
        return {
            values: series.map(s => s.value),
            dates: series.map(s => s.date),
            slope7d: 0, slope14d: 0, slope30d: 0,
            mean7d: 0, mean14d: 0, mean30d: 0,
            volatility7d: 0, volatility14d: 0, volatility30d: 0,
            direction7d: 'stable',
            acceleration: 0,
            recentZScore: 0,
            latest: series.length > 0 ? series[series.length - 1].value : 0,
            min14d: 0, max14d: 0,
            sampleCount: series.length,
            hasSufficient: false,
        }
    }

    const values = series.map(s => s.value)
    const dates = series.map(s => s.date)
    const latest = values[values.length - 1]

    // Window slices
    const win7 = values.slice(-7)
    const win14 = values.slice(-14)
    const win30 = values.slice(-30)

    const mean7d = mean(win7)
    const mean14d = mean(win14)
    const mean30d = mean(win30)

    const slope7d = normalizedSlope(win7)
    const slope14d = normalizedSlope(win14)
    const slope30d = normalizedSlope(win30)

    const volatility7d = coefficientOfVariation(win7)
    const volatility14d = coefficientOfVariation(win14)
    const volatility30d = coefficientOfVariation(win30)

    const direction7d = directionFromSlope(slope7d, higherIsBetter)

    // Acceleration: change in slope between windows
    const acceleration = slope7d - slope14d

    // Recent deviation from 14-day baseline
    const sigma14 = stddev(win14)
    const recentZScore = sigma14 === 0 ? 0 : zScore(latest, mean14d, sigma14)

    const min14d = Math.min(...win14)
    const max14d = Math.max(...win14)

    return {
        values,
        dates,
        slope7d, slope14d, slope30d,
        mean7d, mean14d, mean30d,
        volatility7d, volatility14d, volatility30d,
        direction7d,
        acceleration,
        recentZScore,
        latest,
        min14d,
        max14d,
        sampleCount: series.length,
        hasSufficient: true,
    }
}

// ── Pattern Detection ────────────────────────────────────────────────────────

export interface PatternDetectionInput {
    recovery: TrendMetric
    hrv: TrendMetric
    rhr: TrendMetric
    sleepDuration: TrendMetric
    sleepDebt: TrendMetric
    strain: TrendMetric
    spo2: TrendMetric
    skinTempDelta: TrendMetric
    respiratoryRate: TrendMetric
    vo2max?: TrendMetric
    doubleSupport?: TrendMetric
}

export function detectPatterns(input: PatternDetectionInput): TrendPattern[] {
    const patterns: TrendPattern[] = []
    const {
        recovery, hrv, rhr, sleepDuration, sleepDebt,
        strain, spo2, skinTempDelta, respiratoryRate,
        vo2max, doubleSupport,
    } = input

    // ── Recovery Cliff ──
    // Recovery falling with acceleration (getting worse faster)
    if (
        recovery.hasSufficient &&
        recovery.slope7d < -0.3 &&
        recovery.acceleration < -0.1 &&
        recovery.recentZScore < -0.8
    ) {
        const conf = Math.min(0.95, Math.abs(recovery.recentZScore) * 0.4 + Math.abs(recovery.slope7d) * 0.3)
        patterns.push({
            type: 'recovery_cliff',
            metrics: ['recovery'],
            confidence: conf,
            description: `Recovery declining ${Math.abs(recovery.slope7d).toFixed(1)}%/day — ${recovery.recentZScore.toFixed(1)}σ below baseline. Prioritize rest.`,
            severity: recovery.recentZScore < -1.5 ? 'critical' : 'warning',
        })
    }

    // ── HRV Surge (positive adaptation) ──
    if (
        hrv.hasSufficient &&
        hrv.slope7d > 0.5 &&
        hrv.recentZScore > 1.5
    ) {
        patterns.push({
            type: 'hrv_surge',
            metrics: ['hrv'],
            confidence: Math.min(0.9, hrv.recentZScore * 0.3),
            description: `HRV surging +${hrv.recentZScore.toFixed(1)}σ — strong parasympathetic rebound. Optimal training window.`,
            severity: 'positive',
        })
    }

    // ── RHR Creep (parasympathetic withdrawal) ──
    if (
        rhr.hasSufficient &&
        rhr.slope7d > 0.2 &&
        rhr.recentZScore > 1.0
    ) {
        const conf = Math.min(0.9, rhr.recentZScore * 0.3 + rhr.slope7d * 0.3)
        patterns.push({
            type: 'rhr_creep',
            metrics: ['rhr'],
            confidence: conf,
            description: `RHR creeping +${rhr.recentZScore.toFixed(1)}σ — possible overtraining or illness incubation.`,
            severity: rhr.recentZScore > 1.8 ? 'critical' : 'warning',
        })
    }

    // ── Sleep Erosion ──
    if (
        sleepDuration.hasSufficient &&
        sleepDuration.slope7d < -0.2 &&
        sleepDebt.hasSufficient &&
        sleepDebt.slope7d > 0.15
    ) {
        patterns.push({
            type: 'sleep_erosion',
            metrics: ['sleepDuration', 'sleepDebt'],
            confidence: Math.min(0.85, Math.abs(sleepDuration.slope7d) * 0.4 + sleepDebt.slope7d * 0.3),
            description: `Sleep duration declining — debt accumulating. Prioritize early bedtime.`,
            severity: sleepDebt.recentZScore > 1.5 ? 'critical' : 'warning',
        })
    }

    // ── Strain Accumulation ──
    if (
        strain.hasSufficient &&
        strain.slope7d > 0.3 &&
        recovery.hasSufficient &&
        recovery.slope7d < 0
    ) {
        patterns.push({
            type: 'strain_accumulation',
            metrics: ['strain', 'recovery'],
            confidence: Math.min(0.85, strain.slope7d * 0.5 + Math.abs(recovery.slope7d) * 0.3),
            description: `Strain rising while recovery falls — overreaching risk. Dial back intensity.`,
            severity: strain.recentZScore > 1.5 ? 'critical' : 'warning',
        })
    }

    // ── CNS Fatigue ──
    if (
        hrv.hasSufficient && rhr.hasSufficient && sleepDuration.hasSufficient &&
        hrv.slope7d < -0.2 &&
        rhr.slope7d > 0.15 &&
        sleepDuration.slope7d < -0.1
    ) {
        const conf = Math.min(
            0.95,
            Math.abs(hrv.slope7d) * 0.25 + rhr.slope7d * 0.25 + Math.abs(sleepDuration.slope7d) * 0.3
        )
        patterns.push({
            type: 'cns_fatigue',
            metrics: ['hrv', 'rhr', 'sleepDuration'],
            confidence: conf,
            description: `CNS fatigue pattern: HRV↓, RHR↑, sleep↓. Full rest day recommended.`,
            severity: hrv.recentZScore < -1.5 ? 'critical' : 'warning',
        })
    }

    // ── Positive Adaptation ──
    if (
        recovery.hasSufficient && hrv.hasSufficient && rhr.hasSufficient &&
        recovery.slope7d > 0.2 &&
        hrv.slope7d > 0.2 &&
        rhr.slope7d < -0.1
    ) {
        patterns.push({
            type: 'positive_adaptation',
            metrics: ['recovery', 'hrv', 'rhr'],
            confidence: Math.min(0.9, recovery.slope7d * 0.3 + hrv.slope7d * 0.2),
            description: `Positive adaptation: All key metrics trending favorably. Great work!`,
            severity: 'positive',
        })
    }

    // ── Inflammation Spike ──
    if (
        skinTempDelta.hasSufficient && rhr.hasSufficient &&
        skinTempDelta.recentZScore > 1.2 &&
        rhr.recentZScore > 0.8
    ) {
        patterns.push({
            type: 'inflammation_spike',
            metrics: ['skinTempDelta', 'rhr'],
            confidence: Math.min(0.8, skinTempDelta.recentZScore * 0.3 + rhr.recentZScore * 0.2),
            description: `Inflammation markers elevated — skin temp +${skinTempDelta.recentZScore.toFixed(1)}σ, RHR +${rhr.recentZScore.toFixed(1)}σ. Monitor for illness.`,
            severity: skinTempDelta.recentZScore > 2 ? 'critical' : 'warning',
        })
    }

    // ── VO2 Max Decline ──
    if (
        vo2max?.hasSufficient &&
        vo2max.slope30d < -0.1 &&
        vo2max.recentZScore < -0.8
    ) {
        patterns.push({
            type: 'vo2max_decline',
            metrics: ['vo2max'],
            confidence: Math.min(0.8, Math.abs(vo2max.slope30d) * 0.5),
            description: `VO₂ max declining over 30 days — consider aerobic base rebuild.`,
            severity: vo2max.slope30d < -0.3 ? 'warning' : 'neutral',
        })
    }

    return patterns
}

// ── Summary Generator ────────────────────────────────────────────────────────

export function generateTrendSummary(patterns: TrendPattern[]): string {
    if (patterns.length === 0) {
        return 'All biometrics are stable across rolling windows. No significant patterns detected.'
    }

    const critical = patterns.filter(p => p.severity === 'critical')
    const warnings = patterns.filter(p => p.severity === 'warning')
    const positive = patterns.filter(p => p.severity === 'positive')

    const parts: string[] = []

    if (critical.length > 0) {
        parts.push(`⚠️ ${critical.length} critical pattern${critical.length > 1 ? 's' : ''}: ${critical.map(p => p.type.replace(/_/g, ' ')).join(', ')}.`)
    }

    if (warnings.length > 0) {
        parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}: ${warnings.map(p => p.type.replace(/_/g, ' ')).join(', ')}.`)
    }

    if (positive.length > 0) {
        parts.push(`✅ Positive: ${positive.map(p => p.type.replace(/_/g, ' ')).join(', ')}.`)
    }

    if (critical.length === 0 && warnings.length === 0 && positive.length > 0) {
        parts.unshift('Trends are favorable.')
    }

    return parts.join(' ')
}

// ── Full Report Computation ──────────────────────────────────────────────────

export interface FullTrendInput {
    vitals: { date: string; hrv: number; rhr: number; spo2: number; skinTempDelta: number | null; respiratoryRate: number }[]
    scores: { date: string; recoveryScore: number; strainScore: number; sleepDebtHours: number; paceOfAging: number; biologicalAge: number; rawAge?: number; displayAge?: number }[]
    sleep: { date: string; totalDurationMins: number }[]
    cardioMetabolic?: { date: string; vo2Max: number }[]
    mobility?: { date: string; doubleSupport: number; walkingAsymmetry?: number; strideLength?: number }[]
    weightHistory?: { timestamp: string; weightKg: number; leanBodyMassPercent?: number | null }[]
    environmental?: { date: string; timeInDaylight: number; headphoneAudio: number }[]
}

export function computeTrendReport(input: FullTrendInput): TrendReport {
    const now = new Date().toISOString()
    const referenceDate = input.vitals.length > 0
        ? input.vitals[input.vitals.length - 1].date
        : new Date().toISOString().slice(0, 10)

    // Compute individual trend metrics
    const hrv = computeTrendMetric({
        series: input.vitals
            .filter(v => v.hrv > 0)
            .map(v => ({ date: v.date, value: v.hrv })),
        metricName: 'hrv',
        higherIsBetter: true,
    })

    const rhr = computeTrendMetric({
        series: input.vitals
            .filter(v => v.rhr > 0)
            .map(v => ({ date: v.date, value: v.rhr })),
        metricName: 'rhr',
        higherIsBetter: false,
    })

    const spo2 = computeTrendMetric({
        series: input.vitals
            .filter(v => v.spo2 > 0)
            .map(v => ({ date: v.date, value: v.spo2 })),
        metricName: 'spo2',
        higherIsBetter: true,
    })

    const skinTempDelta = computeTrendMetric({
        series: input.vitals
            .filter(v => v.skinTempDelta != null && Math.abs(v.skinTempDelta) < 5) // filter nulls & outliers
            .map(v => ({ date: v.date, value: v.skinTempDelta! })),
        metricName: 'skinTempDelta',
        higherIsBetter: false,
    })

    const respiratoryRate = computeTrendMetric({
        series: input.vitals
            .filter(v => v.respiratoryRate > 0)
            .map(v => ({ date: v.date, value: v.respiratoryRate })),
        metricName: 'respiratoryRate',
        higherIsBetter: false,
    })

    const recovery = computeTrendMetric({
        series: input.scores
            .filter(s => s.recoveryScore > 0)
            .map(s => ({ date: s.date, value: s.recoveryScore })),
        metricName: 'recovery',
        higherIsBetter: true,
    })

    const strain = computeTrendMetric({
        series: input.scores
            .filter(s => s.strainScore > 0)
            .map(s => ({ date: s.date, value: s.strainScore })),
        metricName: 'strain',
        higherIsBetter: false,
    })

    const sleepDuration = computeTrendMetric({
        series: input.sleep
            .filter(s => s.totalDurationMins > 0)
            .map(s => ({ date: s.date, value: s.totalDurationMins })),
        metricName: 'sleepDuration',
        higherIsBetter: true,
    })

    // Sleep debt sourced from scores (computed by computeScores), NOT from sleep records
    // because addSleep() never populates the sleep_debt_hours column on SleepRecord.
    const sleepDebt = computeTrendMetric({
        series: input.scores
            .filter(s => s.sleepDebtHours != null)
            .map(s => ({ date: s.date, value: s.sleepDebtHours })),
        metricName: 'sleepDebt',
        higherIsBetter: false,
    })

    const paceOfAging = computeTrendMetric({
        series: input.scores
            .filter(s => s.paceOfAging > 0)
            .map(s => ({ date: s.date, value: s.paceOfAging })),
        metricName: 'paceOfAging',
        higherIsBetter: false,
    })

    // Use rawAge (float) for trend precision when available; fall back to biologicalAge
    const biologicalAge = computeTrendMetric({
        series: input.scores
            .filter(s => ((s.rawAge !== undefined && s.rawAge > 0) || s.biologicalAge > 0))
            .map(s => ({ date: s.date, value: (s.rawAge !== undefined && s.rawAge > 0) ? s.rawAge : s.biologicalAge })),
        metricName: 'biologicalAge',
        higherIsBetter: false,
    })

    const vo2max = input.cardioMetabolic && input.cardioMetabolic.length > 0
        ? computeTrendMetric({
            series: input.cardioMetabolic
                .filter(c => c.vo2Max > 0)
                .map(c => ({ date: c.date, value: c.vo2Max })),
            metricName: 'vo2max',
            higherIsBetter: true,
            minSamples: 3,
        })
        : undefined

    const doubleSupport = input.mobility && input.mobility.length > 0
        ? computeTrendMetric({
            series: input.mobility
                .filter(m => m.doubleSupport > 0)
                .map(m => ({ date: m.date, value: m.doubleSupport })),
            metricName: 'doubleSupport',
            higherIsBetter: false,
            minSamples: 3,
        })
        : undefined

    const walkingAsymmetry = input.mobility && input.mobility.length > 0
        ? computeTrendMetric({
            series: input.mobility
                .filter(m => m.walkingAsymmetry !== undefined && m.walkingAsymmetry > 0)
                .map(m => ({ date: m.date, value: m.walkingAsymmetry! })),
            metricName: 'walkingAsymmetry',
            higherIsBetter: false,
            minSamples: 3,
        })
        : undefined

    const strideLength = input.mobility && input.mobility.length > 0
        ? computeTrendMetric({
            series: input.mobility
                .filter(m => m.strideLength !== undefined && m.strideLength > 0)
                .map(m => ({ date: m.date, value: m.strideLength! })),
            metricName: 'strideLength',
            higherIsBetter: true,
            minSamples: 3,
        })
        : undefined

    const weightKg = input.weightHistory && input.weightHistory.length > 0
        ? computeTrendMetric({
            series: input.weightHistory
                .filter(w => w.weightKg > 0)
                .map(w => ({ date: w.timestamp.slice(0, 10), value: w.weightKg })),
            metricName: 'weightKg',
            higherIsBetter: false,
            minSamples: 3,
        })
        : undefined

    const timeInDaylight = input.environmental && input.environmental.length > 0
        ? computeTrendMetric({
            series: input.environmental
                .filter(e => e.timeInDaylight > 0)
                .map(e => ({ date: e.date, value: e.timeInDaylight })),
            metricName: 'timeInDaylight',
            higherIsBetter: true,
            minSamples: 3,
        })
        : undefined

    const headphoneAudio = input.environmental && input.environmental.length > 0
        ? computeTrendMetric({
            series: input.environmental
                .filter(e => e.headphoneAudio > 0)
                .map(e => ({ date: e.date, value: e.headphoneAudio })),
            metricName: 'headphoneAudio',
            higherIsBetter: false,
            minSamples: 3,
        })
        : undefined

    // Detect patterns
    const patterns = detectPatterns({
        recovery,
        hrv,
        rhr,
        sleepDuration,
        sleepDebt,
        strain,
        spo2,
        skinTempDelta,
        respiratoryRate,
        vo2max,
        doubleSupport,
    })

    const summary = generateTrendSummary(patterns)

    return {
        timestamp: now,
        referenceDate,
        metrics: {
            hrv,
            rhr,
            spo2,
            skinTempDelta,
            respiratoryRate,
            recovery,
            strain,
            sleepDuration,
            sleepDebt,
            paceOfAging,
            biologicalAge,
            ...(vo2max ? { vo2max } : {}),
            ...(doubleSupport ? { doubleSupport } : {}),
            ...(walkingAsymmetry ? { walkingAsymmetry } : {}),
            ...(strideLength ? { strideLength } : {}),
            ...(weightKg ? { weightKg } : {}),
            ...(timeInDaylight ? { timeInDaylight } : {}),
            ...(headphoneAudio ? { headphoneAudio } : {}),
        },
        patterns,
        summary,
    }
}

// ── Trend-Based Proactive Alert Generation ──────────────────────

export interface TrendAlertInput {
    patterns: TrendPattern[]
    metrics: TrendReport['metrics']
}

export function generateTrendAlerts(input: TrendAlertInput): import('../../lib/types').InterceptTrigger[] {
    const alerts: import('../../lib/types').InterceptTrigger[] = []
    const { patterns, metrics } = input

    for (const p of patterns) {
        switch (p.type) {
            case 'recovery_cliff': {
                const hrv = metrics.hrv
                const rhr = metrics.rhr
                const details: string[] = []
                if (hrv && hrv.direction7d === 'falling') details.push(`7-day HRV decline of ${(Math.abs(hrv.slope7d ?? 0) * 100).toFixed(1)}%/day`)
                if (rhr && rhr.direction7d === 'rising') details.push(`RHR climbing ${(Math.abs(rhr.slope7d ?? 0) * 100).toFixed(1)}%/day`)
                alerts.push({
                    type: 'recovery_erosion',
                    title: 'RECOVERY TREND ERODING',
                    message: `${p.description}. ${details.join('. ')}. Prioritize sleep, reduce training load by 30%, and monitor closely.`,
                    icon: 'TRENDING_DOWN',
                    actionLabel: 'VIEW READINESS',
                    severity: p.severity === 'critical' ? 'critical' : 'warning',
                    pill: 'readiness',
                })
                break
            }

            case 'sleep_erosion': {
                const sleepDur = metrics.sleepDuration
                const sleepDebt = metrics.sleepDebt
                const detail = sleepDur
                    ? `Sleep duration declining ${(Math.abs(sleepDur.slope7d ?? 0) * 100).toFixed(1)}%/day`
                    : ''
                if (sleepDebt && sleepDebt.direction7d === 'rising') {
                    alerts.push({
                        type: 'trend_degradation',
                        title: 'SLEEP DEBT ACCUMULATING',
                        message: `${p.description}. ${detail}. Sleep debt compounding — set fixed bedtime, no screens 1h before.`,
                        icon: 'MOON',
                        actionLabel: 'SET BEDTIME',
                        severity: 'warning',
                        pill: 'readiness',
                    })
                }
                break
            }

            case 'strain_accumulation': {
                alerts.push({
                    type: 'cns_accumulation',
                    title: 'CHRONIC STRAIN BUILDUP',
                    message: `${p.description}. Sustained high strain without adequate recovery windows. Mandatory deload or rest day within 48 hours.`,
                    icon: 'WARNING',
                    actionLabel: 'PLAN DELOAD',
                    severity: 'warning',
                    pill: 'resilience',
                })
                break
            }

            case 'cns_fatigue': {
                alerts.push({
                    type: 'cns_accumulation',
                    title: 'CNS FATIGUE TREND',
                    message: `${p.description}. CNS stress compounding across multiple markers — HRV suppression, elevated RHR, and sleep fragmentation all converging.`,
                    icon: 'REST',
                    actionLabel: 'REST & RECHARGE',
                    severity: 'critical',
                    pill: 'readiness',
                })
                break
            }

            case 'vo2max_decline': {
                const vo2 = metrics.vo2max
                const detail = vo2
                    ? `VO2Max declining ${(Math.abs(vo2.slope7d ?? 0) * 100).toFixed(1)}%/day over 7 days`
                    : ''
                alerts.push({
                    type: 'vo2max_alert',
                    title: 'VO2 MAX DECLINING',
                    message: `${p.description}. ${detail}. Cardiorespiratory fitness trending down — increase Zone 2 volume and check for overtraining.`,
                    icon: 'TRENDING_DOWN',
                    actionLabel: 'VIEW LONGEVITY',
                    severity: 'warning',
                    pill: 'longevity',
                })
                break
            }

            case 'inflammation_spike': {
                alerts.push({
                    type: 'trend_degradation',
                    title: 'INFLAMMATORY SPIKE DETECTED',
                    message: `${p.description}. Skin temp elevation + RHR climb suggest systemic inflammation. Anti-inflammatory nutrition, prioritize sleep, avoid alcohol.`,
                    icon: 'WARNING',
                    actionLabel: 'VIEW RESILIENCE',
                    severity: 'warning',
                    pill: 'resilience',
                })
                break
            }

            case 'hrv_surge':
            case 'positive_adaptation':
                // Positive patterns — no alert needed
                break

            case 'rhr_creep': {
                const rhr = metrics.rhr
                const detail = rhr
                    ? `RHR increased ~${Math.abs(rhr.slope7d ?? 0) * 7 * 100 > 1 ? (Math.abs(rhr.slope7d ?? 0) * 7 * 100).toFixed(0) : '1'}% over 7 days`
                    : ''
                alerts.push({
                    type: 'trend_degradation',
                    title: 'RHR TRENDING UPWARD',
                    message: `${p.description}. ${detail}. Elevated resting heart rate signals incomplete recovery or early illness. Reduce intensity, increase sleep.`,
                    icon: 'TRENDING_UP',
                    actionLabel: 'VIEW READINESS',
                    severity: 'warning',
                    pill: 'readiness',
                })
                break
            }

            default:
                alerts.push({
                    type: 'trend_degradation',
                    title: 'TREND DEGRADATION',
                    message: p.description,
                    icon: 'WARNING',
                    actionLabel: 'VIEW DETAILS',
                    severity: p.severity === 'critical' ? 'critical' : 'warning',
                    pill: 'readiness',
                })
        }
    }

    return alerts
}
