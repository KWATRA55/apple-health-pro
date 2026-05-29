import React, { useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import type { VitalsRecord, DailyScores } from '../../lib/types'
import { safeNumber } from '../../lib/utils/display-helpers'

// ── STITCH Design Tokens ──────────────────────────────────────────────
const S = {
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.03)',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  primaryFixedDim: '#7ad7c6',
  accentTeal: '#14B8A6',
  success: '#7ad7c6',
  warning: '#FFD60A',
  error: '#FF453A',
}

interface HrvTrendSparkProps {
  vitals: VitalsRecord[]
  scores: DailyScores[]
  dateStr: string
}

export function HrvTrendSpark({ vitals, scores, dateStr }: HrvTrendSparkProps) {
  // Pulse animation for the latest dot
  const pulseOpacity = useSharedValue(0.4)

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }))

  // Get last 7 days of HRV values on or before selected date
  const hrvData = useMemo(() => {
    const sorted = [...vitals]
      .filter(v => v.timestamp.localeCompare(dateStr + 'T23:59:59') <= 0 && v.hrv > 0)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 7)
      .reverse()
    return sorted
  }, [vitals, dateStr])

  // Today's scores for z-score
  const todayScores = useMemo(() => {
    return scores.find(s => s.date === dateStr) ?? null
  }, [scores, dateStr])

  const todayHRV = hrvData.length > 0 ? hrvData[hrvData.length - 1].hrv : null
  const hasScores = todayScores !== null && todayScores !== undefined
  const zScore = hasScores ? (todayScores.hrvZScore ?? null) : null

  // Determine trend direction
  const trendNote = useMemo(() => {
    if (hrvData.length < 3) return 'Collecting HRV data...'
    const last3 = hrvData.slice(-3).map(v => v.hrv)
    const isRising = last3[2] > last3[1] && last3[1] > last3[0]
    const isFalling = last3[2] < last3[1] && last3[1] < last3[0]
    if (isRising) return 'HRV climbing — your body is adapting well.'
    if (isFalling) return 'HRV declining — consider recovery protocol.'
    return 'HRV stable — autonomic balance maintained.'
  }, [hrvData])

  // Z-score badge
  const zBadge = useMemo(() => {
    if (zScore === null) return { text: 'NO BASELINE', color: S.dimText }
    if (zScore > 0) return { text: `+${safeNumber(zScore, 1)}σ ABOVE BASELINE`, color: S.success }
    if (zScore < -0.5) return { text: `${safeNumber(zScore, 1)}σ BELOW BASELINE`, color: S.warning }
    return { text: `${safeNumber(zScore, 1)}σ AT BASELINE`, color: S.primaryFixedDim }
  }, [zScore])

  // Sparkline SVG path
  const sparkline = useMemo(() => {
    if (hrvData.length < 2) return null
    const values = hrvData.map(v => v.hrv)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const w = 140
    const h = 48
    const pad = 6
    const stepX = (w - pad * 2) / (values.length - 1)

    const points = values.map((v, i) => ({
      x: pad + i * stepX,
      y: pad + (1 - (v - min) / range) * (h - pad * 2),
    }))

    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`
    }

    return { d, points, w, h }
  }, [hrvData])

  if (!todayHRV) {
    return (
      <View style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}>
        <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
          HRV Trend
        </Text>
        <Text style={{ color: S.mutedText, fontSize: 13, marginTop: 8 }}>
          No HRV data available yet
        </Text>
      </View>
    )
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: 'readiness' } })}
      style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {/* LEFT: Today's HRV */}
        <View style={{ flex: 1 }}>
          <Text style={{
            color: S.dimText,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            HRV Today
          </Text>

          <Text style={{
            color: S.accentTeal,
            fontSize: 36,
            fontWeight: '900',
            letterSpacing: -1,
            textShadowColor: 'rgba(20,184,166,0.4)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 12,
          }}>
            {Math.round(todayHRV)}
            <Text style={{ color: S.dimText, fontSize: 14, fontWeight: '500' }}> ms</Text>
          </Text>

          {/* Z-score badge */}
          <View style={{
            backgroundColor: `${zBadge.color}15`,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            alignSelf: 'flex-start',
            marginTop: 8,
          }}>
            <Text style={{
              color: zBadge.color,
              fontSize: 9,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}>
              {zBadge.text}
            </Text>
          </View>
        </View>

        {/* RIGHT: 7-day sparkline */}
        <View style={{ width: 140, justifyContent: 'center' }}>
          {sparkline && (
            <Svg width={sparkline.w} height={sparkline.h} viewBox={`0 0 ${sparkline.w} ${sparkline.h}`}>
              <Path
                d={sparkline.d}
                fill="none"
                stroke={S.accentTeal}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.6}
              />
              {sparkline.points.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === sparkline.points.length - 1 ? 4 : 2.5}
                  fill={S.accentTeal}
                  opacity={i === sparkline.points.length - 1 ? 1 : 0.5}
                />
              ))}
            </Svg>
          )}
          {/* Pulsing glow on the latest dot */}
          {sparkline && (
            <Animated.View style={[pulseStyle, {
              position: 'absolute',
              right: 6,
              top: sparkline.points[sparkline.points.length - 1].y - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: 'rgba(20,184,166,0.3)',
            }]} />
          )}
        </View>
      </View>

      {/* Trend note — 7-day scope */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' }}>
        <Text style={{
          color: S.dimText,
          fontSize: 8,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          backgroundColor: 'rgba(255,255,255,0.06)',
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        }}>
          7-DAY TREND
        </Text>
      </View>
      <Text style={{
        color: S.onSurfaceVariant,
        fontSize: 12,
        lineHeight: 18,
        marginTop: 6,
      }}>
        {trendNote}
      </Text>
    </TouchableOpacity>
  )
}
