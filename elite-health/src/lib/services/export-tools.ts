/**
 * Data Export Tools — CSV export, share card, and PDF-ready HTML generation.
 * Uses React Native's built-in Share API and Alert for cross-platform compatibility.
 * For PDF generation, install: npx expo install expo-print
 * For file system writes: npx expo install expo-file-system expo-sharing
 */

import { Share, Alert, Platform } from 'react-native'
import type { HealthState } from '../types'
import { localDateString } from '../healthkit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function csvEscape(value: any): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recordsToCsv(records: any[], columns: string[]): string {
  const header = columns.map(csvEscape).join(',')
  const rows = records.map(r => columns.map(c => csvEscape(r[c] ?? '')).join(','))
  return [header, ...rows].join('\n')
}

/**
 * Build a full CSV report from all health data.
 *
 * **IMPORTANT — Canonical Selector Bypass:** This function reads raw `state.*` arrays
 * directly instead of using canonical selectors. As a result, exported data may include
 * stale, low-confidence, or synthetic records without provenance metadata.
 *
 * [CANONICAL-TODO] Migrate to canonical selectors with provenance metadata in export headers.
 * See Bug B4 in docs/pipeline-audit-phase0-inventory.md.
 */
export function buildFullCsv(state: HealthState): string {
  const sections: string[] = []

  if (state.vitals.length > 0) {
    const cols = ['timestamp', 'hrv', 'rhr', 'spo2', 'respiratoryRate', 'skinTempDelta']
    sections.push('## VITALS\n' + recordsToCsv(state.vitals as unknown[], cols))
  }

  if (state.sleep.length > 0) {
    const cols = ['date', 'totalDurationMins', 'remMins', 'deepMins', 'coreMins', 'awakeMins', 'sleepDebtHours']
    sections.push('## SLEEP\n' + recordsToCsv(state.sleep as unknown[], cols))
  }

  if (state.activities.length > 0) {
    const cols = ['timestamp', 'workoutType', 'durationMins', 'activeCalories', 'avgHR', 'maxHR', 'strainScore']
    sections.push('## ACTIVITIES\n' + recordsToCsv(
      state.activities.map(a => ({ ...a, hrZones: JSON.stringify(a.hrZones ?? []) })),
      cols,
    ))
  }

  if (state.meals.length > 0) {
    const cols = ['timestamp', 'proteinGrams', 'carbsGrams', 'fatGrams', 'totalCalories', 'mealDescription']
    sections.push('## MEALS\n' + recordsToCsv(state.meals as unknown[], cols))
  }

  if (state.scores.length > 0) {
    const cols = ['date', 'recoveryScore', 'strainScore', 'sleepDebtHours', 'biologicalAge', 'paceOfAging']
    sections.push('## SCORES\n' + recordsToCsv(state.scores as unknown[], cols))
  }

  if (state.mobility.length > 0) {
    const cols = ['date', 'steps', 'walkingSpeed', 'walkingStepLength', 'walkingAsymmetry', 'doubleSupport', 'stairSpeedUp', 'stairSpeedDown', 'flightsClimbed']
    sections.push('## MOBILITY\n' + recordsToCsv(state.mobility as unknown[], cols))
  }

  if (state.environmental.length > 0) {
    const cols = ['date', 'timeInDaylight', 'headphoneAudio', 'exerciseMinutes', 'standMinutes', 'standHours']
    sections.push('## ENVIRONMENTAL\n' + recordsToCsv(state.environmental as unknown[], cols))
  }

  if (state.cardioMetabolic.length > 0) {
    const cols = ['date', 'vo2Max', 'walkingHRavg', 'restingEnergy', 'physicalEffort', 'breathingDisturbances']
    sections.push('## CARDIO METABOLIC\n' + recordsToCsv(state.cardioMetabolic as unknown[], cols))
  }

  if (state.journalEntries.length > 0) {
    sections.push('## JOURNAL\n' + recordsToCsv(
      state.journalEntries.map(j => ({ ...j, habits: JSON.stringify(j.habits ?? []) })),
      ['date', 'habits', 'notes'],
    ))
  }

  if (state.weightHistory.length > 0) {
    sections.push('## WEIGHT\n' + recordsToCsv(state.weightHistory as unknown[], ['date', 'weightKg', 'bmi', 'leanBodyMass', 'bodyFatPercent']))
  }

  sections.push(`\n## EXPORT METADATA\nGenerated,KILO AI Elite Health,${new Date().toISOString()}\nRecords,${state.scores.length} days,${state.vitals.length} vitals`)

  return sections.join('\n\n')
}

/** Share full CSV via system share sheet */
export async function shareCsv(state: HealthState): Promise<void> {
  try {
    const csv = buildFullCsv(state)
    await Share.share({
      message: csv,
      title: `KILO Health Export ${localDateString(new Date())}`,
    })
  } catch (error) {
    console.error('CSV share failed:', error)
    Alert.alert('Share Failed', 'Could not share health data.')
  }
}

/**
 * Generate an HTML report for PDF export via expo-print.
 * Install expo-print: npx expo install expo-print
 * Then use: const { uri } = await Print.printToFileAsync({ html })
 */
export function buildPdfHtml(state: HealthState): string {
  const latestVitals = state.latestVitals
  const latestSleep = state.latestSleep
  const latestScores = state.latestScores

  const scoreRows = state.scores.length > 0
    ? state.scores.slice(0, 14).map(s => `
      <tr>
        <td>${s.date}</td>
        <td style="color:${s.recoveryScore >= 50 ? '#CCFF00' : '#FF3366'}">${s.recoveryScore}%</td>
        <td>${s.strainScore.toFixed(1)}</td>
        <td>${s.sleepDebtHours > 0 ? '+' : ''}${s.sleepDebtHours.toFixed(1)}h</td>
        <td>${s.paceOfAging?.toFixed(2) ?? '-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#666;">No score data available</td></tr>'

  const activityRows = state.activities.length > 0
    ? state.activities.slice(0, 10).map(a => `
      <tr>
        <td>${a.timestamp.slice(0, 10)}</td>
        <td>${a.workoutType || 'Unknown'}</td>
        <td>${a.durationMins}min</td>
        <td>${a.activeCalories}cal</td>
        <td>${a.avgHR ?? '-'}bpm</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#666;">No activity data</td></tr>'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KILO AI Health Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',sans-serif;background:#000;color:#FAFAFA;padding:32px}
h1{font-size:28px;letter-spacing:4px;font-weight:900;color:#CCFF00;margin-bottom:4px}
.date{font-size:12px;color:#8A8F93;margin-bottom:32px}
.section{margin-bottom:28px}
.section h2{font-size:14px;letter-spacing:2px;font-weight:800;color:#00E5FF;margin-bottom:12px;text-transform:uppercase}
.stat-row{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px}
.stat{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 16px;min-width:100px}
.stat .label{font-size:9px;color:#8A8F93;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:4px}
.stat .value{font-size:22px;font-weight:900}
.stat .unit{font-size:11px;color:#8A8F93}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;color:#8A8F93;font-weight:700;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:9px;letter-spacing:1px;text-transform:uppercase}
td{padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.04)}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);font-size:10px;color:#8A8F93;text-align:center}
</style></head>
<body>
<h1>KILO AI</h1>
<p class="date">Health Report — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

${latestScores ? `
<div class="section"><h2>Snapshot</h2><div class="stat-row">
<div class="stat"><p class="label">Recovery</p><p class="value" style="color:${latestScores.recoveryScore >= 50 ? '#CCFF00' : '#FF3366'}">${latestScores.recoveryScore}<span class="unit">%</span></p></div>
<div class="stat"><p class="label">Strain</p><p class="value">${latestScores.strainScore.toFixed(1)}</p></div>
<div class="stat"><p class="label">Sleep Debt</p><p class="value">${latestScores.sleepDebtHours.toFixed(1)}<span class="unit">h</span></p></div>
<div class="stat"><p class="label">Pace of Aging</p><p class="value" style="color:${(latestScores.paceOfAging ?? 1) <= 1 ? '#CCFF00' : '#FF3366'}">${latestScores.paceOfAging?.toFixed(2) ?? '-'}</p></div>
</div></div>` : ''}

${latestVitals ? `
<div class="section"><h2>Vitals</h2><div class="stat-row">
<div class="stat"><p class="label">HRV</p><p class="value">${latestVitals.hrv}<span class="unit">ms</span></p></div>
<div class="stat"><p class="label">RHR</p><p class="value">${latestVitals.rhr}<span class="unit">bpm</span></p></div>
<div class="stat"><p class="label">SpO2</p><p class="value">${latestVitals.spo2}<span class="unit">%</span></p></div>
<div class="stat"><p class="label">Resp. Rate</p><p class="value">${latestVitals.respiratoryRate}<span class="unit">/min</span></p></div>
</div></div>` : ''}

${latestSleep ? `
<div class="section"><h2>Sleep</h2><div class="stat-row">
<div class="stat"><p class="label">Total</p><p class="value">${Math.floor(latestSleep.totalDurationMins / 60)}h ${latestSleep.totalDurationMins % 60}m</p></div>
<div class="stat"><p class="label">REM</p><p class="value">${latestSleep.remMins}<span class="unit">min</span></p></div>
<div class="stat"><p class="label">Deep</p><p class="value">${latestSleep.deepMins}<span class="unit">min</span></p></div>
<div class="stat"><p class="label">Efficiency</p><p class="value">${Math.round((latestSleep.remMins + latestSleep.deepMins + latestSleep.coreMins) / latestSleep.totalDurationMins * 100)}<span class="unit">%</span></p></div>
</div></div>` : ''}

<div class="section"><h2>Score History (Last 14 Days)</h2>
<table><thead><tr><th>Date</th><th>Recovery</th><th>Strain</th><th>Sleep Debt</th><th>Pace of Aging</th></tr></thead><tbody>${scoreRows}</tbody></table></div>

<div class="section"><h2>Recent Activities</h2>
<table><thead><tr><th>Date</th><th>Type</th><th>Duration</th><th>Calories</th><th>Avg HR</th></tr></thead><tbody>${activityRows}</tbody></table></div>

<div class="footer">Generated by KILO AI Elite Health · ${new Date().toISOString()}</div>
</body></html>`
}

/** Build natural-language summary for quick sharing */
export function buildSummaryText(state: HealthState): string {
  const today = localDateString(new Date())
  const scores = state.scores.find(s => s.date === today)
  const vitals = state.vitals.find(v => v.timestamp.startsWith(today))

  if (!scores) return '📊 KILO AI Health Report\nNo data available for today. Sync via HealthKit to generate your summary.'

  const recoveryEmoji = scores.recoveryScore >= 70 ? '🟢' : scores.recoveryScore >= 40 ? '🟡' : '🔴'
  const pace = scores.paceOfAging ?? 1.0
  const agingEmoji = pace <= 0.95 ? '🧬✨' : pace <= 1.05 ? '🧬' : '🧬⚠️'

  let text = `📊 KILO AI — Daily Health Report\n📅 ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}\n\n`
  text += `${recoveryEmoji} Recovery: ${scores.recoveryScore}%\n`
  text += `💪 Strain: ${scores.strainScore.toFixed(1)}\n`
  text += `😴 Sleep Debt: ${scores.sleepDebtHours > 0 ? '+' : ''}${scores.sleepDebtHours.toFixed(1)}h\n`
  text += `${agingEmoji} Pace of Aging: ${pace.toFixed(2)}x\n`

  if (vitals) {
    text += `\n❤️ HRV: ${vitals.hrv}ms | RHR: ${vitals.rhr}bpm | SpO2: ${vitals.spo2}%\n`
  }

  if (state.cardioMetabolic.length > 0) {
    const latestCardio = state.cardioMetabolic[0]
    if (latestCardio?.vo2Max > 0) {
      text += `🫁 VO2 Max: ${latestCardio.vo2Max.toFixed(1)}\n`
    }
  }

  text += `\n@KILO AI — Elite Health Analytics`
  return text
}

/** Share health summary text via system share sheet */
export async function shareSummaryText(state: HealthState): Promise<void> {
  try {
    const text = buildSummaryText(state)
    await Share.share({
      message: text,
      title: 'KILO AI Daily Health Report',
    })
  } catch (error) {
    console.error('Share failed:', error)
    Alert.alert('Share Failed', 'Could not share summary.')
  }
}
