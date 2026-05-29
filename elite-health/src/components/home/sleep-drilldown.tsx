import React from 'react'
import { View, Text } from 'react-native'
import type { SleepArchitecture } from '../../lib/types'
import { safeNumber } from '../../lib/utils/display-helpers'

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../theme/stitch-tokens'

const STITCH = {
  ..._S,
  accentCyan: _S.pillarLongevity,
  accentTeal: _S.pillarReadiness,
  accentPurple: _S.pillarResilience,
}

// ── GlassPanel → EliteCard (V3 canonical component) ───────────────────
import { EliteCard, SectionHeader as V3SectionHeader } from '../ui/v3'
const GlassPanel = EliteCard

function SectionHeader({ label }: { label: string }) {
  return <V3SectionHeader label={label} />
}

interface SleepDrilldownProps {
  architecture: SleepArchitecture | null
  history?: SleepArchitecture[]
}

// [CANONICAL-TODO] This component receives sleep architecture via props from parent screens.
// Parent should source data from selectSleepForDate() canonical selector and
// computeSleepArchitecture() for architecture breakdown.
export function SleepDrilldown({ architecture, history = [] }: SleepDrilldownProps) {
  if (!architecture) {
    return (
      <GlassPanel>
        <SectionHeader label="Sleep Architecture" />
        <Text style={{ color: STITCH.dimText, fontSize: 14 }}>No sleep data available</Text>
      </GlassPanel>
    )
  }

  const stages = [
    { label: 'Awake', mins: architecture.awakeMins, color: STITCH.warning, pct: (architecture.awakeMins / architecture.totalDurationMins) * 100 },
    { label: 'REM', mins: architecture.remMins, color: STITCH.accentTeal, pct: architecture.remPercent },
    { label: 'Deep', mins: architecture.deepMins, color: STITCH.accentCyan, pct: architecture.deepPercent },
    { label: 'Core', mins: architecture.coreMins, color: STITCH.accentPurple, pct: ((architecture.coreMins / architecture.totalDurationMins) * 100) },
  ]

  return (
    <View style={{ gap: 12 }}>
      {/* Sleep quality header */}
      <GlassPanel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: STITCH.onSurfaceVariant, fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>Sleep Quality</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 0.5, borderColor: STITCH.border }}>
            <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '800' }}>{architecture.sleepQualityScore}%</Text>
          </View>
        </View>

        {/* Stage bar */}
        <View style={{ height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' }}>
          {stages.map((stage, i) => (
            <View
              key={i}
              style={{
                width: `${(stage.mins / Math.max(1, architecture.totalDurationMins)) * 100}%` as any,
                backgroundColor: stage.color,
                opacity: 0.85,
              }}
            />
          ))}
        </View>

        {/* Stage legend */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 }}>
          {stages.map((stage, i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stage.color }} />
                <Text style={{ color: STITCH.onSurface, fontSize: 10, fontWeight: '800' }}>{stage.label}</Text>
              </View>
              <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '600' }}>
                {safeNumber(stage.pct, 0)}% · {stage.mins}m
              </Text>
            </View>
          ))}
        </View>
      </GlassPanel>

      {/* Key metrics */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GlassPanel style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: STITCH.onSurface, fontSize: 24, fontWeight: '900' }}>{safeNumber(architecture.efficiencyPercent, 0)}%</Text>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Efficiency</Text>
        </GlassPanel>
        <GlassPanel style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: STITCH.onSurface, fontSize: 24, fontWeight: '900' }}>{Math.floor(architecture.totalDurationMins / 60)}h {architecture.totalDurationMins % 60}m</Text>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Duration</Text>
        </GlassPanel>
        <GlassPanel style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: STITCH.onSurface, fontSize: 24, fontWeight: '900' }}>{safeNumber(architecture.remPercent, 0)}%</Text>
          <Text style={{ color: STITCH.dimText, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>REM</Text>
        </GlassPanel>
      </View>

      {/* 7-night history */}
      {history.length > 0 && (
        <GlassPanel>
          <SectionHeader label="7-Night History" />
          {history.slice(0, 7).map((night, i) => {
            const hrs = Math.floor(night.totalDurationMins / 60)
            const mins = night.totalDurationMins % 60
            return (
              <View
                key={i}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8,
                  borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: STITCH.border
                }}
              >
                <Text style={{ color: STITCH.onSurface, fontSize: 12, fontWeight: '800', width: 40 }}>
                  {new Date(night.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}>
                    <View style={{ width: `${night.remPercent}%` as any, backgroundColor: STITCH.accentTeal, opacity: 0.7 }} />
                    <View style={{ width: `${night.deepPercent}%` as any, backgroundColor: STITCH.accentCyan, opacity: 0.7 }} />
                    <View
                      style={{
                        width: `${Math.max(0, 100 - night.remPercent - night.deepPercent - ((night.awakeMins / Math.max(1, night.totalDurationMins)) * 100))}%` as any,
                        backgroundColor: STITCH.accentPurple,
                        opacity: 0.4,
                      }}
                    />
                  </View>
                </View>
                <Text style={{ color: STITCH.dimText, fontSize: 12, fontWeight: '800' }}>
                  {hrs}h {mins}m
                </Text>
              </View>
            )
          })}
        </GlassPanel>
      )}
    </View>
  )
}
