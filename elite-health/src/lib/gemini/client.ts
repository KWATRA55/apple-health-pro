import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateFallbackCoachResponse, generateFallbackDailyDirective } from './fallback-coach'

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null

const flashModel = genAI?.getGenerativeModel({ model: 'gemini-2.5-flash' }) ?? null

const visionModel = GEMINI_API_KEY
  ? genAI!.getGenerativeModel({ model: 'gemini-2.5-flash' })
  : null

const embeddingModel = genAI?.getGenerativeModel({ model: 'text-embedding-001' }) ?? null

export function hasGeminiKey(): boolean {
  return !!GEMINI_API_KEY && GEMINI_API_KEY.length > 0
}

export function getEmbeddingModel() {
  if (!embeddingModel) throw new Error('Gemini API key not configured')
  return embeddingModel
}

export const COACH_SYSTEM_PROMPT = `You are Elite Health's AI Health Coach, a professional, calm, and highly knowledgeable Sports Scientist and Performance Coach.
Your goal is to help the user understand their biometrics and optimize their recovery and training using simple, factual, and supportive language.

You receive a structured payload where every metric includes scope, confidence, provenance, and status fields.
Read this metadata carefully — it tells you exactly how reliable each number is and where it came from.

PERSONA RULES:
- TONE: Calm, informative, professional, and clear. Avoid alarmist, medicalized, or dramatic words (never say "catastrophic", "severe", "fried", "dangerous", "compromised", "crashed").
- DIRECTIVES: Frame your guidance as practical, realistic suggestions (e.g., "Consider an earlier bedtime" or "We suggest capping your exertion today") rather than absolute commands.
- EVIDENCE & SCOPES: Always ground your conclusions in the user's actual numbers. Every metric in the payload has a "scope" field (selectedDate, latest, rolling7d, rolling30d, allTime). Cite this scope explicitly when referencing a metric.
- DATA CONFIDENCE: When a metric has confidence < 70, say "this is an estimate" or "confidence is low". When a metric has status "missing", do NOT fabricate a value — say "I don't have this data". Never sound certain when confidence is low.
- SCOPE AWARENESS: When the scopeSummary shows hasDataForSelectedDate=false, clearly tell the user "I'm using your latest available data from [date], not your selected date". If scopeSummary.missingMetrics is non-empty, acknowledge what's missing.
- PROVENANCE: Reference the provenance field when explaining why a metric may be unreliable or when explaining how a value was computed.
- NUMERICAL ADVICE: Avoid prescribing exact target numbers (e.g. "sleep 503 minutes") unless they are directly backed by a validated app calculation, and present them as estimated targets.

RESPONSE FORMAT (Format your response exactly with these markdown sections using ###):

### SUMMARY
1-2 short, calm sentences summarizing the user's current physical state.

### EVIDENCE
2-4 bullet points detailing specific numbers from the provided biometric payload, including their explicit scope labels and confidence levels.

### PRACTICAL SUGGESTIONS
2-3 realistic and actionable suggestions to help them recover or optimize training today.

### CONFIDENCE & DATA NOTE
A brief line stating the confidence of this analysis based on the completeness and freshness of the synced logs, referencing actual confidence scores and provenance from the payload. Keep each section highly concise and user-friendly.`

export interface CoachOptions {
  message: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  biometrics?: Record<string, unknown>
  ragContext?: string
}

export async function sendCoachMessage(options: CoachOptions): Promise<string> {
  if (!flashModel) {
    console.log('[COACH] No active Gemini client, utilizing biometric fallback engine.')
    return generateFallbackCoachResponse(options)
  }

  const { message, history = [], biometrics, ragContext } = options

  const contextParts: string[] = [COACH_SYSTEM_PROMPT]

  if (ragContext) {
    contextParts.push(ragContext)
  }

  if (biometrics) {
    contextParts.push(`\nBIOMETRIC DATA:\n${JSON.stringify(biometrics, null, 2)}`)
  }

  const contents = [
    { role: 'user', parts: [{ text: contextParts.join('\n\n') }] },
    { role: 'model', parts: [{ text: 'Understood. I have your biometric data. How can I help you today?' }] },
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    })),
    { role: 'user' as const, parts: [{ text: message }] },
  ]

  try {
    const result = await flashModel.generateContent({ contents })
    return result.response.text()
  } catch (err) {
    console.warn('[COACH] Google Generative AI generation failed, using dynamic local fallback engine:', err)
    return generateFallbackCoachResponse(options)
  }
}

export interface DailyDirectiveResult {
  headline: string
  command: string
  targetStrain: number
  targetBedtime: string
  warningFlag: string | null
  recoveryTip: string
}

export async function generateDailyDirective(biometrics: Record<string, unknown>): Promise<DailyDirectiveResult> {
  if (!flashModel) {
    return generateFallbackDailyDirective(biometrics)
  }

  try {
    const prompt = `${COACH_SYSTEM_PROMPT}

Based on the biometric data below, generate a concise daily training directive.
Return ONLY a JSON object (no markdown, no backticks) with these fields:
{
  "headline": "short all-caps status (e.g. CNS FATIGUED, FULLY RECOVERED, SLEEP DEBT CRITICAL)",
  "command": "one direct action sentence, max 100 chars",
  "targetStrain": number (0-21 recommended max strain for today),
  "targetBedtime": "string like '9:45 PM'",
  "warningFlag": "string warning or null if none",
  "recoveryTip": "one specific recovery protocol, max 100 chars"
}

BIOMETRIC DATA:
${JSON.stringify(biometrics, null, 2)}`

    const result = await flashModel.generateContent(prompt)
    const text = result.response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        headline: parsed.headline || 'DAILY DIRECTIVE',
        command: parsed.command || 'Your recovery is stable. Maintain current training.',
        targetStrain: parsed.targetStrain || 10,
        targetBedtime: parsed.targetBedtime || '10:00 PM',
        warningFlag: parsed.warningFlag || null,
        recoveryTip: parsed.recoveryTip || 'Prioritize parasympathetic recovery.',
      }
    }

    const lines = text.split('\n').filter(l => l.trim())
    return {
      headline: lines[0]?.slice(0, 50) || 'DAILY DIRECTIVE',
      command: lines.slice(1).join(' ') || 'Your recovery is stable. Maintain current training.',
      targetStrain: 10,
      targetBedtime: '10:00 PM',
      warningFlag: null,
      recoveryTip: 'Prioritize parasympathetic recovery.',
    }
  } catch (err) {
    console.warn('[COACH] generateDailyDirective failed, using dynamic local fallback directive:', err)
    return generateFallbackDailyDirective(biometrics)
  }
}

// ── Vision APIs ──────────────────────────────────────────────────

const MEAL_VISION_PROMPT = `You are a precision nutrition analyst. Analyze this meal photo and estimate macronutrients.
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

const WORKOUT_VISION_PROMPT = `You are a gym equipment display parser. Analyze this photo and extract workout data.
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

export interface MealVisionResult {
  meal_description: string
  protein_grams: number
  carbs_grams: number
  fat_grams: number
  total_calories: number
}

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

export async function analyzeMealPhoto(imageBase64: string): Promise<MealVisionResult> {
  if (!visionModel) {
    return {
      meal_description: 'Vision API unavailable — add EXPO_PUBLIC_GEMINI_API_KEY',
      protein_grams: 0,
      carbs_grams: 0,
      fat_grams: 0,
      total_calories: 0,
    }
  }

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
    },
  }

  try {
    const result = await visionModel.generateContent([MEAL_VISION_PROMPT, imagePart])
    const text = result.response.text()
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
  } catch (err) {
    console.error('[VISION] Meal analysis failed:', err)
    return {
      meal_description: 'Analysis failed — try again with a clearer photo',
      protein_grams: 0,
      carbs_grams: 0,
      fat_grams: 0,
      total_calories: 0,
    }
  }
}

export async function analyzeWorkoutPhoto(imageBase64: string): Promise<WorkoutVisionResult> {
  if (!visionModel) {
    return {
      exercise: 'Vision API unavailable',
      sets: 0,
      reps: 0,
      weight_kg: null,
      distance_km: null,
      calories: null,
      duration_mins: null,
      workout_type: 'Unknown',
    }
  }

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
    },
  }

  try {
    const result = await visionModel.generateContent([WORKOUT_VISION_PROMPT, imagePart])
    const text = result.response.text()
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
  } catch (err) {
    console.error('[VISION] Workout analysis failed:', err)
    return {
      exercise: 'Analysis failed — try again',
      sets: 0,
      reps: 0,
      weight_kg: null,
      distance_km: null,
      calories: null,
      duration_mins: null,
      workout_type: 'Unknown',
    }
  }
}
