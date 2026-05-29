import React from 'react'
import { View, Text } from 'react-native'
import { GlassCard } from '../ui/glass-card'
import type { RunningDynamics } from '../../lib/types'
import { computeFormDegradation } from '../../lib/algorithms/running-form'
import { safeNumber } from '../../lib/utils/display-helpers'

interface RunningDynamicsProps {
  recent: RunningDynamics | null
  baseline: RunningDynamics[]
}

const S = {
  border: 'rgba(255,255,255,0.08)',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  error: '#FF453A',
}

// [CANONICAL-TODO] This component receives running dynamics via props.
// Parent should source data from selectRunningDynamicsForDate() canonical selector.
export function RunningDynamicsCard({ recent, baseline }: RunningDynamicsProps) {
  if (!recent) {
    return (
      <GlassCard style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 9, color: S.dimText, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '800', marginBottom: 8 }}>RUNNING DYNAMICS</Text>
        <Text style={{ fontSize: 13, color: S.mutedText }}>No recent running data found.</Text>
      </GlassCard>
    )
  }

  const degradation = computeFormDegradation(recent, baseline)

  return (
    <GlassCard style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 9, color: S.dimText, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '800' }}>AWU2 BIOMECHANICS</Text>
        {degradation.degraded && (
          <View style={{ backgroundColor: 'rgba(255,69,58,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, borderWidth: 0.5, borderColor: 'rgba(255,69,58,0.3)' }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: S.error }}>FORM BREAKDOWN RISK</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ width: '48%' }}>
          <Text style={{ color: S.dimText, fontSize: 10, marginBottom: 4 }}>Running Power</Text>
          <Text style={{ color: S.onSurface, fontSize: 24, fontWeight: '800' }}>
            {Math.round(recent.runningPower)}
            <Text style={{ fontSize: 12, color: S.dimText, fontWeight: '400' }}> W</Text>
          </Text>
        </View>
        <View style={{ width: '48%' }}>
          <Text style={{ color: S.dimText, fontSize: 10, marginBottom: 4 }}>Contact Time</Text>
          <Text style={{ color: S.onSurface, fontSize: 24, fontWeight: '800' }}>
            {Math.round(recent.groundContactTime)}
            <Text style={{ fontSize: 12, color: S.dimText, fontWeight: '400' }}> ms</Text>
          </Text>
        </View>
        <View style={{ width: '48%', marginTop: 8 }}>
          <Text style={{ color: S.dimText, fontSize: 10, marginBottom: 4 }}>Vert Oscillation</Text>
          <Text style={{ color: S.onSurface, fontSize: 20, fontWeight: '800' }}>
            {safeNumber(recent.verticalOscillation, 1)}
            <Text style={{ fontSize: 12, color: S.dimText, fontWeight: '400' }}> cm</Text>
          </Text>
        </View>
        <View style={{ width: '48%', marginTop: 8 }}>
          <Text style={{ color: S.dimText, fontSize: 10, marginBottom: 4 }}>Stride Length</Text>
          <Text style={{ color: S.onSurface, fontSize: 20, fontWeight: '800' }}>
            {safeNumber(recent.strideLength, 2)}
            <Text style={{ fontSize: 12, color: S.dimText, fontWeight: '400' }}> m</Text>
          </Text>
        </View>
      </View>

      {degradation.degraded && (
        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: S.border }}>
          <Text style={{ fontSize: 13, color: S.onSurface, lineHeight: 18 }}>{degradation.explanation}</Text>
        </View>
      )}
    </GlassCard>
  )
}
