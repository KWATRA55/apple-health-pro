import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useHealthStore, computeCorrelationInsightsSelector } from '../../src/lib/store'
import { generateTrendAlerts } from '../../src/lib/algorithms/trend-engine'
import { generateWeeklyPlanSelector } from '../../src/lib/algorithms/weekly-planner'
import { WeeklyPlannerCard } from '../../src/components/home/weekly-planner-card'
import { PremiumOrb } from '../../src/components/health/PremiumOrb'
import { DailyDirective } from '../../src/components/home/daily-directive-v2'
import { PillarCard } from '../../src/components/home/pillar-card'
import { InterceptModal } from '../../src/components/home/intercept-modal'
import { AIPromptBar } from '../../src/components/home/ai-prompt-bar'
import { CorrelationExplorer } from '../../src/components/home/correlation-explorer'
import { BodySystemsStatusBar } from '../../src/components/home/body-systems-bar'
import { SleepMiniCard } from '../../src/components/home/sleep-mini-card'
import { HrvTrendSpark } from '../../src/components/home/hrv-trend-spark'
import { TrainingWindowCard } from '../../src/components/home/training-window-card'
import { StreakTracker } from '../../src/components/home/streak-tracker'
import { DataFreshnessRow } from '../../src/components/ui/data-freshness-row'
import { InsightPriorityStack, type PriorityInsight } from '../../src/components/ui/insight-priority-stack'
import { HomePageSkeleton } from '../../src/components/ui/skeleton'
import { useSelectedDateHealthState } from '../../src/hooks/useSelectedDateHealthState'
import type { InterceptTrigger } from '../../src/lib/types'
import { Image } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { BiometricsInfoModal } from '../../src/components/home/biometrics-info-modal'
import { DailyDirectiveDetailModal } from '../../src/components/home/daily-directive-modal'
import { TrainingWindowDetailModal } from '../../src/components/home/training-window-modal'
import { StreakDetailModal } from '../../src/components/home/streak-detail-modal'
import { CorrelationInsightModal } from '../../src/components/home/correlation-insight-modal'
import { colors as S } from '../../src/theme/stitch-tokens'
import { safeNumber, formatAge } from '../../src/lib/utils/display-helpers'
import EliteCard from '../../src/components/ui/v3/elite-card'
import SectionHeader from '../../src/components/ui/v3/section-header'
import EmptyState from '../../src/components/ui/v3/empty-state'
// [CANONICAL] Scope-explicit data selectors — adds provenance & scope awareness
import {
  selectVitalsForDate,
  selectScoresForDate,
  selectSleepForDate,
  selectActivitiesForDate,
  selectLatestScores,
} from '../../src/lib/canonical-selectors'

export default function HomeScreen() {
  const state = useHealthStore()
  const {
    loadFromDB,
    syncHealthKit,
    scores,
    activities,
    sleep,
    isSyncing,
    isLoading,
    initialSyncDone,
    lastSync,
    selectedDate,
    setSelectedDate,
    injuryRisk,
    cnsStressScore,
    vitals,
    mobility,
    environmental,
    cardioMetabolic,
    runningDynamics,
    journalEntries,
  } = state

  const sel = useSelectedDateHealthState()
  const {
    dateStr,
    selectedDateObj,
    isToday,
    displayDate,
    fullDateStr,
    dayOfWeek,
    currentScores,
    currentVitals,
    currentSleep,
    currentActivities,
    displayPace,
    displayBioAge,
    chronologicalAge,
    isAgeConfigured,
    rhrBaseline,
    synthesis,
    trendReport,
    shiftDate: shiftDateFromHook,
  } = sel

  // [CANONICAL] Scope-explicit data access via canonical selectors
  // These live alongside the existing useSelectedDateHealthState() hook,
  // providing provenance metadata and honest empty states for each domain.
  const canonical = useMemo(() => {
    const storeState = useHealthStore.getState()
    return {
      vitals: selectVitalsForDate(storeState, selectedDate),
      scores: selectScoresForDate(storeState, selectedDate),
      sleep: selectSleepForDate(storeState, selectedDate),
      activities: selectActivitiesForDate(storeState, selectedDate),
      latestScores: selectLatestScores(storeState),
    }
  }, [selectedDate, vitals.length, scores.length, sleep.length, activities.length])

  const [interceptVisible, setInterceptVisible] = useState(false)
  const [lastInterceptShownDate, setLastInterceptShownDate] = useState<string | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [initialModalTab, setInitialModalTab] = useState<'pillars' | 'glossary'>('pillars')

  // Detailed Modal States
  const [directiveModalVisible, setDirectiveModalVisible] = useState(false)
  const [trainingModalVisible, setTrainingModalVisible] = useState(false)
  const [streakModalVisible, setStreakModalVisible] = useState(false)
  const [activeStreakType, setActiveStreakType] = useState<'recoveryStreak' | 'trainingStreak' | 'hrvPositiveStreak' | null>(null)
  const [activeStreakCount, setActiveStreakCount] = useState(0)
  const [correlationModalVisible, setCorrelationModalVisible] = useState(false)
  const [activeInsight, setActiveInsight] = useState<any>(null)

  const fadeProgress = useSharedValue(0)

  useEffect(() => {
    fadeProgress.value = 0
    fadeProgress.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
  }, [selectedDateObj])

  const animStyle = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
  }))

  const weeklyPlan = useMemo(() => generateWeeklyPlanSelector(useHealthStore.getState()), [
    scores, sleep, activities, environmental, injuryRisk, cnsStressScore, journalEntries,
  ])

  // Prepend past 3 days to Weekly Plan to construct a beautiful 10-day timeline
  const timelinePlan = useMemo(() => {
    if (!weeklyPlan) return null

    const today = new Date()
    const pastDays: any[] = []

    for (let i = -3; i <= -1; i++) {
      const pastDate = new Date()
      pastDate.setDate(today.getDate() + i)
      const pastDateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`

      const pastScores = scores.find(s => s.date === pastDateStr) || null
      const pastActivity = activities.find(a => a.timestamp.startsWith(pastDateStr)) || null

      let intensityLabel: 'REST' | 'LIGHT' | 'MODERATE' | 'HARD' | 'INTENSE' = 'REST'
      const actualStrain = pastScores?.strainScore ?? pastActivity?.strainScore ?? 0
      if (actualStrain > 15) intensityLabel = 'INTENSE'
      else if (actualStrain > 11) intensityLabel = 'HARD'
      else if (actualStrain > 6) intensityLabel = 'MODERATE'
      else if (actualStrain > 2) intensityLabel = 'LIGHT'

      const dayLabel = pastDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()

      pastDays.push({
        date: pastDateStr,
        label: dayLabel,
        recommendedStrain: actualStrain,
        workoutType: pastActivity?.workoutType ?? 'Rest',
        targetBedtime: '10:00 PM',
        recoveryProtocols: [],
        nutritionFocus: '',
        warningFlags: [],
        intensityLabel,
      })
    }

    return {
      ...weeklyPlan,
      days: [...pastDays, ...weeklyPlan.days],
    }
  }, [weeklyPlan, scores, activities])

  const bioAgeRecencyLabel = useMemo(() => {
    // No recency label needed — stale fallback logic has been removed.
    // LongevitySphere handles the "awaiting inputs" fallback display directly.
    return undefined
  }, [])

  const correlationInsights = useMemo(() => computeCorrelationInsightsSelector(useHealthStore.getState()), [
    journalEntries, activities, environmental, scores, vitals, sleep,
  ])

  const allTriggers = useMemo((): InterceptTrigger[] => {
    const synthesisTriggers = synthesis?.interceptTriggers ?? []
    if (!trendReport) return synthesisTriggers

    const trendAlerts = generateTrendAlerts({
      patterns: trendReport.patterns,
      metrics: trendReport.metrics,
    })

    const seen = new Set<string>()
    const merged: InterceptTrigger[] = []

    for (const trigger of [...trendAlerts, ...synthesisTriggers]) {
      const key = `${trigger.type}:${trigger.pill}`
      if (seen.has(key)) {
        const existing = merged.find(t => `${t.type}:${t.pill}` === key)
        if (existing) {
          const severityRank = { critical: 3, warning: 2, info: 1 }
          if (severityRank[trigger.severity] > severityRank[existing.severity]) {
            merged[merged.indexOf(existing)] = trigger
          }
        }
      } else {
        seen.add(key)
        merged.push(trigger)
      }
    }

    return merged.sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 }
      return (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2)
    })
  }, [synthesis, trendReport])

  const paceOfAging = displayPace

  useEffect(() => {
    // Only show critical intercepts automatically if it is the active date (Today) and we haven't shown it for today yet
    if (isToday && dateStr !== lastInterceptShownDate && allTriggers.some(t => t.severity === 'critical')) {
      setInterceptVisible(true)
      setLastInterceptShownDate(dateStr)
    }
  }, [allTriggers, isToday, dateStr, lastInterceptShownDate])

  const priorityInsights: PriorityInsight[] = useMemo(() => {
    if (!synthesis) return []
    const insights: PriorityInsight[] = []

    if (allTriggers.length > 0) {
      const topRisk = allTriggers[0]
      insights.push({
        type: topRisk.severity === 'critical' ? 'risk' : 'reason',
        title: topRisk.title,
        description: topRisk.message,
      })
    }

    if (synthesis.readiness.zone === 'critical' || synthesis.readiness.zone === 'attention') {
      insights.push({
        type: 'reason',
        title: 'Readiness Suppressed',
        description: synthesis.readiness.detail,
      })
    } else if (synthesis.resilience.zone === 'critical') {
      insights.push({
        type: 'reason',
        title: 'Defense Systems Low',
        description: synthesis.resilience.detail,
      })
    }

    if (synthesis.longevity.zone === 'optimal') {
      insights.push({
        type: 'positive',
        title: 'Longevity Advantage',
        description: synthesis.longevity.detail,
      })
    } else if (synthesis.readiness.zone === 'optimal') {
      insights.push({
        type: 'positive',
        title: 'Prime to Perform',
        description: synthesis.readiness.detail,
      })
    }

    if (insights.length === 0) {
      insights.push({
        type: 'opportunity',
        title: 'Baseline Maintained',
        description: 'No major shifts detected. Good day to build consistency.'
      })
    }

    return insights.slice(0, 3)
  }, [synthesis, allTriggers])

  const shiftDate = (days: number) => shiftDateFromHook(days)

  // Format an ISO timestamp as a friendly relative time string
  const formatRelativeTime = useCallback((iso: string) => {
    const ms = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [])

  const handleInsightPress = useCallback((insight: PriorityInsight) => {
    // Route to the most relevant Health view based on insight type
    if (insight.type === 'risk' || insight.type === 'reason') {
      // Route to readiness or resilience depending on which is flagged
      if (synthesis?.readiness.zone === 'critical' || synthesis?.readiness.zone === 'attention') {
        router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'readiness' } })
      } else if (synthesis?.resilience.zone === 'critical') {
        router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'resilience' } })
      } else {
        router.push({ pathname: '/(tabs)/health', params: { date: dateStr } })
      }
    } else if (insight.type === 'positive' || insight.type === 'opportunity') {
      router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'longevity' } })
    } else {
      router.push({ pathname: '/(tabs)/health', params: { date: dateStr } })
    }
  }, [dateStr, synthesis])

  const handleAskKilo = useCallback(async (query: string) => {
    router.push({
      pathname: '/(tabs)/coach',
      params: { initialQuery: query },
    })
  }, [])

  const handleInterceptAction = useCallback((trigger: InterceptTrigger) => {
    switch (trigger.pill) {
      case 'readiness':
        router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'readiness' } })
        break
      case 'resilience':
        router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'resilience' } })
        break
      case 'longevity':
        router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'longevity' } })
        break
      default:
        router.push({ pathname: '/(tabs)/health', params: { date: dateStr } })
    }
  }, [dateStr])

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Fixed Header (Stitch-style) ──────────────────────────────── */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: 'rgba(18,18,20,0.60)',
            borderBottomWidth: 0.5,
            borderBottomColor: S.border,
            paddingTop: 48,
            paddingBottom: 16,
            paddingHorizontal: 24,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Leading Avatar */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: S.surfaceContainer, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: S.borderStrong }}
          >
            <Text style={{ color: S.primaryFixedDim, fontSize: 16, fontWeight: '900' }}>AT</Text>
          </TouchableOpacity>

          {/* Headline */}
          <Text style={{ color: S.onSurface, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
            ELITE HEALTH
          </Text>

          {/* Trailing Icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity
              onPress={() => {
                setInitialModalTab('pillars')
                setShowInfoModal(true)
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="info-outline" size={24} color={S.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                router.push('/(tabs)/health')
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="calendar-today" size={24} color={S.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 170, paddingHorizontal: 24, paddingTop: 85 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={animStyle}>
            {(isLoading && !initialSyncDone && scores.length === 0) ? (
              <HomePageSkeleton />
            ) : (
              <>
                {/* ── Date Selector (Centered) & Data Freshness (Top Right) ── */}
                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 28, position: 'relative' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <TouchableOpacity onPress={() => shiftDate(-1)} hitSlop={10}>
                      <MaterialIcons name="arrow-back-ios" size={20} color={S.dimText} />
                    </TouchableOpacity>
                    <Text style={{
                      color: S.onSurface,
                      fontSize: 18,
                      fontWeight: '900',
                      letterSpacing: 3,
                      textTransform: 'uppercase',
                    }}>
                      {isToday ? 'TODAY' : displayDate.toUpperCase()}
                    </Text>
                    <TouchableOpacity onPress={() => shiftDate(1)} hitSlop={10} disabled={isToday} style={{ opacity: isToday ? 0.3 : 1 }}>
                      <MaterialIcons name="arrow-forward-ios" size={20} color={S.dimText} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ position: 'absolute', right: 0, top: -30 }}>
                    <DataFreshnessRow
                      lastSyncStr={lastSync ? formatRelativeTime(lastSync) : 'never'}
                      statusText={isSyncing ? 'Syncing...' : ''}
                      isSyncing={isSyncing}
                      onPress={isToday && !isSyncing ? () => syncHealthKit() : undefined}
                    />
                  </View>
                </View>

                {/* ── Hero state: Longevity Orb ────────────────────────── */}
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                  <PremiumOrb
                    variant="home-longevity"
                    primaryValue={displayBioAge?.value != null ? formatAge(displayBioAge.value) : null}
                    secondaryLabel={
                      displayBioAge != null && isAgeConfigured
                        ? `${displayBioAge.value < chronologicalAge ? '↓' : '↑'} ${safeNumber(Math.abs(displayBioAge.value - chronologicalAge), 1)} yr ${displayBioAge.value < chronologicalAge ? 'younger' : 'older'}`
                        : null
                    }
                    isEmpty={displayPace == null || displayBioAge == null}
                    fallbackText="Sync HealthKit for biological age"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'longevity' } })
                    }}
                    accessibilityLabel="Biological Age orb. Tap to view longevity details."
                  />
                </View>

                {/* ── Today's Decision Stack ──────────────────────────── */}
                <DailyDirective
                  synthesis={synthesis}
                  isLoading={isToday && isSyncing}
                  onPress={() => setDirectiveModalVisible(true)}
                  onPressStrain={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'resilience' } })
                  }}
                  onPressBedtime={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'readiness' } })
                  }}
                  onSyncPress={() => syncHealthKit()}
                />
                <View style={{ height: 12 }} />
                {synthesis ? (
                  <TrainingWindowCard
                    synthesis={synthesis}
                    activities={currentActivities}
                    cnsStressRisk={synthesis.cnsStressScore?.risk ?? null}
                    dateStr={dateStr}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setTrainingModalVisible(true)
                    }}
                  />
                ) : (
                  <EmptyState
                    icon="⚡"
                    title="Training Window"
                    subtitle="Awaiting HealthKit sync"
                  />
                )}
                <View style={{ height: 32 }} />

                {/* ── Why Today Looks Like This ───────────────────────── */}
                {priorityInsights.length > 0 && (
                  <View style={{ marginBottom: 32 }}>
                    <SectionHeader label="Why Today Looks Like This" />
                    <InsightPriorityStack insights={priorityInsights} onPressInsight={handleInsightPress} />
                  </View>
                )}

                {/* ── 3 Pillar Cards (Bento Grid) ─────────────────────── */}
                <View style={{ marginBottom: 24 }}>
                  <SectionHeader label="Health Pillars" />
                  {synthesis ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <PillarCard
                          pillar={synthesis.readiness}
                          onPress={() => router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'readiness' } })}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <PillarCard
                          pillar={synthesis.resilience}
                          onPress={() => router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'resilience' } })}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <PillarCard
                          pillar={synthesis.longevity}
                          onPress={() => router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'longevity' } })}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['Readiness', 'Resilience', 'Longevity'].map(label => (
                        <View key={label} style={{ flex: 1, minWidth: 0 }}>
                          <EliteCard padding={12} style={{ alignItems: 'center', minHeight: 100, justifyContent: 'center' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }} numberOfLines={1} adjustsFontSizeToFit>
                              {label}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, fontWeight: '500', marginTop: 4 }}>
                              Awaiting data
                            </Text>
                          </EliteCard>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* ── Body Systems Status Bar ────────────────────── */}
                <View style={{ marginBottom: 32 }}>
                  {synthesis ? (
                    <BodySystemsStatusBar
                      vitals={currentVitals}
                      cnsStress={synthesis.cnsStressScore}
                      rhrBaseline={rhrBaseline}
                      dateStr={dateStr}
                    />
                  ) : (
                    <EmptyState
                      icon="🫀"
                      title="Body Systems"
                      subtitle="Awaiting vitals data"
                    />
                  )}
                </View>

                {/* ── Trends & Planner (Secondary Scroll) ──────────────── */}

                <View style={{ marginBottom: 24 }}>
                  <SectionHeader label="Trends & Recovery" />
                  <HrvTrendSpark vitals={vitals} scores={scores} dateStr={dateStr} />
                </View>

                <SleepMiniCard sleep={currentSleep} sleepDebtHours={currentScores?.sleepDebtHours ?? null} />

                {correlationInsights.length > 0 && (
                  <View style={{ marginTop: 24 }}>
                    <CorrelationExplorer
                      insights={correlationInsights}
                      onPressInsight={(insight) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setActiveInsight(insight)
                        setCorrelationModalVisible(true)
                      }}
                    />
                  </View>
                )}

                <EliteCard variant="strong" padding={16} style={{ marginTop: 24 }}>
                  <SectionHeader
                    label={displayDate === 'Today' ? "Today's Timeline" : `${displayDate}'s Timeline`}
                  />
                  {currentActivities.length > 0 ? (
                    currentActivities.slice(0, 3).map((a, i) => (
                      <TouchableOpacity
                        key={i}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          backgroundColor: 'rgba(18, 18, 20, 0.8)',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.08)',
                          marginBottom: i < currentActivities.slice(0, 3).length - 1 ? 12 : 0,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: S.primaryFixedDim }} />
                        <View style={{
                          padding: 12, borderRadius: 24,
                          backgroundColor: 'rgba(122,215,198,0.10)',
                          borderWidth: 1, borderColor: 'rgba(122,215,198,0.20)',
                          marginLeft: 12,
                          marginRight: 16,
                        }}>
                          <MaterialIcons name={a.workoutType.toLowerCase().includes('run') ? "directions-run" : "fitness-center"} size={24} color={S.primaryFixedDim} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: S.onSurface, fontSize: 16, fontWeight: '700' }}>
                            {a.workoutType}
                          </Text>
                          <Text style={{ color: S.dimText, fontSize: 12, marginTop: 2 }}>
                            Target: {a.workoutType.toLowerCase().includes('run') ? 'Aerobic Base' : 'Strength'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={{ color: S.primaryFixedDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                            {a.durationMins} MIN
                          </Text>
                          <Text style={{ color: S.mutedText, fontSize: 10 }}>
                            {a.activeCalories} kcal • Str {a.strainScore != null ? safeNumber(a.strainScore, 1) : '--'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 12, fontWeight: '500', textAlign: 'center', paddingVertical: 12 }}>
                      No activities logged · Sync HealthKit or log a workout
                    </Text>
                  )}
                </EliteCard>

                {timelinePlan ? (
                  <View style={{ marginTop: 24 }}>
                    <WeeklyPlannerCard
                      plan={timelinePlan}
                      selectedDate={selectedDate}
                      onPressDay={(day) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setSelectedDate(day.date)
                      }}
                    />
                  </View>
                ) : (
                  <View style={{ marginTop: 24 }}>
                    <EmptyState
                      icon="📋"
                      title="Weekly Planner"
                      subtitle="Awaiting sufficient data to generate your personalized training plan"
                    />
                  </View>
                )}

                {scores.length > 0 ? (
                  <View style={{ marginTop: 24 }}>
                    <StreakTracker
                      scores={scores}
                      activities={activities}
                      onPressStreak={(type, count) => {
                        setActiveStreakType(type)
                        setActiveStreakCount(count)
                        setStreakModalVisible(true)
                      }}
                    />
                  </View>
                ) : (
                  <View style={{ marginTop: 24 }}>
                    <EmptyState
                      icon="🔥"
                      title="Streaks"
                      subtitle="Log your first day of data to start building a streak"
                    />
                  </View>
                )}

                {/* ── Global Empty State ────────────────────────────── */}
                {!synthesis && !isSyncing && (
                  <View style={{ marginTop: 24 }}>
                    <EmptyState
                      icon="⌛"
                      title="No Health Data Yet"
                      subtitle="Your dashboard structure is preserved above — pull to sync Apple Health and populate all sections."
                    />
                  </View>
                )}

                {/* [CANONICAL] Data provenance & scope declaration */}
                <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: S.border, alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
                    data scope · provenance
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
                    {(['vitals', 'scores', 'sleep', 'activities'] as const).map(domain => {
                      const vm = canonical[domain]
                      const isPresent = vm.status === 'present'
                      return (
                        <View key={domain} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isPresent ? S.success : 'rgba(255,255,255,0.15)' }} />
                          <Text style={{ fontSize: 7, color: isPresent ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.15)', fontWeight: '600' }}>
                            {domain} ({vm.scope})
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>

        {/* ── Intercept Modal ────────────────────────────────────────── */}
        <InterceptModal
          visible={interceptVisible}
          triggers={allTriggers}
          onDismiss={() => setInterceptVisible(false)}
          onAction={handleInterceptAction}
        />

        {/* ── Detailed Sports-Science Modals ─────────────────────────── */}
        <DailyDirectiveDetailModal
          visible={directiveModalVisible}
          onClose={() => setDirectiveModalVisible(false)}
          synthesis={synthesis}
        />

        <TrainingWindowDetailModal
          visible={trainingModalVisible}
          onClose={() => setTrainingModalVisible(false)}
          synthesis={synthesis}
        />

        <StreakDetailModal
          visible={streakModalVisible}
          onClose={() => setStreakModalVisible(false)}
          streakType={activeStreakType}
          count={activeStreakCount}
        />

        <CorrelationInsightModal
          visible={correlationModalVisible}
          onClose={() => setCorrelationModalVisible(false)}
          insight={activeInsight}
        />

        {/* ── Biometrics Info Modal ───────────────────────────────────── */}
        <BiometricsInfoModal
          visible={showInfoModal}
          onClose={() => setShowInfoModal(false)}
          initialTab={initialModalTab}
        />

        {/* ── Floating Ask KILO Bar ──────────────────────────────────── */}
        <AIPromptBar onSubmit={handleAskKilo} />
      </SafeAreaView>
    </View>
  )
}
