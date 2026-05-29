import React from 'react'
import { View, Text } from 'react-native'

interface MetricValueProps {
  value: string
  label: string
  unit?: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MetricValue({ value, label, unit, color = '#FFFFFF', size = 'md' }: MetricValueProps) {
  const valueSizes = {
    sm: 18,
    md: 30,
    lg: 48,
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ fontSize: valueSizes[size], fontWeight: '800', letterSpacing: -0.5, color }}>
          {value}
        </Text>
        {unit && (
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginLeft: 4, fontWeight: '600' }}>
            {unit}
          </Text>
        )}
      </View>
      <Text style={{ fontSize: 9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginTop: 4, fontWeight: '800', letterSpacing: 1.5 }}>
        {label}
      </Text>
    </View>
  )
}
