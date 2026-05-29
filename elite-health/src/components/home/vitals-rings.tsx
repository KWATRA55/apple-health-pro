import React from 'react'
import { View, Text } from 'react-native'
import { Ring } from '../ui/ring'
import { GlassCard } from '../ui/glass-card'
import { PressableCard } from '../ui/pressable-card'
import type { SynthesisOutput } from '../../lib/types'
import { formatScore } from '../../lib/utils/display-helpers'

interface PerformanceRingRowProps {
  synthesis: SynthesisOutput | null
  onPressRecovery?: () => void
  onPressSleep?: () => void
  onPressStrain?: () => void
}

// [CANONICAL] Receives synthesis via props from parent screens.
// Parent sources synthesis from selectLatestScores() canonical selector.
// Uses formatScore() for canonical integer display of pillar scores.
export const PerformanceRingRow = React.memo(function PerformanceRingRow({ synthesis, onPressRecovery, onPressSleep, onPressStrain }: PerformanceRingRowProps) {
  const hasSynthesis = synthesis !== null && synthesis !== undefined
  const readiness = hasSynthesis ? (synthesis.readiness?.score ?? 0) : 0
  const resilience = hasSynthesis ? (synthesis.resilience?.score ?? 0) : 0
  const longevity = hasSynthesis ? (synthesis.longevity?.score ?? 0) : 0

  const readinessZone = hasSynthesis ? (synthesis.readiness?.zoneLabel ?? '...') : 'NO DATA'
  const resilienceZone = hasSynthesis ? (synthesis.resilience?.zoneLabel ?? '...') : 'NO DATA'
  const longevityZone = hasSynthesis ? (synthesis.longevity?.zoneLabel ?? '...') : 'NO DATA'

  const readinessValue = formatScore(readiness)
  const resilienceValue = formatScore(resilience)
  const longevityValue = formatScore(longevity)

  return (
    <View className="flex-row justify-evenly items-center py-4">
      <PressableCard onPress={onPressRecovery} haptic="medium" className="items-center" scaleTo={0.92}>
        <Ring
          percentage={readiness}
          size={88}
          strokeWidth={6}
          color={hasSynthesis ? "#14B8A6" : "rgba(255,255,255,0.1)"}
          label="Recovery"
          value={readinessValue}
          sublabel={readinessZone}
          zoneBadgeColor={hasSynthesis ? "#14B8A6" : "rgba(255,255,255,0.15)"}
        />
      </PressableCard>

      <PressableCard onPress={onPressStrain} haptic="medium" className="items-center" scaleTo={0.92}>
        <Ring
          percentage={resilience}
          size={88}
          strokeWidth={6}
          color={hasSynthesis ? "#0A84FF" : "rgba(255,255,255,0.1)"}
          label="Resilience"
          value={resilienceValue}
          sublabel={resilienceZone}
          zoneBadgeColor={hasSynthesis ? "#0A84FF" : "rgba(255,255,255,0.15)"}
        />
      </PressableCard>

      <PressableCard onPress={onPressSleep} haptic="medium" className="items-center" scaleTo={0.92}>
        <Ring
          percentage={longevity}
          size={88}
          strokeWidth={6}
          color={hasSynthesis ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.1)"}
          label="Longevity"
          value={longevityValue}
          sublabel={longevityZone}
          zoneBadgeColor={hasSynthesis ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.15)"}
        />
      </PressableCard>
    </View>
  )
});

export const ActivityTimeline = React.memo(function ActivityTimeline({
  activities,
  displayDate = 'Today',
}: {
  activities: { workoutType: string; strainScore: number | null; durationMins: number; activeCalories: number }[]
  displayDate?: string
}) {
  if (activities.length === 0) {
    return (
      <GlassCard>
        <Text className="text-secondary-text text-micro uppercase tracking-[0.10em] mb-2 font-bold">{displayDate}'s Workouts</Text>
        <Text className="text-tertiary-text text-small font-medium">No workouts logged</Text>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="mt-4">
      <Text className="text-secondary-text text-[11px] uppercase tracking-[0.12em] mb-4 font-semibold">{displayDate}'s Workouts</Text>
      {activities.slice(0, 5).map((a, i) => (
        <View
          key={i}
          className={`flex-row items-center justify-between py-3 ${i > 0 ? 'border-t border-border-dim' : ''}`}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-[3px] h-10 rounded-full bg-data-blue/60" />
            <View>
              <Text className="text-primary-text font-bold text-body">{a.workoutType}</Text>
              <Text className="text-secondary-text text-small">
                {a.durationMins} min · {a.activeCalories} cal
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-data-blue font-black text-body">{a.strainScore?.toFixed(1) ?? '--'}</Text>
            <Text className="text-secondary-text text-micro font-bold uppercase">Strain</Text>
          </View>
        </View>
      ))}
    </GlassCard>
  )
});
