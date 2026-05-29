import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { ingestPayloadSchema } from '@/lib/utils/validation'
import { computeStrain } from '@/lib/algorithms/strain'
import { isoToDate, todayDate, getRollingWindow } from '@/lib/utils/date'
import { computeRecoveryFromData } from '@/lib/algorithms/recovery'
import { computeSleepDebtFromData } from '@/lib/algorithms/sleep-debt'
import type { DailyScores, VitalsRecord, SleepRecord } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ingestPayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { timestamp, vitals, sleep, activity, meal } = parsed.data
    const db = getDB()
    const date = isoToDate(timestamp)

    if (vitals && (vitals.hrv || vitals.rhr || vitals.spo2)) {
      db.prepare(`
        INSERT INTO vitals (timestamp, hrv, rhr, spo2, respiratory_rate, skin_temp_delta)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        timestamp,
        vitals.hrv ?? null,
        vitals.rhr ?? null,
        vitals.spo2 ?? null,
        vitals.respiratoryRate ?? null,
        vitals.skinTempDelta ?? null
      )
    }

    if (sleep && sleep.totalDurationMins) {
      db.prepare(`
        INSERT OR REPLACE INTO sleep (date, total_duration_mins, rem_mins, deep_mins, core_mins, awake_mins)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        date,
        sleep.totalDurationMins,
        sleep.remMins ?? 0,
        sleep.deepMins ?? 0,
        sleep.coreMins ?? 0,
        sleep.awakeMins ?? 0
      )
    }

    let strainScore: number | null = null

    if (activity && activity.hrZones) {
      strainScore = computeStrain(activity.hrZones)

      db.prepare(`
        INSERT INTO activity (timestamp, active_calories, workout_type, duration_mins, hr_zones, max_hr, strain_score, avg_hr)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        timestamp,
        activity.activeCalories ?? 0,
        activity.workoutType ?? 'Other',
        activity.durationMins ?? 0,
        JSON.stringify(activity.hrZones),
        activity.maxHR ?? null,
        strainScore,
        activity.avgHR ?? null
      )
    }

    if (meal && (meal.proteinGrams || meal.carbsGrams || meal.fatGrams || meal.totalCalories)) {
      db.prepare(`
        INSERT INTO meals (timestamp, image_base64, protein_grams, carbs_grams, fat_grams, total_calories, meal_description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        timestamp,
        meal.imageBase64 ?? null,
        meal.proteinGrams ?? 0,
        meal.carbsGrams ?? 0,
        meal.fatGrams ?? 0,
        meal.totalCalories ?? 0,
        meal.mealDescription ?? ''
      )
    }

    const { start } = getRollingWindow(14, date)

    const vitals14 = db.prepare(`
      SELECT hrv, rhr FROM vitals
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `).all(start, date + 'T23:59:59.999Z') as { hrv: number; rhr: number }[]

    const todayVitalsRow = db.prepare(`
      SELECT hrv, rhr FROM vitals
      WHERE date(timestamp) = ?
      ORDER BY timestamp DESC LIMIT 1
    `).get(date) as { hrv: number; rhr: number } | undefined

    const sleepRow = db.prepare(`
      SELECT total_duration_mins, sleep_need_hours FROM sleep WHERE date = ?
    `).get(date) as { total_duration_mins: number; sleep_need_hours: number } | undefined

    const recovery = computeRecoveryFromData({
      vitals: vitals14,
      todayVitals: todayVitalsRow,
      sleepRecord: sleepRow ? {
        totalDurationMins: sleepRow.total_duration_mins,
        sleepNeedHours: sleepRow.sleep_need_hours,
      } : null,
    })

    const pastWeekSleepRaw = db.prepare(`
      SELECT total_duration_mins, sleep_need_hours FROM sleep
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(start, date) as { total_duration_mins: number; sleep_need_hours: number }[]

    const pastWeekSleep = pastWeekSleepRaw.map(s => ({
      totalDurationMins: s.total_duration_mins,
      sleepNeedHours: s.sleep_need_hours,
    }))

    const sleepDebt = computeSleepDebtFromData({
      todaySleep: sleepRow ? { totalDurationMins: sleepRow.total_duration_mins } : null,
      pastWeekSleep,
    })

    const scores: DailyScores = {
      date,
      recoveryScore: recovery.recoveryScore,
      strainScore: strainScore ?? 0,
      sleepDebtHours: sleepDebt.sleepDebtHours,
      sleepNeedHours: sleepDebt.sleepNeedHours,
      hrvZScore: recovery.hrvZScore,
      rhrZScore: recovery.rhrZScore,
      recoveryZone: recovery.zone,
    }

    db.prepare(`
      INSERT OR REPLACE INTO daily_scores (date, recovery_score, strain_score, sleep_debt_hours, sleep_need_hours, hrv_z_score, rhr_z_score, recovery_zone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      date,
      scores.recoveryScore,
      scores.strainScore,
      scores.sleepDebtHours,
      scores.sleepNeedHours,
      scores.hrvZScore,
      scores.rhrZScore,
      scores.recoveryZone
    )

    return NextResponse.json({ success: true, scores })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
