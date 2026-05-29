import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const S = {
  glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  onSurface: '#FAFAFA',
  dimText: 'rgba(255,255,255,0.40)',
  error: '#FF453A',
  warning: '#FFD60A',
  success: '#30D158',
  accentCyan: '#00E5FF',
}

export type PriorityInsight = {
  type: 'risk' | 'reason' | 'opportunity' | 'positive'
  title: string
  description: string
}

export function InsightPriorityStack({ insights, onPressInsight }: { insights: PriorityInsight[]; onPressInsight?: (insight: PriorityInsight) => void }) {
  const getColor = (type: string) => {
    switch (type) {
      case 'risk': return S.error
      case 'reason': return S.warning
      case 'opportunity': return S.accentCyan
      case 'positive': return S.success
      default: return S.onSurface
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'risk': return 'warning'
      case 'reason': return 'search'
      case 'opportunity': return 'lightbulb-outline'
      case 'positive': return 'check-circle'
      default: return 'info'
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {insights.map((insight, idx) => (
        <TouchableOpacity
          key={idx}
          activeOpacity={onPressInsight ? 0.7 : 1}
          onPress={() => onPressInsight?.(insight)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: S.glass,
            borderRadius: 12,
            padding: 12,
            borderWidth: 0.5,
            borderColor: S.border,
            borderLeftWidth: 2,
            borderLeftColor: getColor(insight.type)
          }}>
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: `${getColor(insight.type)}15`,
            alignItems: 'center', justifyContent: 'center'
          }}>
            <MaterialIcons name={getIcon(insight.type) as any} size={16} color={getColor(insight.type)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700', marginBottom: 2 }}>
              {insight.title}
            </Text>
            <Text style={{ color: S.dimText, fontSize: 11, lineHeight: 16 }}>
              {insight.description}
            </Text>
          </View>
          {onPressInsight && (
            <MaterialIcons name="chevron-right" size={16} color={S.dimText} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  )
}
