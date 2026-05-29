/**
 * MetricTile — Compact stat tile with label, value, unit, and optional accent ring.
 *
 * Used in bento grids on Health and Profile screens.
 */

import React from 'react'
import { View, Text, ViewStyle } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'
import EliteCard from './elite-card'

type MetricTileProps = {
    label: string
    value: string | number
    unit?: string
    accent?: string
    /** Leading icon character */
    icon?: string
    /** Whether the value is dimmed (missing/invalid data) */
    dimmed?: boolean
    /** Extra style */
    style?: ViewStyle
}

export default function MetricTile({
    label,
    value,
    unit,
    accent,
    icon,
    dimmed = false,
    style,
}: MetricTileProps) {
    return (
        <EliteCard style={[style, { flex: 1 }]}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                }}
            >
                {icon ? (
                    <Text style={{ fontSize: 12, color: accent ?? colors.onSurface }}>
                        {icon}
                    </Text>
                ) : null}
                <Text
                    style={{
                        color: colors.onSurfaceVariant,
                        fontSize: typography.labelSm.fontSize,
                        fontWeight: typography.labelSm.fontWeight,
                        letterSpacing: typography.labelSm.letterSpacing,
                        textTransform: 'uppercase',
                        fontFamily: typography.labelSm.fontFamily,
                    }}
                >
                    {label}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text
                    style={{
                        color: dimmed ? colors.dimText : (accent ?? colors.onSurface),
                        fontSize: typography.metricMd.fontSize,
                        fontWeight: typography.metricMd.fontWeight,
                        letterSpacing: typography.metricMd.letterSpacing,
                        fontFamily: typography.metricMd.fontFamily,
                    }}
                >
                    {value}
                </Text>
                {unit ? (
                    <Text
                        style={{
                            color: dimmed ? colors.dimText : colors.onSurfaceVariant,
                            fontSize: typography.labelSm.fontSize,
                            fontWeight: '500',
                            fontFamily: typography.labelSm.fontFamily,
                        }}
                    >
                        {unit}
                    </Text>
                ) : null}
            </View>
        </EliteCard>
    )
}
