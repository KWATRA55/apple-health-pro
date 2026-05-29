import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated'
import { formatAge, safeNumber } from '../../lib/utils/display-helpers'

interface LongevitySphereProps {
  /** Pace of aging ratio: < 1.0 = aging slower than chronological, > 1.0 = aging faster */
  paceOfAging: number
  /** Calculated biological age */
  biologicalAge?: number
  /** Diameter of the sphere in points */
  size?: number
  /** When true, the values are fallback/defaults — overlay a truthfulness disclaimer */
  isFallback?: boolean
  /** Optional recency label (e.g. "Latest valid reading · 2d ago") */
  recencyLabel?: string
  /** 0–1 confidence based on how many biomarkers were usable */
  confidence?: number
  /** Which biomarker drove the result the most */
  primaryDriver?: string
}

interface SpherePalette {
  primary: string
  secondary: string
  glow: string
  label: string
  statusLabel: string
}

function derivePalette(pace: number): SpherePalette {
  if (pace < 0.92) return { primary: '#14B8A6', secondary: '#00E5FF', glow: 'rgba(0, 229, 255,', label: 'REVERSING', statusLabel: 'Rejuvenating' }
  if (pace < 0.98) return { primary: '#7ad7c6', secondary: '#a1cde3', glow: 'rgba(122, 215, 198,', label: 'OPTIMAL', statusLabel: 'Thriving' }
  if (pace < 1.03) return { primary: '#FFD60A', secondary: '#FFB800', glow: 'rgba(255, 214, 10,', label: 'STEADY', statusLabel: 'Maintaining' }
  if (pace < 1.08) return { primary: '#FF9F0A', secondary: '#FF453A', glow: 'rgba(255, 159, 10,', label: 'ELEVATED', statusLabel: 'Accelerating' }
  return { primary: '#FF453A', secondary: '#93000a', glow: 'rgba(255, 69, 58,', label: 'CRITICAL', statusLabel: 'At Risk' }
}

export const LongevitySphere = React.memo(function LongevitySphere({ paceOfAging, biologicalAge = 25, size = 256, isFallback = false, recencyLabel, confidence, primaryDriver }: LongevitySphereProps) {
  const palette = derivePalette(paceOfAging)
  const paceStr = safeNumber(paceOfAging, 2) + 'x'
  const bioAgeStr = `BIO AGE ${formatAge(biologicalAge)} YRS`

  // Breathing animation
  const breathe = useSharedValue(0)

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    )
  }, [])

  // Morph animation (border-radius morphing)
  const morph = useSharedValue(0)

  useEffect(() => {
    morph.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    )
  }, [])

  // Continuous subtle rotation
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [])

  // Outer glow layer
  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.35, 0.70]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.90, 1.16]) }],
  }))

  // Inner glow intensity
  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.20, 0.45]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.95, 1.08]) }],
  }))

  // Shadow beneath sphere
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.20, 0.45]),
    transform: [{ scaleX: interpolate(breathe.value, [0, 1], [0.65, 1.1]) }],
  }))

  // Rotation animation style for backgrounds
  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  // Morph border radius — simulates CSS border-radius morph
  const morphStyle = useAnimatedStyle(() => {
    const t = morph.value
    // Interpolate between two organic blob shapes with wider variance
    const topLeft = interpolate(t, [0, 0.33, 0.66, 1], [38, 75, 100, 38])
    const topRight = interpolate(t, [0, 0.33, 0.66, 1], [62, 25, 65, 62])
    const bottomRight = interpolate(t, [0, 0.33, 0.66, 1], [75, 40, 65, 75])
    const bottomLeft = interpolate(t, [0, 0.33, 0.66, 1], [25, 60, 100, 25])

    return {
      borderTopLeftRadius: `${topLeft}%`,
      borderTopRightRadius: `${topRight}%`,
      borderBottomRightRadius: `${bottomRight}%`,
      borderBottomLeftRadius: `${bottomLeft}%`,
    }
  })

  const sphereDiameter = size * 0.75
  const glowDiameter = size * 0.88
  const innerGlowDiameter = size * 0.62

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginVertical: 12 }}>
      {/* Ethereal background aura */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `${palette.glow} 0.08)`,
          },
          outerGlowStyle,
        ]}
      />

      {/* Bottom shadow */}
      {/* Bottom reflection — subtle, transparent, no opaque fill */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            bottom: size * 0.06,
            width: size * 0.5,
            height: size * 0.04,
            alignSelf: 'center',
            backgroundColor: 'transparent',
            borderRadius: size * 0.02,
            shadowColor: palette.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 16,
            shadowOpacity: 0.25,
            elevation: 4,
          },
          shadowStyle,
        ]}
      />

      {/* Main sphere container with layer stacking */}
      <View style={{ width: glowDiameter, height: glowDiameter, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer breathing glow ring */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: glowDiameter,
              height: glowDiameter,
              borderRadius: glowDiameter / 2,
              borderWidth: 1.5,
              borderColor: `${palette.secondary}44`,
              backgroundColor: `${palette.secondary}0D`,
            },
            outerGlowStyle,
          ]}
        />

        {/* Procedural sphere body */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: sphereDiameter,
              height: sphereDiameter,
              backgroundColor: palette.primary,
              // Simulate sphere-base-cyan radial gradient via stacked layers
              shadowColor: palette.secondary,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 36,
              shadowOpacity: 0.6,
              elevation: 12,
              // Inner shadow simulation with border
              borderWidth: 0.5,
              borderColor: `${palette.secondary}55`,
              overflow: 'hidden',
            },
            morphStyle,
          ]}
        >
          {/* Rotating procedural background layer */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: '-20%',
                left: '-20%',
                right: '-20%',
                bottom: '-20%',
                borderRadius: 1000,
                backgroundColor: palette.primary,
              },
              rotationStyle,
            ]}
          >
            {/* Inner highlight (simulated radial gradient highlight) */}
            <View
              style={{
                position: 'absolute',
                top: '15%',
                left: '20%',
                width: '50%',
                height: '45%',
                borderRadius: 100,
                backgroundColor: `${palette.secondary}55`,
                shadowColor: palette.secondary,
                shadowOffset: { width: 0, height: 0 },
                shadowRadius: 24,
                shadowOpacity: 0.5,
                elevation: 4,
              }}
            />
            {/* Lower dark area (simulated gradient dark at bottom) */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                backgroundColor: 'rgba(0,0,0,0.50)',
                borderBottomLeftRadius: 1000,
                borderBottomRightRadius: 1000,
              }}
            />
            {/* Secondary highlight */}
            <View
              style={{
                position: 'absolute',
                bottom: '20%',
                right: '15%',
                width: '30%',
                height: '25%',
                borderRadius: 100,
                backgroundColor: `${palette.secondary}33`,
              }}
            />
          </Animated.View>
        </Animated.View>

        {/* Inner glow core */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: innerGlowDiameter,
              height: innerGlowDiameter,
              borderRadius: innerGlowDiameter / 2,
              backgroundColor: `${palette.secondary}22`,
            },
            innerGlowStyle,
          ]}
        />

        {/* Text content */}
        <View style={{ zIndex: 10, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: size * 0.17,
              fontWeight: '900',
              letterSpacing: -1.5,
              textShadowColor: `${palette.secondary}CC`,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 20,
            }}
          >
            {paceStr}
          </Text>
          <Text
            style={{
              color: palette.secondary,
              fontSize: size * 0.038,
              fontWeight: '700',
              letterSpacing: 2,
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            Pace of Aging
          </Text>
          <View style={{
            marginTop: 6,
            backgroundColor: 'rgba(0,0,0,0.4)',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: size * 0.032,
                fontWeight: '800',
                letterSpacing: 0.5,
              }}
            >
              {bioAgeStr}
            </Text>
          </View>
        </View>
      </View>

      {/* Status label below sphere */}
      <Text
        style={{
          color: palette.primary,
          fontSize: size * 0.058,
          fontWeight: '800',
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginTop: size * 0.04,
          textShadowColor: `${palette.primary}55`,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        {palette.statusLabel}
      </Text>

      {/* Truthfulness overlay — shown when using fallback/default values */}
      {isFallback && (
        <View style={{ marginTop: 8, alignItems: 'center' }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 0.5,
              textAlign: 'center',
            }}
          >
            Awaiting recent longevity inputs
          </Text>
        </View>
      )}

      {/* Recency label — shown when value is from a prior date */}
      {!isFallback && recencyLabel && (
        <View style={{ marginTop: 8, alignItems: 'center' }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.30)',
              fontSize: 9,
              fontWeight: '500',
              letterSpacing: 0.3,
            }}
          >
            {recencyLabel}
          </Text>
        </View>
      )}

      {/* Confidence + driver metadata — shown when real data is present */}
      {!isFallback && confidence != null && (
        <View style={{ marginTop: 6, alignItems: 'center', flexDirection: 'row', gap: 6 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.30)',
              fontSize: 9,
              fontWeight: '500',
              letterSpacing: 0.3,
            }}
          >
            {Math.round(confidence * 100)}% confidence
          </Text>
          {primaryDriver && (
            <>
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.30)',
                  fontSize: 9,
                  fontWeight: '500',
                  letterSpacing: 0.3,
                }}
              >
                Driven by {primaryDriver}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  )
})
