/**
 * FocusBadge — Pill-shaped focus indicator (e.g., "READINESS", "RESILIENCE").
 *
 * Displays the current health-tab focus with its pillar color.
 */

import React from 'react'
import { View, Text } from 'react-native'
import { colors, typography, pillarConfig } from '../../../theme/stitch-tokens'

type FocusBadgeProps = {
    /** Focus key matching pillarConfig (readiness / resilience / longevity) */
    focus: string
    /** Optional override display name */
    pillName?: string
}

export default function FocusBadge({ focus, pillName }: FocusBadgeProps) {
    const pillar = pillarConfig[focus] ?? pillarConfig.readiness

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: `${pillar.color}18`,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 9999,
                alignSelf: 'flex-start',
            }}
        >
            <View
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: pillar.color,
                    marginRight: 6,
                }}
            />
            <Text
                style={{
                    color: pillar.color,
                    fontSize: typography.labelSm.fontSize,
                    fontWeight: '700',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    fontFamily: typography.labelSm.fontFamily,
                }}
            >
                {pillName ?? pillar.label}
            </Text>
        </View>
    )
}
