import React from 'react'
import { View, ViewProps, StyleSheet } from 'react-native'

interface GlassCardProps extends ViewProps {
  children: React.ReactNode
  elevated?: boolean
  style?: any
}

const STITCH = {
  surface: '#121214',
  border: 'rgba(255,255,255,0.08)',
  glass: 'rgba(255,255,255,0.04)',
}

export function GlassCard({
  children,
  elevated = false,
  style,
  ...props
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated ? styles.elevated : styles.glass,
        style
      ]}
      {...props}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 0.5,
    padding: 16,
    overflow: 'hidden',
  },
  glass: {
    backgroundColor: STITCH.glass,
    borderColor: STITCH.border,
  },
  elevated: {
    backgroundColor: STITCH.surface,
    borderColor: STITCH.border,
  },
})
