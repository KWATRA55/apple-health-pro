import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import Svg, { Path, Circle as SvgCircle, Defs, LinearGradient, Stop, Line } from 'react-native-svg'
import { useHealthStore, computeTrendReportSelector } from '../../src/lib/store'
import type { TrendReport } from '../../src/lib/types'
import { getMonthWindow, parseDateString, formatDateLocal, todayDate, shiftMonth } from '../../src/lib/date'
// [CANONICAL] Scope-explicit data access for Monthly Summary
import {
    selectRolling30dVitals,
    selectRolling30dScores,
    selectRolling30dSleep,
    selectRolling30dActivities,
} from '../../src/lib/canonical-selectors'
import { formatScore, safeNumber } from '../../src/lib/utils/display-helpers'

// ── Helpers ────────────────────────────────────────────────────────────
function avg(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
}

function recoveryColor(score: number): string {
    if (score >= 67) return S.success
    if (score >= 34) return S.warning
    return S.errorDim
}

function recoveryBg(score: number): string {
    if (score >= 67) return 'rgba(150,243,225,0.30)'
    if (score >= 34) return 'rgba(190,233,255,0.30)'
    return 'rgba(255,180,171,0.30)'
}

function recoveryBorder(score: number): string {
    if (score >= 67) return 'rgba(150,243,225,0.55)'
    if (score >= 34) return 'rgba(190,233,255,0.50)'
    return 'rgba(255,180,171,0.50)'
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

// ── Recovery Heatmap ───────────────────────────────────────────────────
function RecoveryHeatmap({ scores, monthDates }: { scores: { date: string; recoveryScore: number }[]; monthDates: string[] }) {
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

    // Build week-aligned grid
    const grid = useMemo(() => {
        if (monthDates.length === 0) return { weeks: [], leadingBlanks: 0 }
        const first = new Date(monthDates[0] + 'T12:00:00')
        const last = new Date(monthDates[monthDates.length - 1] + 'T12:00:00')
        const dayOfWeek = first.getDay() // 0=Sun
        const leadingBlanks = dayOfWeek === 0 ? 6 : dayOfWeek - 1

        const cells: ({ date: string; score: number | null } | null)[] = []
        // Leading blanks
        for (let i = 0; i < leadingBlanks; i++) cells.push(null)

        monthDates.forEach(d => {
            const s = scores.find(s => s.date === d)
            cells.push({ date: d, score: s ? s.recoveryScore : null })
        })

        // Chunk into weeks of 7
        const weeks: ({ date: string; score: number | null } | null)[][] = []
        for (let i = 0; i < cells.length; i += 7) {
            weeks.push(cells.slice(i, i + 7))
        }

        return { weeks }
    }, [scores, monthDates])

    if (grid.weeks.length === 0) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="30-Day Recovery" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>No recovery data available</Text>
            </GlassPanel>
        )
    }

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
            <SectionLabel label="30-Day Recovery" />

            {/* Day headers */}
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                {dayLabels.map((l, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '600' }}>{l}</Text>
                    </View>
                ))}
            </View>

            {/* Weeks grid */}
            {grid.weeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: 'row', marginBottom: 4 }}>
                    {week.map((cell, di) => {
                        if (!cell) {
                            return <View key={di} style={{ flex: 1, margin: 2 }} />
                        }
                        if (cell.score === null) {
                            return (
                                <View key={di} style={{
                                    flex: 1, margin: 2, height: 36, borderRadius: 6,
                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                }} />
                            )
                        }
                        const isPrimed = cell.score >= 67
                        return (
                            <View key={di} style={{
                                flex: 1, margin: 2, height: 36, borderRadius: 6,
                                backgroundColor: recoveryBg(cell.score),
                                borderWidth: 0.5,
                                borderColor: recoveryBorder(cell.score),
                                alignItems: 'center', justifyContent: 'center',
                                ...(isPrimed ? {
                                    shadowColor: S.primaryFixed,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.25,
                                    shadowRadius: 6,
                                } : {}),
                            }}>
                                <Text style={{
                                    color: S.onSurface,
                                    fontSize: 9,
                                    fontWeight: '700',
                                    opacity: isPrimed ? 1 : 0.7,
                                }}>
                                    {Math.round(cell.score)}
                                </Text>
                            </View>
                        )
                    })}
                </View>
            ))}

            {/* Legend */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: S.borderDim }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: recoveryBg(80), borderWidth: 0.5, borderColor: recoveryBorder(80) }} />
                    <Text style={{ color: S.dimText, fontSize: 10 }}>PRIMED</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: recoveryBg(50), borderWidth: 0.5, borderColor: recoveryBorder(50) }} />
                    <Text style={{ color: S.dimText, fontSize: 10 }}>ADAPTING</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: recoveryBg(20), borderWidth: 0.5, borderColor: recoveryBorder(20) }} />
                    <Text style={{ color: S.dimText, fontSize: 10 }}>DEPLETED</Text>
                </View>
            </View>
        </GlassPanel>
    )
}

// ── Training Load vs Recovery Dual Chart ───────────────────────────────
function TrainingRecoveryBalance({ scores }: { scores: { date: string; strainScore: number; recoveryScore: number }[] }) {
    const sorted = useMemo(() => [...scores].sort((a, b) => a.date.localeCompare(b.date)), [scores])
    if (sorted.length < 3) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="Training Load vs Recovery Capacity" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>Insufficient data</Text>
            </GlassPanel>
        )
    }

    // Aggregate into ~12 buckets
    const chunkSize = Math.max(1, Math.ceil(sorted.length / 12))
    const buckets = useMemo(() => {
        const result: { avgStrain: number; avgRecovery: number }[] = []
        for (let i = 0; i < sorted.length; i += chunkSize) {
            const chunk = sorted.slice(i, i + chunkSize)
            result.push({
                avgStrain: avg(chunk.map(s => s.strainScore)),
                avgRecovery: avg(chunk.map(s => s.recoveryScore)),
            })
        }
        return result
    }, [sorted])

    const w = 300
    const h = 140
    const maxStrain = Math.max(21, ...buckets.map(b => b.avgStrain))

    // Build recovery SVG line
    const buildRecoveryPath = (): string => {
        if (buckets.length < 2) return ''
        const step = w / (buckets.length - 1)
        let d = ''
        buckets.forEach((b, i) => {
            const x = step * i
            const y = h - (b.avgRecovery / 100) * h
            if (i === 0) d += `M${x},${y} `
            else d += `L${x},${y} `
        })
        return d
    }

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <SectionLabel label="Training Load vs Recovery Capacity" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: S.secondaryFixedDim, opacity: 0.35 }} />
                        <Text style={{ color: S.dimText, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' }}>Strain</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: S.primaryFixed }} />
                        <Text style={{ color: S.dimText, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' }}>Recovery</Text>
                    </View>
                </View>
            </View>

            <View style={{ height: h + 10 }}>
                <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                    {/* Strain bars */}
                    {buckets.map((b, i) => {
                        const x = (i / Math.max(buckets.length - 1, 1)) * w
                        const barW = Math.max(4, (w / buckets.length) * 0.7)
                        const barH = Math.max(4, (b.avgStrain / maxStrain) * h)
                        const barX = x - barW / 2
                        return (
                            <Path
                                key={i}
                                d={`M${barX},${h} L${barX},${h - barH} L${barX + barW},${h - barH} L${barX + barW},${h} Z`}
                                fill={S.secondaryFixedDim}
                                opacity={0.2}
                            />
                        )
                    })}
                    {/* Recovery line */}
                    <Path
                        d={buildRecoveryPath()}
                        fill="none"
                        stroke={S.primaryFixed}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Baseline */}
                    <Line x1={0} y1={h} x2={w} y2={h} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
                </Svg>
            </View>

            {/* Legend */}
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: S.borderDim }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: S.primaryFixed }} />
                    <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>Recovery</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: S.secondaryFixedDim, opacity: 0.35 }} />
                    <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600' }}>Strain</Text>
                </View>
            </View>
        </GlassPanel>
    )
}

// ── ANS Balance Arc Ring ───────────────────────────────────────────────
function AnsBalanceCard({ scores }: { scores: { date: string; hrvZScore: number }[] }) {
    const valid = scores.filter(s => s.date).slice(0, 30)
    if (valid.length < 5) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="Autonomic Nervous System Balance" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>Insufficient HRV data</Text>
            </GlassPanel>
        )
    }

    const snsDays = valid.filter(s => s.hrvZScore < -0.5).length
    const psnsDays = valid.filter(s => s.hrvZScore > 0.5).length
    const balanced = valid.length - snsDays - psnsDays
    const total = valid.length || 1
    const snsPct = (snsDays / total) * 100
    const psnsPct = (psnsDays / total) * 100
    const balancedPct = (balanced / total) * 100

    const isPsnsDominant = psnsPct >= snsPct

    // SVG Arc ring
    const size = 80
    const strokeW = 8
    const r = (size - strokeW) / 2
    const cx = size / 2
    const cy = size / 2
    const circumference = 2 * Math.PI * r
    const psnsDash = (psnsPct / 100) * circumference * 0.8 // Arc is 80% of circumference
    const totalDash = circumference * 0.8
    const offset = circumference / 4 + circumference * 0.1

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
            <SectionLabel label="Autonomic Nervous System Balance" />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {/* Arc ring */}
                <View style={{ position: 'relative', width: size, height: size }}>
                    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        {/* Background arc */}
                        <SvgCircle
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke="rgba(255,180,171,0.15)"
                            strokeWidth={strokeW}
                            strokeDasharray={`${totalDash} ${circumference - totalDash}`}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            rotation={-90}
                            origin={`${cx}, ${cy}`}
                        />
                        {/* PSNS arc */}
                        <SvgCircle
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={S.tertiaryFixed}
                            strokeWidth={strokeW}
                            strokeDasharray={`${psnsDash} ${circumference - psnsDash}`}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            rotation={-90}
                            origin={`${cx}, ${cy}`}
                        />
                    </Svg>
                    <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: S.tertiaryFixed, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                            PSNS
                        </Text>
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                            {Math.round(psnsPct)}%
                        </Text>
                    </View>
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>
                        {isPsnsDominant ? 'Parasympathetic Dominance' : 'Sympathetic Dominance'}
                    </Text>
                    <Text style={{ color: S.onSurfaceVariant, fontSize: 11, lineHeight: 17 }}>
                        HRV markers indicate a {isPsnsDominant ? 'restorative' : 'stress'} phase. {
                            isPsnsDominant
                                ? 'Efficient recovery rebound detected.'
                                : 'Consider prioritizing sleep and recovery protocols.'
                        }
                    </Text>
                </View>
            </View>

            {/* ANS bar */}
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', flexDirection: 'row' }}>
                <View style={{ width: `${Math.max(2, snsPct)}%`, backgroundColor: S.errorDim, opacity: 0.5 }} />
                <View style={{ width: `${Math.max(2, balancedPct)}%`, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <View style={{ flex: 1, backgroundColor: S.tertiaryFixed, opacity: 0.8 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: S.errorDim, opacity: 0.5 }} />
                    <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', textTransform: 'uppercase' }}>Stress (SNS)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: S.tertiaryFixed }} />
                    <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', textTransform: 'uppercase' }}>Recovery (PSNS)</Text>
                </View>
            </View>
        </GlassPanel>
    )
}

// ── VO₂ Max Card ───────────────────────────────────────────────────────
function Vo2MaxCard({ vo2Values }: { vo2Values: { date: string; value: number }[] }) {
    const valid = vo2Values.filter(v => v.value > 0)
    if (valid.length < 2) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="VO₂ Max Trajectory" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>Insufficient data</Text>
            </GlassPanel>
        )
    }

    const latest = valid[valid.length - 1].value
    const first = valid[0].value
    const delta = latest - first
    const w = 200
    const h = 60
    const dataMin = Math.min(...valid.map(v => v.value))
    const dataMax = Math.max(...valid.map(v => v.value))
    const range = dataMax - dataMin || 1

    const buildPath = (): string => {
        if (valid.length < 2) return ''
        return valid.map((v, i) => {
            const x = (i / (valid.length - 1)) * w
            const y = h - ((v.value - dataMin) / range) * (h - 6) - 3
            return i === 0 ? `M${x},${y}` : `L${x},${y}`
        }).join(' ')
    }

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16, flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <SectionLabel label="VO₂ Max Trajectory" />
                <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: `${delta >= 0 ? S.success : S.errorDim}15`,
                }}>
                    <Text style={{ color: delta >= 0 ? S.success : S.errorDim, fontSize: 10, fontWeight: '700' }}>
                        {delta >= 0 ? '↑' : '↓'}
                    </Text>
                    <Text style={{ color: delta >= 0 ? S.success : S.errorDim, fontSize: 10, fontWeight: '700' }}>
                        {delta >= 0 ? '+' : ''}{parseFloat(delta.toFixed(1))}
                    </Text>
                </View>
            </View>

            <Text style={{ color: S.onSurface, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 12 }}>
                {parseFloat(latest.toFixed(1))}
            </Text>

            <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                <Path
                    d={buildPath()}
                    fill="none"
                    stroke={S.primaryFixed}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ color: S.dimText, fontSize: 9 }}>{valid[0].date.slice(0, 7)}</Text>
                <Text style={{ color: S.dimText, fontSize: 9 }}>{valid[valid.length - 1].date.slice(0, 7)}</Text>
            </View>
        </GlassPanel>
    )
}

// ── Bio-Age Progression Card ───────────────────────────────────────────
function BioAgeCard({ scores }: { scores: { date: string; biologicalAge: number; paceOfAging: number }[] }) {
    const valid = scores.filter(s => s.biologicalAge > 0 && s.paceOfAging > 0)
    if (valid.length < 2) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="Bio-Age Progression" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>Insufficient data</Text>
            </GlassPanel>
        )
    }

    const latestPace = valid[valid.length - 1].paceOfAging
    const isImproving = latestPace < 1
    const deltaYears = parseFloat((Math.abs(latestPace - 1) * 10).toFixed(1))

    // Weekly buckets
    const weeklyBuckets = useMemo(() => {
        const result: number[] = []
        const chunkSize = Math.max(1, Math.ceil(valid.length / 4))
        for (let i = Math.max(0, valid.length - chunkSize * 4); i < valid.length; i += chunkSize) {
            const chunk = valid.slice(i, i + chunkSize)
            result.push(avg(chunk.map(s => s.paceOfAging)))
        }
        return result.slice(-4)
    }, [valid])

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16, flex: 1 }}>
            <SectionLabel label="Bio-Age Progression" />

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                <Text style={{
                    color: isImproving ? S.tertiaryFixed : S.warning,
                    fontSize: 32,
                    fontWeight: '900',
                    letterSpacing: -1,
                }}>
                    {isImproving ? '-' : '+'}{deltaYears}
                </Text>
                <Text style={{ color: S.onSurfaceVariant, fontSize: 14 }}>Yrs</Text>
            </View>

            {/* Weekly bars */}
            <View style={{ flexDirection: 'row', gap: 6, height: 70, alignItems: 'flex-end', marginTop: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 4 }}>
                {weeklyBuckets.map((pace, i) => {
                    const pct = Math.max(10, (1 - Math.abs(pace - 1)) * 80 + 10)
                    return (
                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{
                                width: '60%',
                                height: `${pct}%`,
                                backgroundColor: pace < 1 ? S.tertiaryFixed : 'rgba(255,255,255,0.08)',
                                borderRadius: 3,
                                opacity: 0.5 + (i / 4) * 0.5,
                                ...(i === 3 ? {
                                    opacity: 1,
                                    shadowColor: pace < 1 ? S.tertiaryFixed : S.warning,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 6,
                                } : {}),
                            }} />
                            <Text style={{
                                color: i === 3 ? S.onSurface : S.dimText,
                                fontSize: 9,
                                fontWeight: '600',
                                marginTop: 6,
                            }}>
                                W{i + 1}
                            </Text>
                        </View>
                    )
                })}
            </View>
        </GlassPanel>
    )
}

// ── Habit Adherence Rings ──────────────────────────────────────────────
function HabitRings({ journalEntries }: { journalEntries: { date: string; habits: string[] }[] }) {
    const entries = journalEntries.slice(0, 30)
    // Aggregate habits into top categories
    const habitCounts: Record<string, number> = {}
    entries.forEach(e => {
        e.habits.forEach(h => {
            habitCounts[h] = (habitCounts[h] || 0) + 1
        })
    })

    const topHabits = Object.entries(habitCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

    const habitColors = [S.primaryFixed, S.tertiaryFixed, S.secondaryFixedDim]

    if (topHabits.length === 0) {
        return (
            <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
                <SectionLabel label="Core Habits Adherence" />
                <Text style={{ color: S.mutedText, fontSize: 13 }}>No habit data logged</Text>
            </GlassPanel>
        )
    }

    const ringSize = 72
    const strokeW = 6
    const r = (ringSize - strokeW) / 2
    const cx = ringSize / 2
    const cy = ringSize / 2
    const circumference = 2 * Math.PI * r

    return (
        <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
            <SectionLabel label="Core Habits Adherence" />

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', gap: 12 }}>
                {topHabits.map(([habit, count], i) => {
                    const pct = Math.round((count / (entries.length || 1)) * 100)
                    const dashLen = (pct / 100) * circumference
                    const color = habitColors[i % habitColors.length]

                    return (
                        <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                            <View style={{ position: 'relative', width: ringSize, height: ringSize }}>
                                <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                                    {/* Track */}
                                    <SvgCircle
                                        cx={cx} cy={cy} r={r}
                                        fill="none"
                                        stroke="rgba(255,255,255,0.06)"
                                        strokeWidth={strokeW}
                                    />
                                    {/* Fill */}
                                    <SvgCircle
                                        cx={cx} cy={cy} r={r}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={strokeW}
                                        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                                        strokeDashoffset={circumference / 4}
                                        strokeLinecap="round"
                                        rotation={-90}
                                        origin={`${cx}, ${cy}`}
                                    />
                                </Svg>
                                <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: S.onSurface, fontSize: 15, fontWeight: '800' }}>
                                        {pct}%
                                    </Text>
                                </View>
                            </View>
                            <Text style={{
                                color: S.onSurfaceVariant,
                                fontSize: 10,
                                fontWeight: '600',
                                textAlign: 'center',
                            }}>
                                {habit}
                            </Text>
                        </View>
                    )
                })}
            </View>
        </GlassPanel>
    )
}

// ── Main Screen ────────────────────────────────────────────────────────
export default function MonthlySummaryScreen() {
    const params = useLocalSearchParams<{ date?: string }>()
    const store = useHealthStore()
    const { vitals, sleep, scores, activities, environmental, cardioMetabolic, mobility, journalEntries, runningDynamics } = store

    // [CANONICAL] Scope-explicit data access for Monthly Summary (rolling30d)
    const canonicalMonthly = useMemo(() => {
        const endDate = store.selectedDate
        return {
            vitals: selectRolling30dVitals(store, endDate),
            scores: selectRolling30dScores(store, endDate),
            sleep: selectRolling30dSleep(store, endDate),
            activities: selectRolling30dActivities(store, endDate),
        }
    }, [store])

    const anchorDate = useMemo(() => {
        if (params.date) return params.date
        return todayDate()
    }, [params.date])

    const { monthStart, monthEnd, monthDates, monthLabel } = useMemo(() => {
        return getMonthWindow(anchorDate)
    }, [anchorDate])

    const monthScores = useMemo(() => {
        return scores.filter(s => s.date >= monthStart && s.date <= monthEnd)
    }, [scores, monthStart, monthEnd])

    const vo2Values = useMemo(() => {
        return cardioMetabolic
            .filter(c => c.date >= monthStart && c.date <= monthEnd && c.vo2Max != null && c.vo2Max > 0)
            .map(c => ({ date: c.date, value: c.vo2Max }))
            .sort((a, b) => a.date.localeCompare(b.date))
    }, [cardioMetabolic, monthStart, monthEnd])

    const monthEntries = useMemo(() => {
        return journalEntries.filter(j => j.date >= monthStart && j.date <= monthEnd)
    }, [journalEntries, monthStart, monthEnd])

    const monthStats = useMemo(() => {
        const validScores = monthScores.filter(s => s.recoveryScore > 0)
        return {
            avgRecovery: Math.round(avg(validScores.map(s => s.recoveryScore))),
            avgStrain: parseFloat(avg(validScores.map(s => s.strainScore)).toFixed(1)),
            totalWorkouts: activities.filter(a => a.timestamp.slice(0, 10) >= monthStart && a.timestamp.slice(0, 10) <= monthEnd).length,
            avgSleep: parseFloat((avg(sleep.filter(s => s.date >= monthStart && s.date <= monthEnd && s.totalDurationMins > 0).map(s => s.totalDurationMins)) / 60).toFixed(1)),
        }
    }, [monthScores, activities, sleep, monthStart, monthEnd])

    const shiftMonthHandler = (dir: -1 | 1) => {
        const newDate = shiftMonth(anchorDate, dir)
        router.setParams({ date: newDate })
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={() => shiftMonthHandler(-1)} style={{ padding: 6 }}>
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 18 }}>‹</Text>
                    </TouchableOpacity>
                    <Text style={{
                        color: S.onSurface,
                        fontSize: 17,
                        fontWeight: '800',
                        letterSpacing: -0.3,
                    }}>
                        {monthLabel.toUpperCase()}
                    </Text>
                    <TouchableOpacity onPress={() => shiftMonthHandler(1)} style={{ padding: 6 }}>
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                </View>
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
                {/* Stats Row */}
                <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: recoveryColor(monthStats.avgRecovery), fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {monthStats.avgRecovery > 0 ? `${monthStats.avgRecovery}%` : '--'}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Recovery</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {monthStats.avgStrain > 0 ? monthStats.avgStrain : '--'}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Strain</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {monthStats.totalWorkouts}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Workouts</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                                {monthStats.avgSleep > 0 ? `${monthStats.avgSleep}h` : '--'}
                            </Text>
                            <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '600', marginTop: 4 }}>Sleep</Text>
                        </View>
                    </View>
                </GlassPanel>

                {/* Recovery Heatmap */}
                <RecoveryHeatmap scores={monthScores as any} monthDates={monthDates} />

                {/* Training Load vs Recovery */}
                <TrainingRecoveryBalance scores={monthScores as any} />

                {/* ANS Balance */}
                <AnsBalanceCard scores={monthScores as any} />

                {/* VO₂ Max + Bio Age side by side */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 0 }}>
                    <View style={{ flex: 1 }}>
                        <Vo2MaxCard vo2Values={vo2Values} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <BioAgeCard scores={monthScores as any} />
                    </View>
                </View>

                {/* VO₂ Max card already rendered, BioAge card already rendered */}
                {/* Habit Rings */}
                <HabitRings journalEntries={monthEntries} />

                {/* [CANONICAL] Data provenance & scope declaration for Monthly Summary */}
                <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
                        data scope · provenance
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                        {([
                            { label: 'vitals', vm: canonicalMonthly.vitals },
                            { label: 'scores', vm: canonicalMonthly.scores },
                            { label: 'sleep', vm: canonicalMonthly.sleep },
                            { label: 'activities', vm: canonicalMonthly.activities },
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
