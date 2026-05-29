import React from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { SynthesisOutput } from '../../lib/types'

interface DailyDirectiveDetailModalProps {
  visible: boolean
  onClose: () => void
  synthesis: SynthesisOutput | null
}

const S = {
  bg: '#000000',
  surface: '#121214',
  border: 'rgba(255,255,255,0.08)',
  accentTeal: '#14B8A6',
  accentCyan: '#00E5FF',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
}

export function DailyDirectiveDetailModal({ visible, onClose, synthesis }: DailyDirectiveDetailModalProps) {
  if (!synthesis) return null

  const isDeficit = synthesis.headline?.includes('DEFICIT') || synthesis.headline?.includes('CRITICAL') || synthesis.readiness.score < 50

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
              <MaterialIcons name="insights" size={20} color={isDeficit ? '#FF453A' : S.accentTeal} />
              <Text style={{ color: S.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>
                {synthesis.headline || 'DAILY Directive Analysis'}
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
            {/* Headline Banner */}
            <View style={{
              backgroundColor: isDeficit ? 'rgba(255, 69, 58, 0.08)' : 'rgba(20, 184, 166, 0.08)',
              borderRadius: 12,
              padding: 16,
              borderWidth: 0.5,
              borderColor: isDeficit ? 'rgba(255, 69, 58, 0.2)' : 'rgba(20, 184, 166, 0.2)',
              marginBottom: 20,
            }}>
              <Text style={{
                color: isDeficit ? '#FF453A' : S.accentTeal,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Physiological Status
              </Text>
              <Text style={{ color: S.onSurface, fontSize: 15, fontWeight: '600', lineHeight: 22 }}>
                {synthesis.directive}
              </Text>
            </View>

            {/* Score Breakdown Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>READINESS</Text>
                <Text style={{ color: S.accentTeal, fontSize: 24, fontWeight: '900', marginTop: 4 }}>{synthesis.readiness.score}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>RESILIENCE</Text>
                <Text style={{ color: '#A855F7', fontSize: 24, fontWeight: '900', marginTop: 4 }}>{synthesis.resilience.score}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>CNS STRESS</Text>
                <Text style={{ color: S.accentCyan, fontSize: 18, fontWeight: '900', marginTop: 8 }}>{synthesis.cnsStressScore?.risk ?? 'LOW'}</Text>
              </View>
            </View>

            {/* Sports Science Explanation */}
            <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Sports Science Rationale
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <Text style={{ color: S.mutedText, fontSize: 13, lineHeight: 20 }}>
                {isDeficit 
                  ? 'Your biometric markers show signs of systemic fatigue. Heart Rate Variability (HRV) has drifted below your 14-day rolling baseline, indicating a shift toward sympathetic nervous system dominance. Because the autonomic nervous system is strained, training capacity is reduced to mitigate injury risk.'
                  : 'Your physiological reserves are fully charged. HRV is stable and resting heart rate (RHR) is highly optimal. Sleep debt has been fully resolved over the last 48 hours, meaning the muscular and cardiovascular systems are primed to absorb significant physical load.'}
              </Text>
            </View>

            {/* Targets Grid */}
            <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Target Prescriptions
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16 }}>
                <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>TARGET STRAIN</Text>
                <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginTop: 4 }}>{synthesis.targetStrain.toFixed(1)}</Text>
                <Text style={{ color: S.dimText, fontSize: 9, marginTop: 4 }}>Max cardio-load capacity</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16 }}>
                <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>BEDTIME TARGET</Text>
                <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginTop: 4 }}>{synthesis.targetBedtime}</Text>
                <Text style={{ color: S.dimText, fontSize: 9, marginTop: 4 }}>Optimal sleep timing</Text>
              </View>
            </View>

            {/* Actionable Protocols */}
            <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Recovery Intervention Checklist
            </Text>
            <View style={{ gap: 10 }}>
              {synthesis.recoveryTips.map((tip, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderWidth: 0.5,
                    borderColor: S.border,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: isDeficit ? 'rgba(255, 69, 58, 0.1)' : 'rgba(20, 184, 166, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 0.5,
                    borderColor: isDeficit ? 'rgba(255, 69, 58, 0.2)' : 'rgba(20, 184, 166, 0.2)',
                  }}>
                    <Text style={{ color: isDeficit ? '#FF453A' : S.accentTeal, fontSize: 10, fontWeight: '700' }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: S.onSurface, fontSize: 13, lineHeight: 18 }}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
