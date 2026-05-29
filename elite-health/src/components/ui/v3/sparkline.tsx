/**
 * Sparkline — Mini inline sparkline chart (bar or line variant).
 *
 * Used for quick trend display in metric tiles.
 */

import React from 'react'
import { View } from 'react-native'
import { colors } from '../../../theme/stitch-tokens'

type SparklineProps = {
    values: number[]
    color?: string
    height?: number
    /** 'bar' or 'line' */
    variant?: 'bar' | 'line'
    /** Max count to display (last N) */
    maxBars?: number
}

export default function Sparkline({
    values,
    color = colors.primaryFixed,
    height = 24,
    variant = 'bar',
    maxBars = 7,
}: SparklineProps) {
    const displayValues = values.slice(-maxBars)
    const max = Math.max(...displayValues, 1)
    const min = Math.min(...displayValues, 0)

    if (variant === 'bar') {
        return (
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: 2,
                    height,
                }}
            >
                {displayValues.map((v, i) => {
                    const barH = max === min ? height * 0.3 : ((v - min) / (max - min)) * height
                    return (
                        <View
                            key={i}
                            style={{
                                flex: 1,
                                height: Math.max(barH, 2),
                                backgroundColor: color,
                                borderRadius: 1,
                                opacity: 0.8,
                            }}
                        />
                    )
                })}
            </View>
        )
    }

    // Line variant — simple dot-connected path approximated with View bars
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
                height,
            }}
        >
            {displayValues.map((v, i) => {
                const dotY = max === min ? 0.5 : (v - min) / (max - min)
                return (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <View
                            style={{
                                width: 4,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: color,
                                position: 'absolute',
                                top: `${((1 - dotY) * 100).toFixed(0)}%` as any,
                            }}
                        />
                    </View>
                )
            })}
        </View>
    )
}
