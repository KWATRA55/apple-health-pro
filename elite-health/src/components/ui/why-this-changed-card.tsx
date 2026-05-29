import React from 'react'
import { View, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const S = {
  surface: '#121214',
  glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  accentTeal: '#14B8A6',
}

export function WhyThisChangedCard({ explanation }: { explanation: string }) {
  return (
    <View style={{
      backgroundColor: S.glass,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: S.border,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <MaterialIcons name="insights" size={16} color={S.accentTeal} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: S.onSurfaceVariant, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          Why This Changed
        </Text>
        <Text style={{ color: S.onSurface, fontSize: 13, lineHeight: 18, fontWeight: '500' }}>
          {explanation}
        </Text>
      </View>
    </View>
  )
}
