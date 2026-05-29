/**
 * PillarRing — Ring visualization for pillar scores (Readiness/Resilience/Longevity).
 *
 * SVG ring with track, filled arc, and center score text.
 */

import React from 'react'
import { View, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors, typography, pillarConfig } from '../../../theme/stitch-tokens'

type PillarRingProps = {
    pillar: 'readiness' | 'resilience' | 'longevity'
    score: number
    size?: number
    strokeWidth?: number
    dimmed?: boolean
}

export default function PillarRing({
    pillar,
    score,
    size = 120,
    strokeWidth = 5,
    dimmed = false,
}: PillarRingProps) {
    const cfg = pillarConfig[pillar] ?? pillarConfig.readiness
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const pct = Math.min(score / 100, 1)
    const dashoffset = circumference * (1 - pct)

    return (
        <View style={{ width: size, height: size, position: 'relative' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={cfg.color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashoffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
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
                        color: dimmed ? colors.dimText : cfg.color,
                        fontSize: typography.metricMd.fontSize,
                        fontWeight: typography.metricMd.fontWeight,
                        letterSpacing: typography.metricMd.letterSpacing,
                        fontFamily: typography.metricMd.fontFamily,
                    }}
                >
                    {score}
                </Text>
                <Text
                    style={{
                        color: dimmed ? colors.dimText : colors.onSurfaceVariant,
                        fontSize: typography.labelSm.fontSize,
                        fontWeight: '500',
                        marginTop: -2,
                        fontFamily: typography.labelSm.fontFamily,
                    }}
                >
                    {cfg.label}
                </Text>
            </View>
        </View>
    )
}
