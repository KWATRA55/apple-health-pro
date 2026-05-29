import React, { useMemo } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { SynthesisOutput } from '../../lib/types'
import { colors as _S } from '../../theme/stitch-tokens'

interface TrainingWindowDetailModalProps {
  visible: boolean
  onClose: () => void
  synthesis: SynthesisOutput | null
}

type TokenMap = Record<string, string>
const S: TokenMap = {
  ..._S as TokenMap,
  accentTeal: _S.pillarReadiness,
  accentCyan: _S.pillarLongevity,
}

export function TrainingWindowDetailModal({
  visible,
  onClose,
  synthesis,
}: TrainingWindowDetailModalProps) {
  if (!synthesis) return null

  const cnsStressRisk = synthesis.cnsStressScore?.risk ?? 'LOW'

  const window = useMemo(() => {
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

    return { timeRange, workoutType, startHour, endHour }
  }, [synthesis, cnsStressRisk])

  const { timeRange, workoutType, startHour, endHour } = window
  const isRestDay = startHour === 0 && endHour === 0

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
        {/* Backdrop press to dismiss */}
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onClose()
          }}
        />

        {/* Modal Container */}
        <View style={{
          backgroundColor: S.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          borderColor: S.border,
          height: '75%',
          width: '100%',
          overflow: 'hidden',
          paddingBottom: 24,
        }}>
          {/* Header Indicator Bar */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

          {/* Title Area */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="fitness-center" size={20} color={S.accentCyan} />
              <Text style={{ color: S.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>
                Optimal Training Window
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onClose()
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.05)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="close" size={18} color={S.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Window Timing Banner */}
            <View style={{
              backgroundColor: 'rgba(0, 229, 255, 0.06)',
              borderRadius: 12,
              padding: 20,
              borderWidth: 0.5,
              borderColor: 'rgba(0, 229, 255, 0.2)',
              marginBottom: 20,
              alignItems: 'center',
            }}>
              <Text style={{ color: S.accentCyan, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                RECOMMENDED TIMING
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                {timeRange}
              </Text>
              <Text style={{ color: S.mutedText, fontSize: 13, marginTop: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {workoutType}
              </Text>
            </View>

            {/* Why this window */}
            <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Why This Window
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <Text style={{ color: S.mutedText, fontSize: 13, lineHeight: 20 }}>
                {isRestDay
                  ? 'Your nervous system is showing signs of accumulated fatigue today. A rest day gives your body time to rebuild and adapt, which is when real gains happen. Light movement like walking or stretching is still fine.'
                  : `Your body's readiness signals suggest this window aligns with when your coordination, strength, and energy levels naturally peak. This is based on your recent sleep quality, heart rate patterns, and recovery trends. Training during this window helps you get the most out of your effort.`}
              </Text>
            </View>

            {/* Target Zones */}
            <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Heart Rate Intensity Targets
            </Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, borderWidth: 0.5, borderColor: S.border }}>
                <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '600' }}>Zone 1 (Active Recovery)</Text>
                <Text style={{ color: S.dimText, fontSize: 12 }}>50 - 60% Max HR</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(20, 184, 166, 0.05)', borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(20, 184, 166, 0.15)' }}>
                <Text style={{ color: S.accentTeal, fontSize: 13, fontWeight: '700' }}>Zone 2 (Aerobic Base)</Text>
                <Text style={{ color: S.accentTeal, fontSize: 12, fontWeight: '600' }}>60 - 70% Max HR</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, borderWidth: 0.5, borderColor: S.border }}>
                <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '600' }}>Zone 3 (Tempo/Threshold)</Text>
                <Text style={{ color: S.dimText, fontSize: 12 }}>70 - 80% Max HR</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, borderWidth: 0.5, borderColor: S.border }}>
                <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '600' }}>Zone 4/5 (Anaerobic / VO2 Max)</Text>
                <Text style={{ color: S.dimText, fontSize: 12 }}>80 - 100% Max HR</Text>
              </View>
            </View>

            {/* Safety Guidelines */}
            <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Physiological Pre-Flight Checklist
            </Text>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, borderWidth: 0.5, borderColor: S.border }}>
                <MaterialIcons name="local-drink" size={16} color={S.accentCyan} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '600' }}>Pre-Hydration</Text>
                  <Text style={{ color: S.mutedText, fontSize: 11, marginTop: 2 }}>Ingest 500ml of mineralized water with sodium/magnesium 45 min prior.</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, borderWidth: 0.5, borderColor: S.border }}>
                <MaterialIcons name="timer" size={16} color={S.accentCyan} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '600' }}>Dynamic Activation</Text>
                  <Text style={{ color: S.mutedText, fontSize: 11, marginTop: 2 }}>Complete 8 minutes of multi-planar dynamic joint mobility stretching.</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, borderWidth: 0.5, borderColor: S.border }}>
                <MaterialIcons name="security" size={16} color={S.accentCyan} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '600' }}>CNS Safety Limit ({cnsStressRisk} STRESS)</Text>
                  <Text style={{ color: S.mutedText, fontSize: 11, marginTop: 2 }}>
                    {cnsStressRisk === 'HIGH'
                      ? 'CNS exhaustion is flagged. Cap heart rate under 140bpm (Zone 2) to prevent sympathetic overload.'
                      : 'CNS strain is low. You are safe to engage in high-intensity overload protocols.'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
