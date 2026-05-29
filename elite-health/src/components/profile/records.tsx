// [CANONICAL-TODO] Records displays are pure presentational components
// receiving data via props. The parent (profile.tsx) should source:
//   - PersonalRecords: activities from selectAllTimeActivities(), sleep from
//     selectAllTimeSleepRange(), scores from selectAllTimeScoresRange()
//   - ActivitySummary: activities from selectAllTimeActivities()
//   - StrainRecoveryChart: scores from selectRolling7dScores(state, endDate)
// This ensures all-time records and trend charts carry provenance metadata.
import React from 'react'
import { View, Text } from 'react-native'
import { safeNumber } from '../../lib/utils/display-helpers'

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../theme/stitch-tokens'

const S = {
  ..._S,
  accentCyan: _S.pillarLongevity,
  accentTeal: _S.pillarReadiness,
  accentPurple: _S.pillarResilience,
  surfaceContainer: _S.surfaceContainer,
  primaryFixedDim: _S.primaryFixedDim,
  secondaryFixedDim: _S.secondaryFixedDim,
  tertiaryFixedDim: _S.tertiaryFixedDim,
  volt: '#CCFF00',
}

// ── GlassPanel → EliteCard (V3 canonical component) ───────────────────
import { EliteCard } from '../ui/v3'
const GlassPanel = EliteCard

// ── Section label ──────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{
      color: S.onSurfaceVariant,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    }}>
      {label}
    </Text>
  )
}

// ── Personal Records ───────────────────────────────────────────────────
interface RecordsProps {
  activities: { workoutType: string; strainScore: number | null }[]
  sleep: { totalDurationMins: number; deepMins?: number }[]
  scores: { recoveryScore: number }[]
}

export function PersonalRecords({ activities, sleep, scores }: RecordsProps) {
  const maxStrain = activities.reduce((max, a) => Math.max(max, a.strainScore ?? 0), 0)
  const longestSleep = sleep.reduce((max, s) => Math.max(max, s.totalDurationMins), 0)
  const lowestRecovery = scores.reduce((min, s) => Math.min(min, s.recoveryScore), 100)
  const bestDeepSleep = sleep.reduce((max, s) => Math.max(max, s.deepMins ?? 0), 0)

  const records = [
    { label: 'Max Strain', value: maxStrain > 0 ? safeNumber(maxStrain, 1) : '--', accent: S.error },
    { label: 'Best Sleep', value: longestSleep > 0 ? `${Math.round(longestSleep / 60)}h ${Math.round(longestSleep % 60)}m` : '--', accent: S.secondaryFixedDim },
    { label: 'Deep Sleep', value: bestDeepSleep > 0 ? `${Math.round(bestDeepSleep / 60)}h ${Math.round(bestDeepSleep % 60)}m` : '--', accent: S.accentPurple },
    { label: 'Low Recovery', value: lowestRecovery < 100 ? `${safeNumber(lowestRecovery, 0)}%` : '--', accent: S.warning },
  ]

  return (
    <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
      <SectionLabel label="All-Time Records" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {records.map((r, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <Text
              style={{
                color: r.accent,
                fontSize: 20,
                fontWeight: '900',
                letterSpacing: -0.5,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {r.value}
            </Text>
            <Text style={{
              color: S.dimText,
              fontSize: 9,
              fontWeight: '700',
              textTransform: 'uppercase',
              marginTop: 4,
              letterSpacing: 0.5,
            }}>
              {r.label}
            </Text>
          </View>
        ))}
      </View>
    </GlassPanel>
  )
}

// ── Activity Summary ───────────────────────────────────────────────────
export function ActivitySummary({ activities }: { activities: { workoutType: string; strainScore: number | null }[] }) {
  const activityTypes = activities.reduce((acc, a) => {
    const key = a.workoutType
    if (!acc[key]) acc[key] = { count: 0, totalStrain: 0, strainReadings: 0 }
    acc[key].count++
    if (a.strainScore !== null) {
      acc[key].totalStrain += a.strainScore
      acc[key].strainReadings++
    }
    return acc
  }, {} as Record<string, { count: number; totalStrain: number; strainReadings: number }>)

  const types = Object.entries(activityTypes)
    .map(([name, data]) => ({
      name,
      count: data.count,
      avgStrain: data.strainReadings > 0 ? data.totalStrain / data.strainReadings : null,
    }))
    .sort((a, b) => b.count - a.count)

  const maxCount = types[0]?.count ?? 1

  if (types.length === 0) {
    return (
      <GlassPanel style={{ padding: 20 }}>
        <SectionLabel label="Activities" />
        <Text style={{ color: S.mutedText, fontSize: 13 }}>
          No workouts recorded yet
        </Text>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel style={{ padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionLabel label="Activities" />
        <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900' }}>
          {activities.length}x
        </Text>
      </View>
      {types.map((t, i) => (
        <View
          key={i}
          style={{
            marginTop: i > 0 ? 12 : 0,
            paddingTop: i > 0 ? 12 : 0,
            borderTopWidth: i > 0 ? 0.5 : 0,
            borderTopColor: S.border,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: S.surfaceContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 0.5,
                  borderColor: S.border,
                }}
              >
                <Text style={{ color: S.primaryFixedDim, fontSize: 10, fontWeight: '800' }}>
                  {t.count}x
                </Text>
              </View>
              <Text style={{ color: S.onSurface, fontSize: 14, fontWeight: '600' }}>
                {t.name}
              </Text>
            </View>
            <Text style={{ color: S.accentCyan, fontSize: 13, fontWeight: '700' }}>
              {t.avgStrain != null ? `Avg ${safeNumber(t.avgStrain, 1)}` : '--'}
            </Text>
          </View>
          <View
            style={{
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${(t.count / maxCount) * 100}%`,
                backgroundColor: S.accentCyan,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      ))}
    </GlassPanel>
  )
}

// ── Strain / Recovery Chart ────────────────────────────────────────────
interface StrainRecoveryChartProps {
  scores: { date: string; strainScore: number; recoveryScore: number }[]
}

export function StrainRecoveryChart({ scores }: StrainRecoveryChartProps) {
  const data = scores.slice(0, 7).reverse()

  if (data.length === 0) {
    return (
      <GlassPanel style={{ padding: 20 }}>
        <SectionLabel label="Load vs Recovery" />
        <Text style={{ color: S.mutedText, fontSize: 13 }}>
          Need more data
        </Text>
      </GlassPanel>
    )
  }

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <GlassPanel style={{ padding: 20 }}>
      <SectionLabel label="7-Day Trend" />

      {/* Dual bar chart */}
      <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        {data.map((d, i) => {
          const strainPct = Math.min(100, (d.strainScore / 21) * 100)
          const recoveryPct = Math.min(100, d.recoveryScore)

          return (
            <View key={i} style={{ width: '12%', alignItems: 'center' }}>
              <View style={{ flexDirection: 'column', gap: 2, alignItems: 'center', flex: 1, justifyContent: 'flex-end', marginBottom: 6 }}>
                {/* Strain bar (narrow) */}
                <View
                  style={{
                    width: 10,
                    height: `${Math.max(4, strainPct)}%`,
                    backgroundColor: S.primaryFixedDim,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    opacity: 0.5,
                    borderWidth: 0.5,
                    borderColor: 'rgba(122,215,198,0.2)',
                  }}
                />
                {/* Recovery bar (wider) */}
                <View
                  style={{
                    width: 16,
                    height: `${Math.max(4, recoveryPct)}%`,
                    backgroundColor: S.tertiaryFixedDim,
                    borderRadius: 2,
                  }}
                />
              </View>
              <Text style={{
                color: i === 2 ? S.primaryFixedDim : S.dimText,
                fontSize: 10,
                fontWeight: '600',
              }}>
                {dayLabels[i] ?? '?'}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: S.primaryFixedDim,
              shadowColor: S.primaryFixedDim,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
          <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>
            STRAIN
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: S.tertiaryFixedDim,
              shadowColor: S.tertiaryFixedDim,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
          <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>
            RECOVERY
          </Text>
        </View>
      </View>
    </GlassPanel>
  )
}
