import React from 'react'
import { View, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const S = {
  glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  onSurface: '#FAFAFA',
  dimText: 'rgba(255,255,255,0.40)',
  warning: '#FFD60A',
}

export function EmptyStateProtocol({ 
  title, 
  message, 
  actionLabel 
}: { 
  title: string;
  message: string;
  actionLabel?: string;
}) {
  return (
    <View style={{
      backgroundColor: S.glass,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: S.border,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <MaterialIcons name="hourglass-empty" size={32} color={S.warning} style={{ marginBottom: 12, opacity: 0.8 }} />
      <Text style={{ color: S.onSurface, fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ color: S.dimText, fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: actionLabel ? 16 : 0 }}>
        {message}
      </Text>
      {actionLabel && (
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 20,
        }}>
          <Text style={{ color: S.onSurface, fontSize: 12, fontWeight: '700' }}>
            {actionLabel}
          </Text>
        </View>
      )}
    </View>
  )
}
