import { getFlashModel } from './client'

const MEAL_PROMPT = `You are a precision nutrition analyst. Analyze this meal photo and estimate macronutrients.
Return ONLY a JSON object with:
{
  "meal_description": "short string describing the meal",
  "protein_grams": number,
  "carbs_grams": number,
  "fat_grams": number,
  "total_calories": number
}
Base your estimates on visible portion sizes and common nutritional databases.
If the photo is unclear, provide your best conservative estimate.
Do not include any text outside the JSON.`

export interface MealVisionResult {
  meal_description: string
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  total_calories: number
}

export async function analyzeMealPhoto(imageBase64: string): Promise<MealVisionResult> {
  const model = getFlashModel()

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
    },
  }

  const result = await model.generateContent([MEAL_PROMPT, imagePart])
  const response = result.response
  const text = response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse meal data from image')
  }

  const parsed = JSON.parse(jsonMatch[0]) as MealVisionResult

  return {
    meal_description: parsed.meal_description || 'Unknown Meal',
    protein_grams: Math.max(0, parsed.protein_grams || 0),
    carbs_grams: Math.max(0, parsed.carbs_grams || 0),
    fat_grams: Math.max(0, parsed.fat_grams || 0),
    total_calories: Math.max(0, parsed.total_calories || 0),
  }
}
