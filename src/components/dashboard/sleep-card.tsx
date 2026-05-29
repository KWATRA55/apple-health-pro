'use client'

import { GlassCard } from '@/components/ui/glass-card'
import { formatHoursToHM } from '@/lib/utils/date'
import type { SleepDebtResult } from '@/lib/types'

interface SleepCardProps {
  sleepDebt: SleepDebtResult | null
  lastSleep?: { totalDurationMins: number; remMins: number; deepMins: number; coreMins: number } | null
}

export function SleepCard({ sleepDebt, lastSleep }: SleepCardProps) {
  const debt = sleepDebt?.sleepDebtHours ?? 0
  const need = sleepDebt?.sleepNeedHours ?? 8
  const isDebtHigh = debt > 2
  const isDebtModerate = debt > 0.5

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-apple-gray text-xs uppercase tracking-widest">Sleep</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
          isDebtHigh
            ? 'border-apple-red/20 text-apple-red'
            : isDebtModerate
            ? 'border-apple-amber/20 text-apple-amber'
            : 'border-apple-green/20 text-apple-green'
        }`}>
          {isDebtHigh ? 'High Debt' : isDebtModerate ? 'Moderate Debt' : 'On Track'}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-4xl font-semibold tracking-tight ${isDebtHigh ? 'text-apple-red' : 'text-apple-white'}`}>
          {formatHoursToHM(debt)}
        </span>
        <span className="text-sm text-apple-gray">debt</span>
      </div>

      <div className="space-y-1.5 text-xs text-apple-gray">
        <div className="flex justify-between">
          <span>Tonight's Need</span>
          <span className="text-apple-white font-medium">{need}h</span>
        </div>
        <div className="flex justify-between">
          <span>Baseline Need</span>
          <span>{sleepDebt?.baselineHours ?? 8}h</span>
        </div>
        {lastSleep && (
          <div className="flex justify-between">
            <span>Last Night</span>
            <span className="text-apple-white font-medium">
              {formatHoursToHM(lastSleep.totalDurationMins / 60)}
            </span>
          </div>
        )}
      </div>

      {lastSleep && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
            <div className="bg-apple-blue/60" style={{ width: `${(lastSleep.remMins / lastSleep.totalDurationMins) * 100}%` }} title="REM" />
            <div className="bg-purple-500/60" style={{ width: `${(lastSleep.deepMins / lastSleep.totalDurationMins) * 100}%` }} title="Deep" />
            <div className="bg-white/20" style={{ width: `${(lastSleep.coreMins / lastSleep.totalDurationMins) * 100}%` }} title="Core" />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-apple-gray">
            <span>REM</span>
            <span>Deep</span>
            <span>Core</span>
          </div>
        </div>
      )}
    </GlassCard>
  )
}
