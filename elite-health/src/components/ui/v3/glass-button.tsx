/**
 * GlassButton — Stitch-style glass button with primary/secondary/danger variants.
 *
 * Consistent touch target with haptic-adjacent styling.
 */

import React from 'react'
import {
    TouchableOpacity,
    Text,
    ViewStyle,
    TextStyle,
} from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type GlassButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type GlassButtonProps = {
    label: string
    onPress: () => void
    variant?: GlassButtonVariant
    disabled?: boolean
    icon?: string
    style?: ViewStyle
    textStyle?: TextStyle
}

export default function GlassButton({
    label,
    onPress,
    variant = 'primary',
    disabled = false,
    icon,
    style,
    textStyle,
}: GlassButtonProps) {
    const isGhost = variant === 'ghost'

    const bgMap: Record<GlassButtonVariant, string> = {
        primary: colors.primaryFixedDim + '22',
        secondary: colors.glass,
        danger: colors.errorDisplay + '22',
        ghost: 'transparent',
    }

    const borderMap: Record<GlassButtonVariant, string> = {
        primary: colors.primaryFixedDim + '55',
        secondary: colors.border,
        danger: colors.errorDisplay + '44',
        ghost: 'transparent',
    }

    const textColorMap: Record<GlassButtonVariant, string> = {
        primary: colors.primaryFixedDim,
        secondary: colors.onSurface,
        danger: colors.errorDisplay,
        ghost: colors.mutedText,
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: bgMap[variant],
                    borderWidth: isGhost ? 0 : 1,
                    borderColor: borderMap[variant],
                    borderRadius: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    opacity: disabled ? 0.4 : 1,
                },
                style,
            ]}
        >
            {icon ? (
                <Text style={{ fontSize: 16, color: textColorMap[variant] }}>
                    {icon}
                </Text>
            ) : null}
            <Text
                style={[
                    {
                        color: textColorMap[variant],
                        fontSize: typography.bodyMd.fontSize,
                        fontWeight: '600',
                        fontFamily: typography.bodyMd.fontFamily,
                    },
                    textStyle,
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    )
}
