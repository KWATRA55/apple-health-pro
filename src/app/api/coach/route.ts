import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { todayDate } from '@/lib/utils/date'
import { coachMessageSchema } from '@/lib/utils/validation'
import { getFlashModel, hasGeminiKey } from '@/lib/gemini/client'
import { COACH_SYSTEM_PROMPT, buildCoachContext, buildCoachMessages } from '@/lib/gemini/coach-prompt'
import { retrieveContext } from '@/lib/rag/retrieval'
import type { HealthSnapshot } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = coachMessageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { message, history } = parsed.data

    if (!hasGeminiKey()) {
      return NextResponse.json({
        reply: "I'm not fully configured yet. Please add your GEMINI_API_KEY to the .env.local file to enable the AI Coach. Once configured, I'll be able to analyze your health data and provide personalized recommendations.",
      })
    }

    const snapshot = getHealthSnapshot()

    let referenceContext = ''
    try {
      const result = await retrieveContext(message, 5)
      referenceContext = result.formattedContext
    } catch {
      referenceContext = 'No reference literature available for this query.'
    }

    const context = buildCoachContext(snapshot as unknown as Record<string, unknown>, referenceContext)

    const messages = buildCoachMessages(
      COACH_SYSTEM_PROMPT,
      context,
      (history || []).map(m => ({ role: m.role, content: m.content })),
      message
    )

    const model = getFlashModel()
    const result = await model.generateContent({
      contents: messages as unknown as { role: string; parts: { text: string }[] }[],
    })

    const response = result.response
    const reply = response.text()

    return NextResponse.json({ reply })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

function getHealthSnapshot(): HealthSnapshot {
  const db = getDB()
  const date = todayDate()

  const scoresRow = db.prepare('SELECT * FROM daily_scores WHERE date = ?').get(date) as Record<string, unknown> | undefined

  const vitalsRow = db.prepare(`
    SELECT * FROM vitals WHERE date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1
  `).get(date) as Record<string, unknown> | undefined

  const sleepRow = db.prepare('SELECT * FROM sleep WHERE date = ?').get(date) as Record<string, unknown> | undefined

  const mealRows = db.prepare(`
    SELECT * FROM meals WHERE date(timestamp) = ? ORDER BY timestamp DESC
  `).all(date) as Record<string, unknown>[]

  const activityRows = db.prepare(`
    SELECT * FROM activity WHERE date(timestamp) = ? ORDER BY timestamp DESC
  `).all(date) as Record<string, unknown>[]

  return {
    scores: scoresRow ? mapScoresRow(scoresRow) : null,
    vitals: vitalsRow ? mapVitalsRow(vitalsRow) : null,
    sleep: sleepRow ? mapSleepRow(sleepRow) : null,
    meals: mealRows.map(mapMealRow),
    activities: activityRows.map(mapActivityRow),
  }
}

function mapScoresRow(r: Record<string, unknown>) {
  return {
    date: r.date as string,
    recoveryScore: r.recovery_score as number,
    strainScore: r.strain_score as number,
    sleepDebtHours: r.sleep_debt_hours as number,
    sleepNeedHours: r.sleep_need_hours as number,
    hrvZScore: r.hrv_z_score as number,
    rhrZScore: r.rhr_z_score as number,
    recoveryZone: r.recovery_zone as 'green' | 'yellow' | 'red',
  }
}

function mapVitalsRow(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    timestamp: r.timestamp as string,
    hrv: r.hrv as number,
    rhr: r.rhr as number,
    spo2: r.spo2 as number,
    respiratoryRate: r.respiratory_rate as number,
    skinTempDelta: r.skin_temp_delta as number,
  }
}

function mapSleepRow(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    date: r.date as string,
    totalDurationMins: r.total_duration_mins as number,
    remMins: r.rem_mins as number,
    deepMins: r.deep_mins as number,
    coreMins: r.core_mins as number,
    awakeMins: r.awake_mins as number,
    sleepNeedHours: r.sleep_need_hours as number,
    sleepDebtHours: r.sleep_debt_hours as number,
  }
}

function mapMealRow(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    timestamp: r.timestamp as string,
    proteinGrams: r.protein_grams as number,
    carbsGrams: r.carbs_grams as number,
    fatGrams: r.fat_grams as number,
    totalCalories: r.total_calories as number,
    mealDescription: r.meal_description as string,
  }
}

function mapActivityRow(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    timestamp: r.timestamp as string,
    activeCalories: r.active_calories as number,
    workoutType: r.workout_type as string,
    durationMins: r.duration_mins as number,
    hrZones: JSON.parse((r.hr_zones as string) || '[0,0,0,0,0]') as number[],
    maxHR: r.max_hr as number,
    strainScore: r.strain_score as number | null,
    avgHR: r.avg_hr as number,
  }
}
