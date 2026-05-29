import { generateEmbedding } from './embeddings'
import { searchSimilar } from './vector-store'

export async function retrieveContext(
  query: string,
  k: number = 5
): Promise<{ chunks: string[]; formattedContext: string }> {
  const queryEmbedding = await generateEmbedding(query)
  const results = await searchSimilar(queryEmbedding, k)

  const chunks = results.map(r => r.content)
  const formattedContext = results
    .map((r, i) => `[Source: ${r.title || r.source}, Chunk ${r.chunkIndex}] (Relevance: ${(r.distance * 100).toFixed(1)}%)\n${r.content}`)
    .join('\n\n---\n\n')

  return { chunks, formattedContext }
}

export async function retrieveRelevantChunks(
  query: string,
  k: number = 3
): Promise<string[]> {
  const { chunks } = await retrieveContext(query, k)
  return chunks
}
