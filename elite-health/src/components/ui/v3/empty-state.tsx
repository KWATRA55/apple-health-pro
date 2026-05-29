/**
 * EmptyState — Displayed when no data is available for a section.
 *
 * Renders a labeled card with an icon and message.
 * All styling from stitch-tokens.ts.
 */

import React from 'react'
import { View, Text, ViewStyle } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'
import EliteCard from './elite-card'

type EmptyStateProps = {
    icon?: string
    title: string
    subtitle?: string
    action?: React.ReactNode
    style?: ViewStyle
}

export default function EmptyState({
    icon = '○',
    title,
    subtitle,
    action,
    style,
}: EmptyStateProps) {
    return (
        <EliteCard
            style={[
                {
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 40,
                },
                style,
            ]}
        >
            <Text
                style={{
                    color: colors.dimText,
                    fontSize: 32,
                    marginBottom: 12,
                }}
            >
                {icon}
            </Text>
            <Text
                style={{
                    color: colors.mutedText,
                    fontSize: typography.bodyMd.fontSize,
                    fontWeight: '600',
                    fontFamily: typography.bodyMd.fontFamily,
                    textAlign: 'center',
                }}
            >
                {title}
            </Text>
            {subtitle ? (
                <Text
                    style={{
                        color: colors.dimText,
                        fontSize: typography.bodySm.fontSize,
                        fontFamily: typography.bodySm.fontFamily,
                        textAlign: 'center',
                        marginTop: 4,
                    }}
                >
                    {subtitle}
                </Text>
            ) : null}
            {action ? (
                <View style={{ marginTop: 16 }}>{action}</View>
            ) : null}
        </EliteCard>
    )
}
