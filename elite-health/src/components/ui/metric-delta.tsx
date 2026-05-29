import React from 'react'
import { View, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const S = {
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
  neutral: '#bdc9c5',
  dimText: 'rgba(255,255,255,0.40)',
}

export function MetricDelta({ 
  value, 
  direction, 
  isPositiveGood = true,
  label 
}: { 
  value: string; 
  direction: 'up' | 'down' | 'flat';
  isPositiveGood?: boolean;
  label?: string;
}) {
  let color = S.neutral
  let icon: any = 'horizontal-rule'

  if (direction === 'up') {
    color = isPositiveGood ? S.success : S.error
    icon = 'arrow-upward'
  } else if (direction === 'down') {
    color = isPositiveGood ? S.error : S.success
    icon = 'arrow-downward'
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <MaterialIcons name={icon} size={12} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>
        {value}
      </Text>
      {label && (
        <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '500' }}>
          {label}
        </Text>
      )}
    </View>
  )
}
