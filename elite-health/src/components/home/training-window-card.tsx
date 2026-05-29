import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import type { SynthesisOutput, ActivityRecord } from '../../lib/types'
import { colors as _S } from '../../theme/stitch-tokens'

type TokenMap = Record<string, string>
const S: TokenMap = {
  ..._S as TokenMap,
  accentCyan: _S.pillarLongevity,
  accentTeal: _S.pillarReadiness,
  success: _S.success,
  warning: _S.warning,
  error: _S.errorDisplay,
  glass: _S.glass,
  border: _S.border,
  dimText: _S.dimText,
  mutedText: _S.mutedText,
  onSurfaceVariant: _S.onSurfaceVariant,
  primaryFixedDim: _S.primaryFixedDim,
}

interface TrainingWindowProps {
  synthesis: SynthesisOutput | null
  activities: ActivityRecord[]
  cnsStressRisk: string | null
  dateStr: string
  onPress?: () => void
}

export function TrainingWindowCard({ synthesis, activities, cnsStressRisk, dateStr, onPress }: TrainingWindowProps) {
  const window = useMemo(() => {
    if (!synthesis) return null

    const readiness = synthesis.readiness.score
    const targetStrain = synthesis.targetStrain

    let timeRange: string
    let workoutType: string
    let startHour: number
    let endHour: number

    if (readiness >= 75) {
      // High readiness → afternoon performance window
      startHour = 16
      endHour = 19
      timeRange = '4:00 PM – 7:00 PM'
      if (targetStrain >= 14) {
        workoutType = 'STRENGTH or HIIT'
      } else if (targetStrain >= 10) {
        workoutType = 'TEMPO RUN or FUNCTIONAL'
      } else {
        workoutType = 'ZONE 2 CARDIO'
      }
    } else if (readiness >= 40) {
      // Moderate readiness → light morning or evening
      if (cnsStressRisk === 'HIGH') {
        startHour = 7
        endHour = 9
        timeRange = '7:00 AM – 9:00 AM'
        workoutType = 'ZONE 2 CARDIO ONLY'
      } else {
        startHour = 17
        endHour = 20
        timeRange = '5:00 PM – 8:00 PM'
        workoutType = 'LIGHT CARDIO or YOGA'
      }
    } else {
      // Low readiness → rest day
      startHour = 0
      endHour = 0
      timeRange = 'REST DAY'
      workoutType = 'MOBILITY + STRETCHING'
    }

    return { timeRange, workoutType, startHour, endHour, readiness }
  }, [synthesis, cnsStressRisk])

  // Check if any activity was logged today
  const hasWorkedOut = activities.some(a => a.timestamp.startsWith(dateStr))

  if (!window) {
    return (
      <View style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}>
        <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
          Optimal Training Window
        </Text>
        <Text style={{ color: S.mutedText, fontSize: 13, marginTop: 8 }}>
          Sync to calculate your training window
        </Text>
      </View>
    )
  }

  const isRestDay = window.startHour === 0 && window.endHour === 0

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        if (onPress) {
          onPress()
        } else {
          router.push({ pathname: '/(tabs)/health', params: { date: dateStr } })
        }
      }}
      style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Title */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{
          color: S.dimText,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          Optimal Training Window
        </Text>
        {hasWorkedOut && (
          <View style={{
            backgroundColor: 'rgba(122,215,198,0.12)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <MaterialIcons name="check-circle" size={12} color={S.success} />
            <Text style={{ color: S.success, fontSize: 10, fontWeight: '700' }}>DONE</Text>
          </View>
        )}
      </View>

      {/* Time range */}
      <Text style={{
        color: isRestDay ? S.warning : S.accentCyan,
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginBottom: 4,
      }}>
        {window.timeRange}
      </Text>

      {/* Workout type recommendation */}
      <Text style={{
        color: S.onSurfaceVariant,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 16,
      }}>
        {window.workoutType}
      </Text>

      {/* Timeline bar: 6AM → 12AM */}
      <View style={{ height: 20, position: 'relative' }}>
        {/* Track background */}
        <View style={{
          position: 'absolute',
          top: 6,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 4,
        }} />

        {/* Optimal window highlight */}
        {!isRestDay && (
          <View style={{
            position: 'absolute',
            top: 4,
            left: `${((window.startHour - 6) / 18) * 100}%`,
            width: `${((window.endHour - window.startHour) / 18) * 100}%`,
            height: 12,
            backgroundColor: 'rgba(20,184,166,0.25)',
            borderRadius: 6,
            borderWidth: 0.5,
            borderColor: 'rgba(20,184,166,0.4)',
            shadowColor: S.accentTeal,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
          }} />
        )}

        {/* Workout checkmark on bar if worked out */}
        {hasWorkedOut && !isRestDay && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: `${((window.startHour - 6) / 18) * 100 + ((window.endHour - window.startHour) / 18) * 50}%`,
          }}>
            <MaterialIcons name="check-circle" size={16} color={S.success} />
          </View>
        )}
      </View>

      {/* Time labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: 'rgba(255,255,255,0.20)', fontSize: 9, fontWeight: '600' }}>6 AM</Text>
        <Text style={{ color: 'rgba(255,255,255,0.20)', fontSize: 9, fontWeight: '600' }}>12 PM</Text>
        <Text style={{ color: 'rgba(255,255,255,0.20)', fontSize: 9, fontWeight: '600' }}>6 PM</Text>
        <Text style={{ color: 'rgba(255,255,255,0.20)', fontSize: 9, fontWeight: '600' }}>12 AM</Text>
      </View>

      {/* Start Workout CTA */}
      {!isRestDay && !hasWorkedOut && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={(e) => {
            e.stopPropagation?.()
            const type = window.workoutType.includes('RUN') ? 'Running'
              : window.workoutType.includes('CYCLE') ? 'Cycling'
                : window.workoutType.includes('STRENGTH') ? 'Strength Training'
                  : 'Other'
            router.push({ pathname: '/workout/live', params: { type } })
          }}
          style={{
            marginTop: 16,
            backgroundColor: S.accentTeal,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <MaterialIcons name="play-circle" size={18} color="#000" />
          <Text style={{ color: '#000', fontSize: 14, fontWeight: '800' }}>
            Start Workout
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}
