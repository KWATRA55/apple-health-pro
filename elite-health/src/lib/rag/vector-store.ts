import { getDB, runQuery, getAll } from '../db'
import { float32ToBase64, base64ToFloat32 } from './embeddings'

interface VectorDocRow {
    id: string
    content: string
    embedding: string
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
    const embeddingB64 = float32ToBase64(embedding)
    await runQuery(
        `INSERT OR REPLACE INTO vector_documents (id, content, embedding, source, chunk_index, title)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [id, content, embeddingB64, source, chunkIndex, title]
    )
}

export async function searchSimilar(
    queryEmbedding: number[],
    k: number = 5
): Promise<{ content: string; source: string; chunkIndex: number; title: string; distance: number }[]> {
    const rows = await getAll<VectorDocRow>(
        `SELECT id, content, embedding, source, chunk_index, title FROM vector_documents`
    )

    if (rows.length === 0) return []

    const results = rows.map(row => {
        const emb = base64ToFloat32(row.embedding)
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
    await runQuery('DELETE FROM vector_documents', [])
}

export async function getDocumentCount(): Promise<number> {
    const row = await getDB().then(db =>
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM vector_documents')
    )
    return row?.count ?? 0
}

export async function getDocumentTitles(): Promise<string[]> {
    const rows = await getDB().then(db =>
        db.getAllAsync<{ title: string }>('SELECT DISTINCT title FROM vector_documents')
    )
    return rows.map(r => r.title)
}
