import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { visionPayloadSchema } from '@/lib/utils/validation'
import { hasGeminiKey } from '@/lib/gemini/client'
import { analyzeWorkoutPhoto } from '@/lib/gemini/vision-workout'
import { computeStrain } from '@/lib/algorithms/strain'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = visionPayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (!hasGeminiKey()) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 400 }
      )
    }

    const { imageBase64 } = parsed.data
    const workoutData = await analyzeWorkoutPhoto(imageBase64)

    const timestamp = new Date().toISOString()
    const hrZones = [0, 0, 0, 0, 0]
    const strainScore = computeStrain(hrZones)

    const db = getDB()
    const result = db.prepare(`
      INSERT INTO activity (timestamp, active_calories, workout_type, duration_mins, hr_zones, strain_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      workoutData.calories ?? 0,
      workoutData.workout_type,
      workoutData.duration_mins ?? (workoutData.sets > 0 ? workoutData.sets * 3 : 30),
      JSON.stringify(hrZones),
      strainScore
    )

    const activity = db.prepare('SELECT * FROM activity WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>

    return NextResponse.json({
      success: true,
      workout: {
        id: activity.id,
        timestamp: activity.timestamp,
        activeCalories: activity.active_calories,
        workoutType: activity.workout_type,
        durationMins: activity.duration_mins,
        hrZones: JSON.parse((activity.hr_zones as string) || '[0,0,0,0,0]'),
        strainScore: activity.strain_score,
        maxHR: activity.max_hr,
        avgHR: activity.avg_hr,
      },
      parsed: workoutData,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
