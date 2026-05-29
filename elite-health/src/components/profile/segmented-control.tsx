import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

const RANGES = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: 'ALL', label: 'ALL TIME', days: 9999 },
]

interface SegmentedControlProps {
  selected: string
  onSelect: (key: string) => void
}

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../theme/stitch-tokens'

const S = {
  containerBg: _S.surface,
  border: _S.border,
  activeBg: _S.glass,
  activeBorder: 'rgba(0,229,255,0.2)',
  textActive: _S.onSurface,
  textInactive: _S.dimText,
}

export function SegmentedControl({ selected, onSelect }: SegmentedControlProps) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: S.containerBg,
      borderRadius: 12,
      padding: 4,
      borderWidth: 0.5,
      borderColor: S.border,
    }}>
      {RANGES.map((r) => {
        const isActive = selected === r.key
        return (
          <TouchableOpacity
            key={r.key}
            onPress={() => onSelect(r.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: isActive ? S.activeBg : 'transparent',
              borderWidth: isActive ? 0.5 : 0,
              borderColor: isActive ? S.activeBorder : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: isActive ? S.textActive : S.textInactive,
              }}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
