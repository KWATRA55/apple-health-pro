import React from 'react'
import { View, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const S = {
  high: '#30D158',
  medium: '#FFD60A',
  low: '#FF453A',
  dimText: 'rgba(255,255,255,0.40)',
  glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  let color = S.high
  let label = 'HIGH CONFIDENCE'
  if (confidence < 0.5) {
    color = S.low
    label = 'LOW CONFIDENCE'
  } else if (confidence < 0.8) {
    color = S.medium
    label = 'MODERATE CONFIDENCE'
  }

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: S.glass,
      borderRadius: 6,
      borderWidth: 0.5,
      borderColor: S.border,
      alignSelf: 'flex-start',
    }}>
      <MaterialIcons name="check-circle" size={10} color={color} />
      <Text style={{
        color: S.dimText,
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
      }}>
        {label}
      </Text>
    </View>
  )
}
