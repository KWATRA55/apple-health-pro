'use client'

import { useState } from 'react'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassCard } from '@/components/ui/glass-card'

const SAMPLE_PAYLOAD = JSON.stringify({
  timestamp: new Date().toISOString(),
  vitals: {
    hrv: 72,
    rhr: 54,
    spo2: 98,
    respiratoryRate: 14.2,
    skinTempDelta: -0.2,
  },
  sleep: {
    totalDurationMins: 460,
    remMins: 90,
    deepMins: 75,
    coreMins: 295,
    awakeMins: 10,
  },
  activity: {
    activeCalories: 650,
    workoutType: 'Snowboarding',
    durationMins: 120,
    hrZones: [10, 30, 40, 35, 5],
  },
}, null, 2)

interface JsonPasteProps {
  onSubmit: (payload: string) => Promise<void>
  isLoading: boolean
  lastResult: Record<string, unknown> | null
}

export function JsonPaste({ onSubmit, isLoading, lastResult }: JsonPasteProps) {
  const [json, setJson] = useState(SAMPLE_PAYLOAD)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    try {
      JSON.parse(json)
    } catch {
      setError('Invalid JSON format')
      return
    }
    await onSubmit(json)
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          className="
            w-full h-64 bg-transparent text-apple-white text-sm font-mono
            focus:outline-none resize-y
            placeholder:text-white/20
          "
          spellCheck={false}
        />
        {error && <p className="text-apple-red text-xs mt-1">{error}</p>}
      </GlassCard>

      <GlassButton
        onClick={handleSubmit}
        disabled={isLoading}
        variant="accent"
        size="md"
        className="w-full"
      >
        {isLoading ? 'Ingesting...' : 'Send Health Data'}
      </GlassButton>

      {lastResult && (
        <GlassCard className="p-4" glow>
          <p className="text-xs text-apple-gray uppercase tracking-widest mb-2">Result</p>
          <pre className="text-xs text-apple-white/80 font-mono overflow-x-auto">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </GlassCard>
      )}
    </div>
  )
}
