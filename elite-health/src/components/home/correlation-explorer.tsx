import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { CorrelationInsight } from '../../lib/types'

interface CorrelationExplorerProps {
  insights: CorrelationInsight[]
  onPressInsight?: (insight: CorrelationInsight) => void
}

// ── Stitch Design Tokens ────────────────────────────────────────────────────

const STITCH = {
  surface: '#121214',
  border: 'rgba(255,255,255,0.08)',
  accent: '#c8c2e9',          // secondary-fixed-dim
  accentDim: 'rgba(200,194,233,0.10)',
  onSurface: '#e2e2e2',
  onSurfaceVariant: '#bdc9c5',
  onSurfaceMuted: 'rgba(189,201,197,0.60)',
  positive: '#7ad7c6',
  negative: '#FF453A',
  surfaceContainer: '#1b1b1b',
}

const CATEGORY_LABELS: Record<string, string> = {
  habit: 'Habit',
  workout_timing: 'Timing',
  workout_type: 'Type',
  daylight: 'Sunlight',
  audio: 'Audio',
  strain: 'Strain',
}

function inferCategory(factor: string): string {
  if (factor.includes('Evening')) return 'workout_timing'
  if (factor.includes('Morning')) return 'workout_timing'
  if (factor.includes('Sunlight')) return 'daylight'
  if (factor.includes('Audio')) return 'audio'
  if (factor.includes('Strain')) return 'strain'
  return 'habit'
}

// ── Main Component ──────────────────────────────────────────────────────────

export const CorrelationExplorer = React.memo(function CorrelationExplorer({ insights, onPressInsight }: CorrelationExplorerProps) {
  // ── Empty State ─────────────────────────────────────────────────────────
  if (insights.length === 0) {
    return (
      <View style={{
        backgroundColor: STITCH.surface,
        borderWidth: 1,
        borderColor: STITCH.border,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        gap: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="insights" size={16} color={STITCH.accent} />
          <Text style={{
            color: STITCH.accent,
            fontSize: 12,
            fontWeight: '500',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}>
            What's Affecting You
          </Text>
        </View>
        <Text style={{
          color: STITCH.onSurfaceMuted,
          fontSize: 14,
          lineHeight: 22,
        }}>
          Track habits, workouts, and daily activities for 7+ days to see what impacts your recovery the most.
        </Text>
      </View>
    )
  }

  const sortedByImpact = [...insights].sort(
    (a, b) => Math.abs(b.avgImpactPercent) - Math.abs(a.avgImpactPercent)
  )
  const top = sortedByImpact.slice(0, 3)

  return (
    <View style={{
      backgroundColor: STITCH.surface,
      borderWidth: 1,
      borderColor: STITCH.border,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <MaterialIcons name="insights" size={16} color={STITCH.accent} />
        <Text style={{
          color: STITCH.accent,
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}>
          What's Affecting You
        </Text>
      </View>

      {/* ── Insight Rows ────────────────────────────────────────────────── */}
      {top.map((insight, i) => {
        const isPositive = insight.direction === 'positive'

        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => onPressInsight?.(insight)}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 16,
              backgroundColor: 'rgba(31,31,31,0.5)',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{
                  backgroundColor: isPositive ? 'rgba(122, 215, 198, 0.1)' : 'rgba(255, 69, 58, 0.1)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}>
                  <Text style={{
                    color: isPositive ? STITCH.positive : STITCH.negative,
                    fontSize: 10,
                    fontWeight: '700',
                  }}>
                    {isPositive ? '↑' : '↓'} {Math.abs(insight.avgImpactPercent)}%
                  </Text>
                </View>
                <View style={{
                  backgroundColor: 'rgba(200,194,233,0.1)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}>
                  <Text style={{
                    color: STITCH.accent,
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                  }}>
                    {Math.abs(insight.avgImpactPercent) > 10 ? 'STRONG' : 'MODERATE'}
                  </Text>
                </View>
              </View>

              <Text style={{
                color: STITCH.onSurface,
                fontSize: 16,
                fontWeight: '400',
                lineHeight: 22,
              }}>
                {insight.habit} is {isPositive ? 'associated with higher' : 'associated with lower'} recovery scores
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                <Text style={{
                  color: STITCH.accent,
                  fontSize: 12,
                  fontWeight: '500',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}>
                  Explore Data
                </Text>
                <MaterialIcons name="arrow-forward" size={14} color={STITCH.accent} />
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
});

/**
 * Calculates correlation insights from journal entries and scores.
 * Pure computation — does not depend on React state.
 */
export { computeHabitImpactPercent } from '../../lib/algorithms/pearson-correlation'
