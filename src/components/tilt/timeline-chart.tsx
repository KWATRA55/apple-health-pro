'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface TimelineChartProps {
  data: { date: string; value: number }[]
  metric: string
  color: string
  timeRange: number
}

export function TimelineChart({ data, metric, color, timeRange }: TimelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-apple-gray text-sm">
        No data available for this time range
      </div>
    )
  }

  const fmtDate = (d: string) => {
    const parts = d.split('-')
    return `${parts[1]}/${parts[2]}`
  }

  const chartData = data.map(d => ({
    date: fmtDate(d.date),
    value: d.value,
    fullDate: d.date,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#86868b', fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#86868b', fontSize: 11 }}
          width={40}
          domain={['dataMin - 5', 'dataMax + 5']}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(0,0,0,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            backdropFilter: 'blur(20px)',
            color: '#f5f5f7',
            fontSize: '13px',
          }}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${metric})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: 'black', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
