import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing } from 'react-native'
import { GlassCard } from '../ui/glass-card'

interface DailyDirectiveProps {
  headline?: string
  command?: string
}

export const DailyDirective = React.memo(function DailyDirective({
  headline = 'DAILY DIRECTIVE',
  command = 'Analyzing your biometrics to generate your coaching directive...'
}: DailyDirectiveProps) {
  const slideUp = useRef(new Animated.Value(20)).current
  const fadeIn = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()
  }, [command])

  return (
    <Animated.View
      className="mb-6"
      style={{
        opacity: fadeIn,
        transform: [{ translateY: slideUp }],
      }}
    >
      <GlassCard className="relative overflow-hidden pl-5" glow>
        <View className="absolute left-0 top-0 bottom-0 w-[4px] bg-accent-volt rounded-full" />

        <Text className="text-micro text-steel uppercase tracking-[0.12em] mb-2 font-bold">
          {headline}
        </Text>
        <Text className="text-body text-ice font-medium leading-relaxed">
          {command}
        </Text>
      </GlassCard>
    </Animated.View>
  )
});
