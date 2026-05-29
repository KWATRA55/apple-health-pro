/**
 * ZoneBar — Horizontal zone distribution bar with labeled segments.
 *
 * Used for heart rate zone breakdown, strain distribution, etc.
 */

import React from 'react'
import { View, Text, ViewStyle } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type ZoneSegment = {
    label: string
    pct: number   // 0–100
    color: string
}

type ZoneBarProps = {
    zones: ZoneSegment[]
    height?: number
    showLabels?: boolean
    style?: ViewStyle
}

export default function ZoneBar({
    zones,
    height = 8,
    showLabels = false,
    style,
}: ZoneBarProps) {
    const total = zones.reduce((s, z) => s + z.pct, 0)

    if (total === 0) {
        return (
            <View
                style={[
                    {
                        height,
                        borderRadius: height / 2,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                    },
                    style,
                ]}
            />
        )
    }

    return (
        <View style={style}>
            <View
                style={{
                    flexDirection: 'row',
                    height,
                    borderRadius: height / 2,
                    overflow: 'hidden',
                }}
            >
                {zones.map((z, i) => {
                    if (z.pct <= 0) return null
                    return (
                        <View
                            key={i}
                            style={{
                                flex: z.pct,
                                backgroundColor: z.color,
                                ...(i === 0
                                    ? {
                                        borderTopLeftRadius: height / 2,
                                        borderBottomLeftRadius: height / 2,
                                    }
                                    : {}),
                                ...(i === zones.length - 1
                                    ? {
                                        borderTopRightRadius: height / 2,
                                        borderBottomRightRadius: height / 2,
                                    }
                                    : {}),
                            }}
                        />
                    )
                })}
            </View>
            {showLabels ? (
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginTop: 6,
                    }}
                >
                    {zones.map((z, i) => (
                        <View
                            key={i}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <View
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: z.color,
                                }}
                            />
                            <Text
                                style={{
                                    color: colors.mutedText,
                                    fontSize: 10,
                                    fontWeight: '500',
                                    fontFamily: typography.labelSm.fontFamily,
                                }}
                            >
                                {z.label} {z.pct}%
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    )
}
