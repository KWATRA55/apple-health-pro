/**
 * EliteScreen — Root wrapper for every V3 screen.
 *
 * Provides OLED black background, SafeAreaView, and optional ScrollView.
 * Import `stitch-tokens.ts` for colors, never inline them.
 *
 * @example
 *   <EliteScreen scrollable>
 *     <EliteHeader title="Home" />
 *     ...
 *   </EliteScreen>
 */

import React from 'react'
import { ScrollView, View, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../../theme/stitch-tokens'

type EliteScreenProps = {
    children: React.ReactNode
    /** Wrap children in a ScrollView (default: false) */
    scrollable?: boolean
    /** Extra content container style */
    contentStyle?: ViewStyle
    /** SafeAreaView edges */
    edges?: ('top' | 'bottom' | 'left' | 'right')[]
}

export default function EliteScreen({
    children,
    scrollable = false,
    contentStyle,
    edges = ['top'],
}: EliteScreenProps) {
    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: colors.bg }}
            edges={edges}
        >
            {scrollable ? (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[
                        {
                            paddingHorizontal: 20,
                            paddingBottom: 120,
                            paddingTop: 12,
                        },
                        contentStyle,
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {children}
                </ScrollView>
            ) : (
                <View style={[{ flex: 1, paddingHorizontal: 20 }, contentStyle]}>
                    {children}
                </View>
            )}
        </SafeAreaView>
    )
}
