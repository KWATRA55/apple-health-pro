import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated'
import { useHealthStore } from '../../src/lib/store'
import { useSelectedDateHealthState } from '../../src/hooks/useSelectedDateHealthState'
import { TrendExplorer } from '../../src/components/home/trend-explorer'
import { PremiumOrb } from '../../src/components/health/PremiumOrb'
import { SegmentedControl } from '../../src/components/ui/segmented-control'
import { MicroNarrative } from '../../src/components/ui/micro-narrative'
import { DriverList, type DriverItem } from '../../src/components/ui/driver-list'
import { HealthPageSkeleton } from '../../src/components/ui/skeleton'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { BiometricsInfoModal } from '../../src/components/home/biometrics-info-modal'
import type { PillarScore, VitalsRecord, DailyScores, MobilityRecord, EnvironmentalRecord, CardioMetabolicRecord, InjuryRisk, CnsStressScore, RunningDynamics } from '../../src/lib/types'
import {
  safeSpO2,
  safeRHR,
  safeHRV,
  safeRespiratoryRate,
  safeSkinTempDelta,
  safeStrainScore,
  safePaceOfAging,
  safeBiologicalAge,
  safeSleepDurationHours,
  safeSleepDebtHours,
  safeVO2Max,
  safeWalkingSpeed,
  safeDaylightMins,
  safeAudioLevel,
  safeNumber,
  formatScore,
  formatAge,
} from '../../src/lib/utils/display-helpers'

// [CANONICAL] Scope-explicit data selectors — adds provenance & scope awareness
import {
  selectVitalsForDate,
  selectScoresForDate,
  selectSleepForDate,
  selectActivitiesForDate,
  selectMobilityForDate,
  selectEnvironmentalForDate,
  selectCardioMetabolicForDate,
  selectRunningDynamicsForDate,
  selectRolling7dScores,
} from '../../src/lib/canonical-selectors'

// ── Stitch Design Tokens (canonical source) ───────────────────────────────
import { colors as _S, pillarConfig as PILLAR_CONFIG } from '../../src/theme/stitch-tokens'

// Backward-compatible local aliases (canonical names: pillarReadiness / pillarResilience / pillarLongevity)
const STITCH = {
  ..._S,
  accentTeal: _S.pillarReadiness,
  accentPurple: _S.pillarResilience,
  accentCyan: _S.pillarLongevity,
}

// ── GlassPanel → EliteCard (V3 canonical component) ───────────────────
import { EliteCard } from '../../src/components/ui/v3'
const GlassPanel = EliteCard

// ── V3 Reusable Components ────────────────────────────────────────────────
import V3SectionHeader from '../../src/components/ui/v3/section-header'
import V3StatusDot from '../../src/components/ui/v3/status-dot'
import V3FocusBadge from '../../src/components/ui/v3/focus-badge'

// ── Section Header (local wrapper preserving Haptics + info icon) ──────
function SectionHeader({ label, accent, onInfoPress }: { label: string; accent?: string; onInfoPress?: () => void }) {
  return (
    <V3SectionHeader
      label={label}
      accent={accent}
      onInfoPress={onInfoPress ? () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onInfoPress()
      } : undefined}
    />
  )
}

// ── Status Dot (local delegate) ────────────────────────────────────────
function StatusDot({ color, glow = false }: { color: string; glow?: boolean }) {
  return <V3StatusDot color={color} glow={glow} />
}

// ── Focus Badge (local delegate) ───────────────────────────────────────
function FocusBadge({ focus, pillName }: { focus: string; pillName?: string }) {
  return <V3FocusBadge focus={focus} pillName={pillName} />
}

// ── Mini Sparkline Bar ────────────────────────────────────────────────────
function MiniSparkline({ values, color, height = 28 }: { values: number[]; color: string; height?: number }) {
  if (!values.length) return null
  const max = Math.max(...values, 1)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
      {values.slice(-7).map((v, i) => {
        const h = Math.max(4, (v / max) * height)
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              backgroundColor: color,
              borderRadius: 2,
              opacity: 0.4 + (i / Math.max(1, values.length - 1)) * 0.6,
            }}
          />
        )
      })}
    </View>
  )
}

// ── Gradient Progress Bar ─────────────────────────────────────────────────
function ProgressBar({ pct, color, height = 4 }: { pct: number; color: string; height?: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <View style={{ height, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${clamped}%` as any, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  )
}

// ── Metric Row ────────────────────────────────────────────────────────────
function MetricRow({ label, value, unit, status, statusColor }: {
  label: string
  value: string
  unit?: string
  status?: string
  statusColor?: string
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
      <Text style={{ color: STITCH.dimText, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ color: STITCH.onSurface, fontSize: 15, fontWeight: '800' }}>{value}</Text>
        {unit && <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '500' }}>{unit}</Text>}
        {status && (
          <Text style={{ color: statusColor ?? STITCH.success, fontSize: 9, fontWeight: '700', marginLeft: 6 }}>{status}</Text>
        )}
      </View>
    </View>
  )
}

// ── Stat Tile ─────────────────────────────────────────────────────────────
function StatTile({ label, value, unit, accent, icon }: {
  label: string
  value: string
  unit?: string
  accent?: string
  icon?: string
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: STITCH.surface,
        borderRadius: 14,
        borderWidth: 0.5,
        borderColor: STITCH.border,
        padding: 14,
        minHeight: 100,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {label}
        </Text>
        {icon && <Text style={{ fontSize: 14, opacity: 0.6 }}>{icon}</Text>}
      </View>
      <View>
        <Text style={{ color: accent ?? STITCH.onSurface, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
          {value}
          {unit && <Text style={{ fontSize: 12, fontWeight: '400', color: STITCH.dimText }}> {unit}</Text>}
        </Text>
      </View>
    </View>
  )
}

// ── Day Bar ───────────────────────────────────────────────────────────────
function DayBar({ label, height, color, value }: { label: string; height: number; color: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{
        width: '80%',
        height: `${height}%` as any,
        backgroundColor: color,
        borderRadius: 3,
        opacity: 0.7,
      }} />
      <Text style={{ color: STITCH.dimText, fontSize: 9, marginTop: 4, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 9, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  )
}

// ── ANS Balance Spectrum ──────────────────────────────────────────────────
function AnsBalanceBar({ parasympathetic = 50 }: { parasympathetic?: number }) {
  const paraPct = Math.min(90, Math.max(10, parasympathetic))
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: '#FF6B6B', fontSize: 9, fontWeight: '600' }}>Sympathetic</Text>
        <Text style={{ color: STITCH.dimText, fontSize: 9 }}>Balance</Text>
        <Text style={{ color: '#51CF66', fontSize: 9, fontWeight: '600' }}>Parasympathetic</Text>
      </View>
      <View style={{
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.06)',
      }}>
        <View style={{ flex: paraPct / 100, backgroundColor: '#51CF66', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
        <View style={{ flex: (100 - paraPct) / 100, backgroundColor: '#FF6B6B', borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
      </View>
      <View style={{
        position: 'absolute',
        top: 18,
        left: `${paraPct}%` as any,
        width: 2,
        height: 14,
        backgroundColor: STITCH.onSurface,
        borderRadius: 1,
        marginLeft: -1,
      }} />
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT HEALTH DEEP-DIVE VIEW
// ═══════════════════════════════════════════════════════════════════════════
function DefaultHealthView({
  currentScores,
  currentVitals,
  currentDynamics,
  currentActivities,
  currentSleep,
  biologicalAge,
  chronologicalAge,
  paceOfAging,
  trendReport,
  displayDate,
  dateStr,
  isAgeConfigured = false,
  cnsStressScore,
  onInfoPress,
}: {
  currentScores: DailyScores | null
  currentVitals: VitalsRecord | null
  currentDynamics: RunningDynamics | null
  currentActivities: any[]
  currentSleep: { totalDurationMins: number; date: string; deepSleepMins?: number; remSleepMins?: number; coreSleepMins?: number } | null
  biologicalAge: number | null
  chronologicalAge: number
  paceOfAging: number | null
  trendReport: any
  displayDate: string
  dateStr: string
  isAgeConfigured?: boolean
  cnsStressScore: CnsStressScore | null
  onInfoPress: (tab: 'pillars' | 'glossary') => void
}) {
  // ── Debug: log data-flow snapshot on every render ──
  if (__DEV__) {
    console.log('[HEALTH-OVERVIEW]', JSON.stringify({
      dateStr,
      displayDate,
      hasCurrentScores: currentScores != null,
      scoreFields: currentScores ? {
        bioAge: currentScores.biologicalAge != null ? formatAge(currentScores.biologicalAge) : undefined,
        pace: currentScores.paceOfAging != null ? safeNumber(currentScores.paceOfAging, 2) : undefined,
        recovery: currentScores.recoveryScore,
        strain: currentScores.strainScore,
        sleepDebt: currentScores.sleepDebtHours != null ? safeNumber(currentScores.sleepDebtHours, 1) : undefined,
      } : null,
      hasCurrentVitals: currentVitals != null,
      vitalFields: currentVitals ? {
        hrv: currentVitals.hrv,
        rhr: currentVitals.rhr,
        spo2: currentVitals.spo2,
      } : null,
      sleepFields: currentSleep ? {
        durationMins: currentSleep.totalDurationMins,
        deepMins: currentSleep.deepSleepMins,
        remMins: currentSleep.remSleepMins,
        coreMins: currentSleep.coreSleepMins,
      } : null,
      trendReportRefDate: trendReport?.referenceDate ?? null,
    }, null, 2))
  }

  const bioAge = safeBiologicalAge(currentScores?.biologicalAge, chronologicalAge)
  const ageDelta = bioAge != null ? bioAge - chronologicalAge : 0
  const hasBioAge = bioAge != null && (currentScores?.bioAgeConfidence ?? 0) > 0
  const hrvVal = currentVitals ? safeHRV(currentVitals.hrv) : null
  const rhrVal = currentVitals ? safeRHR(currentVitals.rhr) : null
  const spo2Val = currentVitals ? safeSpO2(currentVitals.spo2) : null
  const respVal = currentVitals ? safeRespiratoryRate(currentVitals.respiratoryRate) : null
  const tempVal = currentVitals ? safeSkinTempDelta(currentVitals.skinTempDelta) : null
  const cnsRisk = cnsStressScore?.risk ?? null

  // strainScore != null means we have a score; strain=0 is a valid rest day, not missing data
  const hasStrainScore = currentScores?.strainScore != null
  const strainVal = hasStrainScore ? currentScores!.strainScore : 0
  const hasStrainData = hasStrainScore && strainVal > 0
  const strainPct = hasStrainScore ? Math.min(100, (strainVal / 21) * 100) : 0
  const strainLabel = hasStrainScore
    ? (strainVal < 1 ? 'Rest Day — No Measurable Cardiac Load' : strainVal < 7 ? 'Low Load — Active Recovery Optimal' : strainVal < 14 ? 'Moderate Load — Recovery Advised Tonight' : 'High Load — Prioritize Sleep & Rest')
    : 'No strain data — sync workouts to track cardiac load'

  const recoveryScore = currentScores?.recoveryScore != null && currentScores.recoveryScore > 0
    ? currentScores.recoveryScore
    : null
  const recoveryColor = recoveryScore != null
    ? (recoveryScore >= 66 ? STITCH.success : recoveryScore >= 33 ? STITCH.warning : STITCH.error)
    : STITCH.dimText
  const recoveryLabel = recoveryScore != null
    ? (recoveryScore >= 80 ? 'Excellent' : recoveryScore >= 66 ? 'Good' : recoveryScore >= 50 ? 'Fair' : recoveryScore >= 33 ? 'Low' : 'Poor')
    : null

  const sleepDurationMins = currentSleep?.totalDurationMins ?? 0
  const sleepHours = sleepDurationMins > 0 ? (sleepDurationMins / 60) : 0
  const sleepDebtHours = currentScores?.sleepDebtHours ?? null
  const hasSleepData = sleepDurationMins > 0

  return (
    <View>
      {/* Biological Age Slider */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
            Biological Age
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onInfoPress('glossary')
            }}
            activeOpacity={0.7}
            hitSlop={10}
          >
            <MaterialIcons name="info-outline" size={14} color={STITCH.dimText} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ color: hasBioAge ? STITCH.accentCyan : STITCH.dimText, fontSize: 48, fontWeight: '900', letterSpacing: -2, textShadowColor: hasBioAge ? 'rgba(0,229,255,0.4)' : undefined, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: hasBioAge ? 12 : 0 }}>
              {hasBioAge ? formatAge(bioAge!) : '--'}
            </Text>
            <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 14, fontWeight: '500' }}>years</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Chronological</Text>
            <Text style={{ color: STITCH.onSurface, fontSize: 22, fontWeight: '800' }}>{chronologicalAge}.0 y</Text>
            {!isAgeConfigured && (
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '500', marginTop: 2 }}>Set in Profile →</Text>
            )}
          </View>
        </View>
        {/* Slider Track */}
        {hasBioAge ? (
          <>
            <View style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, marginTop: 8, position: 'relative' }}>
              {/* Chronological marker */}
              <View style={{ position: 'absolute', top: -2, left: '80%' as any, width: 2, height: 16, backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 1, marginLeft: -1 }} />
              {/* Bio age glow */}
              <View style={{
                position: 'absolute', top: 0, left: 0, height: '100%',
                width: `${Math.min(95, (bioAge! / (chronologicalAge * 1.5)) * 100)}%` as any,
                backgroundColor: 'rgba(0,229,255,0.20)',
                borderRadius: 6,
                shadowColor: 'rgba(0,229,255,0.4)',
                shadowOffset: { width: 0, height: 0 },
                shadowRadius: 10,
                shadowOpacity: 0.5,
              }} />
              {/* Bio marker */}
              <View style={{
                position: 'absolute', top: -4, left: `${Math.min(95, (bioAge! / (chronologicalAge * 1.5)) * 100)}%` as any,
                width: 14, height: 14, borderRadius: 7,
                backgroundColor: STITCH.onSurface,
                borderWidth: 2, borderColor: STITCH.accentCyan,
                shadowColor: 'rgba(255,255,255,0.8)',
                shadowOffset: { width: 0, height: 0 },
                shadowRadius: 6,
                shadowOpacity: 0.6,
                marginLeft: -7,
              }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '600' }}>
                {ageDelta < 0 ? `${safeNumber(Math.abs(ageDelta), 1)}y Optimization Gap` : ageDelta > 0 ? `${safeNumber(ageDelta, 1)}y Acceleration` : 'Age Aligned'}
              </Text>
              <Text style={{ color: STITCH.dimText, fontSize: 10 }}>Baseline</Text>
            </View>
          </>
        ) : (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ color: STITCH.dimText, fontSize: 12 }}>
              Sync 14+ days of HealthKit data to compute biological age
            </Text>
          </View>
        )}
      </GlassPanel>

      {/* Recovery Score Hero */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
            Recovery Score
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onInfoPress('glossary')
            }}
            activeOpacity={0.7}
            hitSlop={10}
          >
            <MaterialIcons name="info-outline" size={14} color={STITCH.dimText} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: STITCH.surface,
            borderWidth: 3,
            borderColor: recoveryScore != null ? `${recoveryColor}40` : 'rgba(255,255,255,0.08)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: recoveryScore != null ? recoveryColor : STITCH.dimText, fontSize: 28, fontWeight: '900', letterSpacing: -1 }}>
              {recoveryScore != null ? formatScore(recoveryScore) : '--'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {recoveryLabel && (
              <View style={{
                alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3,
                backgroundColor: `${recoveryColor}15`, borderRadius: 9999,
                borderWidth: 0.5, borderColor: `${recoveryColor}30`,
                marginBottom: 6,
              }}>
                <Text style={{ color: recoveryColor, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{recoveryLabel.toUpperCase()}</Text>
              </View>
            )}
            <Text style={{ color: STITCH.dimText, fontSize: 11, lineHeight: 16 }}>
              {recoveryScore != null
                ? `Recovery composite from HRV, RHR, sleep quality & strain balance`
                : 'Recovery score will appear after sufficient vitals & sleep data is synced'}
            </Text>
            {recoveryScore != null && (
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                <View>
                  <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>HRV</Text>
                  <Text style={{ color: STITCH.onSurface, fontSize: 13, fontWeight: '800' }}>{hrvVal ?? '--'} ms</Text>
                </View>
                <View>
                  <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>RHR</Text>
                  <Text style={{ color: STITCH.onSurface, fontSize: 13, fontWeight: '800' }}>{rhrVal ?? '--'} bpm</Text>
                </View>
                {hasSleepData && (
                  <View>
                    <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>Sleep</Text>
                    <Text style={{ color: STITCH.onSurface, fontSize: 13, fontWeight: '800' }}>{safeNumber(sleepHours, 1)}h</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </GlassPanel>

      {/* Sleep Summary */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
            Sleep
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onInfoPress('glossary')
            }}
            activeOpacity={0.7}
            hitSlop={10}
          >
            <MaterialIcons name="info-outline" size={14} color={STITCH.dimText} />
          </TouchableOpacity>
        </View>
        {hasSleepData ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ color: STITCH.onSurface, fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>
                {safeNumber(sleepHours, 1)}
                <Text style={{ fontSize: 13, color: STITCH.dimText, fontWeight: '400' }}> h</Text>
              </Text>
              <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '500', marginTop: 2 }}>
                Target: 8.0h
              </Text>
              {sleepDebtHours != null && sleepDebtHours > 0 && (
                <Text style={{ color: STITCH.warning, fontSize: 9, fontWeight: '700', marginTop: 2 }}>
                  {safeNumber(sleepDebtHours, 1)}h Sleep Debt
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {currentSleep?.deepSleepMins != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7ad7c6' }} />
                  <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '600' }}>
                    Deep {safeNumber(currentSleep.deepSleepMins / 60, 1)}h
                  </Text>
                </View>
              )}
              {currentSleep?.remSleepMins != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#c8c2e9' }} />
                  <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '600' }}>
                    REM {safeNumber(currentSleep.remSleepMins / 60, 1)}h
                  </Text>
                </View>
              )}
              {currentSleep?.coreSleepMins != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#a1cde3' }} />
                  <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '600' }}>
                    Core {safeNumber(currentSleep.coreSleepMins / 60, 1)}h
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 12 }}>
            No sleep data available — sync HealthKit to populate sleep tracking
          </Text>
        )}
      </GlassPanel>

      {/* Body Systems Status */}
      <View style={{ marginBottom: 16 }}>
        <SectionHeader label="Body Systems" accent={STITCH.onSurface} onInfoPress={() => onInfoPress('glossary')} />
        <View style={{
          backgroundColor: STITCH.glass,
          borderRadius: 12,
          borderWidth: 0.5,
          borderColor: STITCH.border,
          padding: 16,
        }}>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
            {[
              { label: 'Cardio', value: hrvVal !== null ? `${hrvVal}ms` : '--', status: hrvVal !== null && rhrVal !== null ? (rhrVal < 65 ? 'green' : rhrVal < 80 ? 'amber' : 'red') : 'unknown' as string },
              { label: 'Autonomic', value: hrvVal !== null ? `${hrvVal}ms` : '--', status: hrvVal !== null ? (hrvVal > 40 ? 'green' : hrvVal > 20 ? 'amber' : 'red') : 'unknown' },
              { label: 'Respiratory', value: spo2Val !== null ? `${spo2Val}%` : '--', status: spo2Val !== null ? (spo2Val >= 95 ? 'green' : 'amber') : 'unknown' },
              { label: 'Temperature', value: tempVal !== null ? `${tempVal > 0 ? '+' : ''}${safeNumber(tempVal, 1)}°` : '--', status: tempVal !== null ? (Math.abs(tempVal) < 0.5 ? 'green' : Math.abs(tempVal) < 1.5 ? 'amber' : 'red') : 'unknown' },
              { label: 'CNS', value: cnsRisk ?? '--', status: cnsRisk === 'LOW' ? 'green' : cnsRisk === 'MODERATE' ? 'amber' : cnsRisk === 'HIGH' ? 'red' : 'unknown' as string },
            ].map((sys, i) => {
              const color = sys.status === 'green' ? STITCH.success : sys.status === 'amber' ? STITCH.warning : sys.status === 'red' ? STITCH.error : STITCH.dimText
              return (
                <View key={sys.label} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: `${color}15`,
                    borderWidth: 1, borderColor: `${color}30`,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                  </View>
                  <Text style={{ color: STITCH.dimText, fontSize: 7, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>
                    {sys.label}
                  </Text>
                  <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                    {sys.status !== 'unknown' ? sys.value : '--'}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
        <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '500', marginTop: 6, textAlign: 'center' }}>
          {currentVitals || cnsStressScore ? 'Based on your latest vital signs & CNS metrics' : 'Sync vitals data to activate body systems status'}
        </Text>
      </View>

      {/* Core Vitals Grid */}
      <SectionHeader label="Core Vitals" accent={STITCH.onSurface} onInfoPress={() => onInfoPress('glossary')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <View style={{ width: '48%' as any }}>
          <StatTile
            label="HRV"
            value={hrvVal !== null ? `${hrvVal}` : '--'}
            unit="ms"
            accent={STITCH.accentCyan}
            icon="❤️"
          />
        </View>
        <View style={{ width: '48%' as any }}>
          <StatTile
            label="RHR"
            value={rhrVal !== null ? `${rhrVal}` : '--'}
            unit="bpm"
            accent="#c8c2e9"
            icon="💓"
          />
        </View>
        <View style={{ width: '48%' as any }}>
          <StatTile
            label="SpO2"
            value={spo2Val !== null ? `${spo2Val}` : '--'}
            unit="%"
            accent="#a1cde3"
            icon="🫁"
          />
        </View>
        <View style={{ width: '48%' as any }}>
          <StatTile
            label="Resp Rate"
            value={respVal !== null ? `${respVal}` : '--'}
            unit="br/m"
            accent={STITCH.onSurface}
            icon="🫁"
          />
        </View>
        <View style={{ width: '48%' as any }}>
          <StatTile
            label="Skin Temp"
            value={tempVal !== null ? `${tempVal > 0 ? '+' : ''}${tempVal}` : '--'}
            unit="°C"
            accent={tempVal !== null && Math.abs(tempVal) > 0.5 ? STITCH.warning : STITCH.success}
            icon="🌡️"
          />
        </View>
      </View>

      {/* Cardiac Strain Bar */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '700' }}>Cardiac Strain</Text>
          <Text style={{ color: STITCH.dimText, fontSize: 12, fontWeight: '600' }}>
            <Text style={{ color: hasStrainScore ? STITCH.onSurface : STITCH.dimText, fontWeight: '800' }}>{hasStrainScore ? safeNumber(strainVal, 1) : '--'}</Text> / 21.0
          </Text>
        </View>
        <View style={{ height: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
          <View style={{
            width: `${hasStrainScore ? strainPct : 0}%` as any, height: '100%',
            backgroundColor: hasStrainData ? (strainVal < 7 ? STITCH.accentTeal : strainVal < 14 ? STITCH.warning : STITCH.error) : 'rgba(255,255,255,0.04)',
            borderRadius: 5,
            shadowColor: hasStrainData ? 'rgba(255,255,255,0.2)' : undefined,
            shadowOffset: hasStrainData ? { width: 0, height: 0 } : undefined,
            shadowRadius: hasStrainData ? 6 : undefined,
            shadowOpacity: hasStrainData ? 0.4 : undefined,
          }}>
            {hasStrainData && <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: STITCH.onSurface, shadowColor: 'rgba(255,255,255,0.9)', shadowOffset: { width: 0, height: 0 }, shadowRadius: 4, shadowOpacity: 1 }} />}
          </View>
        </View>
        <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: hasStrainScore ? 1 : 0.5 }}>
          {strainLabel}
        </Text>
      </GlassPanel>

      {/* MicroNarrative for Overview */}
      <View style={{ marginBottom: 16 }}>
        <MicroNarrative text={
          hasStrainData
            ? `Cardiac strain is at ${safeNumber(strainVal, 1)}/21. ${hrvVal !== null && rhrVal !== null ? `HRV ${hrvVal}ms · RHR ${rhrVal}bpm` : 'Sync vitals for deeper analysis.'}`
            : 'No strain or vitals data available. Sync HealthKit to reveal readiness insights.'
        } />
      </View>

      {/* Running Dynamics */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Running Dynamics" accent={STITCH.onSurface} onInfoPress={() => onInfoPress('glossary')} />
        {currentDynamics && currentDynamics.runningPower > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ width: '48%' as any, paddingVertical: 8 }}>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Power</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 22, fontWeight: '900' }}>{Math.round(currentDynamics.runningPower)}<Text style={{ fontSize: 12, color: STITCH.dimText }}> W</Text></Text>
            </View>
            <View style={{ width: '48%' as any, paddingVertical: 8 }}>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Contact</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 22, fontWeight: '900' }}>{Math.round(currentDynamics.groundContactTime)}<Text style={{ fontSize: 12, color: STITCH.dimText }}> ms</Text></Text>
            </View>
            <View style={{ width: '48%' as any, paddingVertical: 8 }}>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Oscillation</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 22, fontWeight: '900' }}>{safeNumber(currentDynamics.verticalOscillation, 1)}<Text style={{ fontSize: 12, color: STITCH.dimText }}> cm</Text></Text>
            </View>
            <View style={{ width: '48%' as any, paddingVertical: 8 }}>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Stride</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 22, fontWeight: '900' }}>{safeNumber(currentDynamics.strideLength, 2)}<Text style={{ fontSize: 12, color: STITCH.dimText }}> m</Text></Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
            No running data available — log a run to see dynamics
          </Text>
        )}
      </GlassPanel>

      {/* Workouts */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Today's Workouts" accent={STITCH.onSurface} />
        {currentActivities.length > 0 ? (
          currentActivities.map((a, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
              paddingHorizontal: 12, backgroundColor: STITCH.glass,
              borderRadius: 10, borderWidth: 0.5, borderColor: STITCH.border,
              marginBottom: i < currentActivities.length - 1 ? 8 : 0,
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(122,215,198,0.10)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 16 }}>🏃</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '700' }}>{a.workoutType}</Text>
                <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 11, fontWeight: '500', marginTop: 2 }}>{a.durationMins} MIN • {a.activeCalories} KCAL</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: STITCH.accentTeal, fontSize: 20, fontWeight: '800' }}>{a.strainScore != null ? safeNumber(a.strainScore, 1) : '--'}</Text>
                <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Strain</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
            No workouts logged — sync or log a workout to see it here
          </Text>
        )}
      </GlassPanel>

      {/* Trend Explorer */}
      {trendReport ? (
        <TrendExplorer report={trendReport} />
      ) : (
        <GlassPanel style={{ marginBottom: 16 }}>
          <SectionHeader label="Trend Explorer" accent={STITCH.onSurface} onInfoPress={() => onInfoPress('glossary')} />
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
            Trend analysis will populate after 5+ days of consistent HealthKit data
          </Text>
        </GlassPanel>
      )}
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// READINESS DRILLDOWN
// ═══════════════════════════════════════════════════════════════════════════
function ReadinessView({
  currentVitals,
  currentScores,
  vitalsHistory,
  scoresHistory,
  sleepHistory,
  synthesis,
  onInfoPress,
}: {
  currentVitals: VitalsRecord | null
  currentScores: DailyScores | null
  vitalsHistory: VitalsRecord[]
  scoresHistory: DailyScores[]
  sleepHistory: { totalDurationMins: number; date: string }[]
  synthesis: import('../../src/lib/types').SynthesisOutput | null
  onInfoPress: (tab: 'pillars' | 'glossary') => void
}) {
  const hrvValues = vitalsHistory.filter(v => v.hrv > 0).map(v => v.hrv)
  const rhrValues = vitalsHistory.filter(v => v.rhr > 0).map(v => v.rhr)
  const recoveryValues = scoresHistory.filter(s => s.recoveryScore > 0).map(s => s.recoveryScore)

  const hasRecoveryData = currentScores?.recoveryScore != null && currentScores.recoveryScore > 0
  const recoveryZone = currentScores?.recoveryZone ?? null
  const recoveryLabel = recoveryZone === 'green' ? 'PRIMED' : recoveryZone === 'yellow' ? 'MODERATE' : recoveryZone === 'red' ? 'DEPLETED' : 'NO DATA'
  const recoveryColor = recoveryZone === 'green' ? STITCH.success : recoveryZone === 'yellow' ? STITCH.warning : recoveryZone === 'red' ? STITCH.error : STITCH.dimText

  const hrvLatest = hrvValues.length > 0 ? hrvValues[hrvValues.length - 1] : null
  const rhrLatest = rhrValues.length > 0 ? rhrValues[rhrValues.length - 1] : null

  const last7Sleep = sleepHistory.slice(0, 7)
  const avgSleepDuration = last7Sleep.length > 0
    ? last7Sleep.reduce((a, s) => a + s.totalDurationMins, 0) / last7Sleep.length
    : 0
  const sleepHours = (avgSleepDuration / 60)
  const sleepNeedHours = 8
  const sleepPct = Math.min(100, (sleepHours / sleepNeedHours) * 100)

  return (
    <View>
      {/* Recovery Score Hero — Premium Orb */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <PremiumOrb
          variant="health-readiness"
          primaryValue={hasRecoveryData ? formatScore(currentScores!.recoveryScore) : null}
          primaryLabel="READINESS"
          secondaryLabel={hasRecoveryData ? (recoveryZone === 'green' ? 'Optimal · Primed for strain' : recoveryZone === 'yellow' ? 'Moderate · Proceed mindfully' : 'Depleted · Prioritize rest') : null}
          isEmpty={!hasRecoveryData}
          fallbackText="Sync HealthKit for recovery data"
          accessibilityLabel="Readiness score orb. Shows your daily recovery."
        />
      </View>

      {/* RHR & HRV Modules */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentTeal, fontSize: 14, fontWeight: '900' }}>♥</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>RHR</Text>
            </View>
            <Text style={{ color: STITCH.onSurface, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>
              {rhrLatest !== null ? safeRHR(rhrLatest) ?? '--' : '--'}
              <Text style={{ fontSize: 13, color: STITCH.dimText, fontWeight: '400' }}> bpm</Text>
            </Text>
            <Text style={{ color: rhrLatest !== null && rhrLatest < 60 ? STITCH.success : rhrLatest !== null && rhrLatest < 80 ? STITCH.warning : STITCH.error, fontSize: 9, fontWeight: '700', marginTop: 4 }}>
              {rhrLatest !== null ? (rhrLatest < 60 ? 'OPTIMAL' : rhrLatest < 80 ? 'NORMAL' : 'ELEVATED') : '--'}
            </Text>
            <MiniSparkline values={rhrValues} color={STITCH.warning} height={24} />
          </GlassPanel>
        </View>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentTeal, fontSize: 14, fontWeight: '900' }}>⚡</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>HRV</Text>
            </View>
            <Text style={{ color: STITCH.onSurface, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>
              {hrvLatest !== null ? safeHRV(hrvLatest) ?? '--' : '--'}
              <Text style={{ fontSize: 13, color: STITCH.dimText, fontWeight: '400' }}> ms</Text>
            </Text>
            <Text style={{ color: hrvLatest !== null && hrvLatest > 40 ? STITCH.success : STITCH.warning, fontSize: 9, fontWeight: '700', marginTop: 4 }}>
              {hrvLatest !== null ? (hrvLatest > 40 ? 'OPTIMAL' : 'LOW') : '--'}
            </Text>
            <MiniSparkline values={hrvValues} color={STITCH.accentTeal} height={24} />
          </GlassPanel>
        </View>
      </View>

      {/* Supporting Vitals — SpO₂, Resp Rate, Skin Temp */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Supporting Vitals" accent={STITCH.accentTeal} onInfoPress={() => onInfoPress('glossary')} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>SpO₂</Text>
            <Text style={{ color: currentVitals && safeSpO2(currentVitals.spo2) !== null ? STITCH.onSurface : STITCH.dimText, fontSize: 22, fontWeight: '900' }}>
              {currentVitals && safeSpO2(currentVitals.spo2) !== null ? `${safeSpO2(currentVitals.spo2)}` : '--'}
              <Text style={{ fontSize: 10, color: STITCH.dimText, fontWeight: '400' }}> %</Text>
            </Text>
            <Text style={{ color: currentVitals && safeSpO2(currentVitals.spo2) !== null ? (safeSpO2(currentVitals.spo2)! >= 95 ? STITCH.success : STITCH.warning) : STITCH.dimText, fontSize: 8, fontWeight: '700', marginTop: 3 }}>
              {currentVitals && safeSpO2(currentVitals.spo2) !== null ? (safeSpO2(currentVitals.spo2)! >= 95 ? 'NORMAL' : 'LOW') : '--'}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Resp Rate</Text>
            <Text style={{ color: currentVitals && safeRespiratoryRate(currentVitals.respiratoryRate) !== null ? STITCH.onSurface : STITCH.dimText, fontSize: 22, fontWeight: '900' }}>
              {currentVitals && safeRespiratoryRate(currentVitals.respiratoryRate) !== null ? `${safeRespiratoryRate(currentVitals.respiratoryRate)}` : '--'}
              <Text style={{ fontSize: 10, color: STITCH.dimText, fontWeight: '400' }}> br/m</Text>
            </Text>
            <Text style={{ color: currentVitals && safeRespiratoryRate(currentVitals.respiratoryRate) !== null ? (safeRespiratoryRate(currentVitals.respiratoryRate)! <= 18 ? STITCH.success : safeRespiratoryRate(currentVitals.respiratoryRate)! <= 24 ? STITCH.warning : STITCH.error) : STITCH.dimText, fontSize: 8, fontWeight: '700', marginTop: 3 }}>
              {currentVitals && safeRespiratoryRate(currentVitals.respiratoryRate) !== null ? (safeRespiratoryRate(currentVitals.respiratoryRate)! <= 18 ? 'RESTED' : 'ELEVATED') : '--'}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Skin Temp</Text>
            <Text style={{ color: currentVitals && safeSkinTempDelta(currentVitals.skinTempDelta) !== null ? STITCH.onSurface : STITCH.dimText, fontSize: 22, fontWeight: '900' }}>
              {currentVitals && safeSkinTempDelta(currentVitals.skinTempDelta) !== null ? `${safeSkinTempDelta(currentVitals.skinTempDelta)! > 0 ? '+' : ''}${safeSkinTempDelta(currentVitals.skinTempDelta)}` : '--'}
              <Text style={{ fontSize: 10, color: STITCH.dimText, fontWeight: '400' }}> °C</Text>
            </Text>
            <Text style={{ color: currentVitals && safeSkinTempDelta(currentVitals.skinTempDelta) !== null ? (Math.abs(safeSkinTempDelta(currentVitals.skinTempDelta)!) < 0.5 ? STITCH.success : Math.abs(safeSkinTempDelta(currentVitals.skinTempDelta)!) < 1.5 ? STITCH.warning : STITCH.error) : STITCH.dimText, fontSize: 8, fontWeight: '700', marginTop: 3 }}>
              {currentVitals && safeSkinTempDelta(currentVitals.skinTempDelta) !== null ? (Math.abs(safeSkinTempDelta(currentVitals.skinTempDelta)!) < 0.5 ? 'STABLE' : 'DEVIATED') : '--'}
            </Text>
          </View>
        </View>
        <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '500', textAlign: 'center', marginTop: 8 }}>
          {currentVitals ? 'Affects readiness — low SpO₂, elevated RR, or temp deviation may reduce recovery' : 'Sync vitals to populate supporting readiness indicators'}
        </Text>
      </GlassPanel>

      {/* Recovery History (7-day bars) */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Recovery History" accent={STITCH.accentTeal} onInfoPress={() => onInfoPress('pillars')} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80, justifyContent: 'space-between' }}>
          {recoveryValues.slice(-7).map((v, i) => {
            const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
            const today = new Date()
            const dayIdx = (today.getDay() - 7 + i + 7) % 7
            return (
              <DayBar
                key={i}
                label={dayNames[dayIdx]}
                height={v}
                color={v >= 66 ? STITCH.success : v >= 33 ? STITCH.warning : STITCH.error}
                value={`${formatScore(v)}`}
              />
            )
          })}
        </View>
      </GlassPanel>

      {/* Sleep Duration vs Need */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Sleep Duration vs Need" accent={STITCH.accentTeal} onInfoPress={() => onInfoPress('glossary')} />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Actual</Text>
            <View style={{ height: 48, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <View style={{
                height: `${sleepPct}%` as any,
                backgroundColor: sleepPct >= 80 ? STITCH.accentTeal : STITCH.warning,
                borderTopLeftRadius: 8, borderTopRightRadius: 8,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: STITCH.onSurface, fontSize: 16, fontWeight: '800' }}>{safeNumber(sleepHours, 1)}h</Text>
              </View>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Need</Text>
            <View style={{ height: 48, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <View style={{
                height: '100%' as any,
                backgroundColor: 'rgba(20,184,166,0.15)',
                borderRadius: 8,
                borderWidth: 1, borderColor: 'rgba(20,184,166,0.30)',
                borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: STITCH.accentTeal, fontSize: 16, fontWeight: '800' }}>{safeNumber(sleepNeedHours, 1)}h</Text>
              </View>
            </View>
          </View>
        </View>
      </GlassPanel>

      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Autonomic Balance" accent={STITCH.accentTeal} onInfoPress={() => onInfoPress('glossary')} />
        {recoveryValues.length > 0 ? (
          <>
            <AnsBalanceBar parasympathetic={recoveryValues[0]} />
            <MicroNarrative text={
              recoveryValues[0] >= 66
                ? 'Recovery score indicates parasympathetic dominance — primed for training.'
                : recoveryValues[0] >= 33
                  ? 'Recovery score suggests moderate autonomic balance. Monitor load carefully.'
                  : 'Recovery is depleted. Prioritize rest and low-intensity recovery.'
            } />
          </>
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
            Sync recovery data to view autonomic balance
          </Text>
        )}
      </GlassPanel>

      {/* Readiness Drivers */}
      <View style={{ marginBottom: 16 }}>
        <SectionHeader label="Readiness Drivers" accent={STITCH.onSurface} />
        <DriverList drivers={[
          { label: 'Sleep Need Met', value: last7Sleep.length > 0 ? `${formatScore(sleepPct)}%` : '--', impact: last7Sleep.length > 0 ? (sleepPct >= 90 ? 'positive' : 'negative') : 'neutral' },
          { label: 'Resting Heart Rate', value: rhrLatest !== null && safeRHR(rhrLatest) !== null ? `${safeRHR(rhrLatest)} bpm` : '--', impact: rhrLatest !== null ? (rhrLatest < 60 ? 'positive' : 'negative') : 'neutral' },
          { label: 'Heart Rate Variability', value: hrvLatest !== null && safeHRV(hrvLatest) !== null ? `${safeHRV(hrvLatest)} ms` : '--', impact: hrvLatest !== null ? (hrvLatest > 60 ? 'positive' : 'neutral') : 'neutral' }
        ]} />
        {last7Sleep.length > 0 ? (
          <MicroNarrative text={
            sleepPct >= 90
              ? `Sleep need met at ${formatScore(sleepPct)}% — your strongest readiness contributor.`
              : `Sleep at ${formatScore(sleepPct)}% of need. ${hrvLatest !== null ? `HRV ${safeHRV(hrvLatest)}ms · ` : ''}Prioritize rest to improve readiness.`
          } />
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '500', marginTop: 4 }}>Drivers update as data accumulates</Text>
        )}
      </View>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// RESILIENCE DRILLDOWN
// ═══════════════════════════════════════════════════════════════════════════
function ResilienceView({
  currentScores,
  currentVitals,
  mobilityRecord,
  environmentalRecord,
  cardioRecord,
  injuryRisk,
  cnsStressScore,
  scoresHistory,
  synthesis,
  onInfoPress,
}: {
  currentScores: DailyScores | null
  currentVitals: VitalsRecord | null
  mobilityRecord: MobilityRecord | null
  environmentalRecord: EnvironmentalRecord | null
  cardioRecord: CardioMetabolicRecord | null
  injuryRisk: InjuryRisk | null
  cnsStressScore: CnsStressScore | null
  scoresHistory: DailyScores[]
  synthesis: import('../../src/lib/types').SynthesisOutput | null
  onInfoPress: (tab: 'pillars' | 'glossary') => void
}) {
  const immunityLabel = currentScores?.immunityRisk ?? null
  const immunityColor = immunityLabel === 'LOW' ? STITCH.success : immunityLabel === 'ELEVATED' ? STITCH.warning : immunityLabel === 'HIGH' ? STITCH.error : STITCH.dimText

  const injuryLabel = injuryRisk?.risk ?? null
  const injuryColor = injuryLabel === 'LOW' ? STITCH.success : injuryLabel === 'MODERATE' ? STITCH.warning : injuryLabel === 'HIGH' ? STITCH.error : STITCH.dimText

  const cnsLabel = cnsStressScore?.risk ?? null
  const cnsColor = cnsLabel === 'LOW' ? STITCH.success : cnsLabel === 'MODERATE' ? STITCH.warning : cnsLabel === 'HIGH' ? STITCH.error : STITCH.dimText

  // Resilience trend: use HRV as primary resilience signal (higher HRV = more resilient)
  const resilienceValues = scoresHistory.filter(s => s.recoveryScore > 0).map(s => s.recoveryScore)

  // Vitals-based resilience indicators
  const hrvResVal = currentVitals ? safeHRV(currentVitals.hrv) : null
  const rhrResVal = currentVitals ? safeRHR(currentVitals.rhr) : null

  // CNS numeric score (derive from available metrics)
  const cnsNumericScore = cnsStressScore?.risk === 'LOW' ? 25 : cnsStressScore?.risk === 'MODERATE' ? 55 : cnsStressScore?.risk === 'HIGH' ? 88 : null

  return (
    <View>
      {/* Resilience Score Hero — Premium Orb */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <PremiumOrb
          variant="health-resilience"
          primaryValue={synthesis?.resilience?.score != null ? formatScore(synthesis.resilience.score) : null}
          primaryLabel="RESILIENCE"
          secondaryLabel={synthesis?.resilience?.zoneLabel != null ? synthesis.resilience.zoneLabel : null}
          isEmpty={synthesis?.resilience == null || synthesis.resilience.dataCoverage === 'insufficient'}
          fallbackText="Sync HealthKit for resilience data"
          accessibilityLabel="Resilience score orb. Shows your defense and strain capacity."
        />
      </View>

      {/* Defense Status Grid */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentPurple, fontSize: 14 }}>🛡️</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>Immune</Text>
            </View>
            <Text style={{ color: immunityLabel ? STITCH.onSurface : STITCH.dimText, fontSize: 28, fontWeight: '900' }}>{immunityLabel ?? '--'}</Text>
            <Text style={{ color: immunityColor, fontSize: 9, fontWeight: '700', marginTop: 4 }}>
              {immunityLabel === 'LOW' ? 'PROTECTED' : immunityLabel === 'ELEVATED' ? 'WATCH' : immunityLabel === 'HIGH' ? 'COMPROMISED' : 'NO DATA'}
            </Text>
            <ProgressBar pct={immunityLabel === 'LOW' ? 85 : immunityLabel === 'ELEVATED' ? 45 : immunityLabel === 'HIGH' ? 15 : 5} color={immunityColor} />
          </GlassPanel>
        </View>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentPurple, fontSize: 14 }}>⚠️</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>Injury</Text>
            </View>
            <Text style={{ color: injuryLabel ? STITCH.onSurface : STITCH.dimText, fontSize: 28, fontWeight: '900' }}>{injuryLabel ?? '--'}</Text>
            <Text style={{ color: injuryColor, fontSize: 9, fontWeight: '700', marginTop: 4 }}>
              {injuryLabel === 'LOW' ? 'STABLE' : injuryLabel === 'MODERATE' ? 'WATCH' : injuryLabel === 'HIGH' ? 'ELEVATED' : 'NO DATA'}
            </Text>
            <ProgressBar pct={injuryLabel === 'LOW' ? 90 : injuryLabel === 'MODERATE' ? 40 : injuryLabel === 'HIGH' ? 12 : 5} color={injuryColor} />
          </GlassPanel>
        </View>
      </View>

      {/* CNS Load Gauge */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Text style={{ color: STITCH.accentPurple, fontSize: 14 }}>🧠</Text>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>CNS Load</Text>
          <TouchableOpacity onPress={() => onInfoPress('glossary')} activeOpacity={0.7} hitSlop={10}>
            <MaterialIcons name="info-outline" size={12} color={STITCH.dimText} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            {cnsNumericScore != null && (
              <Text style={{ color: cnsColor, fontSize: 20, fontWeight: '900' }}>{cnsNumericScore}<Text style={{ fontSize: 11, color: STITCH.dimText }}>/100</Text></Text>
            )}
            <Text style={{ color: cnsLabel ? STITCH.onSurface : STITCH.dimText, fontSize: 14, fontWeight: '800' }}>{cnsLabel ?? '--'}</Text>
          </View>
        </View>
        <View style={{ height: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
          <View style={{
            width: cnsNumericScore != null ? `${cnsNumericScore}%` as any : '3%' as any,
            height: '100%',
            backgroundColor: cnsColor,
            borderRadius: 5,
          }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '600' }}>Calm</Text>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '600' }}>Taxed</Text>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '600' }}>Overloaded</Text>
        </View>
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: STITCH.border }}>
          {cnsStressScore ? (
            <>
              <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 11, lineHeight: 18 }}>{cnsStressScore.explanation}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <View>
                  <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Noise</Text>
                  <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                    {safeAudioLevel(cnsStressScore.audioLoad) !== null ? `${safeAudioLevel(cnsStressScore.audioLoad)} dB` : '--'}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Daylight</Text>
                  <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                    {safeDaylightMins(cnsStressScore.daylightDeficit) !== null ? `${safeDaylightMins(cnsStressScore.daylightDeficit)}m` : '--'}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>HRV Drop</Text>
                  <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                    {safeNumber(cnsStressScore.hrvSuppression, 0, '%')}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={{ color: STITCH.dimText, fontSize: 11, lineHeight: 18, textAlign: 'center' }}>
              CNS stress detail will populate after sufficient data is synced
            </Text>
          )}
        </View>
      </GlassPanel>

      {/* Resilience Biomarkers — HRV & RHR */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentPurple, fontSize: 13, fontWeight: '900' }}>⚡</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>HRV</Text>
            </View>
            <Text style={{ color: hrvResVal !== null ? STITCH.onSurface : STITCH.dimText, fontSize: 24, fontWeight: '900' }}>
              {hrvResVal !== null ? `${hrvResVal}` : '--'}
              <Text style={{ fontSize: 11, color: STITCH.dimText, fontWeight: '400' }}> ms</Text>
            </Text>
            <Text style={{ color: hrvResVal !== null ? (hrvResVal > 40 ? STITCH.success : STITCH.warning) : STITCH.dimText, fontSize: 8, fontWeight: '700', marginTop: 4 }}>
              {hrvResVal !== null ? (hrvResVal > 60 ? 'HIGH RESILIENCE' : hrvResVal > 40 ? 'MODERATE' : 'LOW') : 'NO DATA'}
            </Text>
            <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '500', marginTop: 6, lineHeight: 12 }}>
              {hrvResVal !== null ? 'Higher HRV signals stronger autonomic flexibility & stress resilience' : 'HRV is a primary marker of nervous system recovery capacity'}
            </Text>
          </GlassPanel>
        </View>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentPurple, fontSize: 13, fontWeight: '900' }}>♥</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>RHR</Text>
            </View>
            <Text style={{ color: rhrResVal !== null ? STITCH.onSurface : STITCH.dimText, fontSize: 24, fontWeight: '900' }}>
              {rhrResVal !== null ? `${rhrResVal}` : '--'}
              <Text style={{ fontSize: 11, color: STITCH.dimText, fontWeight: '400' }}> bpm</Text>
            </Text>
            <Text style={{ color: rhrResVal !== null ? (rhrResVal < 60 ? STITCH.success : rhrResVal < 80 ? STITCH.warning : STITCH.error) : STITCH.dimText, fontSize: 8, fontWeight: '700', marginTop: 4 }}>
              {rhrResVal !== null ? (rhrResVal < 55 ? 'ELITE RECOVERY' : rhrResVal < 65 ? 'GOOD' : 'ELEVATED') : 'NO DATA'}
            </Text>
            <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '500', marginTop: 6, lineHeight: 12 }}>
              {rhrResVal !== null ? 'Lower resting heart rate indicates better cardiovascular efficiency & resilience' : 'RHR is a fundamental marker of overall recovery capacity'}
            </Text>
          </GlassPanel>
        </View>
      </View>

      {/* 7-Day Resilience Trend */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="7-Day Resilience Trend" accent={STITCH.accentPurple} onInfoPress={() => onInfoPress('pillars')} />
        {resilienceValues.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80, justifyContent: 'space-between' }}>
            {resilienceValues.slice(-7).map((v, i) => {
              const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
              const today = new Date()
              const dayIdx = (today.getDay() - 7 + i + 7) % 7
              return (
                <DayBar
                  key={i}
                  label={dayNames[dayIdx]}
                  height={Math.max(5, v * 0.85)}
                  color={v >= 66 ? STITCH.accentPurple : v >= 33 ? STITCH.warning : STITCH.error}
                  value={`${formatScore(v)}`}
                />
              )
            })}
          </View>
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>Insufficient data</Text>
        )}
      </GlassPanel>

      {/* Body Details */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Body Details" accent={STITCH.accentPurple} onInfoPress={() => onInfoPress('glossary')} />
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Movement Health</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Asymmetry</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {mobilityRecord ? safeNumber(mobilityRecord.walkingAsymmetry, 1, '%') : '--'}
              </Text>
            </View>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Stability</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {mobilityRecord ? safeNumber(mobilityRecord.doubleSupport, 1, '%') : '--'}
              </Text>
            </View>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Speed</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {mobilityRecord && safeWalkingSpeed(mobilityRecord.walkingSpeed) !== null ? safeNumber(safeWalkingSpeed(mobilityRecord.walkingSpeed)!, 2) : '--'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginBottom: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: STITCH.border }}>
          <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Environment</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Sunlight</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {environmentalRecord && safeDaylightMins(environmentalRecord.timeInDaylight) !== null ? `${safeDaylightMins(environmentalRecord.timeInDaylight)} min` : '--'}
              </Text>
            </View>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Standing</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {environmentalRecord ? safeNumber(environmentalRecord.standHours, 0, 'h') : '--'}
              </Text>
            </View>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Exercise</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {environmentalRecord ? safeNumber(environmentalRecord.exerciseMinutes, 0, ' min') : '--'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingTop: 12, borderTopWidth: 0.5, borderTopColor: STITCH.border }}>
          <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Breathing & Cardio</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>VO2 Max</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {cardioRecord && safeVO2Max(cardioRecord.vo2Max) !== null ? safeNumber(safeVO2Max(cardioRecord.vo2Max)!, 1) : '--'}
              </Text>
            </View>
            <View>
              <Text style={{ color: STITCH.dimText, fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Breath</Text>
              <Text style={{ color: STITCH.onSurface, fontSize: 14, fontWeight: '800' }}>
                {cardioRecord ? safeNumber(cardioRecord.breathingDisturbances, 1, '/hr') : '--'}
              </Text>
            </View>
          </View>
        </View>
      </GlassPanel>

      {/* Resilience Drivers */}
      <View style={{ marginBottom: 16 }}>
        <SectionHeader label="Resilience Drivers" accent={STITCH.onSurface} />
        <DriverList drivers={[
          { label: 'Immunity Risk', value: currentScores?.immunityRisk ?? '--', impact: currentScores?.immunityRisk === 'LOW' ? 'positive' : currentScores?.immunityRisk === 'HIGH' ? 'negative' : 'neutral' },
          { label: 'CNS Stress', value: cnsStressScore?.risk ?? '--', impact: cnsStressScore?.risk === 'LOW' ? 'positive' : cnsStressScore?.risk === 'HIGH' ? 'negative' : 'neutral' },
          { label: 'Injury Risk', value: injuryRisk?.risk ?? '--', impact: injuryRisk?.risk === 'LOW' ? 'positive' : injuryRisk?.risk === 'HIGH' ? 'negative' : 'neutral' }
        ]} />
        <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '500', marginTop: 6, lineHeight: 14 }}>
          {immunityLabel && injuryLabel && cnsLabel
            ? `Defense systems — Immune: ${immunityLabel}, Injury: ${injuryLabel}, CNS: ${cnsLabel}`
            : 'Defense system data is incomplete — drivers update as more HealthKit data syncs'}
        </Text>
      </View>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LONGEVITY DRILLDOWN
// ═══════════════════════════════════════════════════════════════════════════
function LongevityView({
  currentScores,
  currentVitals,
  mobilityRecord,
  cardioRecord,
  environmentalRecord,
  chronologicalAge,
  scoresHistory,
  synthesis,
  onInfoPress,
}: {
  currentScores: DailyScores | null
  currentVitals: VitalsRecord | null
  mobilityRecord: MobilityRecord | null
  cardioRecord: CardioMetabolicRecord | null
  environmentalRecord: EnvironmentalRecord | null
  chronologicalAge: number
  scoresHistory: DailyScores[]
  synthesis: import('../../src/lib/types').SynthesisOutput | null
  onInfoPress: (tab: 'pillars' | 'glossary') => void
}) {
  const bioAgeFromScores = safeBiologicalAge(currentScores?.biologicalAge, chronologicalAge)
  const paceFromScores = safePaceOfAging(currentScores?.paceOfAging)
  // When confidence is zero or pace/bio age are fallback values, show "No data"
  // instead of misleadingly displaying chronological age as if it were measured.
  const confidence = currentScores?.bioAgeConfidence
  const isLongevityFallback =
    bioAgeFromScores == null ||
    paceFromScores == null ||
    (confidence != null && confidence <= 0) ||
    (bioAgeFromScores === chronologicalAge && (confidence == null || confidence < 0.3))
  const biologicalAge = isLongevityFallback ? null : (bioAgeFromScores ?? chronologicalAge)
  const paceOfAging = isLongevityFallback ? null : (paceFromScores ?? 1.0)
  const ageDelta = biologicalAge != null ? biologicalAge - chronologicalAge : 0
  const paceColor = paceOfAging != null
    ? (paceOfAging < 1.0 ? STITCH.success : paceOfAging <= 1.05 ? STITCH.warning : STITCH.error)
    : STITCH.dimText
  const paceLabel = paceOfAging != null
    ? (paceOfAging < 0.98 ? 'REVERSING' : paceOfAging < 1.0 ? 'OPTIMAL' : paceOfAging <= 1.05 ? 'STEADY' : 'ACCELERATING')
    : '—'

  const vo2Max = cardioRecord?.vo2Max ?? 0
  const vo2MaxPct = Math.min(100, (vo2Max / 60) * 100)
  // VO₂ Max direction: use recoveryScore slope as a cardio fitness proxy when cardioRecord differs
  const vo2MaxCategory = vo2Max > 48 ? 'SUPERIOR' : vo2Max > 42 ? 'EXCELLENT' : vo2Max > 35 ? 'GOOD' : vo2Max > 30 ? 'FAIR' : vo2Max > 0 ? 'BELOW AVG' : null

  const hrvLong = currentVitals ? safeHRV(currentVitals.hrv) : null
  const rhrLong = currentVitals ? safeRHR(currentVitals.rhr) : null

  // Safe mobility values
  const symmetryVal = mobilityRecord?.walkingAsymmetry != null ? (100 - mobilityRecord.walkingAsymmetry) : null
  const doubleSupportVal = mobilityRecord?.doubleSupport ?? null
  const speedVal = mobilityRecord ? safeWalkingSpeed(mobilityRecord.walkingSpeed) : null

  // Protocol adherence checklist — only mark 'done' when verifiable from data
  type ProtocolItem = { label: string; done: boolean | null }
  const sleepDebtVal = safeSleepDebtHours(currentScores?.sleepDebtHours)
  const protocols: ProtocolItem[] = [
    { label: 'Daily daylight ≥ 30 min', done: environmentalRecord ? environmentalRecord.timeInDaylight >= 30 : null },
    { label: 'Bedtime before 11 PM', done: sleepDebtVal != null ? sleepDebtVal < 1 : null },
    { label: 'Daily mindfulness ≥ 10 min', done: environmentalRecord ? (environmentalRecord.mindfulMinutes ?? 0) >= 10 : null },
    { label: 'Strength training 2x/week', done: null },
    { label: 'Aerobic zone 2 ≥ 180 min/week', done: null },
    { label: 'Protein ≥ 1.6 g/kg BW', done: null },
  ]
  const verifiedCount = protocols.filter(p => p.done === true).length
  const unverifiedCount = protocols.filter(p => p.done === null).length
  const totalProtocols = protocols.length

  return (
    <View>
      {/* Longevity Score Hero — Premium Orb */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <PremiumOrb
          variant="health-longevity"
          primaryValue={!isLongevityFallback && biologicalAge != null ? formatAge(biologicalAge) : null}
          primaryLabel="BIOLOGICAL AGE"
          secondaryLabel={!isLongevityFallback && biologicalAge != null && paceOfAging != null
            ? `${biologicalAge < chronologicalAge ? '↓' : '↑'} ${safeNumber(Math.abs(biologicalAge - chronologicalAge), 1)} yr ${biologicalAge < chronologicalAge ? 'younger' : 'older'} · Pace ${safeNumber(paceOfAging, 2)}x`
            : null}
          isEmpty={isLongevityFallback}
          fallbackText="Sync HealthKit for biological age"
          accessibilityLabel="Biological Age orb. Shows your longevity metrics."
        />
      </View>

      {/* Biological Age vs Chronological */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
            Biological vs Chronological
          </Text>
          <TouchableOpacity onPress={() => onInfoPress('glossary')} activeOpacity={0.7} hitSlop={10}>
            <MaterialIcons name="info-outline" size={14} color={STITCH.dimText} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <View>
            <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Bio Age</Text>
            <Text style={{ color: biologicalAge != null ? STITCH.accentCyan : STITCH.dimText, fontSize: 52, fontWeight: '900', letterSpacing: -2, textShadowColor: biologicalAge != null ? 'rgba(0,229,255,0.4)' : 'transparent', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: biologicalAge != null ? 12 : 0 }}>
              {biologicalAge != null ? formatAge(biologicalAge) : '—'}
            </Text>
            <Text style={{ color: STITCH.dimText, fontSize: 11 }}>years</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Chrono Age</Text>
            <Text style={{ color: STITCH.onSurface, fontSize: 32, fontWeight: '800' }}>{chronologicalAge}.0</Text>
            <Text style={{ color: STITCH.dimText, fontSize: 11 }}>years</Text>
          </View>
        </View>

        {/* Age Delta */}
        <View style={{
          alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4,
          backgroundColor: ageDelta < 0 ? 'rgba(48,209,88,0.15)' : ageDelta > 2 ? 'rgba(255,69,58,0.15)' : 'rgba(255,214,10,0.15)',
          borderRadius: 9999, borderWidth: 0.5,
          borderColor: ageDelta < 0 ? 'rgba(48,209,88,0.30)' : ageDelta > 2 ? 'rgba(255,69,58,0.30)' : 'rgba(255,214,10,0.30)',
          marginBottom: 12,
        }}>
          <Text style={{ color: ageDelta < 0 ? STITCH.success : ageDelta > 2 ? STITCH.error : STITCH.warning, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
            {ageDelta < 0 ? '↓' : ageDelta > 0 ? '↑' : '→'} {safeNumber(Math.abs(ageDelta), 1)} yr {ageDelta < 0 ? 'younger' : ageDelta > 0 ? 'older' : 'aligned'}
          </Text>
        </View>

        {/* Aging Pace */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Pace</Text>
          <Text style={{ color: paceColor, fontSize: 22, fontWeight: '900' }}>{paceOfAging != null ? safeNumber(paceOfAging, 2) + 'x' : '—'}</Text>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999,
            backgroundColor: `${paceColor}15`, borderWidth: 0.5, borderColor: `${paceColor}30`,
          }}>
            <Text style={{ color: paceColor, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>{paceLabel}</Text>
          </View>
        </View>

        {/* Recency / truthfulness label for longevity estimates */}
        {isLongevityFallback && (
          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 9, fontWeight: '500', textAlign: 'center' }}>
              Awaiting recent longevity inputs
            </Text>
          </View>
        )}
      </GlassPanel>

      {/* VO2 Max Trend */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="VO₂ Max" accent={STITCH.accentCyan} onInfoPress={() => onInfoPress('glossary')} />
        {cardioRecord && vo2Max > 0 ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
              <View>
                <Text style={{ color: STITCH.onSurface, fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>
                  {safeNumber(vo2Max, 1)}
                  <Text style={{ fontSize: 13, color: STITCH.dimText, fontWeight: '400' }}> ml/kg/min</Text>
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Walk HR</Text>
                <Text style={{ color: STITCH.onSurface, fontSize: 20, fontWeight: '800' }}>
                  {cardioRecord.walkingHRavg > 0 ? safeNumber(cardioRecord.walkingHRavg, 0) : '--'}
                  <Text style={{ fontSize: 11, color: STITCH.dimText }}> bpm</Text>
                </Text>
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{
                width: `${vo2MaxPct}%` as any, height: '100%',
                backgroundColor: vo2Max > 45 ? STITCH.accentCyan : vo2Max > 35 ? STITCH.warning : STITCH.error,
                borderRadius: 3,
              }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: vo2MaxCategory ? STITCH.accentCyan : STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>
                {vo2MaxCategory ? `${vo2MaxCategory} CATEGORY` : 'Elite: 60+'}
              </Text>
              {vo2MaxCategory && <Text style={{ color: STITCH.dimText, fontSize: 9 }}>Elite: 60+</Text>}
            </View>
          </>
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
            Sync cardio data (Apple Watch walking HR or lab test) to estimate VO₂ Max
          </Text>
        )}
      </GlassPanel>

      {/* Heart Rate Recovery (HRR) Panel */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Heart Rate Recovery (HRR)" accent={STITCH.accentCyan} onInfoPress={() => onInfoPress('glossary')} />
        {cardioRecord && (cardioRecord.hrRecovery ?? 0) > 0 ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
              <View>
                <Text style={{ color: STITCH.onSurface, fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>
                  {cardioRecord.hrRecovery != null ? safeNumber(cardioRecord.hrRecovery, 0) : '--'}
                  <Text style={{ fontSize: 13, color: STITCH.dimText, fontWeight: '400' }}> bpm drop</Text>
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>1-min Post-Workout</Text>
                <Text style={{ color: cardioRecord.hrRecovery && cardioRecord.hrRecovery >= 30 ? STITCH.success : STITCH.warning, fontSize: 13, fontWeight: '800' }}>
                  {cardioRecord.hrRecovery && cardioRecord.hrRecovery >= 40 ? 'ATHLETIC' : cardioRecord.hrRecovery && cardioRecord.hrRecovery >= 30 ? 'EXCELLENT' : cardioRecord.hrRecovery && cardioRecord.hrRecovery >= 20 ? 'GOOD' : 'NORMAL'}
                </Text>
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{
                width: `${Math.min(100, ((cardioRecord.hrRecovery ?? 0) / 60) * 100)}%` as any, height: '100%',
                backgroundColor: (cardioRecord.hrRecovery ?? 0) >= 30 ? STITCH.accentCyan : (cardioRecord.hrRecovery ?? 0) >= 20 ? STITCH.warning : STITCH.error,
                borderRadius: 3,
              }} />
            </View>
            <Text style={{ color: STITCH.dimText, fontSize: 9, marginTop: 6, lineHeight: 13 }}>
              HRR measures how quickly your heart rate drops 1 minute after exercise. A faster drop indicates robust parasympathetic activation and superior longevity.
            </Text>
          </>
        ) : (
          <Text style={{ color: STITCH.dimText, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
            Sync workout data from Apple Watch to measure Heart Rate Recovery
          </Text>
        )}
      </GlassPanel>

      {/* Longevity Biomarkers — HRV & RHR */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentCyan, fontSize: 13, fontWeight: '900' }}>⚡</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>HRV</Text>
            </View>
            <Text style={{ color: hrvLong !== null ? STITCH.onSurface : STITCH.dimText, fontSize: 22, fontWeight: '900' }}>
              {hrvLong !== null ? `${hrvLong}` : '--'}
              <Text style={{ fontSize: 10, color: STITCH.dimText, fontWeight: '400' }}> ms</Text>
            </Text>
            <Text style={{ color: hrvLong !== null ? (hrvLong > 40 ? STITCH.success : STITCH.warning) : STITCH.dimText, fontSize: 8, fontWeight: '700', marginTop: 3 }}>
              {hrvLong !== null ? (hrvLong > 60 ? 'STRONG AGING DEFENSE' : hrvLong > 40 ? 'ADEQUATE' : 'BELOW OPTIMAL') : 'NO DATA'}
            </Text>
            <Text style={{ color: STITCH.dimText, fontSize: 7, fontWeight: '500', marginTop: 5, lineHeight: 11 }}>
              HRV is a top longevity biomarker — higher values correlate with slower epigenetic aging
            </Text>
          </GlassPanel>
        </View>
        <View style={{ flex: 1 }}>
          <GlassPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ color: STITCH.accentCyan, fontSize: 13, fontWeight: '900' }}>♥</Text>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>RHR</Text>
            </View>
            <Text style={{ color: rhrLong !== null ? STITCH.onSurface : STITCH.dimText, fontSize: 22, fontWeight: '900' }}>
              {rhrLong !== null ? `${rhrLong}` : '--'}
              <Text style={{ fontSize: 10, color: STITCH.dimText, fontWeight: '400' }}> bpm</Text>
            </Text>
            <Text style={{ color: rhrLong !== null ? (rhrLong < 60 ? STITCH.success : rhrLong < 80 ? STITCH.warning : STITCH.error) : STITCH.dimText, fontSize: 8, fontWeight: '700', marginTop: 3 }}>
              {rhrLong !== null ? (rhrLong < 55 ? 'EXCELLENT' : rhrLong < 65 ? 'GOOD' : 'ABOVE AVG') : 'NO DATA'}
            </Text>
            <Text style={{ color: STITCH.dimText, fontSize: 7, fontWeight: '500', marginTop: 5, lineHeight: 11 }}>
              Lower resting heart rate is associated with longer lifespan & reduced all-cause mortality
            </Text>
          </GlassPanel>
        </View>
      </View>

      {/* Gait Symmetry & Stability */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="Movement & Stability" accent={STITCH.accentCyan} onInfoPress={() => onInfoPress('glossary')} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: STITCH.surface,
              borderWidth: 2, borderColor: `${STITCH.accentCyan}30`,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 6,
            }}>
              <Text style={{ color: STITCH.accentCyan, fontSize: 18, fontWeight: '900' }}>
                {symmetryVal !== null ? `${safeNumber(symmetryVal, 0)}%` : '--'}
              </Text>
            </View>
            <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '600', textAlign: 'center' }}>Gait Symmetry</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: STITCH.surface,
              borderWidth: 2, borderColor: `${STITCH.accentCyan}30`,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 6,
            }}>
              <Text style={{ color: STITCH.accentCyan, fontSize: 18, fontWeight: '900' }}>
                {doubleSupportVal !== null ? `${safeNumber(doubleSupportVal, 1)}%` : '--'}
              </Text>
            </View>
            <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '600', textAlign: 'center' }}>Stability Index</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: STITCH.surface,
              borderWidth: 2, borderColor: `${STITCH.accentCyan}30`,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 6,
            }}>
              <Text style={{ color: STITCH.accentCyan, fontSize: 18, fontWeight: '900' }}>
                {speedVal !== null ? `${safeNumber(speedVal, 2)}` : '--'}
              </Text>
            </View>
            <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '600', textAlign: 'center' }}>Walk m/s</Text>
          </View>
        </View>
        {!mobilityRecord && (
          <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 8 }}>
            Sync mobility data to populate movement metrics
          </Text>
        )}
      </GlassPanel>

      {/* AI Protocol Adherence Checklist */}
      <GlassPanel style={{ marginBottom: 16 }}>
        <SectionHeader label="AI Protocol Adherence" accent={STITCH.accentCyan} onInfoPress={() => onInfoPress('pillars')} />
        {protocols.map((p, i) => {
          const isVerified = p.done === true
          const isFailed = p.done === false
          const isUnverified = p.done === null
          return (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 10, paddingHorizontal: 12,
              backgroundColor: isVerified ? STITCH.glass : isUnverified ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.02)',
              borderRadius: 10, marginBottom: i < protocols.length - 1 ? 6 : 0,
            }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: isVerified ? 'rgba(0,229,255,0.15)' : isUnverified ? 'rgba(255,255,255,0.03)' : 'rgba(255,69,58,0.10)',
                borderWidth: 1, borderColor: isVerified ? 'rgba(0,229,255,0.30)' : isUnverified ? 'rgba(255,255,255,0.08)' : 'rgba(255,69,58,0.25)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: isVerified ? STITCH.accentCyan : isUnverified ? STITCH.dimText : STITCH.error, fontSize: 11, fontWeight: '900' }}>
                  {isVerified ? '✓' : isUnverified ? '?' : '✗'}
                </Text>
              </View>
              <Text style={{
                color: isUnverified ? STITCH.dimText : STITCH.onSurface,
                fontSize: 12, fontWeight: '600',
              }}>
                {p.label}
                {isUnverified && <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '400' }}>  — track to verify</Text>}
              </Text>
            </View>
          )
        })}
      </GlassPanel>

      {/* Longevity Drivers */}
      <View style={{ marginBottom: 16 }}>
        <SectionHeader label="Longevity Drivers" accent={STITCH.onSurface} />
        <DriverList drivers={[
          { label: 'VO2 Max', value: cardioRecord?.vo2Max && safeVO2Max(cardioRecord.vo2Max) !== null ? safeNumber(safeVO2Max(cardioRecord.vo2Max)!, 1) : '--', impact: cardioRecord?.vo2Max && safeVO2Max(cardioRecord.vo2Max) !== null && safeVO2Max(cardioRecord.vo2Max)! > 40 ? 'positive' : 'neutral' },
          { label: 'Protocol Adherence', value: verifiedCount > 0 ? `${verifiedCount}/${totalProtocols}` : `0 verified`, impact: verifiedCount >= 2 ? 'positive' : 'neutral' },
          { label: 'Gait Symmetry', value: symmetryVal != null ? `${safeNumber(symmetryVal, 0)}%` : '--', impact: 'neutral' }
        ]} />
        {unverifiedCount > 0 && (
          <Text style={{ color: STITCH.dimText, fontSize: 10, fontWeight: '500', marginTop: 6, lineHeight: 14 }}>
            {unverifiedCount} protocol{unverifiedCount > 1 ? 's' : ''} unverified — track habits to confirm adherence
          </Text>
        )}
        <MicroNarrative text="Protocol adherence is based on tracked data. Unverified items need activity logging to confirm." />
      </View>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HEALTH SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function HealthScreen() {
  const { date, focus } = useLocalSearchParams<{ date?: string; focus?: string }>()
  const {
    loadFromDB,
    scores,
    vitals,
    sleep,
    mobility,
    environmental,
    cardioMetabolic,
    selectedDate,
    setSelectedDate,
    isLoading,
    initialSyncDone,
  } = useHealthStore()

  const sel = useSelectedDateHealthState()
  const {
    dateStr,
    selectedDateObj,
    isToday,
    displayDate,
    currentScores,
    currentVitals,
    currentSleep,
    currentActivities,
    currentDynamics,
    currentMobility,
    currentEnvironmental,
    currentCardio,
    chronologicalAge,
    isAgeConfigured,
    biologicalAge,
    paceOfAging,
    synthesis,
    trendReport,
    injuryRisk,
    cnsStressScore,
    shiftDate: shiftDateFromHook,
  } = sel

  // [CANONICAL] Scope-explicit data access via canonical selectors
  // These live alongside useSelectedDateHealthState(), providing provenance
  // metadata and honest empty states for each domain on the Health deep-dive.
  const canonicalHealth = useMemo(() => {
    const storeState = useHealthStore.getState()
    return {
      vitals: selectVitalsForDate(storeState, selectedDate),
      scores: selectScoresForDate(storeState, selectedDate),
      sleep: selectSleepForDate(storeState, selectedDate),
      activities: selectActivitiesForDate(storeState, selectedDate),
      mobility: selectMobilityForDate(storeState, selectedDate),
      environmental: selectEnvironmentalForDate(storeState, selectedDate),
      cardiometabolic: selectCardioMetabolicForDate(storeState, selectedDate),
      runningDynamics: selectRunningDynamicsForDate(storeState, selectedDate),
      rolling7dScores: selectRolling7dScores(storeState, selectedDate),
    }
  }, [selectedDate, vitals.length, scores.length, sleep.length, mobility.length, environmental.length, cardioMetabolic.length])

  const [showInfoModal, setShowInfoModal] = useState(false)
  const [initialModalTab, setInitialModalTab] = useState<'pillars' | 'glossary'>('pillars')

  useEffect(() => {
    if (date) setSelectedDate(date)
  }, [date])

  useEffect(() => { loadFromDB() }, [])

  const fadeProgress = useSharedValue(0)

  useEffect(() => {
    fadeProgress.value = 0
    fadeProgress.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
  }, [selectedDateObj])

  const animStyle = useAnimatedStyle(() => ({ opacity: fadeProgress.value }))

  const vitalsHistory = useMemo(() => vitals.filter(v => v.hrv > 0 || v.rhr > 0).slice(0, 7).reverse(), [vitals])
  const scoresHistory = useMemo(() => scores.filter(s => s.recoveryScore > 0).slice(0, 7).reverse(), [scores])
  const sleepHistory = useMemo(() => sleep.filter(s => s.totalDurationMins > 0).map(s => ({
    totalDurationMins: s.totalDurationMins,
    date: s.date,
  })).slice(0, 7).reverse(), [sleep])

  const shiftDate = (days: number) => shiftDateFromHook(days)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: STITCH.bg }} edges={['top']}>
      {/* ── Stitch-style Fixed Header ─────────────────────────────────── */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: 'rgba(18,18,20,0.60)',
        borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.10)',
        paddingTop: 0,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <View style={{ width: 36 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity onPress={() => shiftDate(-1)} hitSlop={10}>
              <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 16, fontWeight: '900' }}>◀</Text>
            </TouchableOpacity>
            <Text style={{ color: STITCH.onSurface, fontSize: 15, fontWeight: '800', letterSpacing: 2 }}>
              {isToday ? 'TODAY' : displayDate.toUpperCase()}
            </Text>
            <TouchableOpacity
              onPress={() => shiftDate(1)} hitSlop={10}
              disabled={isToday}
              style={{ opacity: isToday ? 0.3 : 1 }}
            >
              <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 16, fontWeight: '900' }}>▶</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setInitialModalTab('pillars')
              setShowInfoModal(true)
            }}
            activeOpacity={0.7}
            style={{ width: 36, alignItems: 'flex-end' }}
          >
            <MaterialIcons name="info-outline" size={24} color={STITCH.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <SegmentedControl
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'readiness', label: 'Readiness' },
              { id: 'resilience', label: 'Resilience' },
              { id: 'longevity', label: 'Longevity' }
            ]}
            activeTab={focus || 'overview'}
            onChange={(id) => {
              // @ts-ignore - expo-router typing quirk
              router.setParams({ focus: id === 'overview' ? '' : id })
            }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 20, paddingTop: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={animStyle}>
          {(isLoading && !initialSyncDone && scores.length === 0) ? (
            <HealthPageSkeleton />
          ) : (
            <>
              {/* Focus Badge - Removed in favor of SegmentedControl */}
              {/* ── Default Health Deep-Dive ── */}
              {(!focus || focus === 'overview') && (
                <DefaultHealthView
                  currentScores={currentScores}
                  currentVitals={currentVitals}
                  currentDynamics={currentDynamics}
                  currentActivities={currentActivities}
                  currentSleep={currentSleep}
                  biologicalAge={biologicalAge}
                  chronologicalAge={chronologicalAge}
                  paceOfAging={paceOfAging}
                  trendReport={trendReport}
                  displayDate={displayDate}
                  dateStr={dateStr}
                  isAgeConfigured={isAgeConfigured}
                  cnsStressScore={cnsStressScore}
                  onInfoPress={(tab) => {
                    setInitialModalTab(tab)
                    setShowInfoModal(true)
                  }}
                />
              )}

              {/* ── Readiness Drilldown ── */}
              {focus === 'readiness' && (
                <ReadinessView
                  currentVitals={currentVitals}
                  currentScores={currentScores}
                  vitalsHistory={vitalsHistory}
                  scoresHistory={scoresHistory}
                  sleepHistory={sleepHistory}
                  synthesis={synthesis}
                  onInfoPress={(tab) => {
                    setInitialModalTab(tab)
                    setShowInfoModal(true)
                  }}
                />
              )}

              {/* ── Resilience Drilldown ── */}
              {focus === 'resilience' && (
                <ResilienceView
                  currentScores={currentScores}
                  currentVitals={currentVitals}
                  mobilityRecord={currentMobility}
                  environmentalRecord={currentEnvironmental}
                  cardioRecord={currentCardio}
                  injuryRisk={injuryRisk}
                  cnsStressScore={cnsStressScore}
                  scoresHistory={scoresHistory}
                  synthesis={synthesis}
                  onInfoPress={(tab) => {
                    setInitialModalTab(tab)
                    setShowInfoModal(true)
                  }}
                />
              )}

              {/* ── Longevity Drilldown ── */}
              {focus === 'longevity' && (
                <LongevityView
                  currentScores={currentScores}
                  currentVitals={currentVitals}
                  mobilityRecord={currentMobility}
                  cardioRecord={currentCardio}
                  environmentalRecord={currentEnvironmental}
                  chronologicalAge={chronologicalAge}
                  scoresHistory={scoresHistory}
                  synthesis={synthesis}
                  onInfoPress={(tab) => {
                    setInitialModalTab(tab)
                    setShowInfoModal(true)
                  }}
                />
              )}
            </>
          )}
        </Animated.View>

        {/* [CANONICAL] Data provenance & scope declaration for Health deep-dive */}
        <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
            data scope · provenance
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {(['vitals', 'scores', 'sleep', 'activities', 'mobility', 'environmental', 'cardiometabolic'] as const).map(domain => {
              const vm = canonicalHealth[domain]
              const isPresent = vm.status === 'present'
              return (
                <View key={domain} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isPresent ? '#30D158' : 'rgba(255,255,255,0.15)' }} />
                  <Text style={{ fontSize: 7, color: isPresent ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.15)', fontWeight: '600' }}>
                    {domain} ({vm.scope})
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Biometrics Info Modal ───────────────────────────────────── */}
      <BiometricsInfoModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        initialTab={initialModalTab}
      />
    </SafeAreaView>
  )
}
