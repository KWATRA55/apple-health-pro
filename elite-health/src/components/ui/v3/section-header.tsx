/**
 * SectionHeader — Label + optional accent dot + optional info button.
 *
 * Used across all V3 screens to title card sections.
 */

import React from 'react'
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type SectionHeaderProps = {
    label: string
    /** Optional accent color for the leading dot */
    accent?: string
    /** Optional info-press callback (renders ⓘ button) */
    onInfoPress?: () => void
    /** Extra container style */
    style?: ViewStyle
}

export default function SectionHeader({
    label,
    accent,
    onInfoPress,
    style,
}: SectionHeaderProps) {
    return (
        <View
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                },
                style,
            ]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {accent ? (
                    <View
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: accent,
                        }}
                    />
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
            {onInfoPress ? (
                <TouchableOpacity
                    onPress={onInfoPress}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text
                        style={{
                            color: colors.mutedText,
                            fontSize: 14,
                            fontWeight: '600',
                        }}
                    >
                        ⓘ
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    )
}
