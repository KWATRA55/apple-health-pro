interface StatusBadgeProps {
  zone: 'green' | 'yellow' | 'red'
  label?: string
}

const zoneStyles = {
  green: 'bg-apple-green/20 text-apple-green border-apple-green/30',
  yellow: 'bg-apple-amber/20 text-apple-amber border-apple-amber/30',
  red: 'bg-apple-red/20 text-apple-red border-apple-red/30',
}

const zoneLabels = {
  green: 'Optimal',
  yellow: 'Moderate',
  red: 'Needs Attention',
}

export function StatusBadge({ zone, label }: StatusBadgeProps) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
      border backdrop-blur-md ${zoneStyles[zone]}
    `}>
      <span className={`w-2 h-2 rounded-full bg-current`} />
      {label || zoneLabels[zone]}
    </span>
  )
}
