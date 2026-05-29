export const ALGORITHM_VERSION = '1.0.0';
export const ALGORITHM_NAME = 'streaks';

import type { DailyScores, VitalsRecord, ActivityRecord } from '../types'

export interface StreakResult {
  recoveryStreak: number
  trainingStreak: number
  hrvPositiveStreak: number
}

/**
 * Compute rolling streaks from daily scores and activities.
 * - recoveryStreak: consecutive days ending today where recovery > 50
 * - trainingStreak: consecutive days ending today where at least one workout was logged
 * - hrvPositiveStreak: consecutive days ending today where HRV z-score > 0
 */
export function computeStreaks(
  dailyScores: DailyScores[],
  activities: ActivityRecord[],
): StreakResult {
  if (dailyScores.length === 0) {
    return { recoveryStreak: 0, trainingStreak: 0, hrvPositiveStreak: 0 }
  }

  // Sort descending by date (most recent first)
  const sorted = [...dailyScores].sort((a, b) => b.date.localeCompare(a.date))

  // Build a set of dates with logged activities
  const activityDates = new Set<string>()
  activities.forEach(a => {
    activityDates.add(a.timestamp.slice(0, 10))
  })

  let recoveryStreak = 0
  let trainingStreak = 0
  let hrvPositiveStreak = 0

  // Walk backwards from most recent day
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]

    // Check date continuity (each day should be exactly 1 day before the previous)
    if (i > 0) {
      const prev = new Date(sorted[i - 1].date + 'T12:00:00')
      const curr = new Date(s.date + 'T12:00:00')
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays !== 1) break // Gap in data — stop all streaks
    }

    // Recovery streak
    if (s.recoveryScore > 50 && recoveryStreak === i) {
      recoveryStreak++
    }

    // Training streak
    if (activityDates.has(s.date) && trainingStreak === i) {
      trainingStreak++
    }

    // HRV positive streak
    if (s.hrvZScore > 0 && hrvPositiveStreak === i) {
      hrvPositiveStreak++
    }
  }

  return { recoveryStreak, trainingStreak, hrvPositiveStreak }
}
