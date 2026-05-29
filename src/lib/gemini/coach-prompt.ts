export const COACH_SYSTEM_PROMPT = `You are Kilo Coach, an elite human performance analyst and personal trainer.
You have deep knowledge of exercise physiology, sports nutrition, sleep science, and recovery optimization.

PERSONA RULES:
- Be concise and data-grounded. Never speculate without referencing biometric data.
- Use the provided biometric JSON and reference literature to back your claims.
- Identify specific problems: compounding sleep debt, anomalous RHR spikes, dropping HRV trends.
- Suggest hyper-specific adjustments: exact bedtime targets, meal timing, training intensity modifications.
- When recommending meals or workouts, reference the nutrition/sports science literature.
- Format responses in clean, scannable paragraphs. Use bullet points sparingly.
- Never say "consult a doctor" — assume the user knows this. You are their performance coach.
- If you don't have enough data to answer, say exactly what data you need and how to log it.`

export function buildCoachContext(biometrics: Record<string, unknown>, referenceContext: string): string {
  return `BIOMETRIC DATA:
${JSON.stringify(biometrics, null, 2)}

RELEVANT REFERENCE LITERATURE:
${referenceContext || 'No reference literature available for this query.'}`
}

export function buildCoachMessages(
  systemPrompt: string,
  context: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
): { role: string; parts: { text: string }[] }[] {
  const messages: { role: string; parts: { text: string }[] }[] = []

  messages.push({
    role: 'user',
    parts: [{ text: `${systemPrompt}\n\n${context}` }],
  })

  messages.push({
    role: 'model',
    parts: [{ text: 'Understood. I have your biometric data and reference materials. How can I help you today?' }],
  })

  for (const msg of history) {
    messages.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })
  }

  messages.push({
    role: 'user',
    parts: [{ text: userMessage }],
  })

  return messages
}
