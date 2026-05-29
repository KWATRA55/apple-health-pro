import { getDB } from '@/lib/db'
import { float32ToBuffer, bufferToFloat32 } from './embeddings'

interface VectorDocRow {
  id: string
  content: string
  embedding: Buffer
  source: string
  chunk_index: number
  title: string
}

export async function addDocument(
  id: string,
  content: string,
  embedding: number[],
  source: string,
  chunkIndex: number,
  title: string
): Promise<void> {
  const db = getDB()
  const buffer = float32ToBuffer(embedding)

  db.prepare(`
    INSERT OR REPLACE INTO vector_documents (id, content, embedding, source, chunk_index, title)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, content, buffer, source, chunkIndex, title)
}

export async function searchSimilar(
  queryEmbedding: number[],
  k: number = 5
): Promise<{ content: string; source: string; chunkIndex: number; title: string; distance: number }[]> {
  const db = getDB()
  const rows = db.prepare(`
    SELECT id, content, embedding, source, chunk_index, title FROM vector_documents
  `).all() as VectorDocRow[]

  if (rows.length === 0) return []

  const results = rows.map(row => {
    const emb = bufferToFloat32(row.embedding)
    const distance = cosineSimilarity(queryEmbedding, emb)
    return {
      content: row.content,
      source: row.source,
      chunkIndex: row.chunk_index,
      title: row.title,
      distance,
    }
  })

  results.sort((a, b) => b.distance - a.distance)
  return results.slice(0, k)
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0
  return dotProduct / denominator
}

export async function deleteAllDocuments(): Promise<void> {
  const db = getDB()
  db.prepare('DELETE FROM vector_documents').run()
}

export async function getDocumentCount(): Promise<number> {
  const db = getDB()
  const row = db.prepare('SELECT COUNT(*) as count FROM vector_documents').get() as { count: number }
  return row.count
}

export async function getDocumentTitles(): Promise<string[]> {
  const db = getDB()
  const rows = db.prepare('SELECT DISTINCT title FROM vector_documents').all() as { title: string }[]
  return rows.map(r => r.title)
}
