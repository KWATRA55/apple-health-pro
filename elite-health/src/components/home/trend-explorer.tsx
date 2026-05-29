import React, { useMemo } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated'
import { GlassCard } from '../ui/glass-card'
import type { TrendReport, TrendMetric, TrendPattern } from '../../lib/types'
import { safeNumber } from '../../lib/utils/display-helpers'

// ── Types ────────────────────────────────────────────────────────────────────

interface TrendExplorerProps {
    report: TrendReport | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slopeDirectionArrow(metric: TrendMetric): string {
    if (!metric.hasSufficient) return '—'
    switch (metric.direction7d) {
        case 'rising': return '↑'
        case 'falling': return '↓'
        case 'stable': return '→'
    }
}

/** Arrow reflecting current value vs baseline (z-score direction), not slope */
function zScoreArrow(metric: TrendMetric, higherIsBetter: boolean): string {
    if (!metric.hasSufficient) return '—'
    const z = metric.recentZScore
    if (Math.abs(z) < 0.3) return '→'
    const positive = higherIsBetter ? z > 0 : z < 0
    return positive ? '↑' : '↓'
}

function slopeColor(metric: TrendMetric, higherIsBetter: boolean): string {
    if (!metric.hasSufficient) return '#8A8F93'
    const slope = metric.slope7d
    if (Math.abs(slope) < 0.15) return '#8A8F93'
    const isImproving = higherIsBetter ? slope > 0 : slope < 0
    if (isImproving) return '#30D158'
    if (Math.abs(slope) > 0.5) return '#FF453A'
    return '#FFD60A'
}

/** Color reflecting whether current value is favorable relative to baseline */
function zScoreColor(metric: TrendMetric, higherIsBetter: boolean): string {
    const z = metric.recentZScore
    const abs = Math.abs(z)
    if (abs < 0.3) return '#8A8F93' // near baseline
    const isFavorable = higherIsBetter ? z > 0 : z < 0
    if (isFavorable) return '#30D158' // green — favorable direction
    if (abs > 1.5) return '#FF453A'   // red — significant deviation
    return '#FFD60A'                   // yellow — moderate deviation
}

function patternColor(severity: TrendPattern['severity']): string {
    switch (severity) {
        case 'critical': return '#FF453A'
        case 'warning': return '#FFD60A'
        case 'positive': return '#30D158'
        case 'neutral': return '#8A8F93'
    }
}

// ── Metric Row ───────────────────────────────────────────────────────────────

function TrendMetricRow({
    label,
    metric,
    unit,
    higherIsBetter,
}: {
    label: string
    metric: TrendMetric
    unit: string
    higherIsBetter: boolean
}) {
    if (!metric.hasSufficient) {
        return (
            <View className="flex-row justify-between items-center py-2 border-b border-border-dim">
                <Text className="text-steel text-[13px]">{label}</Text>
                <Text className="text-smoke text-[12px]">not enough data</Text>
            </View>
        )
    }

    return (
        <View className="flex-row justify-between items-center py-2 border-b border-border-dim">
            <View className="flex-1">
                <Text className="text-[rgba(255,255,255,0.75)] text-[13px]">{label}</Text>
                <View className="flex-row items-center gap-2 mt-0.5">
                    <Text className="text-[rgba(255,255,255,0.50)] text-[11px]">
                        14d avg: {safeNumber(metric.mean14d, 1)}{unit}
                    </Text>
                    <Text className="text-[rgba(255,255,255,0.30)] text-[11px]">
                        ±{safeNumber(Math.abs(metric.volatility14d), 0)}%
                    </Text>
                </View>
            </View>

            <View className="items-end">
                {/* Latest value + z-score arrow (current vs baseline) */}
                <View className="flex-row items-center gap-1.5">
                    <Text className="text-white text-[15px] font-semibold">
                        {safeNumber(metric.latest, 1)}{unit}
                    </Text>
                    <Text
                        style={{ color: zScoreColor(metric, higherIsBetter) }}
                        className="text-[12px] font-semibold"
                    >
                        {zScoreArrow(metric, higherIsBetter)} {metric.recentZScore > 0 ? '+' : ''}{safeNumber(metric.recentZScore, 1)}z
                    </Text>
                </View>

                {/* 7-day slope (secondary: where we're trending) */}
                <Text
                    style={{ color: slopeColor(metric, higherIsBetter) }}
                    className="text-[11px] font-medium"
                >
                    7d: {slopeDirectionArrow(metric)} {metric.slope7d > 0 ? '+' : ''}{safeNumber(metric.slope7d, 1)}%/day
                </Text>

                {/* 14d and 30d slope context */}
                <View className="flex-row gap-1.5 mt-0.5">
                    <Text className="text-[rgba(255,255,255,0.35)] text-[10px]">
                        14d: {metric.slope14d > 0 ? '+' : ''}{safeNumber(metric.slope14d, 1)}%
                    </Text>
                    <Text className="text-[rgba(255,255,255,0.25)] text-[10px]">
                        30d: {metric.slope30d > 0 ? '+' : ''}{safeNumber(metric.slope30d, 1)}%
                    </Text>
                </View>
            </View>
        </View>
    )
}

// ── Pattern Card ─────────────────────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: TrendPattern }) {
    return (
        <View
            className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-[12px] p-3 mb-2"
        >
            <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-2">
                    <View
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: patternColor(pattern.severity),
                        }}
                    />
                    <Text className="text-white text-[13px] font-semibold capitalize">
                        {pattern.type.replace(/_/g, ' ')}
                    </Text>
                </View>
                <Text
                    className="text-[11px] font-medium"
                    style={{ color: patternColor(pattern.severity) }}
                >
                    {pattern.severity === 'critical' ? '⚠️ Alert' : pattern.severity === 'warning' ? '⚡ Watch' : pattern.severity === 'positive' ? '✅ Good' : '— Neutral'}
                </Text>
            </View>
            <Text className="text-[rgba(255,255,255,0.60)] text-[12px] leading-[18px]">
                {pattern.description}
            </Text>
            <View className="flex-row items-center gap-2 mt-1.5">
                <Text className="text-[rgba(255,255,255,0.30)] text-[10px]">
                    {(pattern.confidence * 100).toFixed(0)}% confidence
                </Text>
                <Text className="text-[rgba(255,255,255,0.25)] text-[10px]">
                    based on {pattern.metrics.join(', ')}
                </Text>
            </View>
        </View>
    )
}

// ── Mini Line Chart (sparkline) ──────────────────────────────────────────────

function MiniSparkline(_props: { values: number[]; color: string; height: number }) {
    // Sparklines require react-native-svg Polyline; reserved for future enhancement
    return null
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TrendExplorer({ report }: TrendExplorerProps) {
    const fadeIn = useSharedValue(0)

    React.useEffect(() => {
        fadeIn.value = 0
        fadeIn.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    }, [report])

    const animStyle = useAnimatedStyle(() => ({
        opacity: fadeIn.value,
        transform: [{ translateY: (1 - fadeIn.value) * 8 }],
    }))

    if (!report) {
        return (
            <GlassCard className="p-4 mb-4">
                <Text className="text-steel text-[14px]">
                    Keep syncing daily — trends appear after 7+ days of data.
                </Text>
            </GlassCard>
        )
    }

    const metrics = report.metrics
    const hasPositive = report.patterns.some(p => p.severity === 'positive')
    const hasWarning = report.patterns.some(p => p.severity === 'warning')
    const hasCritical = report.patterns.some(p => p.severity === 'critical')

    return (
        <Animated.View style={animStyle} className="mb-4">
            {/* ── Summary Banner ── */}
            <View
                className={`rounded-[16px] p-4 mb-3 border ${hasCritical
                    ? 'bg-[rgba(255,69,58,0.08)] border-[rgba(255,69,58,0.20)]'
                    : hasWarning
                        ? 'bg-[rgba(255,214,10,0.08)] border-[rgba(255,214,10,0.20)]'
                        : hasPositive
                            ? 'bg-[rgba(48,209,88,0.08)] border-[rgba(48,209,88,0.20)]'
                            : 'bg-surface-glass border-edge-border'
                    }`}
            >
                <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-white text-[12px] font-semibold tracking-[0.1em] uppercase">
                        Health Trends
                    </Text>
                    <View className="bg-[rgba(255,255,255,0.06)] rounded-full px-2 py-0.5">
                        <Text className="text-[rgba(255,255,255,0.45)] text-[10px] font-medium">
                            14d rolling
                        </Text>
                    </View>
                </View>
                <Text className="text-[rgba(255,255,255,0.70)] text-[13px] leading-[20px]">
                    {report.summary}
                </Text>
            </View>

            {/* ── Detected Patterns ── */}
            {report.patterns.length > 0 && (
                <View className="mb-3">
                    <Text className="text-[rgba(255,255,255,0.55)] text-[11px] font-semibold tracking-[0.1em] uppercase mb-2">
                        Patterns Found
                    </Text>
                    {report.patterns.map((pattern, i) => (
                        <PatternCard key={i} pattern={pattern} />
                    ))}
                </View>
            )}

            {/* ── Metric Trends ── */}
            <GlassCard className="p-4">
                <Text className="text-[rgba(255,255,255,0.55)] text-[11px] font-semibold tracking-[0.1em] uppercase mb-1">
                    All Metrics
                </Text>
                <Text className="text-[rgba(255,255,255,0.30)] text-[10px] mb-3">
                    14-day rolling trend · values may differ from selected date cards
                </Text>

                <TrendMetricRow
                    label="Recovery"
                    metric={metrics.recovery!}
                    unit=""
                    higherIsBetter={true}
                />
                <TrendMetricRow
                    label="HRV"
                    metric={metrics.hrv!}
                    unit="ms"
                    higherIsBetter={true}
                />
                <TrendMetricRow
                    label="RHR"
                    metric={metrics.rhr!}
                    unit="bpm"
                    higherIsBetter={false}
                />
                <TrendMetricRow
                    label="Sleep Duration"
                    metric={metrics.sleepDuration!}
                    unit="min"
                    higherIsBetter={true}
                />
                <TrendMetricRow
                    label="Sleep Debt"
                    metric={metrics.sleepDebt!}
                    unit="h"
                    higherIsBetter={false}
                />
                <TrendMetricRow
                    label="Strain"
                    metric={metrics.strain!}
                    unit=""
                    higherIsBetter={false}
                />
                <TrendMetricRow
                    label="SpO₂"
                    metric={metrics.spo2!}
                    unit="%"
                    higherIsBetter={true}
                />
                <TrendMetricRow
                    label="Skin Temp"
                    metric={metrics.skinTempDelta!}
                    unit="°C"
                    higherIsBetter={false}
                />
                <TrendMetricRow
                    label="Breathing Rate"
                    metric={metrics.respiratoryRate!}
                    unit="bpm"
                    higherIsBetter={false}
                />
                <TrendMetricRow
                    label="Aging Pace"
                    metric={metrics.paceOfAging!}
                    unit="×"
                    higherIsBetter={false}
                />
                <TrendMetricRow
                    label="Body Age"
                    metric={metrics.biologicalAge!}
                    unit="yrs"
                    higherIsBetter={false}
                />

                {metrics.vo2max?.hasSufficient && (
                    <TrendMetricRow
                        label="VO₂ Max"
                        metric={metrics.vo2max}
                        unit="ml/kg/min"
                        higherIsBetter={true}
                    />
                )}

                {metrics.doubleSupport?.hasSufficient && (
                    <TrendMetricRow
                        label="Stability (Double Support)"
                        metric={metrics.doubleSupport}
                        unit="%"
                        higherIsBetter={false}
                    />
                )}

                {metrics.walkingAsymmetry?.hasSufficient && (
                    <TrendMetricRow
                        label="Gait Asymmetry"
                        metric={metrics.walkingAsymmetry}
                        unit="%"
                        higherIsBetter={false}
                    />
                )}

                {metrics.strideLength?.hasSufficient && (
                    <TrendMetricRow
                        label="Stride Length"
                        metric={metrics.strideLength}
                        unit="m"
                        higherIsBetter={true}
                    />
                )}

                {metrics.weightKg?.hasSufficient && (
                    <TrendMetricRow
                        label="Body Weight"
                        metric={metrics.weightKg}
                        unit="kg"
                        higherIsBetter={false}
                    />
                )}

                {metrics.timeInDaylight?.hasSufficient && (
                    <TrendMetricRow
                        label="Daylight Exposure"
                        metric={metrics.timeInDaylight}
                        unit=" min"
                        higherIsBetter={true}
                    />
                )}

                {metrics.headphoneAudio?.hasSufficient && (
                    <TrendMetricRow
                        label="Headphone Audio Load"
                        metric={metrics.headphoneAudio}
                        unit=" dBA"
                        higherIsBetter={false}
                    />
                )}
            </GlassCard>
        </Animated.View>
    )
}
