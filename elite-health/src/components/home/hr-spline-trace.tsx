import React, { useMemo } from 'react'
import { View, Text, Dimensions } from 'react-native'
import Svg, { Path, Rect, Line, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg'
import { GlassCard } from '../ui/glass-card'
import type { HeartRateSample, SleepRecord, ActivityRecord } from '../../lib/types'

interface HRSplineTraceProps {
  samples: HeartRateSample[]
  sleep?: SleepRecord | null
  activities?: ActivityRecord[]
}

const CARD_PADDING = 16
const CHART_HEIGHT = 180
const LABEL_WIDTH = 32
const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p', '12a']

export function HRSplineTrace({ samples, sleep, activities }: HRSplineTraceProps) {
  const width = Dimensions.get('window').width - CARD_PADDING * 4 - LABEL_WIDTH

  const { pathData, sleepBlocks, activityBlocks, minHR, maxHR, yAxisLabels } = useMemo(() => {
    if (samples.length < 2) {
      return { pathData: '', sleepBlocks: [], activityBlocks: [], minHR: 40, maxHR: 120, yAxisLabels: [] }
    }

    const values = samples.map(s => s.bpm)
    const min = Math.floor(Math.min(...values) / 10) * 10 - 10
    const max = Math.ceil(Math.max(...values) / 10) * 10 + 10
    const clampedMin = Math.max(30, min)
    const clampedMax = Math.min(220, max)

    // Generate smooth cubic bezier path
    const points = samples.map((s, i) => {
      const hour = parseFloat(s.timestamp.split('T')[1].split(':')[0])
      const minute = parseFloat(s.timestamp.split('T')[1].split(':')[1])
      const timeFraction = (hour * 60 + minute) / 1440
      const x = LABEL_WIDTH + timeFraction * width
      const y = CHART_HEIGHT - ((s.bpm - clampedMin) / (clampedMax - clampedMin)) * CHART_HEIGHT
      return { x, y }
    })

    // Catmull-Rom to cubic bezier
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(points.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }

    // Sleep blocks
    const sleepBlocks: { x: number; w: number; color: string; opacity: number }[] = []
    if (sleep && sleep.totalDurationMins > 0) {
      // Assume sleep from ~10PM to wake time based on duration
      const sleepEndHour = 6.5 // 6:30 AM wake
      const sleepHours = sleep.totalDurationMins / 60
      const sleepStartHour = sleepEndHour - sleepHours
      if (sleepStartHour < 0) {
        // Sleep spans midnight
        const startX1 = LABEL_WIDTH + ((sleepStartHour + 24) / 24) * width
        sleepBlocks.push({ x: startX1, w: width - (startX1 - LABEL_WIDTH), color: '#7B61FF', opacity: 0.12 })
        sleepBlocks.push({ x: LABEL_WIDTH, w: (sleepEndHour / 24) * width, color: '#7B61FF', opacity: 0.12 })
      } else {
        const startX = LABEL_WIDTH + (sleepStartHour / 24) * width
        sleepBlocks.push({ x: startX, w: (sleepHours / 24) * width, color: '#7B61FF', opacity: 0.12 })
      }
    } else {
      // [CANONICAL-TODO] Remove fabricated sleep block; use selectSleepForDate
      // This silently assumes 10PM–6AM default when no sleep data exists.
      // Replace with: selectSleepForDate(state, date) → show honest empty state
      // instead of fabricating a sleep window for the chart background.
      // Default sleep block: 10PM - 6AM
      const startX = LABEL_WIDTH + (22 / 24) * width
      sleepBlocks.push({ x: startX, w: width - (startX - LABEL_WIDTH) - (6 / 24) * width + width * (6 / 24), color: '#7B61FF', opacity: 0.08 })
      // Fix: simplified
      sleepBlocks.length = 1
      sleepBlocks[0] = {
        x: LABEL_WIDTH + (22 / 24) * width,
        w: width * (8 / 24),
        color: '#7B61FF',
        opacity: 0.08,
      }
    }

    // Activity blocks
    const activityBlocks: { x: number; w: number; color: string; opacity: number }[] = []
    if (activities) {
      for (const act of activities) {
        if (!act.timestamp) continue
        const hour = parseFloat(act.timestamp.split('T')[1].split(':')[0])
        const durationHours = act.durationMins / 60
        const ax = LABEL_WIDTH + (hour / 24) * width
        activityBlocks.push({ x: ax, w: Math.max(4, (durationHours / 24) * width), color: '#FF3366', opacity: 0.15 })
      }
    }

    // Y-axis labels (3 ticks)
    const yTicks = [clampedMin, Math.round((clampedMin + clampedMax) / 2), clampedMax]
    const yAxisLabels = yTicks.map(t => ({
      label: `${t}`,
      y: CHART_HEIGHT - ((t - clampedMin) / (clampedMax - clampedMin)) * CHART_HEIGHT,
    }))

    return { pathData: d, sleepBlocks, activityBlocks, minHR: clampedMin, maxHR: clampedMax, yAxisLabels }
  }, [samples, sleep, activities, width])

  return (
    <GlassCard className="mt-4 overflow-hidden">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-steel text-micro uppercase tracking-[0.10em] font-bold">24-HR HEART RATE</Text>
        <Text className="text-accent-crimson text-micro font-bold">{minHR}–{maxHR} BPM</Text>
      </View>

      <Svg width={width + LABEL_WIDTH} height={CHART_HEIGHT + 20}>
        <Defs>
          <LinearGradient id="hrGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#00E5FF" stopOpacity="0.3" />
            <Stop offset="50%" stopColor="#FF3366" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFB800" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yAxisLabels.map((t, i) => (
          <React.Fragment key={i}>
            <Line
              x1={LABEL_WIDTH}
              y1={t.y}
              x2={LABEL_WIDTH + width}
              y2={t.y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
            <SvgText
              x={LABEL_WIDTH - 4}
              y={t.y + 4}
              fill="#636870"
              fontSize={9}
              fontWeight="600"
              textAnchor="end"
            >
              {t.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Sleep windows */}
        {sleepBlocks.map((b, i) => (
          <Rect
            key={`sleep-${i}`}
            x={b.x}
            y={0}
            width={b.w}
            height={CHART_HEIGHT}
            fill={b.color}
            opacity={b.opacity}
          />
        ))}

        {/* Activity windows */}
        {activityBlocks.map((b, i) => (
          <Rect
            key={`act-${i}`}
            x={b.x}
            y={0}
            width={b.w}
            height={CHART_HEIGHT}
            fill={b.color}
            opacity={b.opacity}
          />
        ))}

        {/* Spline path */}
        {pathData.length > 0 && (
          <Path
            d={pathData}
            stroke="url(#hrGradient)"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Hour labels */}
        {HOUR_LABELS.map((label, i) => {
          const x = LABEL_WIDTH + (i / 8) * width
          return (
            <SvgText
              key={i}
              x={x}
              y={CHART_HEIGHT + 16}
              fill="#636870"
              fontSize={9}
              fontWeight="600"
              textAnchor={i === 0 ? 'start' : i === 8 ? 'end' : 'middle'}
            >
              {label}
            </SvgText>
          )
        })}
      </Svg>

      {/* Legend */}
      <View className="flex-row justify-center gap-4 mt-2">
        {sleepBlocks.length > 0 && (
          <View className="flex-row items-center gap-1">
            <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#7B61FF', opacity: 0.3 }} />
            <Text className="text-steel text-[9px] font-bold">Sleep</Text>
          </View>
        )}
        {activityBlocks.length > 0 && (
          <View className="flex-row items-center gap-1">
            <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#FF3366', opacity: 0.3 }} />
            <Text className="text-steel text-[9px] font-bold">Activity</Text>
          </View>
        )}
      </View>
    </GlassCard>
  )
}
