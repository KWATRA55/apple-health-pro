import React from 'react'
import { Text } from 'react-native'

const S = {
  mutedText: 'rgba(255,255,255,0.55)',
}

export function MicroNarrative({ text }: { text: string }) {
  return (
    <Text style={{
      color: S.mutedText,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '400',
      marginTop: 8,
    }}>
      {text}
    </Text>
  )
}
