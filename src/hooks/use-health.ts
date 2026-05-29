'use client'

import useSWR from 'swr'
import type { DailyScores, VitalsRecord, SleepRecord, ActivityRecord, MealRecord } from '@/lib/types'

interface HealthData {
  date: string
  scores: DailyScores[]
  vitals: VitalsRecord[]
  sleep: SleepRecord[]
  activities: ActivityRecord[]
  meals: MealRecord[]
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export function useHealth(days: number = 14) {
  const { data, error, isLoading, mutate } = useSWR<HealthData>(
    `/api/health?days=${days}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  )

  const latestScores = data?.scores?.[0] ?? null
  const latestVitals = data?.vitals?.[0] ?? null
  const latestSleep = data?.sleep?.[0] ?? null

  return {
    data,
    latestScores,
    latestVitals,
    latestSleep,
    activities: data?.activities ?? [],
    meals: data?.meals ?? [],
    vitals: data?.vitals ?? [],
    sleep: data?.sleep ?? [],
    scores: data?.scores ?? [],
    error,
    isLoading,
    mutate,
  }
}
