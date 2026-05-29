import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import * as Haptics from 'expo-haptics'

const S = {
  glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  onSurface: '#FAFAFA',
  dimText: 'rgba(255,255,255,0.40)',
}

export function SegmentedControl({ 
  tabs, 
  activeTab, 
  onChange 
}: { 
  tabs: { id: string; label: string }[]
  activeTab: string
  onChange: (id: string) => void 
}) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 9999,
      padding: 4,
      borderWidth: 0.5,
      borderColor: S.border,
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              if (!isActive) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onChange(tab.id)
              }
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderRadius: 9999,
            }}
          >
            <Text style={{
              color: isActive ? S.onSurface : S.dimText,
              fontSize: 12,
              fontWeight: isActive ? '700' : '500',
              letterSpacing: 0.5,
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
