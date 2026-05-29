'use client'

import { useState } from 'react'
import { Navigation } from '@/components/ui/navigation'
import { TimelineChart } from '@/components/tilt/timeline-chart'
import { MetricSelector, getMetricConfig } from '@/components/tilt/metric-selector'
import { TiltControls } from '@/components/tilt/tilt-controls'
import { GlassCard } from '@/components/ui/glass-card'
import { useTimeline } from '@/hooks/use-timeline'

export default function TiltPage() {
  const [metric, setMetric] = useState('recovery')
  const [timeRange, setTimeRange] = useState(30)
  const { getMetricData, isLoading } = useTimeline(timeRange)

  const metricConfig = getMetricConfig(metric)
  const chartData = getMetricData(metric)

  return (
    <div className="min-h-screen bg-apple-black">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 pt-8 pb-24 md:pb-8 space-y-6">
        <header className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-apple-white">Trends</h1>
              <p className="text-apple-gray text-sm">Full-screen macro analysis</p>
            </div>
            <TiltControls timeRange={timeRange} onTimeRangeChange={setTimeRange} />
          </div>
        </header>

        <MetricSelector selected={metric} onSelect={setMetric} />

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metricConfig.color }} />
            <span className="text-sm text-apple-white font-medium">{metricConfig.label}</span>
            {metricConfig.unit && <span className="text-xs text-apple-gray">({metricConfig.unit})</span>}
          </div>
          <div className="h-[400px] md:h-[500px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-pulse w-8 h-8 rounded-full bg-white/10" />
              </div>
            ) : (
              <TimelineChart
                data={chartData}
                metric={metric}
                color={metricConfig.color}
                timeRange={timeRange}
              />
            )}
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chartData.length > 0 && (
            <>
              <MetricSummary label="Latest" value={chartData[chartData.length - 1]?.value?.toFixed(1) ?? '--'} />
              <MetricSummary label="Avg" value={(chartData.reduce((s, d) => s + d.value, 0) / chartData.length).toFixed(1)} />
              <MetricSummary label="Min" value={Math.min(...chartData.map(d => d.value)).toFixed(1)} />
              <MetricSummary label="Max" value={Math.max(...chartData.map(d => d.value)).toFixed(1)} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricSummary({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-3 text-center">
      <p className="text-[10px] text-apple-gray uppercase tracking-widest">{label}</p>
      <p className="text-lg font-semibold text-apple-white">{value}</p>
    </GlassCard>
  )
}
