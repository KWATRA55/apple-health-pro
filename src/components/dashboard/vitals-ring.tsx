'use client'

import { ColorRing } from '@/components/ui/color-ring'
import { StatusBadge } from '@/components/ui/status-badge'
import type { RecoveryResult } from '@/lib/types'

interface VitalsRingProps {
  recovery: RecoveryResult | null
  isLoading?: boolean
}

export function VitalsRing({ recovery, isLoading }: VitalsRingProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="animate-pulse">
          <div className="w-[200px] h-[200px] rounded-full bg-white/5" />
        </div>
      </div>
    )
  }

  if (!recovery) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <ColorRing percentage={0} color="#86868b" label="Recovery" value="--" />
        <p className="text-apple-gray text-sm">No data yet. Ingest your first health metrics.</p>
      </div>
    )
  }

  const ringColor =
    recovery.zone === 'green' ? '#34c759' :
    recovery.zone === 'yellow' ? '#ff9f0a' :
    '#ff3b30'

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <ColorRing
        percentage={recovery.recoveryScore}
        color={ringColor}
        label="Recovery"
        size={220}
        strokeWidth={14}
      />
      <StatusBadge zone={recovery.zone} />
      <div className="grid grid-cols-3 gap-6 mt-2">
        <div className="text-center">
          <p className="text-sm text-apple-white font-semibold">
            {recovery.hrvZScore > 0 ? '+' : ''}{recovery.hrvZScore}
          </p>
          <p className="text-[10px] text-apple-gray uppercase tracking-wider">HRV Z</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-apple-white font-semibold">
            {recovery.rhrZScore > 0 ? '+' : ''}{recovery.rhrZScore}
          </p>
          <p className="text-[10px] text-apple-gray uppercase tracking-wider">RHR Z</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-apple-white font-semibold">
            {(recovery.sleepQualityFactor * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-apple-gray uppercase tracking-wider">Sleep</p>
        </div>
      </div>
    </div>
  )
}
