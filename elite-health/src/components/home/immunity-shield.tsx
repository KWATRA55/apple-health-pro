import React from 'react'
import { View, Text } from 'react-native'
import { GlassCard } from '../ui/glass-card'
import type { ImmunityRisk } from '../../lib/algorithms/illness-predictor'

interface ImmunityShieldProps {
  risk: ImmunityRisk
  explanation: string
}

// [CANONICAL-TODO] This component receives immunity risk via props from parent screens.
// Parent should source risk from illness predictor using canonical vitals/scores selectors.
export function ImmunityShield({ risk, explanation }: ImmunityShieldProps) {
  if (risk === 'LOW') return null // Don't show if there's no risk

  const isHigh = risk === 'HIGH'
  const colorClass = isHigh ? 'bg-accent-crimson' : 'bg-accent-amber'
  const textColor = isHigh ? 'text-accent-crimson' : 'text-accent-amber'
  const bgClass = isHigh ? 'bg-accent-crimson/15' : 'bg-accent-amber/15'
  const borderClass = isHigh ? 'border-accent-crimson/30' : 'border-accent-amber/30'

  return (
    <View className="mb-6">
      <GlassCard className="relative overflow-hidden pl-5">
        <View className={`absolute left-0 top-0 bottom-0 w-[4px] rounded-full ${colorClass}`} />

        <View className="flex-row items-center mb-1">
          <Text className={`text-micro uppercase font-bold tracking-widest mr-2 ${textColor}`}>
            ⚠️ ILLNESS PREDICTOR
          </Text>
          <View className={`px-2 py-0.5 rounded-pill ${isHigh ? 'bg-accent-crimson/20' : 'bg-accent-amber/20'}`}>
            <Text className={`text-[9px] font-bold ${textColor}`}>
              {risk} RISK
            </Text>
          </View>
        </View>

        <Text className="text-small text-ice leading-tight mt-1">
          {explanation}
        </Text>
      </GlassCard>
    </View>
  )
}
