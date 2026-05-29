interface MetricValueProps {
  value: string
  label: string
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  size?: 'sm' | 'md' | 'lg'
}

export function MetricValue({ value, label, unit, trend, size = 'md' }: MetricValueProps) {
  const valueSizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  }

  return (
    <div className="text-center">
      <div className={`${valueSizes[size]} font-semibold tracking-tight text-apple-white flex items-baseline justify-center gap-1`}>
        {value}
        {unit && <span className="text-sm text-apple-gray font-normal">{unit}</span>}
        {trend && (
          <span className={`text-sm ${trend === 'up' ? 'text-apple-green' : trend === 'down' ? 'text-apple-red' : 'text-apple-gray'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      <p className="text-apple-gray text-xs mt-1 uppercase tracking-widest">{label}</p>
    </div>
  )
}
