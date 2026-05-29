/**
 * StatusDot — Small colored dot with optional glow effect.
 *
 * Used for recovery zone indicators, live status, etc.
 */

import React from 'react'
import { View } from 'react-native'

type StatusDotProps = {
    color: string
    glow?: boolean
    size?: number
}

export default function StatusDot({ color, glow = false, size = 8 }: StatusDotProps) {
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                ...(glow
                    ? {
                        shadowColor: color,
                        shadowOffset: { width: 0, height: 0 },
                        shadowRadius: 4,
                        shadowOpacity: 0.8,
                    }
                    : {}),
            }}
        />
    )
}
