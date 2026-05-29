import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { InterceptTrigger } from '../../lib/types'

// ── Props ────────────────────────────────────────────────────────────────────

interface InterceptModalProps {
  visible: boolean
  triggers: InterceptTrigger[]
  onDismiss: () => void
  onAction: (trigger: InterceptTrigger) => void
}

// ── Stitch Design Tokens ─────────────────────────────────────────────────────

const STITCH = {
  surface: '#121214',
  surfaceContainer: '#1b1b1b',
  border: 'rgba(255,255,255,0.08)',
  borderCritical: 'rgba(255,69,58,0.20)',
  onSurface: '#e2e2e2',
  onSurfaceVariant: '#bdc9c5',
  onSurfaceMuted: 'rgba(189,201,197,0.60)',
  accentTeal: '#7ad7c6',
  critical: '#FF453A',
  warning: '#FFD60A',
  info: '#0A84FF',
  overlay: 'rgba(0,0,0,0.88)',
}

// ── Intercept Card ──────────────────────────────────────────────────────────

function InterceptCard({ trigger, onAction }: { trigger: InterceptTrigger; onAction: (t: InterceptTrigger) => void }) {
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 })
    opacity.value = withTiming(1, { duration: 400 })
  }, [])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  const severityColor =
    trigger.severity === 'critical' ? STITCH.critical
      : trigger.severity === 'warning' ? STITCH.warning
        : STITCH.info

  const iconEmoji =
    trigger.icon === 'WARNING' ? '⚠️'
      : trigger.icon === 'REST' ? '🛌'
        : trigger.icon === 'MOON' ? '🌙'
          : trigger.icon === 'SUN' ? '☀️'
            : '⚡'

  return (
    <Animated.View
      style={[
        {
          backgroundColor: STITCH.surface,
          borderWidth: 0.5,
          borderColor: trigger.severity === 'critical'
            ? STITCH.borderCritical
            : STITCH.border,
          padding: 20,
          marginBottom: 12,
          borderRadius: 16,
        },
        cardStyle,
      ]}
    >
      {/* Header row: icon + title + severity badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Text style={{ fontSize: 22 }}>{iconEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{
            color: STITCH.onSurface,
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 1.5,
          }}>
            {trigger.title}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: `${severityColor}15`,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 0.5,
            borderColor: `${severityColor}35`,
          }}
        >
          <Text style={{
            color: severityColor,
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            {trigger.severity}
          </Text>
        </View>
      </View>

      {/* Message body */}
      <Text style={{
        color: STITCH.onSurfaceMuted,
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '500',
        marginBottom: 16,
      }}>
        {trigger.message}
      </Text>

      {/* Action button */}
      <TouchableOpacity
        onPress={() => onAction(trigger)}
        activeOpacity={0.85}
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.15)',
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: 'center',
          borderRadius: 12,
        }}
      >
        <Text style={{
          color: STITCH.onSurface,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 1,
        }}>
          {trigger.actionLabel}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Main Modal ───────────────────────────────────────────────────────────────

export function InterceptModal({ visible, triggers, onDismiss, onAction }: InterceptModalProps) {
  const overlayOpacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 300 })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    } else {
      overlayOpacity.value = withTiming(0, { duration: 250 })
    }
  }, [visible])

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  if (!visible || triggers.length === 0) return null

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[
          { flex: 1, backgroundColor: STITCH.overlay, justifyContent: 'flex-end' },
          overlayStyle,
        ]}>
          {/* Tap-to-dismiss backdrop */}
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={1} />

          {/* Content area */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 4 }}>
            {/* Label */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{
                color: STITCH.onSurfaceMuted,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}>
                Health Alert
              </Text>
            </View>

            {/* Cards */}
            {triggers.map((trigger, i) => (
              <InterceptCard key={i} trigger={trigger} onAction={onAction} />
            ))}

            {/* Dismiss button */}
            <TouchableOpacity
              onPress={onDismiss}
              activeOpacity={0.8}
              style={{
                backgroundColor: 'transparent',
                paddingVertical: 14,
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <Text style={{
                color: 'rgba(255,255,255,0.30)',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1,
              }}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

export { InterceptCard }
