import React from 'react'
import { View, Text } from 'react-native'
import { GlassCard } from '../ui/glass-card'
import { EmissiveRing } from '../ui/ring'
import {
  safeHRV,
  safeRHR,
  safeSpO2,
  safeRespiratoryRate,
  safeSkinTempDelta,
  safePaceOfAging,
  safeBiologicalAge,
  formatVital,
  formatAge,
  safeNumber,
} from '../../lib/utils/display-helpers'
// [CANONICAL] Scope-explicit data access — replaces silent chrono-age fallback
import { useHealthStore } from '../../lib/store'
import {
  selectScoresForDate,
  selectVitalsForDate,
} from '../../lib/canonical-selectors'

const S = {
  border: 'rgba(255,255,255,0.08)',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  accentCyan: '#00E5FF',
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
  glass: 'rgba(255,255,255,0.04)',
}

export function BiologicalAge({ biologicalAge, chronologicalAge, paceOfAging }: { biologicalAge: number; chronologicalAge: number; paceOfAging: number }) {
  const bioAge = safeBiologicalAge(biologicalAge, chronologicalAge) ?? chronologicalAge
  const pace = safePaceOfAging(paceOfAging) ?? 1.0
  const diff = bioAge - chronologicalAge
  const diffSign = diff > 0 ? '+' : ''
  const diffColor = diff < -2 ? S.success : diff < 2 ? S.warning : S.error
  const ringPercent = Math.min(100, Math.max(0, ((bioAge - 18) / 62) * 100))

  // [CANONICAL] Honest data access via scope-explicit selector
  // Replaces silent `?? chronologicalAge` fallback with provable empty state
  const store = useHealthStore()
  const canonicalScores = selectScoresForDate(store, store.selectedDate)
  const canonicalStatus = canonicalScores.status
  const canonicalConfidence = canonicalScores.confidence
  const canonicalProvenance = canonicalScores.provenanceSummary
  const isMissingData = canonicalStatus === 'missing' || canonicalStatus === 'insufficient'

  return (
    <GlassCard style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Text style={{ fontSize: 9, color: S.dimText, textTransform: 'uppercase', letterSpacing: 1.0, fontWeight: '800', marginBottom: 12 }}>Body Age</Text>
      {isMissingData ? (
        // [CANONICAL] Honest empty state — never show fake biological age
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 180, height: 180 }}>
          <Text style={{ fontSize: 14, color: S.mutedText, fontWeight: '700', textAlign: 'center' }}>
            Insufficient data
          </Text>
          <Text style={{ fontSize: 9, color: S.dimText, marginTop: 6, textAlign: 'center', paddingHorizontal: 8 }}>
            {canonicalScores.emptyStateReason ?? 'No biological age available for this date'}
          </Text>
        </View>
      ) : (
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', width: 180, height: 180 }}>
          <EmissiveRing percentage={ringPercent} size={180} strokeWidth={9} startColor="#CCFF00" endColor="#00E5FF" />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 40, fontWeight: '900', color: S.onSurface }}>{formatAge(bioAge)}</Text>
            <Text style={{ fontSize: 9, color: S.dimText, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '800' }}>Years</Text>
            <Text style={{ fontSize: 13, marginTop: 4, fontWeight: '800', color: diffColor }}>
              {diffSign}{Math.abs(diff).toFixed(1)} vs {chronologicalAge}
            </Text>
          </View>
        </View>
      )}
      <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 9999, paddingHorizontal: 20, paddingVertical: 6, borderWidth: 0.5, borderColor: S.border }}>
        <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '800' }}>
          Aging Pace: <Text style={{ color: S.accentCyan }}>{safeNumber(pace, 2)}x</Text>
        </Text>
      </View>
      {/* [CANONICAL] Provenance and scope display */}
      <View style={{ marginTop: 10, alignItems: 'center', gap: 2 }}>
        <Text style={{ fontSize: 7, color: S.dimText, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' }}>
          scope: {canonicalScores.scope} · confidence: {canonicalConfidence}%
        </Text>
        <Text style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingHorizontal: 8 }} numberOfLines={1}>
          {canonicalProvenance.slice(0, 60)}{canonicalProvenance.length > 60 ? '…' : ''}
        </Text>
      </View>
    </GlassCard>
  )
}

export function VitalsGrid({ vitals }: { vitals: { hrv: number; rhr: number; spo2: number; respiratoryRate: number; skinTempDelta: number } | null }) {
  if (!vitals) {
    return (
      <GlassCard>
        <Text style={{ fontSize: 9, color: S.dimText, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '800', marginBottom: 8 }}>Vitals</Text>
        <Text style={{ fontSize: 13, color: S.mutedText, fontWeight: '500' }}>No vitals data available</Text>
      </GlassCard>
    )
  }

  const hrvVal = safeHRV(vitals.hrv)
  const rhrVal = safeRHR(vitals.rhr)
  const spo2Val = safeSpO2(vitals.spo2)
  const respVal = safeRespiratoryRate(vitals.respiratoryRate)
  const tempVal = safeSkinTempDelta(vitals.skinTempDelta)

  const metrics = [
    {
      label: 'HRV',
      value: hrvVal !== null ? `${hrvVal}` : '--',
      unit: 'ms',
      baseline: hrvVal !== null ? `${Math.round(hrvVal * 0.9)}–${Math.round(hrvVal * 1.1)}` : '--',
      inRange: hrvVal !== null && hrvVal > 20,
      desc: 'Heart rate variability',
    },
    {
      label: 'Resting HR',
      value: rhrVal !== null ? `${rhrVal}` : '--',
      unit: 'bpm',
      baseline: rhrVal !== null ? `${Math.round(rhrVal * 0.9)}–${Math.round(rhrVal * 1.1)}` : '--',
      inRange: rhrVal !== null && rhrVal >= 40 && rhrVal <= 80,
      desc: 'Resting heart rate',
    },
    {
      label: 'Oxygen',
      value: spo2Val !== null ? `${spo2Val}` : '--',
      unit: '%',
      baseline: '95–100%',
      inRange: spo2Val !== null && spo2Val >= 95,
      desc: 'Blood oxygen level',
    },
    {
      label: 'Breathing',
      value: respVal !== null ? `${respVal}` : '--',
      unit: '/min',
      baseline: '12–20',
      inRange: respVal !== null && respVal > 8 && respVal < 25,
      desc: 'Respiratory rate',
    },
    {
      label: 'Skin Temp',
      value: tempVal !== null ? `${tempVal > 0 ? '+' : ''}${tempVal}` : '--',
      unit: '°C',
      baseline: '±2°C',
      inRange: tempVal !== null && Math.abs(tempVal) < 2,
      desc: 'Temperature change',
    },
  ]

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {metrics.map((m, i) => (
        <GlassCard key={i} style={{ width: '48%', position: 'relative', overflow: 'hidden' }}>
          {m.inRange && (
            <View
              style={{
                position: 'absolute',
                top: -16,
                right: -16,
                width: 80,
                height: 80,
                borderRadius: 40,
                opacity: 0.1,
                backgroundColor: '#CCFF00',
              }}
            />
          )}
          <Text style={{ fontSize: 9, color: S.dimText, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, fontWeight: '800' }}>{m.label}</Text>
          <Text style={{ fontSize: 28, fontWeight: '900', color: S.onSurface, letterSpacing: -0.5 }}>
            {m.value}
            <Text style={{ fontSize: 13, color: S.dimText, fontWeight: '400' }}> {m.unit}</Text>
          </Text>
          <Text style={{ fontSize: 8, color: S.mutedText, marginTop: 2, marginBottom: 8, fontWeight: '500' }}>{m.desc}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, marginRight: 6, backgroundColor: m.inRange ? S.success : S.error }} />
            <Text style={{ fontSize: 9, fontWeight: '800', color: m.inRange ? S.success : S.error }}>
              {m.inRange ? 'Good' : 'Check'}
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: S.mutedText, marginTop: 4, fontWeight: '500' }}>Normal: {m.baseline}</Text>
        </GlassCard>
      ))}
    </View>
  )
}

export function HealthMonitorStrip({ count, total }: { count: number; total: number }) {
  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {['🫁', '🩸', '❤️', '📈', '🌡️'].map((icon, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 18 }}>{icon}</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i < count ? S.success : 'rgba(255,255,255,0.08)' }} />
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 13, color: S.dimText, textAlign: 'center', marginTop: 12, fontWeight: '800' }}>
        {count}/{total} Metrics in Range
      </Text>
    </GlassCard>
  )
}
