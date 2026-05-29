import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.GEMINI_API_KEY

if (!API_KEY) {
  console.warn('GEMINI_API_KEY not set. AI features will not work.')
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

export const flashModel = genAI?.getGenerativeModel({ model: 'gemini-1.5-flash' }) ?? null

export const embeddingModel = genAI?.getGenerativeModel({ model: 'text-embedding-004' }) ?? null

export function getFlashModel() {
  if (!flashModel) throw new Error('Gemini API key not configured')
  return flashModel
}

export function getEmbeddingModel() {
  if (!embeddingModel) throw new Error('Gemini API key not configured')
  return embeddingModel
}

export function hasGeminiKey(): boolean {
  return !!API_KEY && API_KEY !== 'your-api-key-here'
}
