'use client'

import { Navigation } from '@/components/ui/navigation'
import { VitalsRing } from '@/components/dashboard/vitals-ring'
import { StrainCard } from '@/components/dashboard/strain-card'
import { SleepCard } from '@/components/dashboard/sleep-card'
import { HRVTrend } from '@/components/dashboard/hrv-trend'
import { DailySummary } from '@/components/dashboard/daily-summary'
import { GlassCard } from '@/components/ui/glass-card'
import { useHealth } from '@/hooks/use-health'
import { computeRecoveryFromData } from '@/lib/algorithms/recovery'
import { computeSleepDebtFromData } from '@/lib/algorithms/sleep-debt'
import { useMemo } from 'react'
import type { RecoveryResult, SleepDebtResult } from '@/lib/types'

export default function DashboardPage() {
  const { latestScores, latestVitals, latestSleep, activities, meals, vitals, sleep, isLoading } = useHealth(14)

  const recovery = useMemo<RecoveryResult | null>(() => {
    if (vitals.length === 0 && !latestVitals) return null
    return computeRecoveryFromData({
      vitals: vitals.map(v => ({ hrv: v.hrv, rhr: v.rhr })),
      todayVitals: latestVitals ? { hrv: latestVitals.hrv, rhr: latestVitals.rhr } : null,
      sleepRecord: latestSleep ? {
        totalDurationMins: latestSleep.totalDurationMins,
        sleepNeedHours: latestSleep.sleepNeedHours,
      } : null,
    })
  }, [vitals, latestVitals, latestSleep])

  const sleepDebt = useMemo<SleepDebtResult | null>(() => {
    return computeSleepDebtFromData({
      todaySleep: latestSleep ? { totalDurationMins: latestSleep.totalDurationMins } : null,
      pastWeekSleep: sleep.map(s => ({
        totalDurationMins: s.totalDurationMins,
        sleepNeedHours: s.sleepNeedHours,
      })),
    })
  }, [latestSleep, sleep])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-apple-black">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 pt-8 pb-24 md:pb-8 space-y-6">
        <header className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-apple-white">
              Elite Health
            </h1>
            <p className="text-apple-gray text-sm">{today}</p>
          </div>
        </header>

        <div className="flex justify-center py-4">
          <VitalsRing recovery={recovery} isLoading={isLoading} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StrainCard
            strainScore={latestScores?.strainScore ?? null}
            activities={activities.slice(0, 3)}
          />
          <SleepCard
            sleepDebt={sleepDebt}
            lastSleep={latestSleep}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HRVTrend vitals={vitals.slice(0, 7)} />
          <DailySummary
            vitals={latestVitals}
            activity={activities[0]}
            meals={meals.slice(0, 5)}
          />
        </div>

        {!isLoading && !latestScores && vitals.length === 0 && (
          <GlassCard className="p-6 text-center">
            <p className="text-apple-white font-medium mb-2">Welcome to Elite Health</p>
            <p className="text-apple-gray text-sm mb-4">
              No health data yet. Head to the Ingest tab to upload your first Apple Health snapshot.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
