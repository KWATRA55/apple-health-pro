import React, { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useHealthStore } from '../../src/lib/store'
import { PersonalRecords, ActivitySummary, StrainRecoveryChart } from '../../src/components/profile/records'
import { ExportTools } from '../../src/components/profile/export-tools'
// [CANONICAL] Scope-explicit data access for Profile screen
import {
  selectLatestWeight,
  selectAllTimeScoresRange,
  selectAllTimeSleepRange,
  selectAllTimeActivities,
} from '../../src/lib/canonical-selectors'

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../src/theme/stitch-tokens'
import { safeNumber } from '../../src/lib/utils/display-helpers'

// Backward-compatible local aliases
const S = {
  ..._S,
  accentCyan: _S.pillarLongevity,
  accentTeal: _S.pillarReadiness,
  accentPurple: _S.pillarResilience,
  surfaceContainer: _S.surfaceContainer,
  primaryFixedDim: _S.primaryFixedDim,
  secondaryFixedDim: _S.secondaryFixedDim,
  tertiaryFixedDim: _S.tertiaryFixedDim,
}

// ── GlassPanel → EliteCard (V3 canonical component) ────────────────────
import { EliteCard, SectionHeader as V3SectionHeader } from '../../src/components/ui/v3'
const GlassPanel = EliteCard

// ── Section Header (emoji-style, delegates to V3) ──────────────────────
function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <V3SectionHeader label={label} />
    </View>
  )
}

// ── Main Profile Screen ────────────────────────────────────────────────
export default function ProfileScreen() {
  const store = useHealthStore()
  const { loadFromDB, activities, sleep, scores, journalEntries, weightHistory } = store
  // [CANONICAL] Scope-explicit data access for Profile
  const canonicalWeight = selectLatestWeight(store)
  const canonicalAllScores = selectAllTimeScoresRange(store)
  const canonicalAllSleep = selectAllTimeSleepRange(store)
  const canonicalAllActivities = selectAllTimeActivities(store)
  const fadeProgress = useSharedValue(0)

  useEffect(() => {
    loadFromDB()
    fadeProgress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
  }))

  const workoutCount = activities.length
  const activeDays = scores.length
  const targetDays = 90

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: S.bg }} edges={['top']}>
      {/* Fixed Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(18,18,20,0.60)',
          borderBottomWidth: 0.5,
          borderBottomColor: S.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: S.surfaceContainer,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 0.5,
              borderColor: S.borderStrong,
            }}
          >
            <Text style={{ color: S.primaryFixedDim, fontSize: 16, fontWeight: '900' }}>AT</Text>
          </View>
          <Text style={{ color: S.onSurface, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>
            ELITE HEALTH
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/drilldown/edit-profile')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: S.glass,
            borderWidth: 0.5,
            borderColor: S.border,
          }}
        >
          <Text style={{ color: S.primaryFixedDim, fontSize: 16 }}>✎</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 }}
      >
        <Animated.View style={animStyle}>
          {/* ── Athlete Identity Panel ────────────────────────────────── */}
          <GlassPanel
            style={{
              padding: 24,
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            {/* Gradient-ring avatar */}
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                padding: 2,
                marginBottom: 12,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderColor: S.primaryFixedDim,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 58,
                  backgroundColor: S.surfaceContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: S.surface,
                }}
              >
                <Text style={{ color: S.primaryFixedDim, fontSize: 36, fontWeight: '900' }}>AT</Text>
              </View>
            </View>

            <Text style={{
              color: S.onSurface,
              fontSize: 28,
              fontWeight: '900',
              letterSpacing: -0.5,
              marginBottom: 4,
            }}>
              Athlete
            </Text>
            <Text style={{
              color: S.primaryFixedDim,
              fontSize: 10,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 20,
            }}>
              ATHLETE
            </Text>

            {/* Stats row */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 32,
                width: '100%',
                paddingTop: 16,
                borderTopWidth: 0.5,
                borderTopColor: S.border,
              }}
            >
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  color: S.onSurface,
                  fontSize: 24,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                }}>
                  {workoutCount.toLocaleString()}
                </Text>
                <Text style={{
                  color: S.onSurfaceVariant,
                  fontSize: 10,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  WORKOUTS
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  color: S.onSurface,
                  fontSize: 24,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                }}>
                  {activeDays}
                  <Text style={{ color: S.onSurfaceVariant, fontSize: 16 }}>
                    /{targetDays}
                  </Text>
                </Text>
                <Text style={{
                  color: S.onSurfaceVariant,
                  fontSize: 10,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  ACTIVE DAYS
                </Text>
              </View>
            </View>
          </GlassPanel>

          {/* ── Body Composition Panel ── */}
          {weightHistory.length > 0 && (
            <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
              <SectionHeader icon="⚖️" label="Body Composition" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Weight
                  </Text>
                  <Text style={{ color: S.onSurface, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 4 }}>
                    {weightHistory[0]?.weightKg != null ? safeNumber(weightHistory[0].weightKg, 1) : '--'}
                    <Text style={{ fontSize: 13, color: S.dimText, fontWeight: '400' }}> kg</Text>
                  </Text>
                </View>
                {weightHistory[0]?.leanBodyMassPercent !== null && weightHistory[0]?.leanBodyMassPercent !== undefined && weightHistory[0].leanBodyMassPercent > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: S.dimText, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Lean Muscle
                    </Text>
                    <Text style={{ color: S.primaryFixedDim, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 4 }}>
                      {weightHistory[0].leanBodyMassPercent != null ? safeNumber(weightHistory[0].leanBodyMassPercent, 1) : '--'}
                      <Text style={{ fontSize: 13, color: S.dimText, fontWeight: '400' }}> %</Text>
                    </Text>
                  </View>
                )}
              </View>
            </GlassPanel>
          )}

          {/* ── All-Time Highs Bento ──────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <GlassPanel style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Text style={{ fontSize: 16 }}>❤️</Text>
                  <Text style={{
                    color: S.onSurfaceVariant,
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    MAX STRAIN
                  </Text>
                </View>
                <Text style={{
                  color: S.onSurface,
                  fontSize: 40,
                  fontWeight: '900',
                  letterSpacing: -2,
                }}>
                  {(() => {
                    const validStrains = activities.map(a => a.strainScore).filter((s): s is number => s != null)
                    return validStrains.length > 0 ? safeNumber(Math.max(...validStrains), 1) : '--'
                  })()}
                </Text>
              </GlassPanel>
            </View>
            <View style={{ flex: 1 }}>
              <GlassPanel style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Text style={{ fontSize: 16 }}>😴</Text>
                  <Text style={{
                    color: S.onSurfaceVariant,
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    DEEP SLEEP RECORD
                  </Text>
                </View>
                <Text style={{
                  color: S.onSurface,
                  fontSize: 36,
                  fontWeight: '900',
                  letterSpacing: -1,
                }}>
                  {(() => {
                    const best = sleep.reduce((max, s) => Math.max(max, s.deepMins ?? 0), 0)
                    if (best <= 0) return '--'
                    const h = Math.floor(best / 60)
                    const m = Math.round(best % 60)
                    return `${h}h ${m}m`
                  })()}
                </Text>
              </GlassPanel>
            </View>
          </View>

          {/* ── 7-Day Trend ──────────────────────────────────────────── */}
          <StrainRecoveryChart scores={scores} />

          {/* ── Activity Summary ──────────────────────────────────────── */}
          <View style={{ marginTop: 16 }}>
            <ActivitySummary activities={activities} />
          </View>

          {/* ── Navigation Buttons ────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => router.push('/drilldown/weekly-summary')}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <GlassPanel
                style={{
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 18 }}>📊</Text>
                <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700' }}>
                  Weekly Report
                </Text>
              </GlassPanel>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/drilldown/monthly-summary')}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <GlassPanel
                style={{
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 18 }}>📅</Text>
                <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700' }}>
                  Monthly Report
                </Text>
              </GlassPanel>
            </TouchableOpacity>
          </View>

          {/* ── Export Tools ──────────────────────────────────────────── */}
          <View style={{ marginTop: 16 }}>
            <ExportTools />
          </View>

          {/* [CANONICAL] Data provenance & scope declaration for Profile */}
          <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
              data scope · provenance
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {[
                { label: 'weight', vm: canonicalWeight },
                { label: 'scores', vm: canonicalAllScores },
                { label: 'sleep', vm: canonicalAllSleep },
                { label: 'activities', vm: canonicalAllActivities },
              ].map(({ label, vm }) => {
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
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}
