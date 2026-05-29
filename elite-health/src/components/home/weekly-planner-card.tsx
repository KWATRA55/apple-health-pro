import React, { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated'
import type { WeeklyPlan, DayPlan } from '../../lib/algorithms/weekly-planner'
import { safeNumber } from '../../lib/utils/display-helpers'

// ── Props ────────────────────────────────────────────────────────────────────

interface WeeklyPlannerCardProps {
    plan: WeeklyPlan | null
    onPressDay?: (day: DayPlan) => void
}

// ── Stitch Design Tokens ─────────────────────────────────────────────────────

const STITCH = {
    surface: '#121214',
    border: 'rgba(255,255,255,0.08)',
    accentTeal: '#7ad7c6',        // primary-fixed-dim
    accentPurple: '#c8c2e9',      // secondary-fixed-dim
    accentCyan: '#00E5FF',        // tertiary-fixed
    onSurface: '#e2e2e2',
    onSurfaceVariant: '#bdc9c5',
    onSurfaceMuted: 'rgba(189,201,197,0.60)',
    todayAccent: '#CCFF00',
}

// ── Intensity to Stitch color ────────────────────────────────────────────────

import { MaterialIcons } from '@expo/vector-icons'

function intensityBarColor(intensity: DayPlan['intensityLabel']): string {
    switch (intensity) {
        case 'REST': return '#00E5FF' // Cyan
        case 'LIGHT': return '#c8c2e9' // Purple
        case 'MODERATE': return '#7ad7c6' // Teal
        case 'HARD': return '#7ad7c6' // Teal
        case 'INTENSE': return '#7ad7c6' // Teal
    }
}

function intensityBarPercent(intensity: DayPlan['intensityLabel']): number {
    switch (intensity) {
        case 'REST': return 25
        case 'LIGHT': return 50
        case 'MODERATE': return 75
        case 'HARD': return 100
        case 'INTENSE': return 100
    }
}

function activityIcon(workoutType: string): keyof typeof MaterialIcons.glyphMap {
    const t = workoutType?.toLowerCase() ?? ''
    if (t.includes('run')) return 'directions-run'
    if (t.includes('swim') || t.includes('pool')) return 'pool'
    if (t.includes('bike') || t.includes('cycle') || t.includes('cycling')) return 'directions-bike'
    if (t.includes('lift') || t.includes('strength') || t.includes('gym')) return 'fitness-center'
    if (t.includes('yoga') || t.includes('mobility') || t.includes('stretch')) return 'self-improvement'
    if (t.includes('rest')) return 'hotel'
    return 'directions-run'
}

// ── Stitch Day Chip (narrow: 64×96) ─────────────────────────────────────────

function DayChip({
    day,
    index,
    selectedDate,
    onPress,
}: {
    day: DayPlan;
    index: number;
    selectedDate: string;
    onPress?: (day: DayPlan) => void;
}) {
    const barColor = intensityBarColor(day.intensityLabel)
    const barPct = intensityBarPercent(day.intensityLabel)

    const todayStr = new Date().toISOString().split('T')[0]
    const isToday = day.date === todayStr
    const isPast = day.date < todayStr
    const isSelected = day.date === selectedDate

    const scale = useSharedValue(0.8)
    const opacity = useSharedValue(0)

    useEffect(() => {
        scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
        opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
    }, [day.date])

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }))

    return (
        <Animated.View style={[animStyle]}>
            <TouchableOpacity
                onPress={() => onPress?.(day)}
                activeOpacity={0.7}
                style={{
                    width: 68,
                    height: 100,
                    backgroundColor: isSelected
                        ? 'rgba(20, 184, 166, 0.16)'
                        : isToday
                            ? 'rgba(122,215,198,0.05)'
                            : isPast
                                ? 'rgba(255,255,255,0.02)'
                                : 'rgba(18,18,20,0.8)',
                    borderWidth: 1.5,
                    borderColor: isSelected
                        ? '#00E5FF'
                        : isToday
                            ? 'rgba(122,215,198,0.30)'
                            : 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 6,
                    gap: 3,
                    opacity: isPast && !isSelected ? 0.6 : 1,
                }}
            >
                {/* Day label */}
                <Text style={{
                    color: isSelected
                        ? '#00E5FF'
                        : isToday
                            ? '#7ad7c6'
                            : 'rgba(189,201,197,0.6)',
                    fontSize: 10,
                    fontWeight: isSelected || isToday ? '800' : '600',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                }}>
                    {day.label.slice(0, 3)}
                </Text>

                {/* Strain target or logged strain */}
                <Text style={{
                    color: isSelected ? '#ffffff' : isToday ? '#7ad7c6' : '#e2e2e2',
                    fontSize: 22,
                    fontWeight: '800',
                }}>
                    {safeNumber(day.recommendedStrain, 0)}
                </Text>

                {/* Intensity bar */}
                <View style={{
                    width: 40,
                    height: 4,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    marginTop: 2,
                    marginBottom: 2,
                }}>
                    <View style={{
                        width: `${barPct}%` as any,
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: 2,
                    }} />
                </View>

                {/* Activity or logged status icon */}
                {isPast ? (
                    <MaterialIcons name="check-circle" size={12} color={STITCH.accentTeal} />
                ) : (
                    <MaterialIcons name={activityIcon(day.workoutType)} size={12} color={barColor} />
                )}
            </TouchableOpacity>
        </Animated.View>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

interface WeeklyPlannerCardProps {
    plan: WeeklyPlan | null
    selectedDate: string
    onPressDay?: (day: DayPlan) => void
}

export const WeeklyPlannerCard = React.memo(function WeeklyPlannerCard({ plan, selectedDate, onPressDay }: WeeklyPlannerCardProps) {
    const fadeIn = useSharedValue(0)

    useEffect(() => {
        fadeIn.value = 0
        fadeIn.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    }, [plan])

    const animStyle = useAnimatedStyle(() => ({
        opacity: fadeIn.value,
        transform: [{ translateY: (1 - fadeIn.value) * 10 }],
    }))

    // ── Empty State ─────────────────────────────────────────────────────────
    if (!plan) {
        return (
            <Animated.View style={[animStyle]}>
                <View style={{
                    backgroundColor: STITCH.surface,
                    borderWidth: 0.5,
                    borderColor: STITCH.border,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                }}>
                    <Text style={{
                        color: STITCH.onSurfaceMuted,
                        fontSize: 12,
                        fontWeight: '500',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        marginBottom: 8,
                    }}>
                        Physiological Planner
                    </Text>
                    <Text style={{
                        color: STITCH.onSurfaceVariant,
                        fontSize: 13,
                        lineHeight: 20,
                    }}>
                        Keep syncing daily — your weekly plan appears after 7+ days of data is collected.
                    </Text>
                </View>
            </Animated.View>
        )
    }

    return (
        <Animated.View style={[animStyle, { marginBottom: 16 }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                <Text style={{
                    color: STITCH.onSurfaceMuted,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                }}>
                    Physiological Planner
                </Text>
                <Text style={{
                    color: 'rgba(255,255,255,0.25)',
                    fontSize: 10,
                    fontWeight: '500',
                }}>
                    {plan.confidence}% confidence
                </Text>
            </View>

            {/* Day Chips — Horizontal Scroll (snap-x) */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
                snapToInterval={78}
                decelerationRate="fast"
            >
                {plan.days.map((day, i) => (
                    <DayChip
                        key={day.date}
                        day={day}
                        index={i}
                        selectedDate={selectedDate}
                        onPress={onPressDay}
                    />
                ))}
            </ScrollView>
        </Animated.View>
    )
});
