import React from 'react'
import { View } from 'react-native'

const S = {
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
  neutral: '#bdc9c5',
}

export function TrendSpark({ 
  values, 
  color = S.neutral, 
  height = 24, 
  barWidth = 4, 
  gap = 2,
  highlightLast = true
}: { 
  values: number[]; 
  color?: string; 
  height?: number;
  barWidth?: number;
  gap?: number;
  highlightLast?: boolean;
}) {
  if (!values || !values.length) return null
  const max = Math.max(...values, 1)

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap, height }}>
      {values.map((v, i) => {
        const isLast = i === values.length - 1
        const h = Math.max(2, (v / max) * height)
        const opacity = isLast && highlightLast ? 1 : 0.4 + (i / Math.max(1, values.length - 1)) * 0.4

        return (
          <View
            key={i}
            style={{
              width: barWidth,
              height: h,
              backgroundColor: color,
              borderRadius: barWidth / 2,
              opacity,
              ...(isLast && highlightLast ? {
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowRadius: 4,
                shadowOpacity: 0.6,
              } : {})
            }}
          />
        )
      })}
    </View>
  )
}
