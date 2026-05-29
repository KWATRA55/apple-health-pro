import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import type { PillarScore } from '../../lib/types'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { formatScore } from '../../lib/utils/display-helpers'

interface PillarCardProps {
  pillar: PillarScore
  onPress?: () => void
  size?: 'sm' | 'md' | 'lg'
}

const CIRCLE_COLORS: Record<string, string> = {
  readiness: '#7ad7c6', // primary-fixed-dim
  resilience: '#c8c2e9', // secondary-fixed-dim
  longevity: '#00E5FF',  // custom cyan
}

const PILLAR_TYPE_MAP: Record<string, string> = {
  BODY: 'readiness',
  SHIELD: 'resilience',
  SPHERE: 'longevity',
}

export function PillarCard({ pillar, onPress, size = 'sm' }: PillarCardProps) {
  const scale = useSharedValue(1)

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => { scale.value = withTiming(0.96, { duration: 100, easing: Easing.out(Easing.cubic) }) }
  const handlePressOut = () => { scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }) }

  const pillarType = PILLAR_TYPE_MAP[pillar.icon] || 'readiness'
  const accentColor = CIRCLE_COLORS[pillarType]

  // Handle insufficient data state — use canonical formatScore for display
  const isInsufficient = pillar.zone === 'insufficient'
  const displayScore = formatScore(pillar.score)
  const scoreColor = isInsufficient ? 'rgba(255,255,255,0.3)' : '#ffffff'
  const accentColor_effective = isInsufficient ? 'rgba(255,255,255,0.15)' : accentColor
  // Ring still needs a numeric percentage for the SVG stroke, use 0 when insufficient
  const ringPercent = isInsufficient ? 0 : Math.round(Math.max(0, Math.min(100, pillar.score)))

  return (
    <Animated.View style={containerStyle}>
      <TouchableOpacity
        onPress={isInsufficient ? undefined : onPress}
        onPressIn={isInsufficient ? undefined : handlePressIn}
        onPressOut={isInsufficient ? undefined : handlePressOut}
        activeOpacity={isInsufficient ? 1 : 0.95}
        style={{
          backgroundColor: '#121214',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          padding: 16,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          opacity: isInsufficient ? 0.5 : 1,
        }}
      >
        {/* Label on top */}
        <Text style={{
          color: 'rgba(189,201,197,0.6)',
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}>
          {pillar.label}
        </Text>

        {/* Glowing Circle Ring with Score */}
        <View style={{
          position: 'relative',
          width: 56,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Svg style={{ position: 'absolute', top: 0, left: 0 }} width="56" height="56" viewBox="0 0 36 36">
            <Circle cx="18" cy="18" r="15.9155" fill="none" stroke={`${accentColor}33`} strokeWidth="3" />
            <Circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke={accentColor_effective}
              strokeWidth="3"
              strokeDasharray={`${Math.max(0, Math.min(100, ringPercent))}, 100`}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
            />
          </Svg>
          <Text style={{
            color: scoreColor,
            fontSize: isInsufficient ? 16 : 24,
            fontWeight: '700',
            textShadowColor: 'rgba(255,255,255,0.3)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          }}>
            {displayScore}
          </Text>
        </View>

        {/* Zone Badge */}
        <Text style={{
          color: accentColor_effective,
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          {pillar.zoneLabel}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}
