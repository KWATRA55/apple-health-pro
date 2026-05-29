/**
 * VitalRow — Single vital metric row: label | value + unit | status.
 *
 * Used in vitals grids across Health drilldown screens.
 */

import React from 'react'
import { View, Text, ViewStyle } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'
import StatusDot from './status-dot'

type VitalRowProps = {
    label: string
    value: string | number
    unit?: string
    status?: string
    statusColor?: string
    /** Whether the value is dimmed (missing) */
    dimmed?: boolean
    /** Extra style */
    style?: ViewStyle
}

export default function VitalRow({
    label,
    value,
    unit,
    status,
    statusColor,
    dimmed = false,
    style,
}: VitalRowProps) {
    return (
        <View
            style={[
                {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.borderDim,
                },
                style,
            ]}
        >
            <Text
                style={{
                    color: colors.onSurfaceVariant,
                    fontSize: typography.bodySm.fontSize,
                    fontFamily: typography.bodySm.fontFamily,
                }}
            >
                {label}
            </Text>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                    <Text
                        style={{
                            color: dimmed ? colors.dimText : colors.onSurface,
                            fontSize: typography.bodyMd.fontSize,
                            fontWeight: '700',
                            fontFamily: typography.bodyMd.fontFamily,
                        }}
                    >
                        {value}
                    </Text>
                    {unit ? (
                        <Text
                            style={{
                                color: dimmed ? colors.dimText : colors.mutedText,
                                fontSize: typography.labelSm.fontSize,
                                fontFamily: typography.labelSm.fontFamily,
                            }}
                        >
                            {unit}
                        </Text>
                    ) : null}
                </View>
                {status ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {statusColor ? (
                            <StatusDot color={statusColor} size={6} />
                        ) : null}
                        <Text
                            style={{
                                color: statusColor ?? colors.onSurfaceVariant,
                                fontSize: typography.labelSm.fontSize,
                                fontWeight: '500',
                                fontFamily: typography.labelSm.fontFamily,
                            }}
                        >
                            {status}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    )
}
