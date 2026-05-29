import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { visionPayloadSchema } from '@/lib/utils/validation'
import { hasGeminiKey } from '@/lib/gemini/client'
import { analyzeMealPhoto } from '@/lib/gemini/vision-meal'

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
    const mealData = await analyzeMealPhoto(imageBase64)

    const timestamp = new Date().toISOString()

    const db = getDB()
    const result = db.prepare(`
      INSERT INTO meals (timestamp, image_base64, protein_grams, carbs_grams, fat_grams, total_calories, meal_description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      imageBase64,
      mealData.protein_grams,
      mealData.carbs_grams,
      mealData.fat_grams,
      mealData.total_calories,
      mealData.meal_description
    )

    const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>

    return NextResponse.json({
      success: true,
      meal: {
        id: meal.id,
        timestamp: meal.timestamp,
        proteinGrams: meal.protein_grams,
        carbsGrams: meal.carbs_grams,
        fatGrams: meal.fat_grams,
        totalCalories: meal.total_calories,
        mealDescription: meal.meal_description,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
