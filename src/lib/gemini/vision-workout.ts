import { getFlashModel } from './client'

const WORKOUT_PROMPT = `You are a gym equipment display parser. Analyze this photo and extract workout data.
Return ONLY a JSON object with:
{
  "exercise": "string",
  "sets": number,
  "reps": number,
  "weight_kg": number | null,
  "distance_km": number | null,
  "calories": number | null,
  "duration_mins": number | null,
  "workout_type": "string"
}
If you cannot determine a value, use null. Do not hallucinate. Do not include any text outside the JSON.`

export interface WorkoutVisionResult {
  exercise: string
  sets: number
  reps: number
  weight_kg: number | null
  distance_km: number | null
  calories: number | null
  duration_mins: number | null
  workout_type: string
}

export async function analyzeWorkoutPhoto(imageBase64: string): Promise<WorkoutVisionResult> {
  const model = getFlashModel()

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
    },
  }

  const result = await model.generateContent([WORKOUT_PROMPT, imagePart])
  const response = result.response
  const text = response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse workout data from image')
  }

  const parsed = JSON.parse(jsonMatch[0]) as WorkoutVisionResult

  return {
    exercise: parsed.exercise || 'Unknown Exercise',
    sets: parsed.sets || 0,
    reps: parsed.reps || 0,
    weight_kg: parsed.weight_kg ?? null,
    distance_km: parsed.distance_km ?? null,
    calories: parsed.calories ?? null,
    duration_mins: parsed.duration_mins ?? null,
    workout_type: parsed.workout_type || 'Strength Training',
  }
}
