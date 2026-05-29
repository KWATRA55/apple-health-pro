import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import Svg, { Path, Circle as SvgCircle, Defs, LinearGradient, Stop, Line } from 'react-native-svg'
import { useHealthStore, computeTrendReportSelector } from '../../src/lib/store'
import type { TrendReport, TrendMetric } from '../../src/lib/types'
import {
    safeHRV,
    safeRHR,
    safeSpO2,
    safeRespiratoryRate,
    safeSkinTempDelta,
    safeSleepDurationMins,
    formatScore,
    safeNumber,
} from '../../src/lib/utils/display-helpers'
import { getWeekWindow, parseDateString, formatDateLocal, todayDate } from '../../src/lib/date'
// [CANONICAL] Scope-explicit data access for Weekly Summary
import {
    selectRolling7dVitals,
    selectRolling7dScores,
    selectRolling7dSleep,
    selectRolling7dActivities,
    selectRolling7dEnvironmental,
    selectLatestMobility,
    selectLatestCardioMetabolic,
    selectLatestRunningDynamics,
} from '../../src/lib/canonical-selectors'

// ── Helpers ────────────────────────────────────────────────────────────
type ZoneColor = 'green' | 'yellow' | 'red'

function zoneColorHex(zone: string): string {
    switch (zone) {
        case 'green': return S.success
        case 'yellow': return S.warning
        case 'red': return S.error
        default: return S.dimText
    }
}

function recoveryColor(score: number): string {
    if (score >= 67) return S.success
    if (score >= 34) return S.warning
    return S.error
}

function avg(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
}

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../src/theme/stitch-tokens'

type TokenMap = Record<string, string>
const S: TokenMap = {
    ..._S as TokenMap,
    borderDim: _S.border,
    accentCyan: _S.pillarLongevity,
    accentPurple: _S.pillarResilience,
    errorDim: _S.errorDisplay,
    primaryFixedDim: _S.primaryFixedDim,
    primaryFixed: _S.primaryFixed,
    secondaryFixed: _S.secondaryFixed,
    tertiaryFixed: _S.tertiaryFixed,
    secondaryFixedDim: _S.secondaryFixedDim,
    tertiaryFixedDim: _S.tertiaryFixedDim,
    primaryContainer: _S.primaryFixed,
    onPrimaryContainer: '#003730',
}

// ── GlassPanel → EliteCard (V3 canonical component) ───────────────────
import { EliteCard } from '../../src/components/ui/v3'
const GlassPanel = EliteCard

function SectionLabel({ label }: { label: string }) {
    return (
        <Text style={{
            color: S.onSurfaceVariant,
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 12,
        }}>
            {label}
        </Text>
    )
}

// ── SVG Mini Sparkline ─────────────────────────────────────────────────
function SvgSparkline({ values, color, height = 30 }: { values: number[]; color: string; height?: number }) {
    if (values.length < 2) {
        return <View style={{ height }} />
    }
    const w = 100
    const h = height
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = max - min || 1
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * w
        const y = h - ((v - min) / range) * (h - 4) - 2
        return `${x},${y}`
    }).join(' ')

    return (
        <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <Path
                d={`M${pts}`}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
            />
        </Svg>
    )
}

// ── AI Weekly Insight Card ─────────────────────────────────────────────
function WeeklyInsightCard({
    weekScores,
    trendReport,
}: {
    weekScores: { recoveryScore: number; strainScore: number; recoveryZone: string; date: string }[]
    trendReport: TrendReport | null
}) {
    const insight = useMemo(() => {
        if (weekScores.length === 0) return null
        const validScores = weekScores.filter((s): s is NonNullable<typeof s> => s != null && s.recoveryScore > 0)
        if (validScores.length < 3) {
            return { title: 'Gathering Data', body: 'Need at least 3 days of recovery data to generate weekly insights.', accent: S.dimText }
        }

        const avgRecovery = Math.round(avg(validScores.map(s => s.recoveryScore)))
        const avgStrain = parseFloat(avg(validScores.map(s => s.strainScore)).toFixed(1))
        const greenDays = validScores.filter(s => s.recoveryZone === 'green').length

        let title = ''
        let body = ''
        let accent = S.primaryFixed

        if (avgRecovery >= 67) {
            title = 'Systematic Recovery Achieved'
            body = `${greenDays}/${validScores.length} days in PRIMED zone. Recovery averaging ${avgRecovery}% with strain at ${avgStrain}. Training load is well-managed.`
            accent = S.success
        } else if (avgRecovery >= 34) {
            title = 'Moderate Recovery Week'
            body = `Recovery averaging ${avgRecovery}% with strain at ${avgStrain}. Consider reducing intensity to prevent accumulated fatigue.`
            accent = S.warning
        } else {
            title = 'Recovery Deficit Detected'
            body = `Average recovery at ${avgRecovery}% with strain ${avgStrain}. Prioritize sleep and active recovery this week.`
            accent = S.errorDim
        }

        if (trendReport && trendReport.patterns.length > 0) {
            const top = trendReport.patterns[0]
            body += ` ${top.description}`
        }

        return { title, body, accent }
    }, [weekScores, trendReport])

    if (!insight) return null

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16, overflow: 'hidden' }}>
            {/* Glow behind */}
            <View style={{
                position: 'absolute', top: -20, right: -20,
                width: 80, height: 80,
                backgroundColor: `${insight.accent}20`,
                borderRadius: 40,
                opacity: 0.6,
            }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                <View style={{
                    backgroundColor: S.primaryContainer,
                    padding: 8,
                    borderRadius: 8,
                    shadowColor: S.primaryFixed,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                }}>
                    <Text style={{ color: S.onPrimaryContainer, fontSize: 18 }}>✨</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{
                        color: insight.accent,
                        fontSize: 18,
                        fontWeight: '700',
                        letterSpacing: -0.3,
                        marginBottom: 6,
                    }}>
                        {insight.title}
                    </Text>
                    <Text style={{
                        color: S.onSurfaceVariant,
                        fontSize: 13,
                        lineHeight: 20,
                    }}>
                        {insight.body}
                    </Text>
                </View>
            </View>
        </GlassPanel>
    )
}

// ── Cumulative Strain Bar Chart ────────────────────────────────────────
function StrainBarChart({ scores }: { scores: { date: string; strainScore: number }[] }) {
    const week = scores.slice(0, 7).reverse()
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    const totalStrain = parseFloat(week.reduce((s, d) => s + d.strainScore, 0).toFixed(1))

    if (week.length === 0) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="Cumulative Strain" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>No strain data</Text>
            </GlassPanel>
        )
    }

    const maxStrain = Math.max(...week.map(s => s.strainScore), 1)

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <View>
                    <SectionLabel label="Cumulative Strain" />
                    <Text style={{ color: S.onSurface, fontSize: 32, fontWeight: '800', letterSpacing: -1 }}>
                        {totalStrain}
                    </Text>
                </View>
                <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6,
                    backgroundColor: `${S.primaryFixed}15`,
                    borderWidth: 0.5,
                    borderColor: `${S.primaryFixed}20`,
                }}>
                    <Text style={{ color: S.primaryFixed, fontSize: 10, fontWeight: '700' }}>
                        {week.length}d tracked
                    </Text>
                </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 4 }}>
                {/* Baseline */}
                <View style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)',
                }} />
                {week.map((s, i) => {
                    const pct = Math.max(8, (s.strainScore / maxStrain) * 100)
                    let barColor = S.secondaryFixedDim
                    let barOpacity = 0.4
                    if (s.strainScore >= 15) { barColor = S.error; barOpacity = 0.8 }
                    else if (s.strainScore >= 10) { barColor = S.tertiaryFixed; barOpacity = 0.6 }
                    else if (pct > 50) { barColor = S.primaryFixed; barOpacity = 0.7 }

                    return (
                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{
                                width: '75%',
                                height: `${pct}%`,
                                backgroundColor: barColor,
                                opacity: barOpacity,
                                borderRadius: 4,
                                ...(pct > 75 ? {
                                    shadowColor: barColor,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 6,
                                } : {}),
                            }} />
                            <Text style={{
                                color: S.onSurfaceVariant,
                                fontSize: 9,
                                fontWeight: '600',
                                marginTop: 6,
                                opacity: i === 6 ? 1 : 0.5,
                            }}>
                                {dayLabels[i] || ''}
                            </Text>
                        </View>
                    )
                })}
            </View>
        </GlassPanel>
    )
}

// ── Zone Distribution Donut ────────────────────────────────────────────
function ZoneDonut({ scores }: { scores: { recoveryScore: number; recoveryZone: string }[] }) {
    const counts = useMemo(() => {
        const result: Record<ZoneColor, number> = { green: 0, yellow: 0, red: 0 }
        const valid = scores.filter(s => s.recoveryScore > 0)
        valid.forEach(s => {
            if (s.recoveryZone === 'green') result.green++
            else if (s.recoveryZone === 'yellow') result.yellow++
            else result.red++
        })
        return { ...result, total: valid.length || 1 }
    }, [scores])

    const greenPct = (counts.green / counts.total) * 100
    const yellowPct = (counts.yellow / counts.total) * 100
    const redPct = (counts.red / counts.total) * 100

    // SVG arc math for donut segments
    const size = 140
    const strokeW = 14
    const r = (size - strokeW) / 2
    const cx = size / 2
    const cy = size / 2
    const circumference = 2 * Math.PI * r

    const greenLen = (greenPct / 100) * circumference
    const yellowLen = (yellowPct / 100) * circumference
    const redLen = (redPct / 100) * circumference

    const dominantPct = Math.round(Math.max(greenPct, yellowPct, redPct))
    const dominantLabel = greenPct >= yellowPct && greenPct >= redPct ? 'Optimal'
        : yellowPct >= redPct ? 'Adapting' : 'Critical'
    const dominantColor = greenPct >= yellowPct && greenPct >= redPct ? S.primaryFixed
        : yellowPct >= redPct ? S.tertiaryFixed : S.error

    // Stroke-dasharray offset: start at top (12 o'clock) = -90deg = -circumference/4
    const offset = circumference / 4

    return (
        <GlassPanel style={{ padding: 20, marginBottom: 16, alignItems: 'center', overflow: 'hidden' }}>
            <View style={{
                position: 'absolute', bottom: -30, right: -30,
                width: 100, height: 100,
                backgroundColor: `${S.secondaryFixed}10`,
                borderRadius: 50,
            }} />
            <SectionLabel label="Zone Distribution" />
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background track */}
                <SvgCircle
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeW}
                />
                {/* Red segment */}
                {redLen > 0 && (
                    <SvgCircle
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke={S.error}
                        strokeWidth={strokeW}
                        strokeDasharray={`${redLen} ${circumference - redLen}`}
                        strokeDashoffset={offset}
                        strokeLinecap="butt"
                        rotation={-90}
                        origin={`${cx}, ${cy}`}
                    />
                )}
                {/* Yellow segment - offset by red */}
                {yellowLen > 0 && (
                    <SvgCircle
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke={S.tertiaryFixed}
                        strokeWidth={strokeW}
                        strokeDasharray={`${yellowLen} ${circumference - yellowLen}`}
                        strokeDashoffset={offset - redLen}
                        strokeLinecap="butt"
                        rotation={-90}
                        origin={`${cx}, ${cy}`}
                    />
                )}
                {/* Green segment - offset by red + yellow */}
                {greenLen > 0 && (
                    <SvgCircle
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke={S.primaryFixed}
                        strokeWidth={strokeW}
                        strokeDasharray={`${greenLen} ${circumference - greenLen}`}
                        strokeDashoffset={offset - redLen - yellowLen}
                        strokeLinecap="butt"
                        rotation={-90}
                        origin={`${cx}, ${cy}`}
                    />
                )}
            </Svg>
            {/* Center text */}
            <View style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <Text style={{
                    color: dominantColor,
                    fontSize: 22,
                    fontWeight: '900',
                    letterSpacing: -0.5,
                }}>
                    {dominantPct}%
                </Text>
                <Text style={{
                    color: S.primaryFixedDim,
                    fontSize: 10,
                    fontWeight: '700',
                    marginTop: 2,
                }}>
                    {dominantLabel}
                </Text>
            </View>
            {/* Legend */}
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: S.primaryFixed }} />
                    <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>Opt</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: S.tertiaryFixed }} />
                    <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>Adpt</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: S.error }} />
                    <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>Crit</Text>
                </View>
            </View>
        </GlassPanel>
    )
}

// ── Vitals 2×2 Grid ────────────────────────────────────────────────────
function VitalsGrid({
    hrvValues,
    rhrValues,
    spo2Values,
    sleepHours,
}: {
    hrvValues: (number | null)[]
    rhrValues: (number | null)[]
    spo2Values: (number | null)[]
    sleepHours: number[]
}) {
    const lastNonNull = <T,>(arr: (T | null)[]): T | null => {
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i]
        return null
    }
    const latestHRV = lastNonNull(hrvValues)
    const latestRHR = lastNonNull(rhrValues)
    const latestSpO2 = lastNonNull(spo2Values)
    const latestSleep = sleepHours.length > 0 ? sleepHours[sleepHours.length - 1] : null

    const nullToZero = (v: number | null): number => v ?? 0
    const items = [
        {
            label: 'HRV', value: latestHRV, unit: 'ms',
            values: hrvValues.map(v => (nullToZero(v) / 100) * 30),
            color: S.primaryFixed,
            icon: '❤️',
        },
        {
            label: 'RHR', value: latestRHR, unit: 'bpm',
            values: rhrValues.map(v => ((80 - nullToZero(v)) / 60) * 30),
            color: S.tertiaryFixed,
            icon: '💓',
        },
        {
            label: 'SpO₂', value: latestSpO2, unit: '%',
            values: spo2Values.map(v => ((nullToZero(v) - 90) / 10) * 30),
            color: S.secondaryFixedDim,
            icon: '🫁',
        },
        {
            label: 'Sleep', value: latestSleep, unit: 'h',
            values: sleepHours.map(v => (v / 10) * 30),
            color: S.primaryFixedDim,
            icon: '😴',
        },
    ]

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {items.map((item, i) => (
                <View key={i} style={{ width: '48%' as any }}>
                    <GlassPanel style={{ padding: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <Text style={{
                                color: S.onSurfaceVariant,
                                fontSize: 10,
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                            }}>
                                {item.label}
                            </Text>
                            <Text style={{ fontSize: 14, opacity: 0.6 }}>{item.icon}</Text>
                        </View>
                        <Text style={{ color: S.onSurface, fontSize: 20, fontWeight: '800', marginBottom: 6 }}>
                            {item.value != null ? item.value : '--'}
                            <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>
                                {' '}{item.unit}
                            </Text>
                        </Text>
                        <SvgSparkline values={item.values} color={item.color} height={24} />
                    </GlassPanel>
                </View>
            ))}
        </View>
    )
}

// ── CNS vs Daylight Area Chart ─────────────────────────────────────────
function CnsDaylightChart({
    strainScores,
    daylightValues,
}: {
    strainScores: number[]
    daylightValues: number[]
}) {
    if (strainScores.length < 2 && daylightValues.length < 2) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="CNS Stress vs Daylight" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>Insufficient data</Text>
            </GlassPanel>
        )
    }

    const w = 300
    const h = 140
    const maxDaylight = Math.max(120, ...daylightValues)
    const maxStrain = Math.max(21, ...strainScores)
    const bottomLabels = ['Mon', 'Wed', 'Fri', 'Sun']

    // Build SVG paths
    const buildPath = (values: number[], max: number, height: number, offsetY: number): string => {
        if (values.length < 2) return ''
        const step = w / (values.length - 1)
        let d = `M0,${offsetY + height} `
        d += `L0,${offsetY + height - (values[0] / max) * height} `
        for (let i = 1; i < values.length; i++) {
            const px = step * i
            const prevY = offsetY + height - (values[i - 1] / max) * height
            const currY = offsetY + height - (values[i] / max) * height
            const cpX = px - step / 2
            d += `Q${cpX},${prevY} ${px - step / 4},${currY} `
            d += `L${px},${currY} `
        }
        d += `L${w},${offsetY + height} Z`
        return d
    }

    const daylightArea = buildPath(daylightValues, maxDaylight, h * 0.5, 0)
    const cnsArea = buildPath(strainScores, maxStrain, h * 0.45, h * 0.3)

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
            <SectionLabel label="CNS Stress vs Daylight" />
            <Svg width="100%" height={h + 20} viewBox={`0 0 ${w} ${h + 20}`}>
                <Defs>
                    <LinearGradient id="daylightGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={S.secondaryFixed} stopOpacity={0.2} />
                        <Stop offset="1" stopColor={S.secondaryFixed} stopOpacity={0} />
                    </LinearGradient>
                    <LinearGradient id="cnsGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={S.primaryFixed} stopOpacity={0.3} />
                        <Stop offset="1" stopColor={S.primaryFixed} stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                {/* Daylight area */}
                {daylightArea ? <Path d={daylightArea} fill="url(#daylightGrad)" /> : null}
                {/* CNS area */}
                {cnsArea ? <Path d={cnsArea} fill="url(#cnsGrad)" /> : null}
                {/* Baseline */}
                <Line x1={0} y1={h} x2={w} y2={h} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
            </Svg>
            {/* Bottom labels */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                {bottomLabels.map((l, i) => (
                    <Text key={i} style={{ color: S.dimText, fontSize: 9, fontWeight: '600' }}>
                        {l}
                    </Text>
                ))}
            </View>
            {/* Legend */}
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: S.borderDim }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: S.secondaryFixedDim }} />
                    <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>Daylight</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: S.primaryFixed }} />
                    <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>CNS Load</Text>
                </View>
            </View>
        </GlassPanel>
    )
}

// ── Main Screen ────────────────────────────────────────────────────────
export default function WeeklySummaryScreen() {
    const params = useLocalSearchParams<{ date?: string }>()
    const store = useHealthStore()
    const { vitals, sleep, scores, activities, environmental, runningDynamics, cardioMetabolic, mobility } = store

    // [CANONICAL] Scope-explicit data access for Weekly Summary (rolling7d)
    const canonicalWeekly = useMemo(() => {
        const endDate = store.selectedDate
        return {
            vitals: selectRolling7dVitals(store, endDate),
            scores: selectRolling7dScores(store, endDate),
            sleep: selectRolling7dSleep(store, endDate),
            activities: selectRolling7dActivities(store, endDate),
            environmental: selectRolling7dEnvironmental(store, endDate),
            mobility: selectLatestMobility(store),
            cardiometabolic: selectLatestCardioMetabolic(store),
            runningDynamics: selectLatestRunningDynamics(store),
        }
    }, [store])

    const anchorDate = useMemo(() => {
        if (params.date) return params.date
        return todayDate()
    }, [params.date])

    const { weekDates, weekStart, weekEnd } = useMemo(() => {
        return getWeekWindow(anchorDate)
    }, [anchorDate])

    const weekScores = useMemo(() => {
        return weekDates.map(d => {
            const s = scores.find(s => s.date === d)
            return s || null
        })
    }, [scores, weekDates])

    const nonNullScores = useMemo(() => weekScores.filter(s => s != null) as NonNullable<typeof weekScores[number]>[], [weekScores])

    const weekSleep = useMemo(() => {
        return weekDates.map(d => {
            const s = sleep.find(s => s.date === d)
            return s || { date: d, totalDurationMins: 0, remMins: 0, deepMins: 0, coreMins: 0, awakeMins: 0, sleepNeedHours: 0, sleepDebtHours: 0 }
        })
    }, [sleep, weekDates])

    const weekEnv = useMemo(() => {
        return weekDates.map(d => {
            const e = environmental.find(e => e.date === d)
            return { date: d, daylightMins: e?.timeInDaylight ?? 0 }
        })
    }, [environmental, weekDates])

    const hrvValues = useMemo(() => weekDates.map(d => {
        const v = vitals.find(v => v.timestamp.slice(0, 10) === d)
        return safeHRV(v?.hrv)
    }), [vitals, weekDates])

    const rhrValues = useMemo(() => weekDates.map(d => {
        const v = vitals.find(v => v.timestamp.slice(0, 10) === d)
        return safeRHR(v?.rhr)
    }), [vitals, weekDates])

    const spo2Values = useMemo(() => weekDates.map(d => {
        const v = vitals.find(v => v.timestamp.slice(0, 10) === d)
        return safeSpO2(v?.spo2)
    }), [vitals, weekDates])

    const sleepHours = useMemo(() => weekSleep.map(s =>
        s.totalDurationMins > 0 ? parseFloat((s.totalDurationMins / 60).toFixed(1)) : 0
    ), [weekSleep])

    const trendReport = useMemo(() => {
        return computeTrendReportSelector(useHealthStore.getState())
    }, [vitals, sleep, activities, scores, mobility, environmental, cardioMetabolic])

    const strainOnlyValues = useMemo(() =>
        nonNullScores.map(s => s.strainScore).filter(v => v > 0),
        [nonNullScores])

    const daylightOnlyValues = useMemo(() =>
        weekEnv.map(e => e.daylightMins),
        [weekEnv])

    const weekStats = useMemo(() => {
        const validScores = nonNullScores.filter(s => s.recoveryScore > 0)
        return {
            avgRecovery: Math.round(avg(validScores.map(s => s.recoveryScore))),
            avgStrain: parseFloat(avg(validScores.map(s => s.strainScore)).toFixed(1)),
            totalWorkouts: activities.filter(a => a.timestamp.slice(0, 10) >= weekStart && a.timestamp.slice(0, 10) <= weekEnd).length,
            avgSleep: parseFloat((avg(weekSleep.filter(s => s.totalDurationMins > 0).map(s => s.totalDurationMins)) / 60).toFixed(1)),
        }
    }, [weekScores, weekSleep, activities, weekStart, weekEnd])

    const formatDateRange = () => {
        const s = new Date(weekStart + 'T12:00:00')
        const e = new Date(weekEnd + 'T12:00:00')
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }

    const shiftWeek = (dir: -1 | 1) => {
        const d = new Date(anchorDate + 'T12:00:00')
        d.setDate(d.getDate() + dir * 7)
        router.setParams({ date: d.toISOString().slice(0, 10) })
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: S.bg }} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Fixed Header */}
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 14,
                backgroundColor: 'rgba(18,18,20,0.60)',
                borderBottomWidth: 0.5,
                borderBottomColor: S.border,
            }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        width: 40, height: 40, borderRadius: 20,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: S.glass,
                    }}
                >
                    <Text style={{ color: S.onSurfaceVariant, fontSize: 20 }}>←</Text>
                </TouchableOpacity>
                <Text style={{ color: S.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>
                    {formatDateRange()}
                </Text>
                <TouchableOpacity
                    style={{
                        width: 40, height: 40, borderRadius: 20,
                        alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Text style={{ color: S.onSurfaceVariant, fontSize: 18 }}>⋯</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 12 }}>
                {/* Date Pagination */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <TouchableOpacity
                        onPress={() => shiftWeek(-1)}
                        style={{
                            width: 36, height: 36, borderRadius: 18,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: S.glass,
                            borderWidth: 0.5,
                            borderColor: S.border,
                        }}
                    >
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 18 }}>‹</Text>
                    </TouchableOpacity>
                    <Text style={{ color: S.onSurfaceVariant, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 }}>
                        Weekly Summary
                    </Text>
                    <TouchableOpacity
                        onPress={() => shiftWeek(1)}
                        style={{
                            width: 36, height: 36, borderRadius: 18,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: S.glass,
                            borderWidth: 0.5,
                            borderColor: S.border,
                        }}
                    >
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* AI Weekly Insight */}
                <WeeklyInsightCard weekScores={nonNullScores as any} trendReport={trendReport} />

                {/* Cumulative Strain Bar Chart */}
                <StrainBarChart scores={nonNullScores as any} />

                {/* Zone Donut */}
                <ZoneDonut scores={nonNullScores as any} />

                {/* Vitals 2×2 Grid */}
                <VitalsGrid
                    hrvValues={hrvValues}
                    rhrValues={rhrValues}
                    spo2Values={spo2Values}
                    sleepHours={sleepHours}
                />

                {/* CNS vs Daylight */}
                <CnsDaylightChart
                    strainScores={strainOnlyValues}
                    daylightValues={daylightOnlyValues}
                />

                {/* Stats Row */}
                <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
                    <SectionLabel label="Week Overview" />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: recoveryColor(weekStats.avgRecovery), fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {weekStats.avgRecovery > 0 ? `${weekStats.avgRecovery}%` : '--'}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Recovery</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {weekStats.avgStrain > 0 ? weekStats.avgStrain : '--'}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Strain</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {weekStats.totalWorkouts}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Workouts</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {weekStats.avgSleep > 0 ? `${weekStats.avgSleep}h` : '--'}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Sleep</Text>
                        </View>
                    </View>
                </GlassPanel>

                {/* [CANONICAL] Data provenance & scope declaration for Weekly Summary */}
                <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
                        data scope · provenance
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                        {([
                            { label: 'vitals', vm: canonicalWeekly.vitals },
                            { label: 'scores', vm: canonicalWeekly.scores },
                            { label: 'sleep', vm: canonicalWeekly.sleep },
                            { label: 'activities', vm: canonicalWeekly.activities },
                            { label: 'environmental', vm: canonicalWeekly.environmental },
                            { label: 'mobility', vm: canonicalWeekly.mobility },
                            { label: 'cardiometabolic', vm: canonicalWeekly.cardiometabolic },
                        ] as const).map(({ label, vm }) => {
                            const isPresent = vm.status === 'present'
                            return (
                                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isPresent ? '#30D158' : 'rgba(255,255,255,0.15)' }} />
                                    <Text style={{ fontSize: 7, color: isPresent ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.15)', fontWeight: '600' }}>
                                        {label} ({vm.scope})
                                    </Text>
                                </View>
                            )
                        })}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}
