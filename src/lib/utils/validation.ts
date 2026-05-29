import { z } from 'zod'

const vitalsSchema = z.object({
  hrv: z.number().min(0).max(300).optional(),
  rhr: z.number().min(30).max(200).optional(),
  spo2: z.number().min(70).max(100).optional(),
  respiratoryRate: z.number().min(4).max(60).optional(),
  skinTempDelta: z.number().min(-5).max(5).optional(),
})

const sleepSchema = z.object({
  date: z.string().optional(),
  totalDurationMins: z.number().min(0).max(1440).optional(),
  remMins: z.number().min(0).max(1440).optional(),
  deepMins: z.number().min(0).max(1440).optional(),
  coreMins: z.number().min(0).max(1440).optional(),
  awakeMins: z.number().min(0).max(1440).optional(),
})

const hrZonesSchema = z.array(z.number().min(0)).length(5)

const activitySchema = z.object({
  activeCalories: z.number().min(0).optional(),
  workoutType: z.string().optional(),
  durationMins: z.number().min(0).optional(),
  hrZones: hrZonesSchema.optional(),
  maxHR: z.number().min(40).max(250).optional(),
  avgHR: z.number().min(30).max(250).optional(),
})

const mealSchema = z.object({
  imageBase64: z.string().optional(),
  proteinGrams: z.number().min(0).optional(),
  carbsGrams: z.number().min(0).optional(),
  fatGrams: z.number().min(0).optional(),
  totalCalories: z.number().min(0).optional(),
  mealDescription: z.string().optional(),
})

export const ingestPayloadSchema = z.object({
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'timestamp must be a valid ISO-8601 string',
  }),
  vitals: vitalsSchema.optional(),
  sleep: sleepSchema.optional(),
  activity: activitySchema.optional(),
  meal: mealSchema.optional(),
})

export const coachMessageSchema = z.object({
  message: z.string().min(1),
  imageBase64: z.string().optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      imageBase64: z.string().optional(),
      timestamp: z.string(),
    })
  ).optional(),
})

export const visionPayloadSchema = z.object({
  imageBase64: z.string().min(1),
})

export type IngestPayloadValidated = z.infer<typeof ingestPayloadSchema>
export type CoachMessageValidated = z.infer<typeof coachMessageSchema>
