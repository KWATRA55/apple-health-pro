import { getEmbeddingModel, hasGeminiKey } from '@/lib/gemini/client'

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!hasGeminiKey()) {
    return new Array(768).fill(0).map(() => Math.random() * 0.01)
  }

  const model = getEmbeddingModel()
  const result = await model.embedContent(text)
  return result.embedding.values
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []
  for (const text of texts) {
    const embedding = await generateEmbedding(text)
    embeddings.push(embedding)
  }
  return embeddings
}

export function float32ToBuffer(embedding: number[]): Buffer {
  const buffer = Buffer.alloc(embedding.length * 4)
  for (let i = 0; i < embedding.length; i++) {
    buffer.writeFloatLE(embedding[i], i * 4)
  }
  return buffer
}

export function bufferToFloat32(buffer: Buffer): number[] {
  const embedding: number[] = []
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(buffer.readFloatLE(i))
  }
  return embedding
}
