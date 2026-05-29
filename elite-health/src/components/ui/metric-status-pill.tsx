import React from 'react'
import { View, Text } from 'react-native'

const S = {
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
  info: '#00E5FF',
  neutral: '#bdc9c5',
}

export type StatusType = 'rising' | 'stable' | 'suppressed' | 'elevated' | 'recovering' | 'optimal'

export function MetricStatusPill({ status, type }: { status: string; type?: StatusType }) {
  let color = S.neutral
  switch (type) {
    case 'rising':
    case 'optimal':
    case 'recovering':
      color = S.success
      break
    case 'suppressed':
    case 'elevated':
      color = S.warning
      break
    case 'stable':
      color = S.neutral
      break
    default:
      color = S.neutral
  }

  return (
    <View style={{
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: `${color}15`,
      borderRadius: 9999,
      borderWidth: 0.5,
      borderColor: `${color}30`,
      alignSelf: 'flex-start',
    }}>
      <Text style={{
        color,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        {status}
      </Text>
    </View>
  )
}
