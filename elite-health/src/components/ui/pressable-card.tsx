import React, { useCallback } from 'react'
import { Pressable, PressableProps, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

interface PressableCardProps extends PressableProps {
  children: React.ReactNode
  className?: string
  onPressIn?: () => void
  onPressOut?: () => void
  haptic?: 'light' | 'medium' | 'heavy' | 'none'
  scaleTo?: number
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PressableCard({
  children,
  className = '',
  onPress,
  onPressIn: onPressInProp,
  onPressOut: onPressOutProp,
  haptic = 'light',
  scaleTo = 0.97,
  style,
  ...props
}: PressableCardProps) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const triggerHaptic = useCallback(() => {
    if (haptic === 'none') return
    if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (haptic === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  }, [haptic])

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleTo, { damping: 15, stiffness: 300 })
    opacity.value = withTiming(0.85, { duration: 80 })
    triggerHaptic()
    onPressInProp?.()
  }, [scaleTo])

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 250 })
    opacity.value = withTiming(1, { duration: 150 })
    onPressOutProp?.()
  }, [])

  const animatedStyle = useAnimatedStyle((): ViewStyle => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style as ViewStyle]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  )
}
