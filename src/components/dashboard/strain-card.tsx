'use client'

import { GlassCard } from '@/components/ui/glass-card'
import { interpretStrain } from '@/lib/algorithms/strain'

interface StrainCardProps {
  strainScore: number | null
  activities?: { workoutType: string; strainScore: number | null }[]
}

export function StrainCard({ strainScore, activities }: StrainCardProps) {
  const strain = strainScore ?? 0
  const interpretation = interpretStrain(strain)

  const displayStrain = strain.toFixed(1)
  const maxStrain = 21

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-apple-gray text-xs uppercase tracking-widest">Strain</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/50">
          Day Strain
        </span>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className="text-4xl font-semibold tracking-tight text-apple-white">
          {displayStrain}
        </span>
        <span className="text-sm text-apple-gray mb-1">/ {maxStrain}</span>
      </div>

      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, (strain / maxStrain) * 100)}%`,
            backgroundColor: interpretation.color,
          }}
        />
      </div>

      <p style={{ color: interpretation.color }} className="text-xs font-medium">
        {interpretation.level} — {interpretation.description}
      </p>

      {activities && activities.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex gap-2 flex-wrap">
            {activities.slice(0, 3).map((a, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-apple-gray">
                {a.workoutType}
              </span>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  )
}
