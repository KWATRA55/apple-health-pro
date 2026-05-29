'use client'

import { GlassCard } from '@/components/ui/glass-card'

interface DailySummaryProps {
  vitals?: { rhr: number; spo2: number; respiratoryRate: number } | null
  activity?: { activeCalories: number; workoutType: string } | null
  meals?: { totalCalories: number; proteinGrams: number }[]
}

export function DailySummary({ vitals, activity, meals }: DailySummaryProps) {
  const totalCals = meals?.reduce((sum, m) => sum + m.totalCalories, 0) ?? 0
  const totalProtein = meals?.reduce((sum, m) => sum + m.proteinGrams, 0) ?? 0
  const activeCals = activity?.activeCalories ?? 0

  return (
    <GlassCard className="p-5">
      <p className="text-apple-gray text-xs uppercase tracking-widest mb-4">Today</p>

      <div className="grid grid-cols-2 gap-3">
        <MetricItem label="Rest HR" value={vitals?.rhr ? `${vitals.rhr}` : '--'} unit="bpm" />
        <MetricItem label="SpO₂" value={vitals?.spo2 ? `${vitals.spo2}%` : '--'} />
        <MetricItem label="Active Cals" value={activeCals > 0 ? `${activeCals}` : '--'} unit="kcal" />
        <MetricItem label="Cal In" value={totalCals > 0 ? `${totalCals}` : '--'} unit="kcal" />
        <MetricItem label="Protein" value={totalProtein > 0 ? `${totalProtein}` : '--'} unit="g" />
        <MetricItem label="Resp Rate" value={vitals?.respiratoryRate ? `${vitals.respiratoryRate}` : '--'} unit="/min" />
      </div>

      {activity?.workoutType && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <span className="text-xs text-apple-white font-medium">{activity.workoutType}</span>
        </div>
      )}
    </GlassCard>
  )
}

function MetricItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-apple-gray uppercase tracking-wider">{label}</span>
      <span className="text-sm text-apple-white font-medium">
        {value}{unit ? <span className="text-[10px] text-apple-gray ml-0.5">{unit}</span> : null}
      </span>
    </div>
  )
}
