import React, { useEffect } from 'react'
import { safeNumber } from '../../lib/utils/display-helpers'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import type { SynthesisOutput } from '../../lib/types'

import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

interface DailyDirectiveProps {
  synthesis: SynthesisOutput | null
  isLoading?: boolean
  onPress?: () => void
  onPressStrain?: () => void
  onPressBedtime?: () => void
  onSyncPress?: () => void
}

export function DailyDirective({ synthesis, isLoading, onPress, onPressStrain, onPressBedtime, onSyncPress }: DailyDirectiveProps) {
  const fadeIn = useSharedValue(0)

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
  }, [synthesis])

  const animStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }))

  if (isLoading || !synthesis) {
    const isSyncingState = isLoading
    return (
      <View style={{
        backgroundColor: '#121214',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 28,
        marginBottom: 12,
        alignItems: 'center',
      }}>
        {/* Icon */}
        <MaterialIcons
          name={isSyncingState ? 'sync' : 'psychology'}
          size={36}
          color={isSyncingState ? '#00E5FF' : 'rgba(255,255,255,0.30)'}
          style={{ marginBottom: 16 }}
        />

        {/* Heading */}
        <Text style={{
          color: isSyncingState ? '#e2e2e2' : 'rgba(255,255,255,0.65)',
          fontSize: 15,
          fontWeight: '700',
          fontFamily: undefined,
          textAlign: 'center',
          marginBottom: 8,
          letterSpacing: 0.3,
        }}>
          {isSyncingState ? 'Analyzing Your Health' : 'Today\'s Snapshot'}
        </Text>

        {/* Description */}
        <Text style={{
          color: 'rgba(255,255,255,0.40)',
          fontSize: 13,
          lineHeight: 20,
          textAlign: 'center',
          marginBottom: isSyncingState ? 0 : 20,
          paddingHorizontal: 8,
        }}>
          {isSyncingState
            ? 'Computing your daily health directive from Apple HealthKit data...'
            : 'Sync HealthKit to generate your daily health snapshot. We need 14 days of data for accurate insights.'}
        </Text>

        {/* Sync Now button — only show when not loading */}
        {!isSyncingState && onSyncPress && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onSyncPress()
            }}
            style={{
              backgroundColor: 'rgba(0,229,255,0.12)',
              borderWidth: 0.5,
              borderColor: 'rgba(0,229,255,0.25)',
              borderRadius: 10,
              paddingHorizontal: 20,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MaterialIcons name="sync" size={16} color="#00E5FF" />
            <Text style={{
              color: '#00E5FF',
              fontSize: 14,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}>
              Sync Now
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  const tip = synthesis.recoveryTips[0] || 'Take it easy today'

  return (
    <Animated.View style={[animStyle, { marginBottom: 12 }]}>
      <TouchableOpacity
        activeOpacity={onPress ? 0.9 : 1}
        onPress={() => {
          if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onPress()
          }
        }}
        style={{
          backgroundColor: '#121214',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          padding: 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top colored accent line */}
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#14B8A6' }}
        />

        {/* ── Header Row ─────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.10)',
          paddingBottom: 12,
          marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#14B8A6' }} />
            <Text style={{
              color: '#7ad7c6',
              fontSize: 12,
              fontWeight: '500',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}>
              {synthesis.headline || 'ALL SYSTEMS NOMINAL'}
            </Text>
          </View>
          <MaterialIcons name="psychology" size={18} color="rgba(189,201,197,0.6)" />
        </View>

        {/* ── Main Message ──────────────────────────────────────────── */}
        <Text style={{ color: '#e2e2e2', fontSize: 16, lineHeight: 25.6, marginBottom: 16 }}>
          {synthesis.directive}
        </Text>

        {/* ── 3-Column Metrics Grid ──────────────────────────────────── */}
        <View style={{ flexDirection: 'row', paddingTop: 8 }}>
          {/* Target Strain — tappable → resilience */}
          <TouchableOpacity
            style={{ flex: 1, gap: 4 }}
            activeOpacity={0.7}
            onPress={() => {
              if (onPressStrain) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onPressStrain()
              }
            }}
          >
            <Text style={{ color: 'rgba(189,201,197,0.6)', fontSize: 12, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              TGT STRAIN
            </Text>
            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '500', lineHeight: 31.2 }}>
              {safeNumber(synthesis.targetStrain, 1)}
            </Text>
          </TouchableOpacity>

          {/* Bedtime — tappable → readiness */}
          <TouchableOpacity
            style={{ flex: 1, gap: 4 }}
            activeOpacity={0.7}
            onPress={() => {
              if (onPressBedtime) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onPressBedtime()
              }
            }}
          >
            <Text style={{ color: 'rgba(189,201,197,0.6)', fontSize: 12, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              BEDTIME
            </Text>
            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '500', lineHeight: 31.2 }}>
              {synthesis.targetBedtime}
            </Text>
          </TouchableOpacity>

          {/* Recovery Tip */}
          <View style={{ flex: 1.2, gap: 4, justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 4 }}>
            <View
              style={{
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: '#00E5FF', fontSize: 12, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'right' }}>
                  TIP
                </Text>
                <MaterialIcons name="arrow-forward" size={14} color="#00E5FF" />
              </View>
              <Text style={{ color: 'rgba(189,201,197,0.6)', fontSize: 10, textAlign: 'right' }} numberOfLines={2}>
                {tip}
              </Text>
            </View>
          </View>
        </View>

      </TouchableOpacity>
    </Animated.View>
  )
}

