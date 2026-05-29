import React from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

interface StreakDetailModalProps {
  visible: boolean
  onClose: () => void
  streakType: 'recoveryStreak' | 'trainingStreak' | 'hrvPositiveStreak' | null
  count: number
}

const S = {
  bg: '#000000',
  surface: '#121214',
  border: 'rgba(255,255,255,0.08)',
  accentTeal: '#14B8A6',
  accentVolt: '#CCFF00',
  accentCyan: '#00E5FF',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
}

const STREAK_DETAILS = {
  recoveryStreak: {
    emoji: '🔥',
    title: 'Recovery Streak',
    subtitle: 'Autonomic Balancing Consistency',
    color: S.accentTeal,
    explanation: 'A Recovery Streak represents consecutive days of maintaining a high Readiness Score in the green or yellow zones. Consecutive recovery indicates that your body is managing physiological stressors effectively, preventing accumulated fatigue and maintaining autonomic nervous system (ANS) homeostasis.',
    benefit: 'Sustained muscular restoration, optimal cortisol regulation, and stable metabolic repair.',
    milestone: '7 Days: Dynamic homeostasis stabilizes. 14 Days: Cellular adaptation resilience peaks.',
  },
  trainingStreak: {
    emoji: '⚡',
    title: 'Training Streak',
    subtitle: 'Progressive Strain Consistency',
    color: S.accentVolt,
    explanation: 'A Training Streak tracks consecutive days of hitting your prescribed cardiac strain targets or logging structured workouts. Consistency is the cornerstone of progressive overload and athletic conditioning. Regular exertion induces cardiovascular efficiency and increases cellular mitochondrial density.',
    benefit: 'Increases stroke volume, raises lactate threshold, and amplifies muscle fiber recruitment.',
    milestone: '7 Days: Neuromuscular efficiency increases. 14 Days: Cardiovascular plasma volume expands.',
  },
  hrvPositiveStreak: {
    emoji: '📈',
    title: 'HRV Positive Streak',
    subtitle: 'Parasympathetic Shift Streak',
    color: S.accentCyan,
    explanation: 'An HRV Positive Streak represents consecutive days where your Heart Rate Variability (HRV) is elevated above your 14-day baseline. Elevated HRV indicates strong parasympathetic (rest-and-digest) nervous system dominance, indicating high cardiovascular adaptability and rapid recovery speed.',
    benefit: 'Enhanced heart health, low resting heart rate (RHR), and high mental clarity and stress capacity.',
    milestone: '5 Days: Micro-vascular repair speed accelerates. 10 Days: Autonomic stability index optimizes.',
  },
}

export function StreakDetailModal({ visible, onClose, streakType, count }: StreakDetailModalProps) {
  if (!streakType) return null
  const detail = STREAK_DETAILS[streakType]

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
          height: '65%',
          width: '100%',
          overflow: 'hidden',
          paddingBottom: 24,
        }}>
          {/* Header Indicator Bar */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

          {/* Title Area */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>{detail.emoji}</Text>
              <Text style={{ color: S.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>
                {detail.title}
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
            {/* Streak Number Banner */}
            <View style={{
              backgroundColor: `${detail.color}0D`,
              borderRadius: 12,
              padding: 20,
              borderWidth: 1,
              borderColor: `${detail.color}30`,
              marginBottom: 20,
              alignItems: 'center',
              shadowColor: detail.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            }}>
              <Text style={{ color: detail.color, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                {detail.subtitle}
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 44, fontWeight: '900', letterSpacing: -1 }}>
                {count} {count === 1 ? 'DAY' : 'DAYS'}
              </Text>
              <Text style={{ color: S.mutedText, fontSize: 12, marginTop: 6, fontWeight: '500' }}>
                {count > 0 ? 'Active momentum is high' : 'No active streak — train or rest today to start!'}
              </Text>
            </View>

            {/* Explanation Section */}
            <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Physiology & Mechanism
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: S.mutedText, fontSize: 13, lineHeight: 18 }}>
                {detail.explanation}
              </Text>
            </View>

            {/* Scientific Benefit */}
            <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Target Physiological Benefit
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: detail.color, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
                {detail.benefit}
              </Text>
            </View>

            {/* Milestones */}
            <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Adaptation Milestones
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 0.5, borderColor: S.border, borderRadius: 12, padding: 16 }}>
              <Text style={{ color: S.mutedText, fontSize: 13, lineHeight: 18 }}>
                {detail.milestone}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
