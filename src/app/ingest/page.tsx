'use client'

import { useState } from 'react'
import { Navigation } from '@/components/ui/navigation'
import { JsonPaste } from '@/components/ingest/json-paste'
import { DocUploader } from '@/components/upload/doc-uploader'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'

export default function IngestPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null)
  const [activeTab, setActiveTab] = useState<'ingest' | 'upload'>('ingest')

  const handleIngest = async (json: string) => {
    setIsLoading(true)
    try {
      const payload = JSON.parse(json)
      const res = await fetch('/api/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setLastResult(data)
    } catch (e) {
      setLastResult({ error: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Upload failed')
    }
    return res.json()
  }

  return (
    <div className="min-h-screen bg-apple-black">
      <Navigation />

      <div className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-8 space-y-6">
        <header className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight text-apple-white">Data Ingest</h1>
          <p className="text-apple-gray text-sm">Import your Apple Health data and reference literature</p>
        </header>

        <div className="flex gap-2">
          <GlassButton
            variant={activeTab === 'ingest' ? 'accent' : 'default'}
            size="sm"
            onClick={() => setActiveTab('ingest')}
          >
            Health Data
          </GlassButton>
          <GlassButton
            variant={activeTab === 'upload' ? 'accent' : 'default'}
            size="sm"
            onClick={() => setActiveTab('upload')}
          >
            Knowledge Base
          </GlassButton>
        </div>

        {activeTab === 'ingest' ? (
          <JsonPaste
            onSubmit={handleIngest}
            isLoading={isLoading}
            lastResult={lastResult}
          />
        ) : (
          <DocUploader onUpload={handleUpload} />
        )}

        <GlassCard className="p-4">
          <p className="text-xs text-apple-gray leading-relaxed">
            <strong className="text-apple-white">iOS Shortcut Setup:</strong> Use the Shortcuts app to create an automation that exports your Apple Health data as JSON and sends it to this endpoint. Configure the webhook URL as <code className="text-apple-blue bg-white/5 px-1 rounded">/api/v1/ingest</code>.
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
