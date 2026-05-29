import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useHealthStore, computeSleepArchitecture } from '../../lib/store'
import { GlassCard } from '../ui/glass-card'
import { MetricSpline } from './spline-chart'
import { PerformanceRingRow } from './vitals-rings'

interface BentoGridProps {
  dateStr: string
  onPressSleep: () => void
  onPressRecovery: () => void
  onPressStrain: () => void
}

export function BentoGrid({
  dateStr,
  onPressSleep,
  onPressRecovery,
  onPressStrain,
}: BentoGridProps) {
  const {
    scores,
    vitals,
    sleep,
    mobility,
    environmental,
    cardioMetabolic,
    injuryRisk,
    cnsStressScore,
    isSyncing,
  } = useHealthStore()

  const currentScores = scores.find((s: any) => s.date === dateStr) || null
  const currentSleep = sleep.find((s: any) => s.date === dateStr) || null
  const currentMobility = mobility.find((m: any) => m.date === dateStr) || null
  const currentEnv = environmental.find((e: any) => e.date === dateStr) || null
  const currentCardio = cardioMetabolic.find((c: any) => c.date === dateStr) || null
  const currentVitals = vitals.find((v: any) => v.timestamp.startsWith(dateStr)) || null

  const sleepArch = computeSleepArchitecture(currentSleep)

  const isEmpty = (record: any) => record === null || record === undefined

  // Extract last 7 values of asymmetry for trend spline
  const asymmetryTrend = React.useMemo(() => {
    return mobility.slice().reverse().slice(-7).map((m: any) => m.walkingAsymmetry)
  }, [mobility])

  // Extract last 7 values of HRV for trend spline
  const hrvTrend = React.useMemo(() => {
    return vitals.slice().reverse().slice(-7).map((v: any) => v.hrv)
  }, [vitals])

  return (
    <View className="flex-col gap-4 mt-2">
      {/* 1. HERO - Interactive Vitals Rings */}
      <PerformanceRingRow
        synthesis={null}
        onPressRecovery={onPressRecovery}
        onPressSleep={onPressSleep}
        onPressStrain={onPressStrain}
      />

      {/* 2. WARNING BANNERS (Conditional, Full-Width) */}
      {currentScores && !isSyncing && injuryRisk && injuryRisk.risk !== 'LOW' && (
        <GlassCard className="bg-red-950/20 border-red-500/30 p-4">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-accent-crimson text-micro font-black tracking-wider uppercase">
              \u26A0\uFE0F INJURY BIOMECHANICS ALERT ({injuryRisk.risk})
            </Text>
            <Text className="text-steel text-[10px] font-mono">{injuryRisk.confidence}% Conf.</Text>
          </View>
          <Text className="text-white text-small font-bold">{injuryRisk.primaryMetric} Deviation</Text>
          <Text className="text-gray-400 text-micro mt-1">{injuryRisk.explanation}</Text>
        </GlassCard>
      )}

      {currentScores && !isSyncing && cnsStressScore && cnsStressScore.risk !== 'LOW' && (
        <GlassCard className="bg-amber-950/20 border-accent-amber/30 p-4">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-accent-amber text-micro font-black tracking-wider uppercase">
              \u26A1 CENTRAL NERVOUS SYSTEM ALERT ({cnsStressScore.risk})
            </Text>
            <Text className="text-steel text-[10px] font-mono">{cnsStressScore.confidence}% Conf.</Text>
          </View>
          <Text className="text-white text-small font-bold">Circadian & Autonomic Load</Text>
          <Text className="text-gray-400 text-micro mt-1">{cnsStressScore.explanation}</Text>
        </GlassCard>
      )}

      {/* TWO-COLUMN GRID */}
      <View className="flex-row gap-4">
        {/* Left Column */}
        <View className="flex-1 flex-col gap-4">

          {/* CARD A: Sleep Architecture */}
          {currentSleep && (
            <TouchableOpacity onPress={onPressSleep} activeOpacity={0.95}>
              <GlassCard className="h-[210px] justify-between">
                <View>
                  <Text className="text-micro text-steel uppercase tracking-wider font-bold mb-1">SLEEP ARCHITECTURE</Text>
                  <Text className="text-accent-cyan text-2xl font-bold tracking-tight">
                    {`${Math.floor(currentSleep.totalDurationMins / 60)}h ${currentSleep.totalDurationMins % 60}m`}
                  </Text>
                </View>

                <View className="my-2">
                  <View className="flex-row justify-between text-micro mb-1">
                    <Text className="text-gray-500 font-mono text-[9px]">DEEP</Text>
                    <Text className="text-accent-cyan font-mono text-[9px]">{currentSleep.deepMins > 0 ? `${currentSleep.deepMins}m` : '--'}m</Text>
                  </View>
                  <View className="flex-row justify-between text-micro mb-1">
                    <Text className="text-gray-500 font-mono text-[9px]">REM</Text>
                    <Text className="text-accent-cyan font-mono text-[9px]">{currentSleep.remMins > 0 ? `${currentSleep.remMins}m` : '--'}</Text>
                  </View>
                  <View className="flex-row justify-between text-micro">
                    <Text className="text-gray-500 font-mono text-[9px]">EFFICIENCY</Text>
                    <Text className="text-accent-volt font-mono text-[9px]">{sleepArch?.efficiencyPercent && sleepArch.efficiencyPercent > 0 ? `${sleepArch.efficiencyPercent}%` : '--'}</Text>
                  </View>
                </View>

                <Text className="text-[10px] text-gray-500 italic">
                  Sleep need: {currentSleep.sleepNeedHours > 0 ? `${currentSleep.sleepNeedHours}h` : '--'}
                </Text>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* CARD B: Cardio & Metabolic */}
          {!isEmpty(currentCardio) && (
            <GlassCard className="h-[230px] justify-between">
              <View>
                <Text className="text-micro text-steel uppercase tracking-wider font-bold mb-2">CARDIO-METABOLIC</Text>

                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-gray-500 text-small">VO2 Max</Text>
                  <Text className="text-white text-medium font-bold">{currentCardio?.vo2Max ?? 'No data'} <Text className="text-[10px] text-gray-500">ml/kg</Text></Text>
                </View>

                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-gray-500 text-small">Resting Energy</Text>
                  <Text className="text-white text-medium font-bold">{currentCardio?.restingEnergy ?? 'No data'} <Text className="text-[10px] text-gray-500">kcal</Text></Text>
                </View>

                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-gray-500 text-small">Physical Effort</Text>
                  <Text className="text-white text-medium font-bold">{currentCardio?.physicalEffort ?? 'No data'} <Text className="text-[10px] text-gray-500">MET</Text></Text>
                </View>

                <View className="flex-row justify-between items-baseline">
                  <Text className="text-gray-500 text-small">Walking HR</Text>
                  <Text className="text-white text-medium font-bold">{currentCardio?.walkingHRavg ? `${currentCardio.walkingHRavg} BPM` : 'No data'}</Text>
                </View>
              </View>
              <Text className="text-[9px] text-gray-600 font-mono">Real-time Watch Ultra Ingestion</Text>
            </GlassCard>
          )}

          {/* Fallback: no data in left column */}
          {isEmpty(currentSleep) && isEmpty(currentCardio) && (
            <GlassCard className="h-[230px] justify-center items-center">
              <Text className="text-smoke text-small">No sleep or cardio data for {dateStr}</Text>
            </GlassCard>
          )}
        </View>

        {/* Right Column */}
        <View className="flex-1 flex-col gap-4">

          {/* CARD C: Vitals Summary */}
          {!isEmpty(currentVitals) && (
            <TouchableOpacity onPress={onPressRecovery} activeOpacity={0.95}>
              <GlassCard className="h-[210px] justify-between">
                <View>
                  <Text className="text-micro text-steel uppercase tracking-wider font-bold mb-2">IMMUNOLOGICAL VITALS</Text>

                  <View className="flex-row justify-between items-baseline mb-1">
                    <Text className="text-gray-500 text-[10px]">HRV</Text>
                    <Text className="text-white text-small font-bold">{currentVitals?.hrv ?? 'No data'} <Text className="text-[9px] text-gray-500">ms</Text></Text>
                  </View>

                  <View className="flex-row justify-between items-baseline mb-1">
                    <Text className="text-gray-500 text-[10px]">RHR</Text>
                    <Text className="text-white text-small font-bold">{currentVitals?.rhr ?? 'No data'} <Text className="text-[9px] text-gray-500">bpm</Text></Text>
                  </View>

                  <View className="flex-row justify-between items-baseline mb-1">
                    <Text className="text-gray-500 text-[10px]">SpO2</Text>
                    <Text className="text-accent-volt text-small font-bold">{currentVitals?.spo2 ?? 'No data'} <Text className="text-[9px] text-gray-500">%</Text></Text>
                  </View>

                  <View className="flex-row justify-between items-baseline mb-1">
                    <Text className="text-gray-500 text-[10px]">Skin Temp</Text>
                    <Text className="text-white text-small font-bold">
                      {currentVitals?.skinTempDelta ? `${currentVitals.skinTempDelta > 0 ? '+' : ''}${currentVitals.skinTempDelta.toFixed(1)}\u00B0C` : 'No data'}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-baseline">
                    <Text className="text-gray-500 text-[10px]">Resp Rate</Text>
                    <Text className="text-white text-small font-bold">{currentVitals?.respiratoryRate ?? 'No data'}</Text>
                  </View>
                </View>
                <Text className="text-[9px] text-accent-cyan font-mono">Immunity Risk: {currentScores?.immunityRisk ?? 'No data'}</Text>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* CARD D: Environmental & Lifestyle */}
          {!isEmpty(currentEnv) && (
            <GlassCard className="h-[230px] justify-between">
              <View>
                <Text className="text-micro text-steel uppercase tracking-wider font-bold mb-2">ENVIRONMENTAL</Text>

                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-gray-500 text-small">Daylight</Text>
                  <Text className="text-accent-volt text-medium font-bold">{currentEnv?.timeInDaylight ?? 'No data'} <Text className="text-[10px] text-gray-500">min</Text></Text>
                </View>

                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-gray-500 text-small">Audio Load</Text>
                  <Text className="text-white text-medium font-bold">{currentEnv?.headphoneAudio ?? 'No data'} <Text className="text-[10px] text-gray-500">dB</Text></Text>
                </View>

                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-gray-500 text-small">Exercise</Text>
                  <Text className="text-white text-medium font-bold">{currentEnv?.exerciseMinutes ?? 'No data'} <Text className="text-[10px] text-gray-500">min</Text></Text>
                </View>

                <View className="flex-row justify-between items-baseline">
                  <Text className="text-gray-500 text-small">Stand Hours</Text>
                  <Text className="text-white text-medium font-bold">{currentEnv?.standHours ?? 'No data'} <Text className="text-[10px] text-gray-500">hrs</Text></Text>
                </View>
              </View>
              <Text className="text-[9px] text-gray-600 font-mono">Circadian circadian phase alignment</Text>
            </GlassCard>
          )}

          {/* Fallback: no data in right column */}
          {isEmpty(currentVitals) && isEmpty(currentEnv) && (
            <GlassCard className="h-[230px] justify-center items-center">
              <Text className="text-smoke text-small">No vitals or environmental data for {dateStr}</Text>
            </GlassCard>
          )}
        </View>
      </View>

      {/* 3. MOBILITY BENTO BOX (Full Width Trend) */}
      {!isEmpty(currentMobility) && (
        <GlassCard className="p-4">
          <View className="flex-row justify-between items-center mb-2">
            <View>
              <Text className="text-micro text-steel uppercase tracking-wider font-bold">BIOMECHANICAL MOBILITY</Text>
              <Text className="text-white text-2xl font-bold tracking-tight">
                {currentMobility!.steps.toLocaleString()} <Text className="text-xs text-gray-500 font-normal">steps</Text>
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] text-gray-500 font-mono">Asymmetry: {currentMobility!.walkingAsymmetry}%</Text>
              <Text className="text-[10px] text-gray-500 font-mono">Double Support: {currentMobility!.doubleSupport}%</Text>
            </View>
          </View>

          <View className="flex-row justify-between gap-4 mt-2">
            <View className="flex-1">
              <Text className="text-[10px] text-gray-500 mb-1">Walking Speed</Text>
              <Text className="text-white text-small font-bold">{currentMobility!.walkingSpeed} m/s</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-gray-500 mb-1">Step Length</Text>
              <Text className="text-white text-small font-bold">{currentMobility!.walkingStepLength} m</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-gray-500 mb-1">Flights Climbed</Text>
              <Text className="text-white text-small font-bold">{currentMobility!.flightsClimbed}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-gray-500 mb-1">Stair Ascent</Text>
              <Text className="text-white text-small font-bold">{currentMobility!.stairSpeedUp} m/s</Text>
            </View>
          </View>

          {asymmetryTrend.length > 1 && (
            <View className="mt-4 pt-4 border-t border-border-dim">
              <Text className="text-micro text-steel uppercase tracking-wider font-bold mb-1">7-DAY WALKING ASYMMETRY TREND</Text>
              <MetricSpline
                data={asymmetryTrend}
                labels={['6d ago', '3d ago', 'Today']}
                accentColor="#FF3B30"
                gradientColor="#FF3B30"
              />
            </View>
          )}
        </GlassCard>
      )}
    </View>
  )
}
