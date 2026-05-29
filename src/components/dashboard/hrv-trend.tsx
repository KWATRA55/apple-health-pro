'use client'

import { GlassCard } from '@/components/ui/glass-card'

interface HRVTrendProps {
  vitals: { timestamp: string; hrv: number }[]
}

export function HRVTrend({ vitals }: HRVTrendProps) {
  const hrvValues = vitals
    .filter(v => v.hrv > 0)
    .slice(0, 7)
    .reverse()
    .map(v => v.hrv)

  const min = Math.min(...hrvValues, 1)
  const max = Math.max(...hrvValues, 100)
  const range = max - min || 1

  const normalized = hrvValues.map(v => (v - min) / range)
  const points = normalized.map((v, i) => `${(i / (normalized.length - 1 || 1)) * 100},${100 - v * 60}`).join(' ')

  const latestHRV = hrvValues[hrvValues.length - 1]
  const firstHRV = hrvValues[0]
  const trend: 'up' | 'down' | 'stable' = latestHRV > firstHRV * 1.05 ? 'up' : latestHRV < firstHRV * 0.95 ? 'down' : 'stable'

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-apple-gray text-xs uppercase tracking-widest">HRV</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
          trend === 'up' ? 'border-apple-green/20 text-apple-green' :
          trend === 'down' ? 'border-apple-red/20 text-apple-red' :
          'border-white/10 text-apple-gray'
        }`}>
          {trend === 'up' ? '↑ Rising' : trend === 'down' ? '↓ Falling' : '→ Steady'}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-semibold tracking-tight text-apple-white">
          {latestHRV?.toFixed(0) ?? '--'}
        </span>
        <span className="text-sm text-apple-gray">ms</span>
      </div>

      {hrvValues.length > 1 ? (
        <svg viewBox="0 0 100 60" className="w-full h-16">
          <defs>
            <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34c759" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#34c759" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,60 ${points} 100,60`}
            fill="url(#hrvGrad)"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#34c759"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <div className="h-16 flex items-center justify-center text-apple-gray text-xs">
          Need more data
        </div>
      )}
    </GlassCard>
  )
}
