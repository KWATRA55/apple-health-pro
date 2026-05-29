import React from 'react'
import { View, ViewProps, StyleSheet } from 'react-native'

interface GlassCardProps extends ViewProps {
  children: React.ReactNode
}

export function GlassCard({
  children,
  style,
  ...props
}: GlassCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.10)',
          padding: 16,
          overflow: 'hidden',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  )
}
