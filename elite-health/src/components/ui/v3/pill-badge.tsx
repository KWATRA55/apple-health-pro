/**
 * PillBadge — Small pill-shaped label with optional color.
 *
 * Used for tags, categories, zone labels (e.g., "Recovery", "Optimal").
 */

import React from 'react'
import { View, Text } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type PillBadgeProps = {
    label: string
    color?: string
    /** Fill opacity (default: 0.12) */
    fillOpacity?: number
}

export default function PillBadge({
    label,
    color = colors.primaryFixed,
    fillOpacity = 0.12,
}: PillBadgeProps) {
    return (
        <View
            style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 9999,
                backgroundColor: `${color}${Math.round(fillOpacity * 255)
                    .toString(16)
                    .padStart(2, '0')}`,
            }}
        >
            <Text
                style={{
                    color,
                    fontSize: typography.labelSm.fontSize,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                    fontFamily: typography.labelSm.fontFamily,
                }}
            >
                {label}
            </Text>
        </View>
    )
}
