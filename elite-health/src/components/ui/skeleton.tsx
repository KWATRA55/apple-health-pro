import React, { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated'

// ── Base Shimmer Block ──────────────────────────────────────────────────────

interface SkeletonBlockProps {
    width: number | string
    height: number
    radius?: number
    opacity?: number
}

function SkeletonBlock({ width, height, radius = 6, opacity = 0.5 }: SkeletonBlockProps) {
    const shimmer = useSharedValue(0)

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        )
    }, [])

    const animStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [opacity, opacity + 0.3, opacity]),
    }))

    return (
        <Animated.View
            style={[
                animStyle,
                {
                    width: width as any,
                    height,
                    borderRadius: radius,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                },
            ]}
        />
    )
}

// ── DataGrid Skeleton (2 cards side-by-side) ────────────────────────────────

export function DataGridSkeleton() {
    return (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                    padding: 16,
                    minHeight: 130,
                    justifyContent: 'space-between',
                }}
            >
                <SkeletonBlock width="60%" height={12} radius={4} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
                    <SkeletonBlock width={20} height={20} radius={10} />
                    <SkeletonBlock width="40%" height={28} radius={4} />
                </View>
                <SkeletonBlock width="70%" height={10} radius={4} opacity={0.3} />
            </View>
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                    padding: 16,
                    minHeight: 130,
                    justifyContent: 'space-between',
                }}
            >
                <SkeletonBlock width="55%" height={12} radius={4} />
                <View style={{ marginVertical: 8 }}>
                    <SkeletonBlock width="45%" height={28} radius={4} />
                </View>
                <SkeletonBlock width="80%" height={10} radius={4} opacity={0.3} />
            </View>
        </View>
    )
}

// ── Ring Row Skeleton (3 rings side-by-side) ────────────────────────────────

export function RingRowSkeleton() {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 16 }}>
            {[0, 1, 2].map((i) => (
                <View key={i} style={{ alignItems: 'center', gap: 10 }}>
                    <SkeletonBlock width={88} height={88} radius={44} />
                    <SkeletonBlock width={60} height={12} radius={4} />
                    <SkeletonBlock width={40} height={8} radius={4} opacity={0.3} />
                </View>
            ))}
        </View>
    )
}

// ── Sphere Skeleton ─────────────────────────────────────────────────────────

export function SphereSkeleton({ size = 150 }: { size?: number }) {
    return (
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <SkeletonBlock width={size} height={size} radius={size / 2} />
            <View style={{ marginTop: 8, alignItems: 'center', gap: 6 }}>
                <SkeletonBlock width={80} height={14} radius={4} />
                <SkeletonBlock width={120} height={10} radius={4} opacity={0.3} />
            </View>
        </View>
    )
}

// ── Daily Directive Skeleton ────────────────────────────────────────────────

export function DirectiveSkeleton() {
    return (
        <View
            style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                padding: 20,
                marginBottom: 16,
                gap: 16,
            }}
        >
            <SkeletonBlock width="40%" height={12} radius={4} />
            <View style={{ gap: 6 }}>
                <SkeletonBlock width="100%" height={14} radius={4} />
                <SkeletonBlock width="85%" height={14} radius={4} />
                <SkeletonBlock width="60%" height={14} radius={4} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12 }}>
                <SkeletonBlock width={60} height={30} radius={8} />
                <SkeletonBlock width={60} height={30} radius={8} />
            </View>
        </View>
    )
}

// ── Vitals Grid Skeleton ────────────────────────────────────────────────────

export function VitalsGridSkeleton() {
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                    key={i}
                    style={{
                        width: '48%',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.06)',
                        padding: 12,
                        gap: 8,
                    }}
                >
                    <SkeletonBlock width="40%" height={10} radius={4} opacity={0.4} />
                    <SkeletonBlock width="55%" height={28} radius={4} />
                    <SkeletonBlock width="70%" height={8} radius={4} opacity={0.3} />
                </View>
            ))}
        </View>
    )
}

// ── Bio Age Skeleton ────────────────────────────────────────────────────────

export function BioAgeSkeleton() {
    return (
        <View
            style={{
                alignItems: 'center',
                paddingVertical: 24,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
            }}
        >
            <SkeletonBlock width={60} height={10} radius={4} opacity={0.4} />
            <View style={{ marginVertical: 16 }}>
                <SkeletonBlock width={180} height={180} radius={90} />
            </View>
            <SkeletonBlock width={120} height={24} radius={6} />
        </View>
    )
}

// ── Correlation Explorer Skeleton ───────────────────────────────────────────

export function CorrelationSkeleton() {
    return (
        <View
            style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                padding: 16,
                marginTop: 16,
                gap: 12,
            }}
        >
            <SkeletonBlock width="50%" height={12} radius={4} />
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingTop: 12,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: 'rgba(255,255,255,0.05)',
                    }}
                >
                    <View style={{ flex: 1, gap: 6 }}>
                        <SkeletonBlock width="50%" height={14} radius={4} />
                        <SkeletonBlock width="70%" height={10} radius={4} opacity={0.3} />
                    </View>
                    <SkeletonBlock width={40} height={14} radius={4} />
                </View>
            ))}
        </View>
    )
}

// ── Weekly Planner Skeleton ─────────────────────────────────────────────────

export function WeeklyPlannerSkeleton() {
    return (
        <View
            style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                padding: 20,
                marginBottom: 16,
                gap: 16,
            }}
        >
            <SkeletonBlock width="40%" height={12} radius={4} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                        <SkeletonBlock width="100%" height={54} radius={10} />
                        <SkeletonBlock width={20} height={8} radius={4} opacity={0.3} />
                    </View>
                ))}
            </View>
        </View>
    )
}

// ── Full Home Page Skeleton ─────────────────────────────────────────────────

export function HomePageSkeleton() {
    return (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {/* Header spacer */}
            <View style={{ height: 60 }} />

            {/* Section label */}
            <View style={{ alignItems: 'center', marginBottom: 4 }}>
                <SkeletonBlock width={120} height={10} radius={4} opacity={0.4} />
            </View>

            {/* Sphere */}
            <SphereSkeleton size={150} />

            {/* Section label */}
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <SkeletonBlock width={100} height={10} radius={4} opacity={0.4} />
            </View>

            {/* Ring row */}
            <RingRowSkeleton />

            {/* Daily directive */}
            <DirectiveSkeleton />

            {/* Weekly planner */}
            <WeeklyPlannerSkeleton />

            {/* Data grid */}
            <DataGridSkeleton />

            {/* Vitals grid */}
            <VitalsGridSkeleton />

            {/* Correlation */}
            <CorrelationSkeleton />
        </View>
    )
}

// ── Health Page Skeleton ────────────────────────────────────────────────────

export function HealthPageSkeleton() {
    return (
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
            <View style={{ height: 60 }} />
            <BioAgeSkeleton />
            <VitalsGridSkeleton />
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.06)',
                        padding: 16,
                        gap: 8,
                    }}
                >
                    <SkeletonBlock width="30%" height={12} radius={4} />
                    <SkeletonBlock width="100%" height={20} radius={4} />
                    <SkeletonBlock width="80%" height={14} radius={4} opacity={0.3} />
                </View>
            ))}
        </View>
    )
}
