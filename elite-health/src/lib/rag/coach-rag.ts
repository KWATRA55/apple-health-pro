import { safeNumber } from '../utils/display-helpers'
import { generateEmbedding } from './embeddings'
import { searchSimilar, addDocument, getDocumentCount } from './vector-store'
import { chunkText } from './chunker'
import { CURATED_KNOWLEDGE, KnowledgeDoc } from './knowledge-base'

let indexingPromise: Promise<void> | null = null
let indexed = false

export async function ensureKnowledgeBaseIndexed(): Promise<void> {
    if (indexed) return
    if (indexingPromise) {
        await indexingPromise
        return
    }

    indexingPromise = indexKnowledgeBase()
    try {
        await indexingPromise
        indexed = true
    } finally {
        indexingPromise = null
    }
}

async function indexKnowledgeBase(): Promise<void> {
    const start = Date.now()
    try {
        const count = await getDocumentCount()
        if (count > 0) {
            indexed = true
            console.log(`[RAG] Knowledge base already indexed (${count} documents). Checked in ${Date.now() - start}ms`)
            return
        }
    } catch {
        // DB may not be initialized yet, proceed with indexing
    }

    for (const doc of CURATED_KNOWLEDGE) {
        const chunks = chunkText(doc.content)
        for (const chunk of chunks) {
            try {
                const embedding = await generateEmbedding(chunk.content)
                const id = `${doc.source}_${chunk.index}`
                await addDocument(id, chunk.content, embedding, doc.source, chunk.index, doc.title)
            } catch (err) {
                console.warn(`[RAG] Failed to index chunk ${chunk.index} of "${doc.title}":`, err)
            }
        }
    }

    const finalCount = await getDocumentCount()
    console.log(`[RAG] Knowledge base indexed: ${finalCount} documents in ${Date.now() - start}ms`)
}

export async function retrieveHealthKnowledge(
    query: string,
    k: number = 3
): Promise<string> {
    try {
        const queryEmbedding = await generateEmbedding(query)
        const results = await searchSimilar(queryEmbedding, k)

        if (results.length === 0) return ''

        return results
            .map(
                (r, i) =>
                    `[KNOWLEDGE: ${r.title || r.source}] (Relevance: ${safeNumber(r.distance * 100, 0)}%)\n${r.content}`
            )
            .join('\n\n---\n\n')
    } catch (err) {
        console.warn('[RAG] Retrieval failed:', err)
        return ''
    }
}

export async function buildRAGContext(query: string): Promise<string> {
    const healthKnowledge = await retrieveHealthKnowledge(query)

    if (!healthKnowledge) return ''

    return `
─── BEGIN RETRIEVED KNOWLEDGE ───
${healthKnowledge}
─── END RETRIEVED KNOWLEDGE ───

Use the retrieved knowledge above to inform your response. Cite specific facts and metrics from the knowledge base when relevant. If the retrieved knowledge doesn't help with the user's query, rely on your own expertise.
`.trim()
}
