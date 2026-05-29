'use client'

const METRICS = [
  { key: 'recovery', label: 'Recovery', color: '#34c759', unit: '%' },
  { key: 'strain', label: 'Strain', color: '#ff9f0a', unit: '' },
  { key: 'sleepDebt', label: 'Sleep Debt', color: '#5ac8fa', unit: 'h' },
  { key: 'hrvZ', label: 'HRV Z-Score', color: '#007aff', unit: '' },
  { key: 'rhrZ', label: 'RHR Z-Score', color: '#ff3b30', unit: '' },
]

interface MetricSelectorProps {
  selected: string
  onSelect: (key: string) => void
}

export function MetricSelector({ selected, onSelect }: MetricSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
      {METRICS.map((m) => (
        <button
          key={m.key}
          onClick={() => onSelect(m.key)}
          className={`
            px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap
            transition-all duration-200 border
            ${selected === m.key
              ? 'text-white border-white/20'
              : 'text-apple-gray border-transparent hover:text-white/70 hover:border-white/10'
            }
          `}
          style={{
            backgroundColor: selected === m.key ? `${m.color}20` : 'transparent',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

export function getMetricConfig(key: string) {
  return METRICS.find(m => m.key === key) ?? METRICS[0]
}
