import React from 'react'
import { View, Text } from 'react-native'

const S = {
  dimText: 'rgba(255,255,255,0.40)',
  onSurface: '#FAFAFA',
}

export type ThresholdBandProps = {
  value: number
  min: number
  max: number
  zones: {
    color: string
    flex: number
    label?: string
  }[]
  markerLabel?: string
}

export function ThresholdBand({ value, min, max, zones, markerLabel }: ThresholdBandProps) {
  const range = max - min
  const clampedValue = Math.min(Math.max(value, min), max)
  const percent = ((clampedValue - min) / range) * 100

  return (
    <View style={{ width: '100%' }}>
      {/* Labels Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        {zones.map((z, idx) => (
          <Text key={idx} style={{ color: z.color, fontSize: 9, fontWeight: '700', flex: z.flex, textAlign: 'center', opacity: 0.8 }}>
            {z.label}
          </Text>
        ))}
      </View>
      
      {/* Band Container */}
      <View style={{ 
        height: 6, 
        borderRadius: 3, 
        flexDirection: 'row', 
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.06)'
      }}>
        {zones.map((z, idx) => (
          <View key={idx} style={{ flex: z.flex, backgroundColor: z.color, opacity: 0.6 }} />
        ))}
      </View>

      {/* Current Marker */}
      <View style={{
        position: 'absolute',
        bottom: -2,
        left: `${percent}%`,
        transform: [{ translateX: -4 }],
        alignItems: 'center'
      }}>
        <View style={{ width: 8, height: 10, backgroundColor: S.onSurface, borderRadius: 4, shadowColor: '#FFF', shadowRadius: 4, shadowOpacity: 0.8 }} />
      </View>
      
      {markerLabel && (
        <View style={{
          position: 'absolute',
          top: -20,
          left: `${percent}%`,
          transform: [{ translateX: -10 }],
        }}>
          <Text style={{ color: S.onSurface, fontSize: 10, fontWeight: '800' }}>{markerLabel}</Text>
        </View>
      )}
    </View>
  )
}
