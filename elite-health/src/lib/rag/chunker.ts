export interface TextChunk {
    content: string
    index: number
}

const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100

export function chunkText(
    text: string,
    chunkSize: number = CHUNK_SIZE,
    overlap: number = CHUNK_OVERLAP
): TextChunk[] {
    const words = text.split(/\s+/)
    const chunks: TextChunk[] = []

    if (words.length === 0) return chunks

    let start = 0
    let index = 0

    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length)
        const content = words.slice(start, end).join(' ')

        if (content.trim().length > 0) {
            chunks.push({ content: content.trim(), index })
            index++
        }

        if (end >= words.length) break
        start = end - overlap
    }

    return chunks
}
