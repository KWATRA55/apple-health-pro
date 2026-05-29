import React from 'react'
import { View, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const S = {
  glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  dimText: 'rgba(255,255,255,0.40)',
  success: '#30D158',
  error: '#FF453A',
}

export type DriverItem = {
  label: string
  value: string
  impact: 'positive' | 'negative' | 'neutral'
}

export function DriverList({ drivers }: { drivers: DriverItem[] }) {
  if (!drivers.length) return null

  return (
    <View style={{
      backgroundColor: S.glass,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: S.border,
      overflow: 'hidden',
    }}>
      {drivers.map((driver, idx) => (
        <View key={idx} style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: idx < drivers.length - 1 ? 0.5 : 0,
          borderBottomColor: S.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {driver.impact === 'positive' && <MaterialIcons name="arrow-upward" size={14} color={S.success} />}
            {driver.impact === 'negative' && <MaterialIcons name="arrow-downward" size={14} color={S.error} />}
            {driver.impact === 'neutral' && <MaterialIcons name="horizontal-rule" size={14} color={S.dimText} />}
            <Text style={{ color: S.onSurfaceVariant, fontSize: 13, fontWeight: '600' }}>
              {driver.label}
            </Text>
          </View>
          <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '800' }}>
            {driver.value}
          </Text>
        </View>
      ))}
    </View>
  )
}
