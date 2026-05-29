import React from 'react'
import { View, Text, Dimensions } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'

interface MetricSplineProps {
  data: number[]
  labels: string[]
  height?: number
  accentColor?: string
  gradientColor?: string
}

export function MetricSpline({
  data,
  labels,
  height = 140,
  accentColor = '#00E5FF',
  gradientColor = '#00E5FF',
}: MetricSplineProps) {
  const screenWidth = Dimensions.get('window').width
  const width = screenWidth - 72 // Adjusted for card padding and horizontal margins

  if (!data || data.length < 2) {
    return (
      <View style={{ height }} className="items-center justify-center bg-obsidian-900/40 rounded-xl">
        <Text className="text-gray-500 font-mono text-xs">Insufficient history for trend spline</Text>
      </View>
    )
  }

  const maxVal = Math.max(...data)
  const minVal = Math.min(...data)
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width
    const y = height - ((val - minVal) / range) * (height - 30) - 15
    return { x, y }
  })

  // Build cubic bezier path string
  let pathD = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const cpX1 = p0.x + (p1.x - p0.x) / 3
    const cpY1 = p0.y
    const cpX2 = p0.x + (2 * (p1.x - p0.x)) / 3
    const cpY2 = p1.y
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`
  }

  // Build fill path string
  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return (
    <View className="my-2 items-center">
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="splineGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={gradientColor} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={gradientColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>
          
          {/* Closed shape fill */}
          <Path d={fillD} fill="url(#splineGrad)" />

          {/* Stroke path */}
          <Path
            d={pathD}
            fill="none"
            stroke={accentColor}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View className="flex-row justify-between w-full mt-2 px-1">
        {labels.map((lbl, idx) => (
          <Text key={idx} className="text-gray-500 text-[9px] font-mono">
            {lbl}
          </Text>
        ))}
      </View>
    </View>
  )
}
