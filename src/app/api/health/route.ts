import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { todayDate, getRollingWindow } from '@/lib/utils/date'
import type { DailyScores, VitalsRecord, SleepRecord, ActivityRecord, MealRecord } from '@/lib/types'

interface VitalsRow {
  id: number
  timestamp: string
  hrv: number
  rhr: number
  spo2: number
  respiratory_rate: number
  skin_temp_delta: number
}

interface SleepRow {
  id: number
  date: string
  total_duration_mins: number
  rem_mins: number
  deep_mins: number
  core_mins: number
  awake_mins: number
  sleep_need_hours: number
  sleep_debt_hours: number
}

interface ActivityRow {
  id: number
  timestamp: string
  active_calories: number
  workout_type: string
  duration_mins: number
  hr_zones: string
  max_hr: number
  strain_score: number
  avg_hr: number
}

interface MealRow {
  id: number
  timestamp: string
  image_base64: string | null
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  total_calories: number
  meal_description: string
}

interface ScoresRow {
  date: string
  recovery_score: number
  strain_score: number
  sleep_debt_hours: number
  sleep_need_hours: number
  hrv_z_score: number
  rhr_z_score: number
  recovery_zone: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '14')
    const db = getDB()

    const { start } = getRollingWindow(days)

    const scoresRows = db.prepare(`
      SELECT * FROM daily_scores WHERE date >= ? ORDER BY date DESC
    `).all(start) as ScoresRow[]

    const dailyScores: DailyScores[] = scoresRows.map((r) => ({
      date: r.date,
      recoveryScore: r.recovery_score,
      strainScore: r.strain_score,
      sleepDebtHours: r.sleep_debt_hours,
      sleepNeedHours: r.sleep_need_hours,
      hrvZScore: r.hrv_z_score,
      rhrZScore: r.rhr_z_score,
      recoveryZone: r.recovery_zone as 'green' | 'yellow' | 'red',
    }))

    const vitalsRows = db.prepare(`
      SELECT * FROM vitals WHERE timestamp >= ? ORDER BY timestamp DESC
    `).all(start + 'T00:00:00.000Z') as VitalsRow[]

    const vitals: VitalsRecord[] = vitalsRows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      hrv: r.hrv,
      rhr: r.rhr,
      spo2: r.spo2,
      respiratoryRate: r.respiratory_rate,
      skinTempDelta: r.skin_temp_delta,
    }))

    const sleepRows = db.prepare(`
      SELECT * FROM sleep WHERE date >= ? ORDER BY date DESC
    `).all(start) as SleepRow[]

    const sleep: SleepRecord[] = sleepRows.map((r) => ({
      id: r.id,
      date: r.date,
      totalDurationMins: r.total_duration_mins,
      remMins: r.rem_mins,
      deepMins: r.deep_mins,
      coreMins: r.core_mins,
      awakeMins: r.awake_mins,
      sleepNeedHours: r.sleep_need_hours,
      sleepDebtHours: r.sleep_debt_hours,
    }))

    const activityRows = db.prepare(`
      SELECT * FROM activity WHERE timestamp >= ? ORDER BY timestamp DESC
    `).all(start + 'T00:00:00.000Z') as ActivityRow[]

    const activities: ActivityRecord[] = activityRows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      activeCalories: r.active_calories,
      workoutType: r.workout_type,
      durationMins: r.duration_mins,
      hrZones: JSON.parse(r.hr_zones || '[0,0,0,0,0]'),
      maxHR: r.max_hr,
      strainScore: r.strain_score,
      avgHR: r.avg_hr,
    }))

    const mealRows = db.prepare(`
      SELECT * FROM meals WHERE timestamp >= ? ORDER BY timestamp DESC
    `).all(start + 'T00:00:00.000Z') as MealRow[]

    const meals: MealRecord[] = mealRows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      imageBase64: r.image_base64 ?? undefined,
      proteinGrams: r.protein_grams,
      carbsGrams: r.carbs_grams,
      fatGrams: r.fat_grams,
      totalCalories: r.total_calories,
      mealDescription: r.meal_description,
    }))

    const today = todayDate()

    return NextResponse.json({
      date: today,
      scores: dailyScores,
      vitals,
      sleep,
      activities,
      meals,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
