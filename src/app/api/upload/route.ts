import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { extractTextFromFile, chunkText } from '@/lib/rag/chunker'
import { generateBatchEmbeddings } from '@/lib/rag/embeddings'
import { addDocument, getDocumentCount } from '@/lib/rag/vector-store'
import { hasGeminiKey } from '@/lib/gemini/client'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const filename = file.name
    const buffer = Buffer.from(await file.arrayBuffer())

    const documentsDir = path.join(process.cwd(), 'data', 'documents')
    const filePath = path.join(documentsDir, filename)
    await writeFile(filePath, buffer)

    const text = await extractTextFromFile(buffer, filename)
    if (!text) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 })
    }

    const chunks = chunkText(text)

    let chunkCount = 0

    if (hasGeminiKey()) {
      const chunkTexts = chunks.map(c => c.content)
      const embeddings = await generateBatchEmbeddings(chunkTexts)

      for (let i = 0; i < chunks.length; i++) {
        await addDocument(
          uuidv4(),
          chunks[i].content,
          embeddings[i],
          filename,
          chunks[i].index,
          filename.replace(/\.(pdf|epub|txt)$/i, '')
        )
        chunkCount++
      }
    } else {
      for (const chunk of chunks) {
        const dummyEmbedding = new Array(768).fill(0).map(() => Math.random() * 0.01)
        await addDocument(
          uuidv4(),
          chunk.content,
          dummyEmbedding,
          filename,
          chunk.index,
          filename.replace(/\.(pdf|epub|txt)$/i, '')
        )
        chunkCount++
      }
    }

    const totalDocs = await getDocumentCount()

    return NextResponse.json({
      success: true,
      chunks_ingested: chunkCount,
      total_chunks: totalDocs,
      filename,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
