/**
 * LiveIndicator — Pulsing dot + "LIVE" label for workout sessions.
 *
 * Uses the success/green color with continuous pulse animation.
 */

import React, { useEffect, useRef } from 'react'
import { View, Text, Animated } from 'react-native'
import { colors, typography } from '../../../theme/stitch-tokens'

type LiveIndicatorProps = {
    label?: string
}

export default function LiveIndicator({ label = 'LIVE' }: LiveIndicatorProps) {
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
        outputRange: [0.4, 1],
    })

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Animated.View
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.success,
                    opacity,
                }}
            />
            <Text
                style={{
                    color: colors.success,
                    fontSize: typography.labelSm.fontSize,
                    fontWeight: '700',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    fontFamily: typography.labelSm.fontFamily,
                }}
            >
                {label}
            </Text>
        </View>
    )
}
