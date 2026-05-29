import React from 'react'
import { View, Text } from 'react-native'
import type { HabitInsight } from '../../lib/algorithms/habit-impact'

interface HabitImpactEngineProps {
  insights: HabitInsight[]
}

const S = {
  border: 'rgba(255,255,255,0.08)',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  success: '#30D158',
  error: '#FF453A',
}

// [CANONICAL-TODO] This component receives habit insights via props.
// Parent should derive insights from journal entries queried via canonical selectors.
export function HabitImpactEngine({ insights }: HabitImpactEngineProps) {
  if (insights.length === 0) {
    return (
      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: S.border }}>
        <Text style={{ fontSize: 9, color: S.dimText, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '800', marginBottom: 8 }}>
          BEHAVIOR INSIGHTS
        </Text>
        <Text style={{ fontSize: 13, color: S.mutedText }}>
          Log more habits to unlock correlation insights.
        </Text>
      </View>
    )
  }

  return (
    <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: S.border }}>
      <Text style={{ fontSize: 9, color: S.dimText, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '800', marginBottom: 12 }}>
        BEHAVIOR INSIGHTS
      </Text>

      <View style={{ gap: 8 }}>
        {insights.slice(0, 4).map((insight, i) => {
          const isPositive = insight.direction === 'positive'
          const symbol = isPositive ? '+' : '-'
          const textColor = isPositive ? S.success : S.error

          return (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: S.onSurface }}>{insight.habit}</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: textColor }}>
                {symbol}{Math.abs(insight.avgImpactPercent)}% Recovery
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
