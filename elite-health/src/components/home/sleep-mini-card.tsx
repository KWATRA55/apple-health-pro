import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import type { SleepRecord } from '../../lib/types'
import { safeNumber } from '../../lib/utils/display-helpers'

// ── STITCH Design Tokens ──────────────────────────────────────────────
const S = {
  surface: '#121214',
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.03)',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  primaryFixedDim: '#7ad7c6',
  secondaryFixedDim: '#c8c2e9',
  tertiaryFixedDim: '#a1cde3',
  success: '#7ad7c6',
  warning: '#FFD60A',
  error: '#FF453A',
}

interface SleepMiniCardProps {
  sleep: SleepRecord | null
  /** Sleep debt from computed scores (single source of truth) */
  sleepDebtHours?: number | null
}

function pillColor(actual: number, ideal: number): string {
  const ratio = actual / ideal
  if (ratio >= 0.85) return S.success
  if (ratio >= 0.65) return S.warning
  return S.error
}

// [CANONICAL-TODO] This component receives sleep via props from parent screens.
// Parent should source sleep from selectSleepForDate() and sleepDebtHours from
// selectScoresForDate() canonical selectors.
export function SleepMiniCard({ sleep, sleepDebtHours }: SleepMiniCardProps) {
  const countUp = useSharedValue(0)

  useEffect(() => {
    if (sleep && sleep.totalDurationMins > 0) {
      countUp.value = 0
      countUp.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    }
  }, [sleep])

  const animStyle = useAnimatedStyle(() => ({
    opacity: countUp.value,
    transform: [{ translateY: (1 - countUp.value) * 8 }],
  }))

  if (!sleep || sleep.totalDurationMins <= 0) {
    return (
      <View style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}>
        <Text style={{ color: S.dimText, fontSize: 12, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Sleep Last Night
        </Text>
        <Text style={{ color: S.mutedText, fontSize: 13, marginTop: 8 }}>
          No sleep data recorded
        </Text>
      </View>
    )
  }

  const totalHrs = Math.floor(sleep.totalDurationMins / 60)
  const totalMins = Math.round(sleep.totalDurationMins % 60)
  const total = sleep.totalDurationMins || 1

  const remPct = Math.round((sleep.remMins / total) * 100)
  const deepPct = Math.round((sleep.deepMins / total) * 100)
  const efficiency = Math.round(((total - (sleep.awakeMins || 0)) / total) * 100)

  const pills = [
    { label: `REM ${remPct}%`, color: pillColor(remPct, 22) },
    { label: `DEEP ${deepPct}%`, color: pillColor(deepPct, 17) },
    { label: `EFF ${efficiency}%`, color: efficiency >= 85 ? S.success : efficiency >= 75 ? S.warning : S.error },
  ]

  const hasDebt = (sleepDebtHours ?? 0) > 0.1

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/drilldown/sleep', params: { date: sleep.date } })}
      style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{
          color: S.dimText,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          Sleep Last Night
        </Text>
        {hasDebt && (
          <View style={{
            backgroundColor: 'rgba(255,182,0,0.12)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
          }}>
            <Text style={{ color: S.warning, fontSize: 10, fontWeight: '700' }}>
              ↓ {safeNumber(sleepDebtHours, 1)}h debt
            </Text>
          </View>
        )}
      </View>

      {/* Big number */}
      <Animated.View style={animStyle}>
        <Text style={{
          color: S.onSurface,
          fontSize: 36,
          fontWeight: '900',
          letterSpacing: -1,
        }}>
          {totalHrs}h {totalMins}m
        </Text>
      </Animated.View>

      {/* Pill badges */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {pills.map((p, i) => (
          <View key={i} style={{
            backgroundColor: `${p.color}15`,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 0.5,
            borderColor: `${p.color}30`,
          }}>
            <Text style={{
              color: p.color,
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}>
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  )
}
