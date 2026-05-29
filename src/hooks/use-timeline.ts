'use client'

import useSWR from 'swr'
import type { DailyScores } from '@/lib/types'

interface TimelineData {
  scores: DailyScores[]
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export function useTimeline(days: number = 30) {
  const { data, error, isLoading } = useSWR<TimelineData>(
    `/api/health?days=${days}`,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  )

  const recoveryData = (data?.scores ?? []).map(s => ({
    date: s.date,
    value: s.recoveryScore,
  })).reverse()

  const strainData = (data?.scores ?? []).map(s => ({
    date: s.date,
    value: s.strainScore,
  })).reverse()

  const sleepDebtData = (data?.scores ?? []).map(s => ({
    date: s.date,
    value: s.sleepDebtHours,
  })).reverse()

  const hrvZData = (data?.scores ?? []).map(s => ({
    date: s.date,
    value: s.hrvZScore,
  })).reverse()

  const rhrZData = (data?.scores ?? []).map(s => ({
    date: s.date,
    value: s.rhrZScore,
  })).reverse()

  const getMetricData = (metric: string) => {
    switch (metric) {
      case 'recovery': return recoveryData
      case 'strain': return strainData
      case 'sleepDebt': return sleepDebtData
      case 'hrvZ': return hrvZData
      case 'rhrZ': return rhrZData
      default: return recoveryData
    }
  }

  return {
    getMetricData,
    scores: data?.scores ?? [],
    isLoading,
    error,
  }
}
