'use client'

import { useState, useCallback } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'

interface DocUploaderProps {
  onUpload: (file: File) => Promise<{ chunks_ingested: number; total_chunks: number }>
}

export function DocUploader({ onUpload }: DocUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{ chunks_ingested: number; total_chunks: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'epub', 'txt'].includes(ext || '')) {
      setError('Supported formats: PDF, EPUB, TXT')
      return
    }
    setError(null)
    setIsUploading(true)
    try {
      const res = await onUpload(file)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <GlassCard className="p-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${isDragging
            ? 'border-apple-blue bg-apple-blue/5'
            : 'border-white/10 hover:border-white/20'
          }
        `}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="1.5" className="mx-auto mb-3">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-apple-white text-sm font-medium mb-1">
          Drop sports science literature here
        </p>
        <p className="text-apple-gray text-xs">PDF, EPUB, or TXT files</p>

        <label className="mt-4 inline-block">
          <GlassButton variant="default" size="sm" onClick={() => {}}>
            {isUploading ? 'Processing...' : 'Choose File'}
          </GlassButton>
          <input
            type="file"
            accept=".pdf,.epub,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </label>
      </div>

      {error && <p className="text-apple-red text-xs mt-3">{error}</p>}

      {result && (
        <div className="mt-4 p-4 rounded-xl bg-apple-green/10 border border-apple-green/20">
          <p className="text-apple-green text-sm font-medium">
            {result.chunks_ingested} chunks ingested
          </p>
          <p className="text-apple-gray text-xs mt-1">
            Total knowledge base: {result.total_chunks} chunks
          </p>
        </div>
      )}
    </GlassCard>
  )
}
