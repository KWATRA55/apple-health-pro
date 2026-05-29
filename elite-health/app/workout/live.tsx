/**
 * Live Workout Screen — Full-screen immersive workout view.
 *
 * Shows live HR ring, zone distribution, strain accumulation,
 * timer, calories, distance, and pace in real time.
 *
 * Entry points:
 *   - Training Window card "Start Workout" button on Home screen
 *   - Deep link: /workout/live?type=Running
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ScrollView,
    Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import {
    LiveWorkoutSession,
    type LiveWorkoutState,
    type LiveWorkoutConfig,
    ZONE_META,
    formatTime,
    formatPace,
    formatDistance,
} from '../../src/lib/workout/live-session'
import { useHealthStore } from '../../src/lib/store'
// [CANONICAL] Scope-explicit data access for Live Workout (selectedDate for post-workout)
import { selectScoresForDate } from '../../src/lib/canonical-selectors'
import { colors as S } from '../../src/theme/stitch-tokens'
import { EliteCard, LiveIndicator, ZoneBar } from '../../src/components/ui/v3'
import { safeNumber } from '../../src/lib/utils/display-helpers'

// ── Stitch-anchored constants ───────────────────────────────────────────────

const GLASS = 'rgba(255,255,255,0.03)' as const
const BORDER = 'rgba(255,255,255,0.08)' as const
const DIM = 'rgba(255,255,255,0.40)' as const
const MUTED = 'rgba(255,255,255,0.55)' as const
const SURFACE = '#121214' as const

// ── HR Ring (SVG-ish via RN Views) ─────────────────────────────────────────

function HRRing({ currentHR, maxHR, size = 200, strokeWidth = 12 }: {
    currentHR: number
    maxHR: number
    size?: number
    strokeWidth?: number
}) {
    const pct = Math.min(currentHR / (maxHR || 200), 1)
    const center = size / 2
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference * (1 - pct)

    // Determine zone color for current HR
    const zoneColors = ['#30D158', '#0A84FF', '#FFD60A', '#FF9F0A', '#FF453A']
    let zoneIdx = 0
    if (currentHR > 0 && maxHR > 0) {
        const pctMax = currentHR / maxHR
        if (pctMax < 0.6) zoneIdx = 0
        else if (pctMax < 0.7) zoneIdx = 1
        else if (pctMax < 0.8) zoneIdx = 2
        else if (pctMax < 0.9) zoneIdx = 3
        else zoneIdx = 4
    }
    const hrColor = currentHR > 0 ? zoneColors[zoneIdx] : DIM

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {/* Background track */}
            <View
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: 'rgba(255,255,255,0.06)',
                }}
            />
            {/* Colored progress arc — simplified as a View-based ring */}
            <View
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: hrColor,
                    opacity: currentHR > 0 ? 0.9 : 0.3,
                }}
            />
            {/* Center content */}
            <View style={{ alignItems: 'center' }}>
                <Text style={{
                    color: S.onSurface,
                    fontSize: 48,
                    fontWeight: '900',
                    letterSpacing: -1,
                    fontVariant: ['tabular-nums'],
                }}>
                    {currentHR > 0 ? currentHR : '--'}
                </Text>
                <Text style={{ color: DIM, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
                    BPM
                </Text>
                {currentHR > 0 && (
                    <Text style={{ color: hrColor, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                        {ZONE_META[zoneIdx].name}
                    </Text>
                )}
            </View>
        </View>
    )
}

// ── Zone Distribution Bars ──────────────────────────────────────────────────

function ZoneDistribution({ zones }: { zones: number[] }) {
    const zoneSegments = ZONE_META.map((z, i) => ({
        label: z.label,
        pct: zones[i] ?? 0,
        color: z.color,
    }))

    return (
        <View style={{ gap: 8 }}>
            <Text style={{ color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                Zone Distribution
            </Text>
            <ZoneBar zones={zoneSegments} height={10} style={{ marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {ZONE_META.map((z, i) => (
                    <View key={z.label} style={{ alignItems: 'center', gap: 2 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: z.color }} />
                        <Text style={{ color: MUTED, fontSize: 9, fontWeight: '600' }}>{z.label}</Text>
                        <Text style={{ color: S.onSurface, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                            {zones[i] ?? 0}%
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    )
}

// ── Metric Tile (inline for live screen) ────────────────────────────────────

function LiveMetricTile({ label, value, unit, accent, icon }: {
    label: string
    value: string
    unit?: string
    accent?: string
    icon?: keyof typeof MaterialIcons.glyphMap
}) {
    return (
        <View style={{
            flex: 1,
            backgroundColor: GLASS,
            borderWidth: 0.5,
            borderColor: BORDER,
            borderRadius: 14,
            padding: 14,
            alignItems: 'center',
        }}>
            {icon && (
                <MaterialIcons name={icon} size={16} color={accent ?? DIM} style={{ marginBottom: 6 }} />
            )}
            <Text style={{
                color: S.onSurface,
                fontSize: 22,
                fontWeight: '900',
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
            }}>
                {value}
            </Text>
            {unit && (
                <Text style={{ color: accent ?? MUTED, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                    {unit}
                </Text>
            )}
            <Text style={{ color: DIM, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 }}>
                {label}
            </Text>
        </View>
    )
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function LiveWorkoutScreen() {
    const params = useLocalSearchParams<{ type?: string; target?: string }>()
    const store = useHealthStore()
    // [CANONICAL] Scope-explicit data access for Live Workout (selectedDate scores for post-workout context)
    const canonicalScores = selectScoresForDate(store, store.selectedDate)
    const sessionRef = useRef<LiveWorkoutSession | null>(null)
    const [ws, setWs] = useState<LiveWorkoutState>({
        isActive: false,
        isPaused: false,
        elapsedSeconds: 0,
        currentHR: 0,
        avgHR: 0,
        maxHR: 0,
        activeCalories: 0,
        distance: 0,
        currentPace: 0,
        hrZones: [0, 0, 0, 0, 0],
        strainAccumulation: 0,
        zoneDistribution: [0, 0, 0, 0, 0],
        hrHistory: [],
        activityType: params.type ?? 'Running',
        targetStrain: params.target ? Number(params.target) : undefined,
    })
    const [workoutComplete, setWorkoutComplete] = useState(false)
    const [completedRecord, setCompletedRecord] = useState<any>(null)

    // Initialize session on mount
    useEffect(() => {
        const session = new LiveWorkoutSession((state) => {
            setWs(state)
        })

        sessionRef.current = session

        // Auto-start workout
        const config: LiveWorkoutConfig = {
            activityType: params.type ?? 'Running',
            targetStrain: params.target ? Number(params.target) : undefined,
            age: store.profileAge ?? 30,
        }
        session.start(config)

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        return () => {
            session.destroy()
        }
    }, [])

    const handlePauseResume = useCallback(async () => {
        const session = sessionRef.current
        if (!session) return

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        if (ws.isPaused) {
            await session.resume()
        } else {
            await session.pause()
        }
    }, [ws.isPaused])

    const handleEnd = useCallback(() => {
        const session = sessionRef.current
        const isSimulated = session?.getIsSimulated() ?? true

        Alert.alert(
            'End Workout',
            isSimulated
                ? 'This is a simulated session. Data will NOT be saved to your health records.'
                : 'Are you sure you want to end this workout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isSimulated ? 'End (Demo Only)' : 'End Workout',
                    style: 'destructive',
                    onPress: async () => {
                        const currentSession = sessionRef.current
                        if (!currentSession) return

                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)

                        const record = await currentSession.end()
                        if (record) {
                            setCompletedRecord(record)
                            setWorkoutComplete(true)

                            // Only save to store if NOT simulated
                            if (!isSimulated) {
                                await store.addActivity(record)
                                const today = new Date().toISOString().split('T')[0]
                                await store.computeScores(today)
                            }
                        }
                    },
                },
            ]
        )
    }, [store])

    const handleDismiss = useCallback(() => {
        if (router.canGoBack()) {
            router.back()
        } else {
            router.replace('/(tabs)')
        }
    }, [])

    // ── Workout Complete Summary ──────────────────────────────────────────

    if (workoutComplete && completedRecord) {
        const r = completedRecord
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: S.bg }} edges={['top', 'bottom']}>
                <Stack.Screen options={{ headerShown: false }} />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 24, alignItems: 'center', paddingTop: 60 }}
                >
                    {/* Checkmark */}
                    <View style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: 'rgba(48,209,88,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 24,
                    }}>
                        <MaterialIcons name="check" size={40} color={S.success} />
                    </View>

                    <Text style={{
                        color: S.onSurface,
                        fontSize: 28,
                        fontWeight: '900',
                        letterSpacing: -0.5,
                        marginBottom: 4,
                    }}>
                        Workout Complete
                    </Text>
                    <Text style={{ color: MUTED, fontSize: 15, marginBottom: 32 }}>
                        {r.workoutType} · {formatTime((r.durationMins ?? 0) * 60)}
                    </Text>

                    {/* Summary Card */}
                    <EliteCard style={{ width: '100%', padding: 24, marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                            <View style={{ width: '45%', alignItems: 'center', paddingVertical: 8 }}>
                                <Text style={{ color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                                    Avg HR
                                </Text>
                                <Text style={{ color: S.onSurface, fontSize: 28, fontWeight: '900', marginTop: 4 }}>
                                    {r.avgHR ?? '--'}
                                </Text>
                                <Text style={{ color: DIM, fontSize: 11 }}>bpm</Text>
                            </View>
                            <View style={{ width: '45%', alignItems: 'center', paddingVertical: 8 }}>
                                <Text style={{ color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                                    Max HR
                                </Text>
                                <Text style={{ color: S.onSurface, fontSize: 28, fontWeight: '900', marginTop: 4 }}>
                                    {r.maxHR ?? '--'}
                                </Text>
                                <Text style={{ color: DIM, fontSize: 11 }}>bpm</Text>
                            </View>
                            <View style={{ width: '45%', alignItems: 'center', paddingVertical: 8 }}>
                                <Text style={{ color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                                    Strain
                                </Text>
                                <Text style={{ color: S.pillarLongevity, fontSize: 28, fontWeight: '900', marginTop: 4 }}>
                                    {r.strainScore != null ? safeNumber(r.strainScore, 1) : '--'}
                                </Text>
                            </View>
                            <View style={{ width: '45%', alignItems: 'center', paddingVertical: 8 }}>
                                <Text style={{ color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                                    Calories
                                </Text>
                                <Text style={{ color: S.onSurface, fontSize: 28, fontWeight: '900', marginTop: 4 }}>
                                    {r.activeCalories ?? '--'}
                                </Text>
                                <Text style={{ color: DIM, fontSize: 11 }}>kcal</Text>
                            </View>
                        </View>
                    </EliteCard>

                    {/* Zone breakdown */}
                    {r.hrZones && r.hrZones.some((z: number) => z > 0) && (
                        <EliteCard style={{ width: '100%', padding: 20, marginBottom: 24 }}>
                            <Text style={{ color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                                Zone Breakdown
                            </Text>
                            {r.hrZones.map((seconds: number, i: number) => {
                                const pct = r.durationMins > 0
                                    ? Math.round((seconds / (r.durationMins * 60)) * 100)
                                    : 0
                                return (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ZONE_META[i].color }} />
                                        <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', width: 80 }}>
                                            {ZONE_META[i].name}
                                        </Text>
                                        <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                            <View style={{
                                                height: '100%',
                                                width: `${pct}%`,
                                                backgroundColor: ZONE_META[i].color,
                                                borderRadius: 3,
                                            }} />
                                        </View>
                                        <Text style={{ color: S.onSurface, fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right' }}>
                                            {pct}%
                                        </Text>
                                    </View>
                                )
                            })}
                        </EliteCard>
                    )}

                    {/* Done button */}
                    <TouchableOpacity
                        onPress={handleDismiss}
                        activeOpacity={0.8}
                        style={{
                            width: '100%',
                            backgroundColor: S.surface,
                            borderWidth: 0.5,
                            borderColor: BORDER,
                            borderRadius: 16,
                            paddingVertical: 16,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: S.onSurface, fontSize: 16, fontWeight: '700' }}>Done</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        )
    }

    // ── Live Workout View ─────────────────────────────────────────────────

    const isSimulated = useMemo(() => sessionRef.current?.getIsSimulated() ?? true, [sessionRef.current])

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: S.bg }} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 12,
            }}>
                <TouchableOpacity onPress={handleEnd} activeOpacity={0.7}>
                    <Text style={{ color: S.errorDisplay, fontSize: 15, fontWeight: '700' }}>End</Text>
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <LiveIndicator label={ws.isPaused ? 'PAUSED' : 'LIVE'} />
                        {isSimulated && (
                            <View style={{
                                backgroundColor: 'rgba(255,214,10,0.12)',
                                borderWidth: 0.5,
                                borderColor: 'rgba(255,214,10,0.3)',
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                            }}>
                                <Text style={{ color: S.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                                    SIMULATED
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                        {ws.activityType}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handlePauseResume}
                    activeOpacity={0.7}
                    style={{
                        backgroundColor: ws.isPaused ? 'rgba(255,214,10,0.15)' : 'rgba(255,255,255,0.06)',
                        borderWidth: 0.5,
                        borderColor: ws.isPaused ? 'rgba(255,214,10,0.3)' : BORDER,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                    }}
                >
                    <Text style={{
                        color: ws.isPaused ? S.warning : S.onSurface,
                        fontSize: 14,
                        fontWeight: '700',
                    }}>
                        {ws.isPaused ? 'Resume' : 'Pause'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Timer */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{
                        color: S.onSurface,
                        fontSize: 56,
                        fontWeight: '900',
                        letterSpacing: -1,
                        fontVariant: ['tabular-nums'],
                    }}>
                        {formatTime(ws.elapsedSeconds)}
                    </Text>
                    {ws.targetStrain && (
                        <Text style={{ color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                            Target Strain: {ws.targetStrain}
                        </Text>
                    )}
                </View>

                {/* HR Ring */}
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <HRRing
                        currentHR={ws.currentHR}
                        maxHR={ws.maxHR > ws.currentHR ? ws.maxHR : 200}
                        size={200}
                    />
                </View>

                {/* Paused overlay */}
                {ws.isPaused && (
                    <View style={{
                        backgroundColor: 'rgba(255,214,10,0.08)',
                        borderWidth: 0.5,
                        borderColor: 'rgba(255,214,10,0.2)',
                        borderRadius: 12,
                        padding: 16,
                        alignItems: 'center',
                        marginBottom: 20,
                    }}>
                        <MaterialIcons name="pause-circle" size={24} color={S.warning} />
                        <Text style={{ color: S.warning, fontSize: 14, fontWeight: '700', marginTop: 6 }}>
                            Workout Paused
                        </Text>
                        <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                            Tap Resume to continue tracking
                        </Text>
                    </View>
                )}

                {/* Strain bar */}
                <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ color: DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                            Strain Accumulation
                        </Text>
                        <Text style={{ color: S.pillarLongevity, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                            {safeNumber(ws.strainAccumulation, 1)}
                        </Text>
                    </View>
                    <View style={{
                        height: 6,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 3,
                        overflow: 'hidden',
                    }}>
                        <View style={{
                            height: '100%',
                            width: `${Math.min((ws.strainAccumulation / (ws.targetStrain || 15)) * 100, 100)}%`,
                            backgroundColor: ws.strainAccumulation >= (ws.targetStrain || 15)
                                ? S.success
                                : S.pillarLongevity,
                            borderRadius: 3,
                        }} />
                    </View>
                    {ws.targetStrain && (
                        <Text style={{ color: DIM, fontSize: 10, fontWeight: '600', textAlign: 'right', marginTop: 4 }}>
                            Target: {ws.targetStrain}
                        </Text>
                    )}
                </View>

                {/* Key Metrics Row */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    <LiveMetricTile
                        label="Calories"
                        value={ws.activeCalories.toString()}
                        unit="kcal"
                        icon="local-fire-department"
                        accent={S.warning}
                    />
                    <LiveMetricTile
                        label="Distance"
                        value={formatDistance(ws.distance)}
                        unit=""
                        icon="straighten"
                        accent={S.pillarReadiness}
                    />
                    <LiveMetricTile
                        label="Pace"
                        value={formatPace(ws.currentPace)}
                        unit="/km"
                        icon="speed"
                        accent={S.pillarResilience}
                    />
                </View>

                {/* Secondary Metrics */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    <LiveMetricTile
                        label="Avg HR"
                        value={ws.avgHR > 0 ? ws.avgHR.toString() : '--'}
                        unit="bpm"
                    />
                    <LiveMetricTile
                        label="Max HR"
                        value={ws.maxHR > 0 ? ws.maxHR.toString() : '--'}
                        unit="bpm"
                    />
                </View>

                {/* Zone Distribution */}
                <EliteCard style={{ padding: 20, marginBottom: 20 }}>
                    <ZoneDistribution zones={ws.zoneDistribution} />
                </EliteCard>

                {/* Lock screen hint */}
                <TouchableOpacity
                    activeOpacity={0.6}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 12,
                        opacity: 0.4,
                    }}
                >
                    <MaterialIcons name="lock" size={14} color={DIM} />
                    <Text style={{ color: DIM, fontSize: 11, fontWeight: '600' }}>Swipe to lock screen</Text>
                </TouchableOpacity>

                {/* [CANONICAL] Data provenance & scope declaration for Live Workout */}
                <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
                        data scope · provenance
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                        {([
                            { label: 'scores', vm: canonicalScores },
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
