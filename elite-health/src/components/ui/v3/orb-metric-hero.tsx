/**
 * OrbMetricHero — Large orb-like metric display with ring and label.
 *
 * Used for hero numbers like Recovery Score, HRV, RHR on drilldown screens.
 */

import React from 'react'
import { View, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors, typography } from '../../../theme/stitch-tokens'

type OrbMetricHeroProps = {
    value: number | string
    label: string
    unit?: string
    /** Fill percentage (0-100) for the ring */
    pct?: number
    /** Ring color */
    ringColor?: string
    /** Size in px (default: 160) */
    size?: number
    /** Whether value is dimmed */
    dimmed?: boolean
}

export default function OrbMetricHero({
    value,
    label,
    unit,
    pct = 0,
    ringColor = colors.pillarReadiness,
    size = 160,
    dimmed = false,
}: OrbMetricHeroProps) {
    const strokeWidth = 6
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference * (1 - Math.min(pct, 100) / 100)

    return (
        <View style={{ alignItems: 'center' }}>
            <View style={{ width: size, height: size, position: 'relative' }}>
                <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {/* Track */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    {/* Fill */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={ringColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                </Svg>
                {/* Center text */}
                <View
                    style={{
                        position: 'absolute',
                        inset: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: dimmed ? colors.dimText : colors.onSurface,
                            fontSize: typography.metricXl.fontSize * 0.6,
                            fontWeight: typography.metricXl.fontWeight,
                            letterSpacing: typography.metricXl.letterSpacing,
                            fontFamily: typography.metricXl.fontFamily,
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
                                marginTop: -2,
                                fontFamily: typography.labelSm.fontFamily,
                            }}
                        >
                            {unit}
                        </Text>
                    ) : null}
                </View>
            </View>
            <Text
                style={{
                    color: colors.onSurfaceVariant,
                    fontSize: typography.labelSm.fontSize,
                    fontWeight: typography.labelSm.fontWeight,
                    letterSpacing: typography.labelSm.letterSpacing,
                    textTransform: 'uppercase',
                    marginTop: 8,
                    fontFamily: typography.labelSm.fontFamily,
                }}
            >
                {label}
            </Text>
        </View>
    )
}
