import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

interface AuroraOrb {
  x: number
  y: number
  size: number
  color: string
  speed: number
  amplitude: number
}

const ORBS: AuroraOrb[] = [
  { x: 0.15, y: 0.1, size: 280, color: '#00E5FF', speed: 18000, amplitude: 40 },
  { x: 0.85, y: 0.25, size: 340, color: '#0D9488', speed: 22000, amplitude: 55 },
  { x: 0.25, y: 0.7, size: 260, color: '#1E3A8A', speed: 25000, amplitude: 35 },
  { x: 0.7, y: 0.8, size: 300, color: '#00E5FF', speed: 20000, amplitude: 45 },
  { x: 0.5, y: 0.5, size: 350, color: '#020617', speed: 30000, amplitude: 20 },
]

const OrbAnim = React.memo(function OrbAnim({ orb }: { orb: AuroraOrb }) {
  const driftX = useSharedValue(0)
  const driftY = useSharedValue(0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    driftX.value = withRepeat(
      withTiming(1, { duration: orb.speed, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    )
    driftY.value = withRepeat(
      withTiming(1, { duration: orb.speed * 1.3, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    )
    pulse.value = withRepeat(
      withTiming(1.08, { duration: orb.speed * 0.7, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    )
    return () => {
      cancelAnimation(driftX)
      cancelAnimation(driftY)
      cancelAnimation(pulse)
    }
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.04,
    transform: [
      { translateX: driftX.value * orb.amplitude },
      { translateY: driftY.value * orb.amplitude },
      { scale: pulse.value },
    ],
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: orb.x * SCREEN_W - orb.size / 2,
          top: orb.y * SCREEN_H - orb.size / 2,
          width: orb.size,
          height: orb.size,
          borderRadius: orb.size / 2,
          backgroundColor: orb.color,
        },
        animStyle,
      ]}
    />
  )
})

export function AuroraCanvas({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: '#000000' }}>{children}</View>
}

// Keep the old component around as a pass-through in case it's still imported directly
export function AuroraBackground({
  children,
}: {
  children?: React.ReactNode
}) {
  return <AuroraCanvas>{children}</AuroraCanvas>
}
