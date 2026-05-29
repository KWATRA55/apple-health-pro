/**
 * ErrorState — Displayed when a data fetch or computation fails.
 *
 * Renders an error card with retry action.
 * All styling from stitch-tokens.ts.
 */

import React from 'react'
import { View, Text, ViewStyle } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'
import EliteCard from './elite-card'
import GlassButton from './glass-button'

type ErrorStateProps = {
    /** Error message */
    message: string
    /** Retry callback (renders a "Retry" button if provided) */
    onRetry?: () => void
    /** Custom retry label */
    retryLabel?: string
    style?: ViewStyle
}

export default function ErrorState({
    message,
    onRetry,
    retryLabel = 'Retry',
    style,
}: ErrorStateProps) {
    return (
        <EliteCard
            style={[
                {
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 40,
                    borderColor: colors.errorDisplay + '30',
                },
                style,
            ]}
        >
            <Text
                style={{
                    color: colors.errorDisplay,
                    fontSize: 24,
                    marginBottom: 12,
                }}
            >
                ⚠
            </Text>
            <Text
                style={{
                    color: colors.mutedText,
                    fontSize: typography.bodyMd.fontSize,
                    fontWeight: '600',
                    fontFamily: typography.bodyMd.fontFamily,
                    textAlign: 'center',
                    marginBottom: 4,
                }}
            >
                Something went wrong
            </Text>
            <Text
                style={{
                    color: colors.dimText,
                    fontSize: typography.bodySm.fontSize,
                    fontFamily: typography.bodySm.fontFamily,
                    textAlign: 'center',
                }}
            >
                {message}
            </Text>
            {onRetry ? (
                <View style={{ marginTop: 16 }}>
                    <GlassButton
                        label={retryLabel}
                        onPress={onRetry}
                        variant="secondary"
                    />
                </View>
            ) : null}
        </EliteCard>
    )
}
