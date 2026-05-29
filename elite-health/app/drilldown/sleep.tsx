import React, { useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { useHealthStore, computeSleepArchitecture } from '../../src/lib/store'
import { SleepDrilldown } from '../../src/components/home/sleep-drilldown'
import { safeRecoveryScore, safeSleepDebtHours, safeNumber } from '../../src/lib/utils/display-helpers'
import { localDateString } from '../../src/lib/healthkit'
import type { SleepArchitecture } from '../../src/lib/types'
// [CANONICAL] Scope-explicit data access for Sleep drilldown
import { selectSleepForDate, selectScoresForDate } from '../../src/lib/canonical-selectors'

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../src/theme/stitch-tokens'

const STITCH = {
  ..._S,
  accentTeal: _S.pillarReadiness,
  accentPurple: _S.pillarResilience,
  accentCyan: _S.pillarLongevity,
  borderStrong: _S.border,
  success: _S.success,
  warning: _S.warning,
  error: _S.errorDisplay,
}

export default function SleepDrilldownScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>()
  const store = useHealthStore()
  const { loadFromDB, sleep, scores } = store

  useEffect(() => {
    loadFromDB()
  }, [])

  const dateStr = date || localDateString()
  // [CANONICAL] Scope-explicit data access for Sleep drilldown
  const canonicalSleep = selectSleepForDate(store, dateStr)
  const canonicalScores = selectScoresForDate(store, dateStr)
  const currentSleep = sleep.find(s => s.date === dateStr) || null
  const architecture = useMemo(() => computeSleepArchitecture(currentSleep), [currentSleep])

  const history: SleepArchitecture[] = useMemo(() => {
    return sleep
      .filter(s => s.date <= dateStr)
      .slice(0, 7)
      .map(s => computeSleepArchitecture(s))
      .filter((a): a is SleepArchitecture => a !== null)
  }, [sleep, dateStr])

  const currentScore = scores.find(s => s.date === dateStr)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: STITCH.bg }} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Sleep Architecture',
          headerStyle: { backgroundColor: STITCH.bg },
          headerTintColor: STITCH.onSurface,
          headerTitleStyle: {
            fontWeight: '900',
            fontSize: 17,
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: STITCH.accentCyan, fontSize: 16, fontWeight: '800' }}>← Back</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}
      >
        <View style={{ marginVertical: 16 }}>
          <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>
            {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {currentScore && (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: currentScore.recoveryZone === 'green' ? STITCH.success : currentScore.recoveryZone === 'yellow' ? STITCH.warning : STITCH.error,
                  }}
                />
                <Text style={{ color: STITCH.dimText, fontSize: 12, fontWeight: '700' }}>
                  Recovery {safeRecoveryScore(currentScore.recoveryScore) ?? '--'}%
                </Text>
              </View>
              <Text style={{ color: STITCH.dimText, fontSize: 12, fontWeight: '700' }}>
                Debt {safeSleepDebtHours(currentScore.sleepDebtHours) != null ? safeNumber(safeSleepDebtHours(currentScore.sleepDebtHours)!, 1) + 'h' : '--'}
              </Text>
            </View>
          )}
        </View>

        <SleepDrilldown architecture={architecture} history={history} />

        {/* [CANONICAL] Data provenance & scope declaration for Sleep drilldown */}
        <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
            data scope · provenance
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {([
              { label: 'sleep', vm: canonicalSleep },
              { label: 'scores', vm: canonicalScores },
            ] as const).map(({ label, vm }) => {
              const isPresent = vm.status === 'present'
              return (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isPresent ? '#30D158' : 'rgba(255,255,255,0.15)' }} />
                  <Text style={{ fontSize: 7, color: isPresent ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.15)', fontWeight: '600' }}>
                    {label} ({vm.scope})
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
