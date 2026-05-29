'use client'

const TIME_RANGES = [
  { key: 7, label: '7D' },
  { key: 14, label: '14D' },
  { key: 30, label: '30D' },
  { key: 90, label: '90D' },
  { key: 365, label: '1Y' },
]

interface TiltControlsProps {
  timeRange: number
  onTimeRangeChange: (days: number) => void
}

export function TiltControls({ timeRange, onTimeRangeChange }: TiltControlsProps) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onTimeRangeChange(r.key)}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200
            ${timeRange === r.key
              ? 'bg-white/15 text-white'
              : 'text-apple-gray hover:text-white/70'
            }
          `}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
