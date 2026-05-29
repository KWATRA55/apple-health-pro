/**
 * EliteHeader — Standard V3 screen header.
 *
 * Renders title + optional subtitle + optional right accessory.
 * All styling comes from stitch-tokens.ts (no inline token objects).
 */

import React from 'react'
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type EliteHeaderProps = {
    title: string
    subtitle?: string
    /** Right-side accessory (e.g., settings gear, calendar icon) */
    rightAccessory?: React.ReactNode
    /** Called when the right accessory is pressed */
    onRightPress?: () => void
    /** Extra container style */
    style?: ViewStyle
}

export default function EliteHeader({
    title,
    subtitle,
    rightAccessory,
    onRightPress,
    style,
}: EliteHeaderProps) {
    return (
        <View
            style={[
                {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                },
                style,
            ]}
        >
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        color: colors.onSurface,
                        fontSize: typography.headlineLg.fontSize,
                        fontWeight: typography.headlineLg.fontWeight,
                        lineHeight: typography.headlineLg.lineHeight * typography.headlineLg.fontSize,
                        letterSpacing: typography.headlineLg.letterSpacing,
                        fontFamily: typography.headlineLg.fontFamily,
                    }}
                >
                    {title}
                </Text>
                {subtitle ? (
                    <Text
                        style={{
                            color: colors.dimText,
                            fontSize: typography.bodySm.fontSize,
                            marginTop: 2,
                            fontFamily: typography.bodySm.fontFamily,
                        }}
                    >
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            {rightAccessory ? (
                <TouchableOpacity onPress={onRightPress} activeOpacity={0.7}>
                    {rightAccessory}
                </TouchableOpacity>
            ) : null}
        </View>
    )
}
