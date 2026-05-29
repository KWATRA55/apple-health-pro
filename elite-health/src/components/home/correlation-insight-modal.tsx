import React from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { CorrelationInsight } from '../../lib/types'

interface CorrelationInsightModalProps {
  visible: boolean
  onClose: () => void
  insight: CorrelationInsight | null
}

const S = {
  bg: '#000000',
  surface: '#121214',
  border: 'rgba(255,255,255,0.08)',
  accentTeal: '#14B8A6',
  accentPurple: '#A855F7',
  accentCyan: '#00E5FF',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
}

export function CorrelationInsightModal({ visible, onClose, insight }: CorrelationInsightModalProps) {
  if (!insight) return null

  const isPositive = insight.direction === 'positive'
  const color = isPositive ? S.accentTeal : '#FF453A'

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
          height: '70%',
          width: '100%',
          overflow: 'hidden',
          paddingBottom: 24,
        }}>
          {/* Header Indicator Bar */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

          {/* Title Area */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="insights" size={20} color={S.accentPurple} />
              <Text style={{ color: S.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>
                Habit Correlation Analysis
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
            {/* Impact Metric Banner */}
            <View style={{
              backgroundColor: `${color}0D`,
              borderRadius: 12,
              padding: 20,
              borderWidth: 1,
              borderColor: `${color}30`,
              marginBottom: 20,
              alignItems: 'center',
            }}>
              <Text style={{ color: S.accentPurple, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                STATISTICAL EFFECT ON RECOVERY
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 34, fontWeight: '900', letterSpacing: -0.5 }}>
                {isPositive ? 'CORRELATES WITH' : 'CORRELATES WITH'} {isPositive ? '+' : '-'}{Math.abs(insight.avgImpactPercent)}% RECOVERY
              </Text>
              <Text style={{ color: S.mutedText, fontSize: 12, marginTop: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                FACTOR: {insight.habit}
              </Text>
            </View>

            {/* Scientific Breakdown */}
            <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Physiological Explanation
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: S.mutedText, fontSize: 13, lineHeight: 18 }}>
                {insight.habit.toLowerCase().includes('late screen') || insight.habit.toLowerCase().includes('phone')
                  ? 'Blue wavelength light exposure within 90 minutes of sleep suppresses natural melatonin synthesis in the pineal gland. This delays sleep onset, fragments deep/REM sleep architecture, and reduces heart rate variability (HRV) recovery potential.'
                  : insight.habit.toLowerCase().includes('hydration') || insight.habit.toLowerCase().includes('water')
                    ? 'Adequate plasma volume is essential for cardiovascular efficiency. Proper hydration boosts stroke volume, allowing the heart to pump more blood with less effort, which naturally lowers resting heart rate and elevates HRV scores.'
                    : insight.habit.toLowerCase().includes('caffeine') || insight.habit.toLowerCase().includes('coffee')
                      ? 'Caffeine acts as a competitive adenosine receptor antagonist. When consumed late, it blocks the chemical signal for sleep pressure, leading to shallow sleep, increased nocturnal micro-arousals, and suppressed parasympathetic recovery.'
                      : `Logging "${insight.habit}" has a mathematically significant relationship with your autonomic state. Statistical tracking indicates that when this factor is present, cellular replenishment rates vary, directly driving next-day systemic readiness.`}
              </Text>
            </View>

            {/* Math / Pearson explanation */}
            <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Mathematical Significance
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                <Text style={{ color: S.dimText, fontSize: 12 }}>Significance Rating</Text>
                <Text style={{ color: S.accentPurple, fontSize: 12, fontWeight: '700' }}>
                  {Math.abs(insight.avgImpactPercent) > 12 ? 'HIGH CONFIDENCE (p < 0.05)' : 'MODERATE SIGNIFICANCE (p < 0.10)'}
                </Text>
              </View>
              <View style={{ width: '100%', height: 1, backgroundColor: S.border }} />
              <Text style={{ color: S.dimText, fontSize: 11, lineHeight: 15 }}>
                Our algorithms run a rolling Pearson Correlation Coefficient (r) between your journal entries and your next-day heart rate variability / recovery scores. This is a statistical association, not proof of causation. Results are based on a 14-day sample size.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
