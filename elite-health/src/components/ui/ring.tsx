import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'

interface RingProps {
  percentage: number
  size: number
  strokeWidth: number
  color: string
  label: string
  value: string
  sublabel?: string
  zoneBadgeColor?: string
}

export function Ring({
  percentage,
  size,
  strokeWidth,
  color,
  label,
  value,
  sublabel,
  zoneBadgeColor,
}: RingProps) {
  const animProgress = useRef(new Animated.Value(0)).current
  const fadeIn = useRef(new Animated.Value(0)).current

  useEffect(() => {
    fadeIn.setValue(0)
    animProgress.setValue(0)
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animProgress, {
        toValue: percentage,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start()
  }, [percentage])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const center = size / 2
  const AnimatedCircle = Animated.createAnimatedComponent(Circle)

  const strokeDashoffset = animProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  })

  return (
    <Animated.View
      style={{
        width: size,
        opacity: fadeIn,
        alignItems: 'center',
      }}
    >
      <View style={{ width: size, height: size }}>
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
        >
          {/* Track — barely visible grey arc */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Fill — solid stroke */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>

        {/* Center content */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{ fontSize: 24, letterSpacing: -0.04 * 24, color: '#FFFFFF', fontWeight: '900' }}
          >
            {value}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.12 * 11, marginTop: 8 }}>
        {label}
      </Text>
      
      {sublabel && (
        <View 
          style={{
            marginTop: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 9999,
            borderWidth: 1,
            backgroundColor: `${zoneBadgeColor || color}1F`, // 12% is approx 1F hex
            borderColor: `${zoneBadgeColor || color}00`, // no border actually requested, but good for structure if we want
          }}
        >
          <Text 
            style={{ color: zoneBadgeColor || color, fontSize: 9, fontWeight: '600', letterSpacing: 0.08 * 9, textTransform: 'uppercase' }}
          >
            {sublabel}
          </Text>
        </View>
      )}
    </Animated.View>
  )
}

interface EmissiveRingProps {
  percentage: number
  size: number
  strokeWidth: number
  startColor: string
  endColor: string
}

export function EmissiveRing({
  percentage,
  size,
  strokeWidth,
  startColor,
  endColor,
}: EmissiveRingProps) {
  const animProgress = useRef(new Animated.Value(0)).current
  const fadeIn = useRef(new Animated.Value(0)).current

  useEffect(() => {
    fadeIn.setValue(0)
    animProgress.setValue(0)
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animProgress, {
        toValue: percentage,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start()
  }, [percentage])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const center = size / 2
  const AnimatedCircle = Animated.createAnimatedComponent(Circle)

  const strokeDashoffset = animProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  })

  const gradientId = `grad-${startColor.replace('#', '')}-${endColor.replace('#', '')}`

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        opacity: fadeIn,
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={startColor} />
            <Stop offset="100%" stopColor={endColor} />
          </LinearGradient>
        </Defs>

        {/* Track — background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Glow Layer — thicker blurred/transparent stroke behind the main one */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth * 2.2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          opacity={0.15}
        />

        {/* Main Layer */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
    </Animated.View>
  )
}
