import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import type { VitalsRecord, CnsStressScore } from '../../lib/types'

// ── STITCH Design Tokens ──────────────────────────────────────────────
const S = {
  surface: '#121214',
  bg: '#000000',
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.03)',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  primaryFixedDim: '#7ad7c6',
  success: '#7ad7c6',
  warning: '#FFD60A',
  error: '#FF453A',
}

interface BodySystemsStatusBarProps {
  vitals: VitalsRecord | null
  cnsStress: CnsStressScore | null
  rhrBaseline: number
  dateStr: string
}

function statusColor(level: 'green' | 'amber' | 'red' | 'unknown'): string {
  if (level === 'unknown') return S.dimText
  return level === 'green' ? S.success : level === 'amber' ? S.warning : S.error
}

function rhrStatus(rhr: number, baseline: number): 'green' | 'amber' | 'red' | 'unknown' {
  if (baseline <= 0) return 'unknown'
  const diff = Math.abs(rhr - baseline)
  if (diff <= 5) return 'green'
  if (diff <= 12) return 'amber'
  return 'red'
}

function lungStatus(rr: number, spo2: number): 'green' | 'amber' | 'red' {
  if (spo2 >= 95 && rr >= 8 && rr <= 25) return 'green'
  if (spo2 >= 92 || rr > 25 || rr < 8) return 'amber'
  return 'red'
}

function cnsStatus(cns: CnsStressScore | null): 'green' | 'amber' | 'red' | 'unknown' {
  if (!cns) return 'unknown'
  return cns.risk === 'LOW' ? 'green' : cns.risk === 'MODERATE' ? 'amber' : 'red'
}

function tempStatus(delta: number): 'green' | 'amber' | 'red' {
  const abs = Math.abs(delta)
  if (abs <= 0.2) return 'green'
  if (abs <= 0.5) return 'amber'
  return 'red'
}

const SYSTEMS = [
  { emoji: '🫀', label: 'HEART', focus: 'readiness' },
  { emoji: '🫁', label: 'LUNGS', focus: 'resilience' },
  { emoji: '🧠', label: 'CNS', focus: 'resilience' },
  { emoji: '🌡️', label: 'TEMP', focus: 'resilience' },
]

// [CANONICAL-TODO] This component receives data via props from parent screens.
// Parent should source vitals from selectVitalsForDate() and cnsStress from
// selectLatestScores() or selectScoresForDate() canonical selectors.
export function BodySystemsStatusBar({ vitals, cnsStress, rhrBaseline, dateStr }: BodySystemsStatusBarProps) {
  const hasVitals = vitals !== null && vitals !== undefined
  const statuses: ('green' | 'amber' | 'red' | 'unknown')[] = [
    hasVitals ? rhrStatus(vitals.rhr, rhrBaseline) : 'unknown',
    hasVitals ? lungStatus(vitals.respiratoryRate, vitals.spo2) : 'unknown',
    cnsStatus(cnsStress),
    hasVitals ? tempStatus(vitals.skinTempDelta) : 'unknown',
  ]

  return (
    <View
      style={{
        backgroundColor: S.glass,
        borderWidth: 0.5,
        borderColor: S.border,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        marginBottom: 16,
      }}
    >
      {SYSTEMS.map((sys, i) => (
        <TouchableOpacity
          key={sys.label}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/(tabs)/health', params: { date: dateStr, focus: sys.focus } })}
          style={{
            flex: 1,
            alignItems: 'center',
            gap: 6,
            borderRightWidth: i < 3 ? 0.5 : 0,
            borderRightColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <Text style={{ fontSize: 18 }}>{sys.emoji}</Text>
          <Text style={{
            color: S.dimText,
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}>
            {sys.label}
          </Text>
          {/* Status dot */}
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: statusColor(statuses[i]),
            shadowColor: statuses[i] !== 'unknown' ? statusColor(statuses[i]) : 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: statuses[i] !== 'unknown' ? 0.6 : 0,
            shadowRadius: 4,
            borderWidth: statuses[i] === 'unknown' ? 1 : 0,
            borderColor: statuses[i] === 'unknown' ? 'rgba(255,255,255,0.12)' : 'transparent',
          }} />
        </TouchableOpacity>
      ))}
    </View>
  )
}
