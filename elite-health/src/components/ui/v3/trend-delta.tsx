/**
 * TrendDelta — Compact trend indicator: ▲ / ▼ + value + optional label.
 *
 * Green for positive trends (▲), red for negative (▼).
 */

import React from 'react'
import { View, Text } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type TrendDeltaProps = {
    value: number | string
    /** 'up' = ▲ green, 'down' = ▼ red, 'neutral' = muted */
    direction?: 'up' | 'down' | 'neutral'
    label?: string
    /** Invert colors: 'up' is bad (e.g., RHR increase) */
    invert?: boolean
}

export default function TrendDelta({
    value,
    direction = 'neutral',
    label,
    invert = false,
}: TrendDeltaProps) {
    const isGoodUp = !invert
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '─'
    const clr =
        direction === 'neutral'
            ? colors.mutedText
            : (direction === 'up' && isGoodUp) || (direction === 'down' && !isGoodUp)
                ? colors.success
                : colors.errorDisplay

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text
                style={{
                    color: clr,
                    fontSize: 10,
                    fontWeight: '700',
                }}
            >
                {arrow}
            </Text>
            <Text
                style={{
                    color: clr,
                    fontSize: typography.labelSm.fontSize,
                    fontWeight: '600',
                    fontFamily: typography.labelSm.fontFamily,
                }}
            >
                {value}
            </Text>
            {label ? (
                <Text
                    style={{
                        color: colors.mutedText,
                        fontSize: typography.labelSm.fontSize,
                        fontFamily: typography.labelSm.fontFamily,
                    }}
                >
                    {label}
                </Text>
            ) : null}
        </View>
    )
}
