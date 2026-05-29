import React, { useMemo } from 'react'
import { View, Text } from 'react-native'
import type { DailyScores, ActivityRecord } from '../../lib/types'
import { computeStreaks } from '../../lib/algorithms/streaks'

// ── STITCH Design Tokens ──────────────────────────────────────────────
const S = {
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.03)',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  primaryFixedDim: '#7ad7c6',
  accentCyan: '#00E5FF',
  accentVolt: '#CCFF00',
  success: '#30D158',
}

import * as Haptics from 'expo-haptics'
import { TouchableOpacity } from 'react-native'

interface StreakTrackerProps {
  scores: DailyScores[]
  activities: ActivityRecord[]
  onPressStreak?: (type: 'recoveryStreak' | 'trainingStreak' | 'hrvPositiveStreak', count: number) => void
}

const STREAKS = [
  { key: 'recoveryStreak' as const, emoji: '🔥', label: 'Recovery Streak', color: '#14B8A6' },
  { key: 'trainingStreak' as const, emoji: '⚡', label: 'Training Streak', color: '#CCFF00' },
  { key: 'hrvPositiveStreak' as const, emoji: '📈', label: 'HRV Positive', color: '#00E5FF' },
]

// [CANONICAL-TODO] This component receives scores/activities via props from parent screens.
// Parent should source data from selectAllTimeScoresRange() and
// selectAllTimeActivities() canonical selectors.
export function StreakTracker({ scores, activities, onPressStreak }: StreakTrackerProps) {
  const streaks = useMemo(() => computeStreaks(scores, activities), [scores, activities])

  return (
    <View style={{
      backgroundColor: S.glass,
      borderWidth: 0.5,
      borderColor: S.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    }}>
      {/* Header */}
      <Text style={{
        color: S.dimText,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 14,
      }}>
        Streak & Momentum
      </Text>

      {/* 3 streak counters in a row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {STREAKS.map(({ key, emoji, label, color }) => {
          const count = streaks[key]
          const isActive = count > 0
          const isGlowing = count >= 7

          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onPressStreak?.(key, count)
              }}
              style={{
                flex: 1,
                backgroundColor: isActive ? `${color}08` : 'rgba(255,255,255,0.02)',
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                gap: 6,
                borderWidth: isGlowing ? 1 : 0.5,
                borderColor: isGlowing ? `${color}40` : 'rgba(255,255,255,0.06)',
                ...(isGlowing && {
                  shadowColor: color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                }),
              }}
            >
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
              {isActive ? (
                <>
                  <Text style={{
                    color: S.onSurface,
                    fontSize: 24,
                    fontWeight: '900',
                    letterSpacing: -0.5,
                  }}>
                    {count}
                  </Text>
                  <Text style={{
                    color: color,
                    fontSize: 9,
                    fontWeight: '700',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}>
                    {label.toUpperCase().split(' ').slice(-1)[0]}
                  </Text>
                  <Text style={{
                    color: S.dimText,
                    fontSize: 9,
                    fontWeight: '500',
                  }}>
                    {count} day{count !== 1 ? 's' : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{
                    color: S.mutedText,
                    fontSize: 10,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginTop: 4,
                  }}>
                    Start today →
                  </Text>
                  <Text style={{
                    color: S.dimText,
                    fontSize: 9,
                    fontWeight: '500',
                    textAlign: 'center',
                  }}>
                    {label.split(' ').slice(-1)[0]}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}
