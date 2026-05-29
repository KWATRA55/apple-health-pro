/**
 * EliteCard — Canonical glass panel for V3 (replaces all ad-hoc GlassPanel definitions).
 *
 * Use this everywhere instead of defining local GlassPanel components.
 * Supports 'default' and 'strong' border variants.
 */

import React from 'react'
import { View, ViewStyle, StyleProp } from 'react-native'
import { colors, radius, glassPanel, glassPanelStrong } from '../../../theme/stitch-tokens'

type EliteCardVariant = 'default' | 'strong'

type EliteCardProps = {
    children: React.ReactNode
    /** Border strength variant */
    variant?: EliteCardVariant
    /** Extra style overrides */
    style?: StyleProp<ViewStyle>
    /** Inner padding (default: 20) */
    padding?: number
}

export default function EliteCard({
    children,
    variant = 'default',
    style,
    padding = 20,
}: EliteCardProps) {
    const preset = variant === 'strong' ? glassPanelStrong : glassPanel

    return (
        <View
            style={[
                {
                    backgroundColor: preset.backgroundColor,
                    borderWidth: preset.borderWidth,
                    borderColor: preset.borderColor,
                    borderRadius: preset.borderRadius,
                    padding,
                },
                style,
            ]}
        >
            {children}
        </View>
    )
}
