import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import type { SynthesisOutput, VitalsRecord, DailyScores } from '../../lib/types'
import {
  safeSpO2,
  safeRHR,
  safeHRV,
  safeRespiratoryRate,
  safeSkinTempDelta,
  safeStrainScore,
  safePaceOfAging,
} from '../../lib/utils/display-helpers'

interface DataGridProps {
  synthesis: SynthesisOutput | null
  vitals: VitalsRecord | null
  scores: DailyScores | null
}

export const DataGrid = React.memo(function DataGrid({ synthesis, vitals, scores }: DataGridProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    })
  }, [synthesis])

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: (1 - progress.value) * 15,
      },
    ],
  }))

  if (!synthesis || !scores) return null

  // Health Monitor calculations — use safe guards to avoid counting invalid/zero values
  const spo2Safe = vitals ? safeSpO2(vitals.spo2) : null
  const rhrSafe = vitals ? safeRHR(vitals.rhr) : null
  const hrvSafe = vitals ? safeHRV(vitals.hrv) : null
  const respSafe = vitals ? safeRespiratoryRate(vitals.respiratoryRate) : null
  const tempSafe = vitals ? safeSkinTempDelta(vitals.skinTempDelta) : null

  const metricsInRange = [
    spo2Safe !== null && spo2Safe >= 95,
    rhrSafe !== null && rhrSafe >= 40 && rhrSafe <= 80,
    hrvSafe !== null && hrvSafe > 20,
    respSafe !== null && respSafe > 8 && respSafe < 25,
    tempSafe !== null && Math.abs(tempSafe) < 2,
  ].filter(Boolean).length

  // Stress Monitor calculations — show nothing when data is missing
  const paceOfAging = safePaceOfAging(scores.paceOfAging)
  const strainScore = safeStrainScore(scores.strainScore)
  const hasValidStressData = paceOfAging !== null && strainScore !== null

  let stressLabel = 'Balanced'
  let stressColor = '#FFD60A'
  if (paceOfAging !== null && paceOfAging < 1.0) {
    stressLabel = 'Low'
    stressColor = '#7ad7c6'
  } else if (paceOfAging !== null && paceOfAging >= 1.1) {
    stressLabel = 'High'
    stressColor = '#FF453A'
  }

  return (
    <Animated.View style={[animStyle]} className="flex-row gap-3 mb-4">
      {/* Left Card — Health Check */}
      <View className="flex-1 bg-surface-glass border border-edge-border rounded-[20px] p-4 min-h-[130px] justify-between">
        <Text className="text-[rgba(255,255,255,0.50)] text-[11px] font-semibold tracking-[0.08em] uppercase">
          Health Check
        </Text>
        <View className="flex-row items-center gap-2 my-2">
          <Text style={{ color: '#7ad7c6', fontSize: 22 }}>✓</Text>
          <Text className="text-white text-[26px] font-bold">{metricsInRange}/5</Text>
        </View>
        <View>
          <Text className="text-[rgba(255,255,255,0.40)] text-[11px] uppercase tracking-[0.06em] mb-0.5">Metrics OK</Text>
          <Text className="text-[rgba(255,255,255,0.28)] text-[9px]" numberOfLines={2}>
            {metricsInRange === 5 ? 'All vitals in healthy range' : `${5 - metricsInRange} need attention`}
          </Text>
        </View>
      </View>

      {/* Right Card — Body Stress */}
      <View className="flex-1 bg-surface-glass border border-edge-border rounded-[20px] p-4 min-h-[130px] justify-between">
        <Text className="text-[rgba(255,255,255,0.50)] text-[11px] font-semibold tracking-[0.08em] uppercase">
          Body Stress
        </Text>
        <View className="my-2">
          <Text className="text-white text-[26px] font-bold">
            {hasValidStressData ? `${paceOfAging!.toFixed(1)}x` : '--'}
          </Text>
        </View>
        <View>
          <Text
            className="text-[11px] uppercase tracking-[0.06em] font-semibold mb-0.5"
            style={{ color: hasValidStressData ? stressColor : 'rgba(255,255,255,0.28)' }}
          >
            {hasValidStressData ? stressLabel : 'No data'}
          </Text>
          <Text className="text-[rgba(255,255,255,0.28)] text-[9px]">
            {hasValidStressData
              ? `Today's workout load: ${strainScore!.toFixed(0)}`
              : 'Awaiting HealthKit sync'}
          </Text>
        </View>
      </View>
    </Animated.View>
  )
});
