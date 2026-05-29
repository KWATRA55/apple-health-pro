import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { View, Text, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Keyboard, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useHealthStore } from '../../src/lib/store'
import { useSelectedDateHealthState } from '../../src/hooks/useSelectedDateHealthState'
import { ChatWindow, ChatInput } from '../../src/components/coach/chat-window'
import { sendCoachMessage } from '../../src/lib/gemini/client'
import { VisionCapture } from '../../src/components/coach/vision-capture'
import { ensureKnowledgeBaseIndexed, buildRAGContext } from '../../src/lib/rag/coach-rag'
import type { CoachMessage } from '../../src/lib/types'
import {
  safeHRV,
  safeRHR,
  safeSpO2,
  safeRespiratoryRate,
  safeSkinTempDelta,
  safeSleepDurationMins,
  safeNumber,
} from '../../src/lib/utils/display-helpers'
import {
  selectVitalsForDate, selectScoresForDate, selectSleepForDate,
  selectMobilityForDate, selectEnvironmentalForDate,
  selectCardioMetabolicForDate, selectRunningDynamicsForDate,
} from '../../src/lib/canonical-selectors'

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../src/theme/stitch-tokens'

// Backward-compatible local aliases
const S = {
  ..._S,
  accentCyan: _S.pillarLongevity,
  accentTeal: _S.pillarReadiness,
  accentPurple: _S.pillarResilience,
  surfaceContainer: _S.surfaceContainer,
}

// ── Quick Suggestions ──────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  { text: 'How recovered am I today?', icon: '⚡', label: 'Recovery' },
  { text: 'Is my running form okay?', icon: '🏃', label: 'Form Check' },
  { text: 'Am I at risk of injury?', icon: '⚠️', label: 'Injury Risk' },
  { text: 'How is my sleep quality?', icon: '😴', label: 'Sleep' },
]

function getDynamicSuggestions(scores: any): string[] {
  if (!scores) return ['Analyze CNS', 'Running Form', 'Injury Risk', 'Sleep Debt', 'HRV Trend']

  const suggestions: string[] = []

  if (scores.sleepDebtHours > 1.5) {
    suggestions.push('How do I recover fastest?')
    suggestions.push('Analyze my sleep debt')
  } else {
    suggestions.push('Am I ready to train hard?')
  }

  if (scores.recoveryScore < 40) {
    suggestions.push('Why is my recovery so low?')
  }

  if (scores.strainScore > 14) {
    suggestions.push('Did I overtrain today?')
  }

  if (suggestions.length < 4) {
    suggestions.push('Analyze CNS')
    suggestions.push('Running Form')
    suggestions.push('Injury Risk')
  }

  return Array.from(new Set(suggestions)).slice(0, 5)
}

// ── Recovery Zone color helper ─────────────────────────────────────────
function zoneColor(zone: string | null | undefined): string {
  switch (zone) {
    case 'green': return S.success
    case 'yellow': return S.warning
    case 'red': return S.error
    default: return S.dimText
  }
}

function zoneLabel(zone: string | null | undefined): string {
  switch (zone) {
    case 'green': return 'PRIMED'
    case 'yellow': return 'MODERATE'
    case 'red': return 'DEPLETED'
    default: return '--'
  }
}

// ── GlassPanel → EliteCard (V3 canonical component) ───────────────────
import { EliteCard, SectionHeader } from '../../src/components/ui/v3'

function GlassPanel({
  children,
  glowing = false,
  style,
}: {
  children: React.ReactNode
  glowing?: boolean
  style?: any
}) {
  return (
    <EliteCard
      variant={glowing ? 'strong' : 'default'}
      style={[
        glowing && {
          shadowColor: S.primaryFixedDim,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 3,
        } as any,
        style,
      ]}
    >
      {children}
    </EliteCard>
  )
}

// ── Biometric Context Widget ───────────────────────────────────────────
function BiometricsContextWidget({
  recoveryScore,
  strainScore,
  recoveryZone,
  hrvZScore,
  rhrZScore,
}: {
  recoveryScore: number | null
  strainScore: number | null
  recoveryZone: string | null
  hrvZScore: number | null
  rhrZScore: number | null
}) {
  if (recoveryScore == null && strainScore == null) return null

  return (
    <View
      style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        alignSelf: 'center',
        marginTop: 8,
      }}
    >
      {/* Recovery chip */}
      {recoveryScore != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: zoneColor(recoveryZone),
            }}
          />
          <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700' }}>
            {zoneLabel(recoveryZone)}
          </Text>
          <Text style={{ color: S.primaryFixedDim, fontSize: 13, fontWeight: '900' }}>
            {Math.round(recoveryScore)}%
          </Text>
        </View>
      )}

      {/* Divider */}
      {recoveryScore != null && strainScore != null && (
        <View style={{ width: 1, height: 16, backgroundColor: S.border }} />
      )}

      {/* Strain chip */}
      {strainScore != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: S.onSurfaceVariant, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Strain
          </Text>
          <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '900' }}>
            {Math.round(strainScore)}
          </Text>
        </View>
      )}

      {/* HRV / RHR z-score indicators */}
      {(hrvZScore != null || rhrZScore != null) && (
        <View style={{ width: 1, height: 16, backgroundColor: S.border }} />
      )}

      {hrvZScore != null && (
        <Text
          style={{
            color: hrvZScore < -1 ? S.error : hrvZScore < 0 ? S.warning : S.success,
            fontSize: 11,
            fontWeight: '800',
          }}
        >
          HRV {hrvZScore > 0 ? '+' : ''}{safeNumber(hrvZScore, 1)}σ
        </Text>
      )}

      {rhrZScore != null && (
        <Text
          style={{
            color: rhrZScore > 1 ? S.error : rhrZScore > 0 ? S.warning : S.success,
            fontSize: 11,
            fontWeight: '800',
          }}
        >
          RHR {rhrZScore > 0 ? '+' : ''}{safeNumber(rhrZScore, 1)}σ
        </Text>
      )}
    </View>
  )
}

// ── Insight Card ───────────────────────────────────────────────────────
function InsightCard({
  title,
  value,
  subtext,
  accent,
  accentBorder,
  children,
}: {
  title: string
  value?: string
  subtext?: string
  accent?: string
  accentBorder?: string
  children?: React.ReactNode
}) {
  return (
    <GlassPanel
      style={{
        padding: 16,
        flexDirection: 'column',
        gap: 8,
        borderLeftWidth: accentBorder ? 2 : 0,
        borderLeftColor: accentBorder,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: accent ?? S.onSurfaceVariant, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Text>
        {accent && (
          <Text style={{ color: accent, fontSize: 16 }}>◆</Text>
        )}
      </View>
      {value && (
        <Text style={{ color: S.onSurface, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>
          {value}
        </Text>
      )}
      {subtext && (
        <Text style={{ color: S.mutedText, fontSize: 13, lineHeight: 18 }}>
          {subtext}
        </Text>
      )}
      {children}
    </GlassPanel>
  )
}

// ── Suggestive Analysis Button ─────────────────────────────────────────
function SuggestionChip({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 12,
        padding: 14,
        flex: 1,
        minWidth: '46%',
      }}
    >
      <Text style={{ fontSize: 20, marginBottom: 8 }}>{icon}</Text>
      <Text style={{ color: S.onSurface, fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

// ── Protocol Row ───────────────────────────────────────────────────────
function ProtocolRow({ icon, label, accent }: { icon: string; label: string; accent?: string }) {
  return (
    <GlassPanel
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: accent ?? S.secondaryFixedDim, fontSize: 18 }}>{icon}</Text>
        <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '500' }}>{label}</Text>
      </View>
      <Text style={{ color: S.onSurfaceVariant, fontSize: 16 }}>›</Text>
    </GlassPanel>
  )
}

// ── Desktop Nav Fallback ───────────────────────────────────────────────
function DesktopNav() {
  const { width } = useWindowDimensions()
  if (width < 768) return null
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        paddingVertical: 10,
        backgroundColor: 'rgba(0,0,0,0.50)',
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Text style={{ color: S.onSurfaceVariant, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>HOME</Text>
      <Text style={{ color: S.onSurfaceVariant, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>HEALTH</Text>
      <Text style={{ color: S.primaryFixedDim, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>COACH</Text>
      <Text style={{ color: S.onSurfaceVariant, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>PROFILE</Text>
    </View>
  )
}

// ── Main Coach Screen ─────────────────────────────────────────────────
export default function CoachScreen() {
  const { initialQuery } = useLocalSearchParams<{ initialQuery?: string }>()
  const router = useRouter()
  const {
    loadFromDB,
    latestScores,
    latestVitals,
    latestSleep,
    mobility,
    runningDynamics,
    environmental,
    cardioMetabolic,
    meals,
    sleep,
  } = useHealthStore()

  const sel = useSelectedDateHealthState()
  const {
    currentScores,
    currentVitals,
    currentSleep,
    currentCardio,
    trendReport,
    injuryRisk,
    cnsStressScore,
    chronologicalAge,
    dateStr,
  } = sel

  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showVision, setShowVision] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [activeModalData, setActiveModalData] = useState<{
    title: string
    subtitle?: string
    description: string
    science?: string
    metrics?: { label: string; value: string }[]
    redirect?: { label: string; action: () => void }
  } | null>(null)

  // Preferred selected-date data with full database fallback
  const effectiveScores = useMemo(() => currentScores ?? latestScores, [currentScores, latestScores])
  const effectiveVitals = useMemo(() => currentVitals ?? latestVitals, [currentVitals, latestVitals])
  const effectiveSleep = useMemo(() => currentSleep ?? latestSleep, [currentSleep, latestSleep])
  const effectiveCardio = useMemo(() => currentCardio ?? (cardioMetabolic[0] ?? null), [currentCardio, cardioMetabolic])

  const selectedDateMeals = useMemo(() => {
    return meals.filter(m => m.timestamp.startsWith(dateStr))
  }, [meals, dateStr])

  const totalProtein = useMemo(() => {
    return selectedDateMeals.reduce((sum, m) => sum + (m.proteinGrams ?? 0), 0)
  }, [selectedDateMeals])

  const totalCalories = useMemo(() => {
    return selectedDateMeals.reduce((sum, m) => sum + (m.totalCalories ?? 0), 0)
  }, [selectedDateMeals])

  const parsedSleepSchedule = useMemo(() => {
    const logs = sleep.slice(0, 7)
    if (logs.length < 3) {
      return null
    }

    const schedule = logs.map(s => {
      let bedtimeDec = 0
      let wakeDec = 0
      let hasTimestamps = false

      if (s.bedtimeStart && s.wakeTimeEnd) {
        hasTimestamps = true
        const bedDate = new Date(s.bedtimeStart)
        let bedHrs = bedDate.getHours() + bedDate.getMinutes() / 60
        if (bedHrs > 12) {
          bedHrs -= 24
        }
        bedtimeDec = bedHrs

        const wakeDate = new Date(s.wakeTimeEnd)
        wakeDec = wakeDate.getHours() + wakeDate.getMinutes() / 60
      } else {
        const durationHrs = s.totalDurationMins / 60
        wakeDec = 7.0
        bedtimeDec = wakeDec - durationHrs
      }

      return {
        date: s.date,
        bedtime: bedtimeDec,
        wakeTime: wakeDec,
        duration: s.totalDurationMins,
        sleepDebt: s.sleepDebtHours ?? 0,
        sleepNeed: s.sleepNeedHours ?? 8.0,
        hasTimestamps,
      }
    })

    const hasAnyRealTimestamps = schedule.some(item => item.hasTimestamps)

    const avgBedtime = schedule.reduce((sum, item) => sum + item.bedtime, 0) / schedule.length
    const avgWakeTime = schedule.reduce((sum, item) => sum + item.wakeTime, 0) / schedule.length
    const avgDuration = schedule.reduce((sum, item) => sum + item.duration, 0) / schedule.length
    const avgSleepDebt = schedule.reduce((sum, item) => sum + item.sleepDebt, 0) / schedule.length
    const avgSleepNeed = schedule.reduce((sum, item) => sum + item.sleepNeed, 0) / schedule.length

    const bedtimeVar = Math.sqrt(schedule.reduce((sum, item) => sum + Math.pow(item.bedtime - avgBedtime, 2), 0) / schedule.length) * 60
    const wakeVar = Math.sqrt(schedule.reduce((sum, item) => sum + Math.pow(item.wakeTime - avgWakeTime, 2), 0) / schedule.length) * 60

    const formatTime = (decimalHours: number) => {
      const positiveHrs = (decimalHours + 24) % 24
      const hours = Math.floor(positiveHrs)
      const mins = Math.round((positiveHrs % 1) * 60)
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const dispHours = hours % 12 === 0 ? 12 : hours % 12
      return `${dispHours}:${mins.toString().padStart(2, '0')} ${ampm}`
    }

    return {
      avgBedtimeStr: formatTime(avgBedtime),
      avgWakeTimeStr: formatTime(avgWakeTime),
      bedtimeVarMins: Math.round(bedtimeVar),
      wakeVarMins: Math.round(wakeVar),
      avgDurationHours: safeNumber(avgDuration / 60, 1),
      avgSleepDebtHours: safeNumber(avgSleepDebt, 1),
      avgSleepNeedHours: safeNumber(avgSleepNeed, 1),
      scheduleCount: logs.length,
      hasAnyRealTimestamps,
      rawSchedule: schedule,
    }
  }, [sleep])

  const nutritionalMetrics = useMemo(() => {
    if (selectedDateMeals.length === 0) {
      return {
        proteinFloor: '0g / 160g (0% Met)',
        glycogenIndex: 'No logs today'
      }
    }
    const goalMet = Math.min(100, Math.round((totalProtein / 160) * 100))
    return {
      proteinFloor: `${Math.round(totalProtein)}g / 160g (${goalMet}% Met)`,
      glycogenIndex: totalCalories > 1200 ? 'Replenished' : 'Awaiting intake'
    }
  }, [selectedDateMeals, totalProtein, totalCalories])

  const cardiorespiratoryFitness = useMemo(() => {
    const cm = effectiveCardio
    const hasRealVo2 = cm !== null && cm !== undefined && cm.vo2Max > 0
    const vo2Max = hasRealVo2 ? cm!.vo2Max : 0

    let rating = '--'
    if (hasRealVo2) {
      if (vo2Max > 48) rating = 'Excellent'
      else if (vo2Max > 38) rating = 'Good'
      else if (vo2Max > 30) rating = 'Fair'
      else rating = 'Poor'
    }

    const hasRealRmr = cm?.restingEnergy != null && cm.restingEnergy > 100
    const rmr = hasRealRmr ? cm.restingEnergy : 0

    return {
      vo2Max,
      rating,
      hasRealVo2,
      hasRealRmr,
      rmr,
      displayLabel: rating,
      confidenceText: hasRealVo2 && hasRealRmr
        ? 'High Confidence — Synced from Apple Health'
        : hasRealVo2 && !hasRealRmr
          ? 'Partial Confidence — RMR unavailable'
          : !hasRealVo2 && hasRealRmr
            ? 'Partial Confidence — VO2 Max unavailable'
            : 'No cardiorespiratory data synced'
    }
  }, [effectiveCardio])


  // Recovery protocols driven by biometric state
  const recoveryProtocols = useMemo(() => {
    const protocols: { icon: string; label: string; accent: string }[] = []
    const cnsRisk = cnsStressScore?.risk
    const hasScores = effectiveScores !== null && effectiveScores !== undefined
    const recoScore = hasScores ? (effectiveScores.recoveryScore ?? null) : null
    const rhrVal = effectiveVitals ? safeRHR(effectiveVitals.rhr) : null

    if (cnsRisk === 'HIGH' || cnsRisk === 'MODERATE' || (recoScore !== null && recoScore < 40)) {
      protocols.push({ icon: '🧘', label: 'NSDR Session (15m)', accent: '#c8c2e9' })
    }
    if (cnsRisk === 'HIGH' || (rhrVal !== null && rhrVal > 70)) {
      protocols.push({ icon: '❄️', label: 'Cold Exposure Protocol', accent: '#00E5FF' })
    }
    if (hasScores && effectiveScores.strainScore !== null && effectiveScores.strainScore !== undefined && effectiveScores.strainScore > 12) {
      protocols.push({ icon: '💧', label: 'Hydration + Electrolytes', accent: '#14B8A6' })
    }
    return protocols
  }, [cnsStressScore, effectiveScores, effectiveVitals])

  const fadeProgress = useSharedValue(0)

  // Initialize RAG
  useEffect(() => {
    ensureKnowledgeBaseIndexed().catch(e =>
      console.warn('[RAG] Background indexing failed (non-fatal):', e)
    )
  }, [])

  useEffect(() => {
    loadFromDB()
    fadeProgress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
    flex: 1,
  }))

  // ── Biometrics Context Builder (Phase G: Scoped & Provenance-Aware) ──
  const buildBiometricsContext = useCallback(() => {
    const raw = useHealthStore.getState()
    const stateForSelectors = {
      vitals: raw.vitals,
      sleep: raw.sleep,
      scores: raw.scores,
      activities: raw.activities,
      mobility: raw.mobility,
      environmental: raw.environmental,
      cardioMetabolic: raw.cardioMetabolic,
      runningDynamics: raw.runningDynamics,
      weightHistory: raw.weightHistory,
      selectedDate: dateStr,
    }

    // ── Canonical selector calls ────────────────────────────────
    const scoresVM = selectScoresForDate(stateForSelectors, dateStr)
    const vitalsVM = selectVitalsForDate(stateForSelectors, dateStr)
    const sleepVM = selectSleepForDate(stateForSelectors, dateStr)
    const mobilityVM = selectMobilityForDate(stateForSelectors, dateStr)
    const environmentalVM = selectEnvironmentalForDate(stateForSelectors, dateStr)
    const cardioVM = selectCardioMetabolicForDate(stateForSelectors, dateStr)
    const runningDynamicsVM = selectRunningDynamicsForDate(stateForSelectors, dateStr)

    // ── Helper: view model → scoped metric payload ─────────────
    function wrapVM<T>(vm: typeof scoresVM) {
      return {
        value: vm.value as T | null,
        scope: vm.scope,
        effectiveDate: vm.effectiveDate,
        confidence: vm.confidence,
        provenance: vm.provenanceSummary,
        sourceKind: vm.sourceKind,
        status: vm.status,
        ...(vm.status !== 'present' && vm.emptyStateReason ? { emptyStateReason: vm.emptyStateReason } : {}),
      }
    }

    // ── Sub-metric helpers (accept any HealthMetricViewModel) ─
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function wrapSubValue<T>(vm: { scope: string; effectiveDate: string; confidence: number | null; provenanceSummary: string; sourceKind: string; status: string; emptyStateReason: string | null }, subValue: T) {
      return {
        value: subValue,
        scope: vm.scope,
        effectiveDate: vm.effectiveDate,
        confidence: vm.confidence,
        provenance: vm.provenanceSummary,
        sourceKind: vm.sourceKind,
        status: vm.status,
        ...(vm.status !== 'present' && vm.emptyStateReason ? { emptyStateReason: vm.emptyStateReason } : {}),
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function missingSubValue(vm: { scope: string; effectiveDate: string; confidence: number | null; provenanceSummary: string; sourceKind: string; status: string; emptyStateReason: string | null }) {
      return {
        value: null,
        scope: vm.scope,
        effectiveDate: vm.effectiveDate,
        confidence: vm.confidence,
        provenance: vm.provenanceSummary,
        sourceKind: vm.sourceKind,
        status: vm.status,
        emptyStateReason: vm.emptyStateReason,
      }
    }

    // ── Build scoped metrics ────────────────────────────────────
    const scoresRaw = scoresVM.value
    const vitalsRaw = vitalsVM.value
    const sleepRaw = sleepVM.value
    const mobilityRaw = mobilityVM.value
    const envRaw = environmentalVM.value
    const cardioRaw = cardioVM.value
    const runningRaw = runningDynamicsVM.value

    const metrics: Record<string, unknown> = {
      recoveryScore: scoresRaw ? wrapSubValue(scoresVM, scoresRaw.recoveryScore) : missingSubValue(scoresVM),
      strainScore: scoresRaw ? wrapSubValue(scoresVM, scoresRaw.strainScore) : missingSubValue(scoresVM),
      sleepDebtHours: scoresRaw ? wrapSubValue(scoresVM, scoresRaw.sleepDebtHours) : missingSubValue(scoresVM),
      sleepNeedHours: scoresRaw ? wrapSubValue(scoresVM, scoresRaw.sleepNeedHours) : missingSubValue(scoresVM),
      hrvZScore: scoresRaw ? wrapSubValue(scoresVM, scoresRaw.hrvZScore) : missingSubValue(scoresVM),
      rhrZScore: scoresRaw ? wrapSubValue(scoresVM, scoresRaw.rhrZScore) : missingSubValue(scoresVM),
      recoveryZone: scoresRaw ? wrapSubValue(scoresVM, scoresRaw.recoveryZone) : missingSubValue(scoresVM),
      vitals: vitalsRaw ? {
        hrv: wrapSubValue(vitalsVM, vitalsRaw.hrv),
        rhr: wrapSubValue(vitalsVM, vitalsRaw.rhr),
        spo2: wrapSubValue(vitalsVM, vitalsRaw.spo2),
        respiratoryRate: wrapSubValue(vitalsVM, vitalsRaw.respiratoryRate),
        skinTempDelta: wrapSubValue(vitalsVM, vitalsRaw.skinTempDelta),
      } : {
        hrv: missingSubValue(vitalsVM),
        rhr: missingSubValue(vitalsVM),
        spo2: missingSubValue(vitalsVM),
        respiratoryRate: missingSubValue(vitalsVM),
        skinTempDelta: missingSubValue(vitalsVM),
      },
      sleep: sleepRaw ? {
        totalDurationMins: wrapSubValue(sleepVM, sleepRaw.totalDurationMins),
        remMins: wrapSubValue(sleepVM, sleepRaw.remMins > 0 ? sleepRaw.remMins : null),
        deepMins: wrapSubValue(sleepVM, sleepRaw.deepMins > 0 ? sleepRaw.deepMins : null),
      } : {
        totalDurationMins: missingSubValue(sleepVM),
        remMins: missingSubValue(sleepVM),
        deepMins: missingSubValue(sleepVM),
      },
      mobility: mobilityRaw ? {
        steps: wrapSubValue(mobilityVM, mobilityRaw.steps),
        walkingAsymmetry: wrapSubValue(mobilityVM, mobilityRaw.walkingAsymmetry),
        doubleSupport: wrapSubValue(mobilityVM, mobilityRaw.doubleSupport),
        walkingSpeed: wrapSubValue(mobilityVM, mobilityRaw.walkingSpeed),
      } : {
        steps: missingSubValue(mobilityVM),
        walkingAsymmetry: missingSubValue(mobilityVM),
        doubleSupport: missingSubValue(mobilityVM),
        walkingSpeed: missingSubValue(mobilityVM),
      },
      environmental: envRaw ? {
        timeInDaylight: wrapSubValue(environmentalVM, envRaw.timeInDaylight),
        headphoneAudio: wrapSubValue(environmentalVM, envRaw.headphoneAudio),
        exerciseMinutes: wrapSubValue(environmentalVM, envRaw.exerciseMinutes),
      } : {
        timeInDaylight: missingSubValue(environmentalVM),
        headphoneAudio: missingSubValue(environmentalVM),
        exerciseMinutes: missingSubValue(environmentalVM),
      },
      cardioMetabolic: cardioRaw ? {
        vo2Max: wrapSubValue(cardioVM, cardioRaw.vo2Max),
        restingEnergy: wrapSubValue(cardioVM, cardioRaw.restingEnergy),
      } : {
        vo2Max: missingSubValue(cardioVM),
        restingEnergy: missingSubValue(cardioVM),
      },
      runningDynamics: runningRaw ? {
        runningPower: wrapSubValue(runningDynamicsVM, runningRaw.runningPower),
        groundContactTime: wrapSubValue(runningDynamicsVM, runningRaw.groundContactTime),
        verticalOscillation: wrapSubValue(runningDynamicsVM, runningRaw.verticalOscillation),
        strideLength: wrapSubValue(runningDynamicsVM, runningRaw.strideLength),
      } : {
        runningPower: missingSubValue(runningDynamicsVM),
        groundContactTime: missingSubValue(runningDynamicsVM),
        verticalOscillation: missingSubValue(runningDynamicsVM),
        strideLength: missingSubValue(runningDynamicsVM),
      },
    }

    // ── Missing metrics tracking ────────────────────────────────
    const missingMetrics: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vmEntries: [string, any][] = [
      ['scores', scoresVM],
      ['vitals', vitalsVM],
      ['sleep', sleepVM],
      ['mobility', mobilityVM],
      ['environmental', environmentalVM],
      ['cardioMetabolic', cardioVM],
      ['runningDynamics', runningDynamicsVM],
    ]
    for (const [key, vm] of vmEntries) {
      if (vm.status === 'missing' || vm.status === 'insufficient') {
        missingMetrics.push(`${key}: ${vm.emptyStateReason || 'no data available'}`)
      }
    }

    // ── Derived predictions (scoped) ────────────────────────────
    const derivedPredictions = {
      injuryRisk: injuryRisk ? {
        value: injuryRisk,
        scope: 'selectedDate' as const,
        effectiveDate: dateStr,
        confidence: injuryRisk.confidence ?? 50,
        provenance: 'computed via algorithm injury-predictor v1.0.0',
        sourceKind: 'derived' as const,
        status: 'present' as const,
      } : {
        value: null,
        scope: 'selectedDate' as const,
        effectiveDate: dateStr,
        confidence: null,
        provenance: 'injury-predictor algorithm unavailable',
        sourceKind: 'derived' as const,
        status: 'missing' as const,
      },
      cnsStressScore: cnsStressScore ? {
        value: cnsStressScore,
        scope: 'selectedDate' as const,
        effectiveDate: dateStr,
        confidence: cnsStressScore.confidence ?? 50,
        provenance: 'computed via algorithm cns-stress v1.0.0',
        sourceKind: 'derived' as const,
        status: 'present' as const,
      } : {
        value: null,
        scope: 'selectedDate' as const,
        effectiveDate: dateStr,
        confidence: null,
        provenance: 'cns-stress algorithm unavailable',
        sourceKind: 'derived' as const,
        status: 'missing' as const,
      },
    }

    // ── Trend analysis ──────────────────────────────────────────
    const trendMetrics: Record<string, unknown> = {}
    if (trendReport) {
      const m = trendReport.metrics
      for (const key of [
        'hrv', 'rhr', 'spo2', 'respiratoryRate', 'skinTempDelta',
        'sleepDuration', 'sleepDebt', 'recoveryScore', 'strainScore',
        'walkingAsymmetry', 'vo2max',
      ] as const) {
        const metric = m[key]
        if (metric && metric.hasSufficient) {
          trendMetrics[key] = {
            slope7d: metric.slope7d,
            direction7d: metric.direction7d,
            latest: metric.latest,
            zScore: metric.recentZScore,
            volatility: metric.volatility7d,
            acceleration: metric.acceleration,
          }
        }
      }
    }

    // ── Scope summary ───────────────────────────────────────────
    const hasData = scoresVM.status !== 'missing' || vitalsVM.status !== 'missing' || sleepVM.status !== 'missing'
    const latestAvailableDate = [
      scoresVM.effectiveDate, vitalsVM.effectiveDate, sleepVM.effectiveDate,
      mobilityVM.effectiveDate, environmentalVM.effectiveDate,
      cardioVM.effectiveDate, runningDynamicsVM.effectiveDate,
    ].filter(d => d !== dateStr || true).sort().reverse()[0] || dateStr

    return {
      selectedDate: dateStr,
      metrics,
      missingMetrics,
      derivedPredictions,
      trendAnalysis: trendReport
        ? {
          referenceDate: trendReport.referenceDate,
          summary: trendReport.summary,
          detectedPatterns: trendReport.patterns.map(p => ({
            type: p.type,
            focus: p.type,
            confidence: p.confidence,
            description: p.description,
            severity: p.severity,
            triggeringMetrics: p.metrics,
          })),
          metricTrends: trendMetrics,
        }
        : null,
      scopeSummary: {
        selectedDate: dateStr,
        hasDataForSelectedDate: hasData,
        latestAvailableDate,
      },
    }
  }, [
    dateStr, injuryRisk, cnsStressScore, trendReport,
  ])

  // ── Last biometrics ref for "Explain This Answer" mode ─────────
  const lastBiometricsRef = useRef<any>(null)

  // ── Explain This Answer Payload Builder ────────────────────────
  function buildExplainPayload(lastBiometrics: any, lastResponse: string) {
    if (!lastBiometrics?.metrics) {
      return {
        mode: 'explain',
        lastResponse,
        metricsUsed: [],
        note: 'No biometrics context available from last response',
      }
    }

    const metricsUsed: { metric: string; value: any; scope: string; confidence: number | null; provenance: string }[] = []

    // Extract top-level metrics
    for (const [key, m] of Object.entries(lastBiometrics.metrics)) {
      const entry = m as any
      if (!entry || typeof entry !== 'object') continue
      // Check if this is a nested container (vitals, sleep, mobility, etc.)
      const nestedKeys = ['vitals', 'sleep', 'mobility', 'environmental', 'cardioMetabolic', 'runningDynamics']
      if (nestedKeys.includes(key)) {
        if (entry.status === 'present') {
          for (const [subKey, subVal] of Object.entries(entry)) {
            const sv = subVal as any
            if (sv && typeof sv === 'object' && 'value' in sv) {
              metricsUsed.push({
                metric: `${key}.${subKey}`,
                value: sv.value,
                scope: sv.scope ?? 'unknown',
                confidence: sv.confidence ?? null,
                provenance: sv.provenance ?? 'unknown',
              })
            }
          }
        }
      } else if (entry.status === 'present') {
        metricsUsed.push({
          metric: key,
          value: entry.value,
          scope: entry.scope ?? 'unknown',
          confidence: entry.confidence ?? null,
          provenance: entry.provenance ?? 'unknown',
        })
      }
    }

    return {
      mode: 'explain',
      lastResponse,
      metricsUsed,
      scopeSummary: lastBiometrics.scopeSummary || { selectedDate: 'unknown', hasDataForSelectedDate: false },
      missingMetrics: lastBiometrics.missingMetrics || [],
    }
  }

  // ── Send Handler ──────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      setShowVision(false)
      const userMsg: CoachMessage = {
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, userMsg])
      setIsLoading(true)

      try {
        const biometrics = buildBiometricsContext()
        lastBiometricsRef.current = biometrics
        const ragContext = await buildRAGContext(text)

        const reply = await sendCoachMessage({
          message: text,
          history: messages.slice(-8).map(m => ({
            role: m.role,
            content: m.content,
          })),
          biometrics,
          ragContext: ragContext || undefined,
        })

        const coachMsg: CoachMessage = {
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
        }

        setMessages(prev => [...prev, coachMsg])
        // Show insights panel after first response
        setShowInsights(true)
      } catch (err) {
        console.error('[COACH] error sending message:', err)
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, I had trouble connecting. Please check your API key and try again.',
            timestamp: new Date().toISOString(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [messages, buildBiometricsContext]
  )

  const lastProcessedQueryRef = useRef<string | null>(null)

  // Handle initial query from Ask bar
  useEffect(() => {
    if (initialQuery && initialQuery !== lastProcessedQueryRef.current) {
      lastProcessedQueryRef.current = initialQuery
      handleSend(initialQuery)
    }
  }, [initialQuery, handleSend])

  // ── Handle vision save ────────────────────────────────────────────
  const handleMealResult = useCallback((result: any) => {
    setShowVision(false)
    const summary = result?.summary ?? 'Meal logged successfully.'
    handleSend(`[Vision: Meal Analysis] ${summary}`)
  }, [handleSend])

  const handleWorkoutResult = useCallback((result: any) => {
    setShowVision(false)
    const summary = result?.summary ?? 'Workout logged successfully.'
    handleSend(`[Vision: Workout Analysis] ${summary}`)
  }, [handleSend])

  // ── Suggestion chip handler ───────────────────────────────────────
  const handleChipPress = useCallback((chip: string) => {
    handleSend(chip)
  }, [handleSend])

  const handleCardiorespiratoryPress = useCallback(() => {
    const cf = cardiorespiratoryFitness
    const hasRealVo2 = cf.hasRealVo2
    const hasRealRmr = cf.hasRealRmr
    const vo2Max = cf.vo2Max
    const rmr = cf.rmr

    setActiveModalData({
      title: 'Cardiorespiratory Fitness',
      subtitle: 'AEROBIC CAPACITY & METABOLICS',
      description: 'Your cardiorespiratory fitness measures how effectively your heart, lungs, and blood vessels deliver oxygen to your working muscles during physical exertion. This includes VO2 Max (cardio fitness) and Basal Energy Burned (daily resting metabolism).',
      science: 'Data comes from Apple Health. VO2 Max is captured during workouts. Resting energy (basal metabolic rate) is available if synced from a wearable. Values show "--" when real data is unavailable.',
      metrics: [
        {
          label: 'VO2 Max',
          value: hasRealVo2 ? `${safeNumber(vo2Max, 1)} ml/kg/min` : '--'
        },
        {
          label: 'Basal Energy Burned',
          value: hasRealRmr ? `${Math.round(rmr)} kcal` : '--'
        },
        {
          label: 'Fitness Rating',
          value: cf.displayLabel
        },
        {
          label: 'Data Confidence',
          value: cf.confidenceText
        }
      ],
      redirect: {
        label: 'View Cardiovascular Health',
        action: () => {
          setActiveModalData(null)
          router.push({ pathname: '/(tabs)/health', params: { focus: 'longevity' } })
        }
      }
    })
  }, [cardiorespiratoryFitness, router])

  const handleRecoveryForecastPress = useCallback(() => {
    const scoreVal = effectiveScores?.recoveryScore
    const strainVal = effectiveScores?.strainScore
    const hrvZ = effectiveScores?.hrvZScore
    setActiveModalData({
      title: 'Recovery Forecast',
      subtitle: 'AUTONOMIC ADAPTATION WINDOW',
      description: 'The estimated time remaining before your Central Nervous System (CNS) and muscular structures return to your established physiological baseline.',
      science: 'A validated recovery forecast time model is currently unavailable in the local database or Apple Health. Establishing a high-confidence forecast requires 14 days of historical heart rate variability (HRV) and daily cardiovascular strain to map your homeostatic parasympathetic window.',
      metrics: [
        { label: 'Today\'s Recovery Score [Selected Date]', value: scoreVal != null ? `${scoreVal}%` : '--' },
        { label: 'Today\'s Exertion Strain [Selected Date]', value: strainVal != null ? `${safeNumber(strainVal, 1)} / 21` : '--' },
        { label: 'HRV Shift [Selected Date]', value: hrvZ != null ? `${hrvZ > 0 ? '+' : ''}${safeNumber(hrvZ, 1)}σ` : '--' },
        { label: 'Forecast Status', value: 'Building Baseline' }
      ],
      redirect: {
        label: 'View Autonomic Readiness',
        action: () => {
          setActiveModalData(null)
          router.push({ pathname: '/(tabs)/health', params: { focus: 'readiness' } })
        }
      }
    })
  }, [effectiveScores, router])

  const handleSleepConsistencyPress = useCallback(() => {
    const sched = parsedSleepSchedule
    if (!sched) {
      setActiveModalData({
        title: 'Sleep Consistency Analysis',
        subtitle: 'CIRCADIAN GAIN & STABILITY',
        description: 'Sleep consistency measures the day-to-day variance in your bedtime and wake-up sleep boundaries. A stable circadian window optimizes natural growth hormone (GH) release and maximizes deep/REM sleep efficiency.',
        science: 'A robust consistency index requires at least 3 sleep logs from the past week to evaluate bedtime stability.',
        metrics: [
          { label: 'Sleep Logs [Last 7 Days]', value: 'Not enough data' },
          { label: 'Bedtime Adherence', value: '--' }
        ],
        redirect: {
          label: 'View Circadian Readiness',
          action: () => {
            setActiveModalData(null)
            router.push({ pathname: '/(tabs)/health', params: { focus: 'readiness' } })
          }
        }
      })
      return
    }

    const precisionLabel = sched.hasAnyRealTimestamps ? 'Real Timestamps' : 'Duration Estimated'

    setActiveModalData({
      title: 'Sleep Consistency Analysis',
      subtitle: 'CIRCADIAN GAIN & STABILITY',
      description: `Based on your last ${sched.scheduleCount} nights, your average bedtime is ${sched.avgBedtimeStr} and wake time is ${sched.avgWakeTimeStr}. Your bedtime variability is ±${sched.bedtimeVarMins} mins.`,
      science: 'Circadian stability index computed using rolling bedtime variance across your synced sleep logs in Apple Health.',
      metrics: [
        { label: 'Avg Bedtime [Last 7 Days]', value: sched.avgBedtimeStr },
        { label: 'Avg Wake Time [Last 7 Days]', value: sched.avgWakeTimeStr },
        { label: 'Bedtime Variance [Last 7 Days]', value: `±${sched.bedtimeVarMins} mins` },
        { label: 'Wake Variance [Last 7 Days]', value: `±${sched.wakeVarMins} mins` },
        { label: 'Avg Duration [Last 7 Days]', value: `${sched.avgDurationHours}h (Goal: ${sched.avgSleepNeedHours}h)` },
        { label: 'Sleep Debt [Last 7 Days]', value: `${sched.avgSleepDebtHours}h` },
        { label: 'Schedule Precision', value: precisionLabel }
      ],
      redirect: {
        label: 'View Circadian Readiness',
        action: () => {
          setActiveModalData(null)
          router.push({ pathname: '/(tabs)/health', params: { focus: 'readiness' } })
        }
      }
    })
  }, [parsedSleepSchedule, router])

  const handleOvertrainingRiskPress = useCallback(() => {
    const hasScores = effectiveScores !== null && effectiveScores !== undefined
    const cns = cnsStressScore?.risk ?? null
    const injury = injuryRisk?.risk ?? null
    const todayStrain = hasScores ? (effectiveScores.strainScore ?? 0) : null
    const hrvZ = hasScores ? effectiveScores.hrvZScore : null
    const recovery = hasScores ? effectiveScores.recoveryScore : null

    setActiveModalData({
      title: 'Overtraining Risk Model',
      subtitle: 'CHRONIC SYSTEMIC RESILIENCE',
      description: 'Calculates the likelihood of overreaching or Central Nervous System (CNS) exhaustion. High training strain paired with suppressed recovery metrics triggers warnings.',
      science: 'Correlates today\'s accumulated cardiac strain against your 7-day rolling HRV z-score shift and autonomic recovery levels.',
      metrics: [
        { label: 'Today\'s Exertion Strain [Selected Date]', value: todayStrain != null ? `${safeNumber(todayStrain, 1)} / 21` : '--' },
        { label: 'Recovery Score [Selected Date]', value: recovery != null ? `${recovery}%` : '--' },
        { label: 'HRV Shift [Selected Date]', value: hrvZ != null ? `${hrvZ > 0 ? '+' : ''}${safeNumber(hrvZ, 1)}σ` : '--' },
        { label: 'CNS Stress Level [Selected Date]', value: cns ?? '--' },
        { label: 'Injury Risk Level [Selected Date]', value: injury ?? '--' }
      ],
      redirect: {
        label: 'View Stress & Resilience',
        action: () => {
          setActiveModalData(null)
          router.push({ pathname: '/(tabs)/health', params: { focus: 'resilience' } })
        }
      }
    })
  }, [cnsStressScore, injuryRisk, effectiveScores, router])

  const handleNutritionalImpactPress = useCallback(() => {
    const goalMet = Math.min(100, Math.round((totalProtein / 160) * 100))
    const proteinText = `${Math.round(totalProtein)}g / 160g (${goalMet}% Met)`

    let totalCarbs = 0
    let totalFats = 0
    selectedDateMeals.forEach(m => {
      totalCarbs += (m.carbsGrams ?? 0)
      totalFats += (m.fatGrams ?? 0)
    })

    setActiveModalData({
      title: 'Nutritional Impact Analytics',
      subtitle: 'BIO-ENERGETIC RECOVERY FUEL',
      description: 'Evaluates how your macronutrient split and intake timing support protein synthesis and active muscle glycogen rebuilding today.',
      science: 'Cites your total calories and proteins logged from vision logs against daily recovery requirements.',
      metrics: [
        { label: 'Calories Logged [Selected Date]', value: `${Math.round(totalCalories)} kcal` },
        { label: 'Protein Logged [Selected Date]', value: proteinText },
        { label: 'Carbs Logged [Selected Date]', value: `${Math.round(totalCarbs)}g` },
        { label: 'Fats Logged [Selected Date]', value: `${Math.round(totalFats)}g` }
      ],
      redirect: {
        label: 'Open Food Camera Logs',
        action: () => {
          setActiveModalData(null)
          setShowVision(true)
        }
      }
    })
  }, [totalProtein, totalCalories, selectedDateMeals])

  const handleReadinessScanPress = useCallback(() => {
    let sleepEfficiencyStr = '--'
    let remPctStr = '--'
    let deepPctStr = '--'

    if (effectiveSleep && effectiveSleep.totalDurationMins > 0) {
      const asleepMins = effectiveSleep.totalDurationMins - (effectiveSleep.awakeMins || 0)
      const eff = Math.round((asleepMins / effectiveSleep.totalDurationMins) * 100)
      sleepEfficiencyStr = `${eff}%`

      if (effectiveSleep.remMins > 0) {
        remPctStr = `${Math.round((effectiveSleep.remMins / effectiveSleep.totalDurationMins) * 100)}%`
      }
      if (effectiveSleep.deepMins > 0) {
        deepPctStr = `${Math.round((effectiveSleep.deepMins / effectiveSleep.totalDurationMins) * 100)}%`
      }
    }

    const rhrVal = effectiveVitals?.rhr ?? latestVitals?.rhr
    const hrvVal = effectiveVitals?.hrv ?? latestVitals?.hrv
    const isVitalsStale = !effectiveVitals && latestVitals

    setActiveModalData({
      title: 'Morning Readiness Deep-Scan',
      subtitle: 'BIOMETRIC STRESS MATRIX',
      description: 'A comprehensive autonomic and cardiovascular scan to determine systemic recovery dominance for training readiness today.',
      science: 'Aggregates sleep architecture efficiencies with waking resting heart rate and heart rate variability baseline shifts.',
      metrics: [
        { label: 'Waking HRV [Selected Date]', value: hrvVal != null ? `${Math.round(hrvVal)} ms` : '--' },
        { label: 'Waking RHR [Selected Date]', value: rhrVal != null ? `${Math.round(rhrVal)} bpm` : '--' },
        { label: 'Sleep Efficiency [Selected Date]', value: sleepEfficiencyStr },
        { label: 'Deep Sleep % [Selected Date]', value: deepPctStr },
        { label: 'REM Sleep % [Selected Date]', value: remPctStr },
        { label: 'Metrics Origin', value: isVitalsStale ? 'Latest Available' : 'Selected Date' }
      ],
      redirect: {
        label: 'View Readiness Diagnostics',
        action: () => {
          setActiveModalData(null)
          router.push({ pathname: '/(tabs)/health', params: { focus: 'readiness' } })
        }
      }
    })
  }, [effectiveSleep, effectiveVitals, latestVitals, effectiveScores, router])

  const handleNsdrPress = useCallback(() => {
    setActiveModalData({
      title: 'NSDR Session (15m)',
      subtitle: 'NON-SLEEP DEEP REST PROTOCOL',
      description: 'A structured, neuro-scientifically proven breathing and body-scanning protocol designed by Dr. Andrew Huberman and elite researchers to drop the brain into self-induced deep relaxation, restoring dopamine reserves and rapidly down-regulating CNS fatigue.',
      science: 'Triggers a rapid shift from sympathetic high-alert to parasympathetic vagal dominance, calming systemic neural drive in minutes.',
      metrics: [
        { label: 'CNS Stress Risk', value: cnsStressScore?.risk ?? 'LOW' },
        { label: 'Audio Noise Load', value: cnsStressScore?.audioLoad != null ? `${Math.round(cnsStressScore.audioLoad)} dBA` : '--' }
      ],
      redirect: {
        label: 'Launch NSDR Breathing Guidance',
        action: () => {
          setActiveModalData(null)
          handleSend('Launch the NSDR box breathing recovery session guidance')
        }
      }
    })
  }, [cnsStressScore, handleSend])

  const handleColdExposurePress = useCallback(() => {
    const hasScores = effectiveScores !== null && effectiveScores !== undefined
    const strain = hasScores ? (effectiveScores.strainScore ?? 0) : null
    setActiveModalData({
      title: 'Cold Exposure Protocol',
      subtitle: 'SYSTEMIC HORMETIC RESILIENCE',
      description: 'Immerse in cold water (10-14°C) for 3-5 minutes or execute a 3-minute cold shower. Accelerates muscle soreness recovery, suppresses local joint inflammation, and initiates a massive 2.5x surge in dopamine and norepinephrine to spike focus and physical resilience.',
      science: 'Stimulates cold thermoreceptors, inducing rapid vasoconstriction, lowering muscle swelling, and training autonomic cold stress tolerance.',
      metrics: [
        { label: 'Today\'s Exertion Strain', value: strain != null ? `${safeNumber(strain, 1)} / 21` : '--' },
        { label: 'Cold Shower Target', value: strain != null ? (strain > 12 ? 'Active Recovery (4m)' : 'Baseline Tone (3m)') : '--' }
      ],
      redirect: {
        label: 'Request Cold exposure detailed guide',
        action: () => {
          setActiveModalData(null)
          handleSend('Explain step-by-step cold exposure protocols for athletic recovery')
        }
      }
    })
  }, [effectiveScores, handleSend])

  const handleHydrationPress = useCallback(() => {
    const hasScores = effectiveScores !== null && effectiveScores !== undefined
    const strain = hasScores ? (effectiveScores.strainScore ?? 0) : null
    const hasRealRmr = effectiveCardio?.restingEnergy != null && effectiveCardio.restingEnergy > 100
    const activeBurn = hasRealRmr
      ? Math.round(effectiveCardio!.restingEnergy + (strain ?? 0) * 40)
      : null
    setActiveModalData({
      title: 'Hydration & Electrolytes',
      subtitle: 'BIO-CHEMICAL INTRA-CELLULAR RESTORE',
      description: 'Rehydrate with 500-700ml water mixed with active electrolytes: 1000mg Sodium, 200mg Potassium, and 100mg Magnesium. Restores plasma volume, offsets sweat-loss indices, and ensures optimal neuromuscular firing capacity.',
      science: 'Directly replaces key ions lost during athletic sweat to prevent muscle cramping and maintain systemic cellular fluid balance.',
      metrics: [
        { label: 'Estimated Today\'s Burn', value: activeBurn != null ? `${activeBurn} kcal` : '--' },
        { label: 'Water replacement Target', value: strain != null ? (strain > 12 ? '900ml + Active Salts' : '600ml Baseline') : '--' }
      ],
      redirect: {
        label: 'Request fueling guidelines',
        action: () => {
          setActiveModalData(null)
          handleSend('How should I fuel with carbs and electrolytes for high strain?')
        }
      }
    })
  }, [effectiveCardio, effectiveScores, handleSend])

  const hasMessages = messages.length > 0
  const recoZone = effectiveScores?.recoveryZone ?? null

  const renderListFooter = () => {
    if (!showInsights) {
      return (
        <TouchableOpacity
          onPress={() => setShowInsights(true)}
          style={{
            backgroundColor: 'rgba(20,184,166,0.1)',
            borderColor: 'rgba(20,184,166,0.2)',
            borderWidth: 0.5,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            alignSelf: 'center',
            marginTop: 16,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Text style={{ color: S.accentTeal, fontSize: 12, fontWeight: '700' }}>
            📊 Show Insights
          </Text>
        </TouchableOpacity>
      )
    }

    return (
      <View style={{ marginTop: 16, paddingBottom: 16 }}>
        {/* Header with Collapse option */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <SectionHeader label="Insights" accent={S.primaryFixedDim} />
          <TouchableOpacity onPress={() => setShowInsights(false)}>
            <Text style={{ color: S.dimText, fontSize: 11, fontWeight: '700' }}>COLLAPSE ✕</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Insight Cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity onPress={handleCardiorespiratoryPress} activeOpacity={0.7} style={{ flex: 1 }}>
            <InsightCard
              title="Cardiorespiratory Fitness"
              value={cardiorespiratoryFitness.displayLabel}
              accent={S.secondaryFixedDim}
              accentBorder={S.secondaryFixedDim}
            >
              {/* Sparkline bars */}
              <View
                style={{
                  height: 28,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 6,
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  paddingHorizontal: 2,
                  paddingBottom: 2,
                  gap: 2,
                }}
              >
                {[0.3, 0.5, 0.4, 0.7, 0.85, 0.95].map((h, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h * 100}%`,
                      backgroundColor: i === 5 ? S.primaryFixedDim : S.secondaryFixedDim,
                      borderRadius: 3,
                      opacity: 0.4 + (i * 0.1),
                    }}
                  />
                ))}
              </View>
            </InsightCard>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRecoveryForecastPress} activeOpacity={0.7} style={{ flex: 1 }}>
            <InsightCard
              title="Recovery Forecast"
              accent={S.primaryFixedDim}
              accentBorder={S.primaryFixedDim}
            >
              <Text style={{ color: S.mutedText, fontSize: 13, lineHeight: 18, marginBottom: 4 }}>
                You will be{' '}
                <Text style={{ color: S.primaryFixedDim, fontWeight: '700' }}>
                  {zoneLabel(recoZone)}
                </Text>{' '}
                for your next session in:
              </Text>
              <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
                {effectiveScores?.recoveryScore != null ? '~12–48h' : '--'}
              </Text>
            </InsightCard>
          </TouchableOpacity>
        </View>

        {/* Suggestive Analysis */}
        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="Suggestive Analysis" accent={S.primaryFixedDim} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ width: '47%' as any }}>
              <SuggestionChip
                icon="🌙"
                label="Analyze Sleep Consistency"
                onPress={handleSleepConsistencyPress}
              />
            </View>
            <View style={{ width: '47%' as any }}>
              <SuggestionChip
                icon="📈"
                label="Predict Overtraining Risk"
                onPress={handleOvertrainingRiskPress}
              />
            </View>
            <View style={{ width: '47%' as any }}>
              <SuggestionChip
                icon="🍽️"
                label="Check Nutritional Impact"
                onPress={handleNutritionalImpactPress}
              />
            </View>
            <View style={{ width: '47%' as any }}>
              <SuggestionChip
                icon="🔍"
                label="Morning Readiness Deep-Scan"
                onPress={handleReadinessScanPress}
              />
            </View>
          </View>
        </View>

        {/* Recovery Protocols */}
        <View style={{ marginBottom: 12 }}>
          <SectionHeader label="Recovery Protocols" accent={S.secondaryFixedDim} />
          <View style={{ gap: 8 }}>
            {recoveryProtocols.length > 0 ? (
              recoveryProtocols.map((p, i) => {
                let pressAction = handleNsdrPress
                if (p.label.includes('Cold')) pressAction = handleColdExposurePress
                if (p.label.includes('Hydration')) pressAction = handleHydrationPress
                return (
                  <TouchableOpacity key={i} onPress={pressAction} activeOpacity={0.7}>
                    <ProtocolRow icon={p.icon} label={p.label} accent={p.accent} />
                  </TouchableOpacity>
                )
              })
            ) : (
              <TouchableOpacity onPress={handleNsdrPress} activeOpacity={0.7}>
                <ProtocolRow icon="🧘" label="NSDR Session (15m)" accent={S.secondaryFixedDim} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: S.bg }} edges={['top']}>
      <DesktopNav />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <Animated.View style={animStyle}>
          {/* ── Fixed Header ────────────────────────────────────────── */}
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
              {/* Avatar */}
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: S.primaryFixedDim,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: S.primaryFixedDim,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.2,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <Text style={{ color: S.bg, fontSize: 16, fontWeight: '900' }}>🧠</Text>
              </View>
              <View>
                <Text style={{ color: S.onSurface, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>
                  ELITE HEALTH
                </Text>
                <Text style={{ color: S.primaryFixedDim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  AI Coach
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {hasMessages && (
                <TouchableOpacity onPress={() => { setMessages([]); setShowInsights(false); lastProcessedQueryRef.current = null; }}>
                  <Text style={{ color: S.error, fontSize: 12, fontWeight: '700' }}>RESET</Text>
                </TouchableOpacity>
              )}
              {isLoading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: S.primaryFixedDim,
                    }}
                  />
                  <Text style={{ color: S.primaryFixedDim, fontSize: 10, fontWeight: '700' }}>
                    ACTIVE
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Biometrics Context Widget ────────────────────────────── */}
          <BiometricsContextWidget
            recoveryScore={effectiveScores?.recoveryScore ?? null}
            strainScore={effectiveScores?.strainScore ?? null}
            recoveryZone={recoZone}
            hrvZScore={effectiveScores?.hrvZScore ?? null}
            rhrZScore={effectiveScores?.rhrZScore ?? null}
          />

          {/* ── Main Content ────────────────────────────────────────── */}
          {hasMessages ? (
            <ChatWindow
              messages={messages}
              ListFooterComponent={renderListFooter()}
            />
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Welcome Hero */}
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <GlassPanel
                  glowing
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ color: S.primaryFixedDim, fontSize: 30 }}>🧠</Text>
                </GlassPanel>
                <Text style={{ color: S.onSurface, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }}>
                  AI HEALTH COACH
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: S.primaryFixedDim,
                    }}
                  />
                  <Text style={{ color: S.primaryFixedDim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Systems Analysis: ACTIVE
                  </Text>
                </View>
              </View>

              {/* Vision Capture toggle */}
              {showVision ? (
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <SectionHeader label="Visual Analytics" accent={S.pillarLongevity} />
                    <TouchableOpacity onPress={() => setShowVision(false)}>
                      <Text style={{ color: S.dimText, fontSize: 12 }}>Close ✕</Text>
                    </TouchableOpacity>
                  </View>
                  <VisionCapture
                    onMealResult={handleMealResult}
                    onWorkoutResult={handleWorkoutResult}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowVision(true)}
                  activeOpacity={0.7}
                >
                  <GlassPanel
                    style={{
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 24,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(0,229,255,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>📸</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '700' }}>Visual Analytics</Text>
                      <Text style={{ color: S.mutedText, fontSize: 12, marginTop: 2 }}>
                        Capture meal or workout for AI analysis
                      </Text>
                    </View>
                    <Text style={{ color: S.dimText, fontSize: 16 }}>›</Text>
                  </GlassPanel>
                </TouchableOpacity>
              )}

              {/* Quick Suggestions */}
              <View style={{ marginBottom: 24 }}>
                <SectionHeader label="Suggested Command Enquiries" accent={S.primaryFixedDim} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {QUICK_SUGGESTIONS.map((s, idx) => (
                    <View key={idx} style={{ width: '47%' as any }}>
                      <SuggestionChip
                        icon={s.icon}
                        label={s.text}
                        onPress={() => handleChipPress(s.text)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}

          {/* ── Floating Input Area ──────────────────────────────────── */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 20,
              paddingTop: 8,
            }}
          >
            {/* Suggestion Chips (when messages exist) */}
            {hasMessages && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
                contentContainerStyle={{ gap: 8, alignItems: 'center' }}
              >
                {getDynamicSuggestions(latestScores).map((chip, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleChipPress(chip)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: S.glass,
                      borderWidth: 0.5,
                      borderColor: S.border,
                      borderRadius: 20,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: S.onSurfaceVariant, fontSize: 12, fontWeight: '600' }}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
              isLoading={isLoading}
              onAttach={() => setShowVision(prev => !prev)}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* ── Reusable Sports Science Detail Modal ─────────────────── */}
      {activeModalData && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <GlassPanel
            glowing
            style={{
              width: '100%',
              maxWidth: 400,
              padding: 24,
              backgroundColor: '#16161a',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 28,
              gap: 16,
            }}
          >
            {/* Header */}
            <View>
              <Text style={{ color: S.accentTeal, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {activeModalData.subtitle ?? 'SPORTS SCIENCE METRIC'}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                  {activeModalData.title}
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveModalData(null)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: S.onSurface, fontSize: 12, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={{ height: 0.5, backgroundColor: S.border }} />

            {/* Description */}
            <Text style={{ color: S.onSurface, fontSize: 14, lineHeight: 22 }}>
              {activeModalData.description}
            </Text>

            {/* Scientific Basis */}
            {activeModalData.science && (
              <View
                style={{
                  backgroundColor: 'rgba(20,184,166,0.05)',
                  borderColor: 'rgba(20,184,166,0.15)',
                  borderWidth: 0.5,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text style={{ color: S.accentTeal, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
                  🔬 Sports Science Ingest
                </Text>
                <Text style={{ color: S.mutedText, fontSize: 12, lineHeight: 18 }}>
                  {activeModalData.science}
                </Text>
              </View>
            )}

            {/* Metrics Breakdown */}
            {activeModalData.metrics && activeModalData.metrics.length > 0 && (
              <View style={{ gap: 8, marginTop: 4 }}>
                {activeModalData.metrics.map((m, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      backgroundColor: S.glass,
                      borderWidth: 0.5,
                      borderColor: S.border,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    {/* Label - prevents shrinking, ensures gap from value */}
                    <Text
                      style={{
                        color: S.onSurfaceVariant,
                        fontSize: 12,
                        fontWeight: '600',
                        flexShrink: 0,
                        marginRight: 12,
                        maxWidth: '50%',
                      }}
                      numberOfLines={2}
                    >
                      {m.label}
                    </Text>
                    {/* Value - takes remaining space, wraps, right-aligned */}
                    <View style={{ flex: 1, alignItems: 'flex-end', flexShrink: 1 }}>
                      <Text
                        style={{
                          color: S.onSurface,
                          fontSize: 13,
                          fontWeight: '800',
                          textAlign: 'right',
                        }}
                        numberOfLines={3}
                      >
                        {m.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Action button */}
            {activeModalData.redirect && (
              <TouchableOpacity
                onPress={activeModalData.redirect.action}
                activeOpacity={0.8}
                style={{
                  backgroundColor: S.primaryFixedDim,
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginTop: 8,
                  shadowColor: S.primaryFixedDim,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text style={{ color: S.bg, fontSize: 14, fontWeight: '800' }}>
                  {activeModalData.redirect.label}
                </Text>
              </TouchableOpacity>
            )}
          </GlassPanel>
        </View>
      )}
    </SafeAreaView>
  )
}
