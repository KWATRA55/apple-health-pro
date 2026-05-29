/**
 * SphereMetricHero — Full-screen sphere hero for the Home Dashboard.
 *
 * The LongevitySphere replacement: a large glowing orb with a score,
 * designed according to the Stitch home-dashboard reference.
 */

import React from 'react'
import { View, Text } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type SphereMetricHeroProps = {
    value: number | string
    label: string
    sublabel?: string
    /** Pillar color (default: longevity cyan) */
    color?: string
    /** Glow color (default: tertiary-fixed-dim) */
    glowColor?: string
    /** Size in px (default: 280) */
    size?: number
    dimmed?: boolean
}

export default function SphereMetricHero({
    value,
    label,
    sublabel,
    color = colors.pillarLongevity,
    glowColor = colors.tertiaryFixedDim,
    size = 280,
    dimmed = false,
}: SphereMetricHeroProps) {
    return (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: `${glowColor}15`,
                    borderWidth: 1,
                    borderColor: `${glowColor}30`,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {/* Inner glow ring */}
                <View
                    style={{
                        width: size * 0.78,
                        height: size * 0.78,
                        borderRadius: (size * 0.78) / 2,
                        backgroundColor: `${glowColor}08`,
                        borderWidth: 1,
                        borderColor: `${glowColor}20`,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: dimmed ? colors.dimText : color,
                            fontSize: typography.metricXl.fontSize * 0.95,
                            fontWeight: typography.metricXl.fontWeight,
                            letterSpacing: typography.metricXl.letterSpacing,
                            fontFamily: typography.metricXl.fontFamily,
                        }}
                    >
                        {value}
                    </Text>
                </View>
            </View>
            <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Text
                    style={{
                        color: colors.onSurface,
                        fontSize: typography.headlineMd.fontSize,
                        fontWeight: typography.headlineMd.fontWeight,
                        fontFamily: typography.headlineMd.fontFamily,
                    }}
                >
                    {label}
                </Text>
                {sublabel ? (
                    <Text
                        style={{
                            color: colors.dimText,
                            fontSize: typography.bodySm.fontSize,
                            marginTop: 4,
                            fontFamily: typography.bodySm.fontFamily,
                        }}
                    >
                        {sublabel}
                    </Text>
                ) : null}
            </View>
        </View>
    )
}
