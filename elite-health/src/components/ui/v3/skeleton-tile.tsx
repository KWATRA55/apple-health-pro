/**
 * SkeletonTile — Placeholder shimmer for loading states.
 *
 * Renders a pulse-animated rectangle matching EliteCard proportions.
 * Inherits glass styling from stitch-tokens.
 */

import React, { useEffect, useRef } from 'react'
import { View, Animated } from 'react-native'
import { colors, radius } from '../../../theme/stitch-tokens'

type SkeletonTileProps = {
    width?: number | string
    height?: number
    borderRadius?: number
    /** Number of skeleton lines below the tile (e.g., for text placeholders) */
    lines?: number
}

function SkeletonBlock({ width, height, borderRadius }: {
    width: number | string
    height: number
    borderRadius: number
}) {
    const anim = useRef(new Animated.Value(0)).current

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        )
        loop.start()
        return () => loop.stop()
    }, [anim])

    const opacity = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.6],
    })

    return (
        <Animated.View
            style={{
                width: width as any,
                height,
                borderRadius,
                backgroundColor: colors.glass,
                opacity,
            }}
        />
    )
}

export default function SkeletonTile({
    width = '100%',
    height = 120,
    borderRadius = radius.md,
    lines = 0,
}: SkeletonTileProps) {
    return (
        <View style={{ marginBottom: 16 }}>
            <SkeletonBlock width={width} height={height} borderRadius={borderRadius} />
            {lines > 0 ? (
                <View style={{ marginTop: 8, gap: 6 }}>
                    {Array.from({ length: lines }).map((_, i) => (
                        <SkeletonBlock
                            key={i}
                            width={i === lines - 1 ? '60%' : '100%'}
                            height={10}
                            borderRadius={4}
                        />
                    ))}
                </View>
            ) : null}
        </View>
    )
}
