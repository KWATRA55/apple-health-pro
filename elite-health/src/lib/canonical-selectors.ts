// ── Phase D: Canonical Selectors ─────────────────────────────────────────────
// Every selector returns data for exactly ONE declared scope with provenance
// metadata. No silent fallback across scopes — if the requested scope has no
// data, the selector returns an explicit empty-state view model.

import type {
    HealthMetricViewModel,
    VitalsRecord,
    SleepRecord,
    ActivityRecord,
    DailyScores,
    MobilityRecord,
    EnvironmentalRecord,
    CardioMetabolicRecord,
    RunningDynamics,
    WeightRecord,
    RollingVitalsAggregate,
    RollingScoresAggregate,
    RollingSleepAggregate,
} from './types'

// ── Minimal local state shape (avoids circular dependency with store.ts) ─────

interface HealthStoreState {
    vitals: VitalsRecord[]
    sleep: SleepRecord[]
    scores: DailyScores[]
    activities: ActivityRecord[]
    mobility: MobilityRecord[]
    environmental: EnvironmentalRecord[]
    cardioMetabolic: CardioMetabolicRecord[]
    runningDynamics: RunningDynamics[]
    weightHistory: WeightRecord[]
    selectedDate: string
}

// ── Provenance Helpers ───────────────────────────────────────────────────────

interface ProvenanceFields {
    sync_run_id?: number
    source_raw_sample_ids?: string
    algorithm_version?: string
    computed_at?: string
}

interface ProvenanceResult {
    provenanceSummary: string
    confidence: number
    algorithmVersion?: string
    lastUpdated: string
}

function deriveProvenance(record: ProvenanceFields | null | undefined): ProvenanceResult {
    if (!record) {
        return {
            provenanceSummary: 'no record available',
            confidence: 0,
            lastUpdated: new Date().toISOString(),
        }
    }
    const { sync_run_id, source_raw_sample_ids, algorithm_version, computed_at } = record
    const lastUpdated = computed_at || new Date().toISOString()

    if (source_raw_sample_ids) {
        let ids: number[] = []
        try {
            ids = JSON.parse(source_raw_sample_ids)
        } catch {
            ids = []
        }
        const idList = ids.slice(0, 3).join(', ') + (ids.length > 3 ? ', …' : '')
        return {
            provenanceSummary: `from raw_health_samples [${idList}] via sync_run #${sync_run_id}`,
            confidence: 95,
            algorithmVersion: algorithm_version,
            lastUpdated,
        }
    }

    if (sync_run_id != null) {
        return {
            provenanceSummary: `from sync_run #${sync_run_id}`,
            confidence: 80,
            algorithmVersion: algorithm_version,
            lastUpdated,
        }
    }

    return {
        provenanceSummary: 'legacy record — no provenance available',
        confidence: 50,
        algorithmVersion: algorithm_version,
        lastUpdated,
    }
}

// ── Date Helpers ─────────────────────────────────────────────────────────────

function getDateRange(days: number, endDate: string): { start: string; end: string } {
    const end = new Date(endDate + 'T00:00:00')
    const start = new Date(end)
    start.setDate(start.getDate() - (days - 1))
    return {
        start: start.toISOString().slice(0, 10),
        end: endDate,
    }
}

// ── View Model Factories ─────────────────────────────────────────────────────

function emptyViewModel<T>(
    scope: HealthMetricViewModel['scope'],
    domain: string,
    date: string,
    reason?: string,
    sourceKind: HealthMetricViewModel['sourceKind'] = 'normalized',
): HealthMetricViewModel<T> {
    return {
        value: null,
        displayValue: `No ${domain} data`,
        status: 'missing',
        scope,
        effectiveDate: date,
        sourceKind,
        confidence: 0,
        emptyStateReason: reason || `No ${domain} recorded for ${date}`,
        provenanceSummary: 'no record available',
        lastUpdated: new Date().toISOString(),
    }
}

function presentViewModel<T>(
    value: T,
    displayValue: string,
    scope: HealthMetricViewModel['scope'],
    effectiveDate: string,
    sourceKind: HealthMetricViewModel['sourceKind'],
    provenance: ProvenanceResult,
    dateWindow?: { start: string; end: string },
    inputCoverage?: { available: number; required: number },
): HealthMetricViewModel<T> {
    return {
        value,
        displayValue,
        status: 'present',
        scope,
        effectiveDate,
        dateWindow,
        sourceKind,
        confidence: provenance.confidence,
        emptyStateReason: null,
        provenanceSummary: provenance.provenanceSummary,
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage,
    }
}

// =============================================================================
// VITALS SELECTORS
// =============================================================================

export function selectVitalsForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<VitalsRecord | null> {
    const record = state.vitals.find(v => v.timestamp.startsWith(date)) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'vitals', date, `No vitals recorded for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const displayValue = `HRV ${record.hrv}ms · RHR ${record.rhr}bpm · SpO₂ ${record.spo2}%`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestVitals(
    state: HealthStoreState,
): HealthMetricViewModel<VitalsRecord | null> {
    const sorted = [...state.vitals].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'vitals', state.selectedDate, 'No vitals recorded yet')
    }
    const effectiveDate = record.timestamp.slice(0, 10)
    const provenance = deriveProvenance(record)
    const displayValue = `HRV ${record.hrv}ms · RHR ${record.rhr}bpm · SpO₂ ${record.spo2}%`
    return presentViewModel(record, displayValue, 'latest', effectiveDate, 'normalized', provenance)
}

export function selectRolling7dVitals(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<RollingVitalsAggregate | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.vitals.filter(v => {
        const d = v.timestamp.slice(0, 10)
        return d >= start && d <= end
    })

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'vitals',
            endDate,
            `No vitals recorded between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = new Set(dailyRecords.map(v => v.timestamp.slice(0, 10))).size
    const hrvVals = dailyRecords.filter(v => v.hrv > 0).map(v => v.hrv)
    const rhrVals = dailyRecords.filter(v => v.rhr > 0).map(v => v.rhr)
    const spo2Vals = dailyRecords.filter(v => v.spo2 > 0).map(v => v.spo2)

    const avgHrv = hrvVals.length > 0 ? Math.round((hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length) * 10) / 10 : null
    const avgRhr = rhrVals.length > 0 ? Math.round((rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length) * 10) / 10 : null
    const avgSpo2 = spo2Vals.length > 0 ? Math.round((spo2Vals.reduce((a, b) => a + b, 0) / spo2Vals.length) * 10) / 10 : null

    const status = daysWithData < 3 ? 'insufficient' as const : 'present' as const

    const aggregate: RollingVitalsAggregate = {
        avgHrv,
        avgRhr,
        avgSpo2,
        sampleCount: dailyRecords.length,
        daysWithData,
        dateRange: { start, end },
        dailyRecords,
    }

    const provenance = deriveProvenance(dailyRecords[0]) // use first record as representative
    const displayValue = `7d avg HRV ${avgHrv ?? '—'}ms · RHR ${avgRhr ?? '—'}bpm · SpO₂ ${avgSpo2 ?? '—'}%`

    return {
        value: aggregate,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have vitals data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

export function selectRolling30dVitals(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<RollingVitalsAggregate | null> {
    const { start, end } = getDateRange(30, endDate)
    const dailyRecords = state.vitals.filter(v => {
        const d = v.timestamp.slice(0, 10)
        return d >= start && d <= end
    })

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling30d',
            'vitals',
            endDate,
            `No vitals recorded between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = new Set(dailyRecords.map(v => v.timestamp.slice(0, 10))).size
    const hrvVals = dailyRecords.filter(v => v.hrv > 0).map(v => v.hrv)
    const rhrVals = dailyRecords.filter(v => v.rhr > 0).map(v => v.rhr)
    const spo2Vals = dailyRecords.filter(v => v.spo2 > 0).map(v => v.spo2)

    const avgHrv = hrvVals.length > 0 ? Math.round((hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length) * 10) / 10 : null
    const avgRhr = rhrVals.length > 0 ? Math.round((rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length) * 10) / 10 : null
    const avgSpo2 = spo2Vals.length > 0 ? Math.round((spo2Vals.reduce((a, b) => a + b, 0) / spo2Vals.length) * 10) / 10 : null

    const status = daysWithData < 5 ? 'insufficient' as const : 'present' as const

    const aggregate: RollingVitalsAggregate = {
        avgHrv,
        avgRhr,
        avgSpo2,
        sampleCount: dailyRecords.length,
        daysWithData,
        dateRange: { start, end },
        dailyRecords,
    }

    const provenance = deriveProvenance(dailyRecords[0])
    const displayValue = `30d avg HRV ${avgHrv ?? '—'}ms · RHR ${avgRhr ?? '—'}bpm · SpO₂ ${avgSpo2 ?? '—'}%`

    return {
        value: aggregate,
        displayValue,
        status,
        scope: 'rolling30d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 30 days have vitals data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/30 days`
            : provenance.provenanceSummary.replace('sync_run #', `30d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 30 },
    }
}

export function selectAllTimeVitalsRange(
    state: HealthStoreState,
): HealthMetricViewModel<{ min: VitalsRecord; max: VitalsRecord } | null> {
    const sorted = [...state.vitals].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    if (sorted.length === 0) {
        return emptyViewModel('allTime', 'vitals', state.selectedDate, 'No vitals data in store')
    }
    const value = { min: sorted[0], max: sorted[sorted.length - 1] }
    const provenance = deriveProvenance(sorted[sorted.length - 1])
    const displayValue = `Vitals from ${sorted[0].timestamp.slice(0, 10)} through ${sorted[sorted.length - 1].timestamp.slice(0, 10)}`
    return presentViewModel(
        value,
        displayValue,
        'allTime',
        value.max.timestamp.slice(0, 10),
        'derived',
        provenance,
    )
}

// =============================================================================
// SCORES SELECTORS
// =============================================================================

export function selectScoresForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<DailyScores | null> {
    const record = state.scores.find(s => s.date === date) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'scores', date, `No scores computed for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const displayValue = `Recovery ${record.recoveryScore} · Strain ${record.strainScore}`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestScores(
    state: HealthStoreState,
): HealthMetricViewModel<DailyScores | null> {
    const sorted = [...state.scores].sort((a, b) => b.date.localeCompare(a.date))
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'scores', state.selectedDate, 'No scores computed yet')
    }
    const provenance = deriveProvenance(record)
    const displayValue = `Recovery ${record.recoveryScore} · Strain ${record.strainScore}`
    return presentViewModel(record, displayValue, 'latest', record.date, 'normalized', provenance)
}

export function selectRolling7dScores(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<RollingScoresAggregate | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.scores.filter(s => s.date >= start && s.date <= end)

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'scores',
            endDate,
            `No scores computed between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = dailyRecords.length
    const recVals = dailyRecords.filter(s => s.recoveryScore > 0).map(s => s.recoveryScore)
    const strainVals = dailyRecords.filter(s => s.strainScore > 0).map(s => s.strainScore)
    const debtVals = dailyRecords.map(s => s.sleepDebtHours)

    const avgRecovery = recVals.length > 0 ? Math.round((recVals.reduce((a, b) => a + b, 0) / recVals.length) * 10) / 10 : null
    const avgStrain = strainVals.length > 0 ? Math.round((strainVals.reduce((a, b) => a + b, 0) / strainVals.length) * 10) / 10 : null
    const avgSleepDebt = debtVals.length > 0 ? Math.round((debtVals.reduce((a, b) => a + b, 0) / debtVals.length) * 10) / 10 : null

    const status = daysWithData < 3 ? 'insufficient' as const : 'present' as const

    const aggregate: RollingScoresAggregate = {
        avgRecovery,
        avgStrain,
        avgSleepDebt,
        sampleCount: dailyRecords.length,
        daysWithData,
        dateRange: { start, end },
        dailyRecords,
    }

    const provenance = deriveProvenance(dailyRecords[0])
    const displayValue = `7d avg Recovery ${avgRecovery ?? '—'} · Strain ${avgStrain ?? '—'}`

    return {
        value: aggregate,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have scores` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

export function selectRolling30dScores(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<RollingScoresAggregate | null> {
    const { start, end } = getDateRange(30, endDate)
    const dailyRecords = state.scores.filter(s => s.date >= start && s.date <= end)

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling30d',
            'scores',
            endDate,
            `No scores computed between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = dailyRecords.length
    const recVals = dailyRecords.filter(s => s.recoveryScore > 0).map(s => s.recoveryScore)
    const strainVals = dailyRecords.filter(s => s.strainScore > 0).map(s => s.strainScore)
    const debtVals = dailyRecords.map(s => s.sleepDebtHours)

    const avgRecovery = recVals.length > 0 ? Math.round((recVals.reduce((a, b) => a + b, 0) / recVals.length) * 10) / 10 : null
    const avgStrain = strainVals.length > 0 ? Math.round((strainVals.reduce((a, b) => a + b, 0) / strainVals.length) * 10) / 10 : null
    const avgSleepDebt = debtVals.length > 0 ? Math.round((debtVals.reduce((a, b) => a + b, 0) / debtVals.length) * 10) / 10 : null

    const status = daysWithData < 5 ? 'insufficient' as const : 'present' as const

    const aggregate: RollingScoresAggregate = {
        avgRecovery,
        avgStrain,
        avgSleepDebt,
        sampleCount: dailyRecords.length,
        daysWithData,
        dateRange: { start, end },
        dailyRecords,
    }

    const provenance = deriveProvenance(dailyRecords[0])
    const displayValue = `30d avg Recovery ${avgRecovery ?? '—'} · Strain ${avgStrain ?? '—'}`

    return {
        value: aggregate,
        displayValue,
        status,
        scope: 'rolling30d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 30 days have scores` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/30 days`
            : provenance.provenanceSummary.replace('sync_run #', `30d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 30 },
    }
}

export function selectAllTimeScoresRange(
    state: HealthStoreState,
): HealthMetricViewModel<{ min: DailyScores; max: DailyScores } | null> {
    const sorted = [...state.scores].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length === 0) {
        return emptyViewModel('allTime', 'scores', state.selectedDate, 'No scores data in store')
    }
    const value = { min: sorted[0], max: sorted[sorted.length - 1] }
    const provenance = deriveProvenance(sorted[sorted.length - 1])
    const displayValue = `Scores from ${sorted[0].date} through ${sorted[sorted.length - 1].date}`
    return presentViewModel(value, displayValue, 'allTime', value.max.date, 'derived', provenance)
}

// =============================================================================
// SLEEP SELECTORS
// =============================================================================

export function selectSleepForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<SleepRecord | null> {
    const record = state.sleep.find(s => s.date === date) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'sleep', date, `No sleep recorded for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const hours = Math.floor(record.totalDurationMins / 60)
    const mins = record.totalDurationMins % 60
    const displayValue = `${hours}h ${mins}m sleep`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestSleep(
    state: HealthStoreState,
): HealthMetricViewModel<SleepRecord | null> {
    const sorted = [...state.sleep].sort((a, b) => b.date.localeCompare(a.date))
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'sleep', state.selectedDate, 'No sleep recorded yet')
    }
    const provenance = deriveProvenance(record)
    const hours = Math.floor(record.totalDurationMins / 60)
    const mins = record.totalDurationMins % 60
    const displayValue = `${hours}h ${mins}m sleep`
    return presentViewModel(record, displayValue, 'latest', record.date, 'normalized', provenance)
}

export function selectRolling7dSleep(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<RollingSleepAggregate | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.sleep.filter(s => s.date >= start && s.date <= end)

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'sleep',
            endDate,
            `No sleep recorded between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = dailyRecords.length
    const durationVals = dailyRecords.map(s => s.totalDurationMins)
    const remVals = dailyRecords.map(s => s.remMins)
    const deepVals = dailyRecords.map(s => s.deepMins)
    const efficiencyVals = dailyRecords
        .filter(s => s.totalDurationMins > 0)
        .map(s => ((s.totalDurationMins - s.awakeMins) / s.totalDurationMins) * 100)

    const avgDurationMins = durationVals.length > 0 ? Math.round(durationVals.reduce((a, b) => a + b, 0) / durationVals.length) : null
    const avgRemMins = remVals.length > 0 ? Math.round(remVals.reduce((a, b) => a + b, 0) / remVals.length) : null
    const avgDeepMins = deepVals.length > 0 ? Math.round(deepVals.reduce((a, b) => a + b, 0) / deepVals.length) : null
    const avgEfficiency = efficiencyVals.length > 0 ? Math.round((efficiencyVals.reduce((a, b) => a + b, 0) / efficiencyVals.length) * 10) / 10 : null

    const status = daysWithData < 3 ? 'insufficient' as const : 'present' as const

    const aggregate: RollingSleepAggregate = {
        avgDurationMins,
        avgRemMins,
        avgDeepMins,
        avgEfficiency,
        sampleCount: dailyRecords.length,
        daysWithData,
        dateRange: { start, end },
        dailyRecords,
    }

    const provenance = deriveProvenance(dailyRecords[0])
    const avgHours = avgDurationMins !== null ? Math.floor(avgDurationMins / 60) : '—'
    const avgMinsDisplay = avgDurationMins !== null ? avgDurationMins % 60 : '—'
    const displayValue = `7d avg ${avgHours}h ${avgMinsDisplay}m sleep`

    return {
        value: aggregate,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have sleep data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

export function selectRolling30dSleep(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<RollingSleepAggregate | null> {
    const { start, end } = getDateRange(30, endDate)
    const dailyRecords = state.sleep.filter(s => s.date >= start && s.date <= end)

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling30d',
            'sleep',
            endDate,
            `No sleep recorded between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = dailyRecords.length
    const durationVals = dailyRecords.map(s => s.totalDurationMins)
    const remVals = dailyRecords.map(s => s.remMins)
    const deepVals = dailyRecords.map(s => s.deepMins)
    const efficiencyVals = dailyRecords
        .filter(s => s.totalDurationMins > 0)
        .map(s => ((s.totalDurationMins - s.awakeMins) / s.totalDurationMins) * 100)

    const avgDurationMins = durationVals.length > 0 ? Math.round(durationVals.reduce((a, b) => a + b, 0) / durationVals.length) : null
    const avgRemMins = remVals.length > 0 ? Math.round(remVals.reduce((a, b) => a + b, 0) / remVals.length) : null
    const avgDeepMins = deepVals.length > 0 ? Math.round(deepVals.reduce((a, b) => a + b, 0) / deepVals.length) : null
    const avgEfficiency = efficiencyVals.length > 0 ? Math.round((efficiencyVals.reduce((a, b) => a + b, 0) / efficiencyVals.length) * 10) / 10 : null

    const status = daysWithData < 5 ? 'insufficient' as const : 'present' as const

    const aggregate: RollingSleepAggregate = {
        avgDurationMins,
        avgRemMins,
        avgDeepMins,
        avgEfficiency,
        sampleCount: dailyRecords.length,
        daysWithData,
        dateRange: { start, end },
        dailyRecords,
    }

    const provenance = deriveProvenance(dailyRecords[0])
    const avgHours = avgDurationMins !== null ? Math.floor(avgDurationMins / 60) : '—'
    const avgMinsDisplay = avgDurationMins !== null ? avgDurationMins % 60 : '—'
    const displayValue = `30d avg ${avgHours}h ${avgMinsDisplay}m sleep`

    return {
        value: aggregate,
        displayValue,
        status,
        scope: 'rolling30d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 30 days have sleep data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/30 days`
            : provenance.provenanceSummary.replace('sync_run #', `30d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 30 },
    }
}

export function selectAllTimeSleepRange(
    state: HealthStoreState,
): HealthMetricViewModel<{ min: SleepRecord; max: SleepRecord } | null> {
    const sorted = [...state.sleep].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length === 0) {
        return emptyViewModel('allTime', 'sleep', state.selectedDate, 'No sleep data in store')
    }
    const value = { min: sorted[0], max: sorted[sorted.length - 1] }
    const provenance = deriveProvenance(sorted[sorted.length - 1])
    const displayValue = `Sleep from ${sorted[0].date} through ${sorted[sorted.length - 1].date}`
    return presentViewModel(value, displayValue, 'allTime', value.max.date, 'derived', provenance)
}

// =============================================================================
// ACTIVITY SELECTORS
// =============================================================================

export function selectActivitiesForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<ActivityRecord[]> {
    const records = state.activities.filter(a => a.timestamp.startsWith(date))

    if (records.length === 0) {
        return emptyViewModel(
            'selectedDate',
            'activities',
            date,
            `No activities recorded for ${date}`,
        ) as HealthMetricViewModel<ActivityRecord[]>
    }

    // Use the first activity's provenance as representative
    const provenance = deriveProvenance(records[0])
    const displayValue = records.length === 1
        ? `1 activity — ${records[0].workoutType}`
        : `${records.length} activities`

    return presentViewModel(records, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestActivities(
    state: HealthStoreState,
): HealthMetricViewModel<ActivityRecord[]> {
    const sorted = [...state.activities].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )

    if (sorted.length === 0) {
        return emptyViewModel(
            'latest',
            'activities',
            state.selectedDate,
            'No activities recorded yet',
        ) as HealthMetricViewModel<ActivityRecord[]>
    }

    // Get the most recent date that has activities
    const latestDate = sorted[0].timestamp.slice(0, 10)
    const records = sorted.filter(a => a.timestamp.startsWith(latestDate))
    const provenance = deriveProvenance(records[0])
    const displayValue = records.length === 1
        ? `1 activity — ${records[0].workoutType}`
        : `${records.length} activities`

    return presentViewModel(records, displayValue, 'latest', latestDate, 'normalized', provenance)
}

export function selectRolling7dActivities(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<ActivityRecord[]> {
    const { start, end } = getDateRange(7, endDate)
    const records = state.activities.filter(a => {
        const d = a.timestamp.slice(0, 10)
        return d >= start && d <= end
    })

    if (records.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'activities',
            endDate,
            `No activities recorded between ${start} and ${end}`,
            'derived',
        ) as HealthMetricViewModel<ActivityRecord[]>
    }

    const daysWithData = new Set(records.map(a => a.timestamp.slice(0, 10))).size
    const provenance = deriveProvenance(records[0])
    const displayValue = `${records.length} activities over ${daysWithData} days`

    return {
        value: records,
        displayValue,
        status: 'present',
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: 75,
        emptyStateReason: null,
        provenanceSummary: provenance.provenanceSummary.replace('sync_run #', `7d activities via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

export function selectRolling30dActivities(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<ActivityRecord[]> {
    const { start, end } = getDateRange(30, endDate)
    const records = state.activities.filter(a => {
        const d = a.timestamp.slice(0, 10)
        return d >= start && d <= end
    })

    if (records.length === 0) {
        return emptyViewModel(
            'rolling30d',
            'activities',
            endDate,
            `No activities recorded between ${start} and ${end}`,
            'derived',
        ) as HealthMetricViewModel<ActivityRecord[]>
    }

    const daysWithData = new Set(records.map(a => a.timestamp.slice(0, 10))).size
    const provenance = deriveProvenance(records[0])
    const displayValue = `${records.length} activities over ${daysWithData} days`

    return {
        value: records,
        displayValue,
        status: 'present',
        scope: 'rolling30d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: 75,
        emptyStateReason: null,
        provenanceSummary: provenance.provenanceSummary.replace('sync_run #', `30d activities via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 30 },
    }
}

export function selectAllTimeActivities(
    state: HealthStoreState,
): HealthMetricViewModel<ActivityRecord[]> {
    if (state.activities.length === 0) {
        return emptyViewModel(
            'allTime',
            'activities',
            state.selectedDate,
            'No activities recorded in store',
            'derived',
        ) as HealthMetricViewModel<ActivityRecord[]>
    }

    const provenance = deriveProvenance(state.activities[0])
    const displayValue = `${state.activities.length} activities total`

    return presentViewModel(
        state.activities,
        displayValue,
        'allTime',
        state.selectedDate,
        'derived',
        provenance,
    )
}

// =============================================================================
// MOBILITY SELECTORS
// =============================================================================

export function selectMobilityForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<MobilityRecord | null> {
    const record = state.mobility.find(m => m.date === date) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'mobility', date, `No mobility recorded for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const displayValue = `${record.steps.toLocaleString()} steps · ${record.walkingSpeed} m/s`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestMobility(
    state: HealthStoreState,
): HealthMetricViewModel<MobilityRecord | null> {
    const sorted = [...state.mobility].sort((a, b) => b.date.localeCompare(a.date))
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'mobility', state.selectedDate, 'No mobility recorded yet')
    }
    const provenance = deriveProvenance(record)
    const displayValue = `${record.steps.toLocaleString()} steps · ${record.walkingSpeed} m/s`
    return presentViewModel(record, displayValue, 'latest', record.date, 'normalized', provenance)
}

export function selectRolling7dMobility(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<{ avgSteps: number; avgWalkingSpeed: number; daysWithData: number; dailyRecords: MobilityRecord[] } | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.mobility.filter(m => m.date >= start && m.date <= end)

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'mobility',
            endDate,
            `No mobility recorded between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = dailyRecords.length
    const avgSteps = Math.round(dailyRecords.reduce((a, m) => a + m.steps, 0) / daysWithData)
    const avgWalkingSpeed = Math.round((dailyRecords.reduce((a, m) => a + m.walkingSpeed, 0) / daysWithData) * 100) / 100

    const status = daysWithData < 3 ? 'insufficient' as const : 'present' as const
    const provenance = deriveProvenance(dailyRecords[0])
    const value = { avgSteps, avgWalkingSpeed, daysWithData, dailyRecords }
    const displayValue = `7d avg ${avgSteps.toLocaleString()} steps · ${avgWalkingSpeed} m/s`

    return {
        value,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have mobility data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

// =============================================================================
// ENVIRONMENTAL SELECTORS
// =============================================================================

export function selectEnvironmentalForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<EnvironmentalRecord | null> {
    const record = state.environmental.find(e => e.date === date) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'environmental', date, `No environmental data for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const displayValue = `${record.timeInDaylight}min daylight · ${record.exerciseMinutes}min exercise`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestEnvironmental(
    state: HealthStoreState,
): HealthMetricViewModel<EnvironmentalRecord | null> {
    const sorted = [...state.environmental].sort((a, b) => b.date.localeCompare(a.date))
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'environmental', state.selectedDate, 'No environmental data recorded yet')
    }
    const provenance = deriveProvenance(record)
    const displayValue = `${record.timeInDaylight}min daylight · ${record.exerciseMinutes}min exercise`
    return presentViewModel(record, displayValue, 'latest', record.date, 'normalized', provenance)
}

export function selectRolling7dEnvironmental(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<{ avgDaylight: number; avgExercise: number; avgStandHours: number; daysWithData: number; dailyRecords: EnvironmentalRecord[] } | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.environmental.filter(e => e.date >= start && e.date <= end)

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'environmental',
            endDate,
            `No environmental data between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = dailyRecords.length
    const avgDaylight = Math.round(dailyRecords.reduce((a, e) => a + e.timeInDaylight, 0) / daysWithData)
    const avgExercise = Math.round(dailyRecords.reduce((a, e) => a + e.exerciseMinutes, 0) / daysWithData)
    const avgStandHours = Math.round(dailyRecords.reduce((a, e) => a + e.standHours, 0) / daysWithData)

    const status = daysWithData < 3 ? 'insufficient' as const : 'present' as const
    const provenance = deriveProvenance(dailyRecords[0])
    const value = { avgDaylight, avgExercise, avgStandHours, daysWithData, dailyRecords }
    const displayValue = `7d avg ${avgDaylight}min daylight · ${avgExercise}min exercise`

    return {
        value,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have environmental data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

// =============================================================================
// CARDIO METABOLIC SELECTORS
// =============================================================================

export function selectCardioMetabolicForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<CardioMetabolicRecord | null> {
    const record = state.cardioMetabolic.find(c => c.date === date) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'cardiometabolic', date, `No cardiometabolic data for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const displayValue = `VO₂ max ${record.vo2Max} · HR recovery ${record.hrRecovery ?? '—'} bpm`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestCardioMetabolic(
    state: HealthStoreState,
): HealthMetricViewModel<CardioMetabolicRecord | null> {
    const sorted = [...state.cardioMetabolic].sort((a, b) => b.date.localeCompare(a.date))
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'cardiometabolic', state.selectedDate, 'No cardiometabolic data recorded yet')
    }
    const provenance = deriveProvenance(record)
    const displayValue = `VO₂ max ${record.vo2Max} · HR recovery ${record.hrRecovery ?? '—'} bpm`
    return presentViewModel(record, displayValue, 'latest', record.date, 'normalized', provenance)
}

export function selectRolling7dCardioMetabolic(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<{ avgVo2Max: number | null; avgHRRecovery: number | null; daysWithData: number; dailyRecords: CardioMetabolicRecord[] } | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.cardioMetabolic.filter(c => c.date >= start && c.date <= end)

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'cardiometabolic',
            endDate,
            `No cardiometabolic data between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = dailyRecords.length
    const vo2Vals = dailyRecords.filter(c => c.vo2Max > 0).map(c => c.vo2Max)
    const hrRecoveryVals = dailyRecords.filter(c => (c.hrRecovery ?? 0) > 0).map(c => c.hrRecovery!)

    const avgVo2Max = vo2Vals.length > 0 ? Math.round((vo2Vals.reduce((a, b) => a + b, 0) / vo2Vals.length) * 10) / 10 : null
    const avgHRRecovery = hrRecoveryVals.length > 0 ? Math.round((hrRecoveryVals.reduce((a, b) => a + b, 0) / hrRecoveryVals.length) * 10) / 10 : null

    const status = daysWithData < 3 ? 'insufficient' as const : 'present' as const
    const provenance = deriveProvenance(dailyRecords[0])
    const value = { avgVo2Max, avgHRRecovery, daysWithData, dailyRecords }
    const displayValue = `7d avg VO₂ max ${avgVo2Max ?? '—'} · HR recovery ${avgHRRecovery ?? '—'} bpm`

    return {
        value,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have cardiometabolic data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

// =============================================================================
// RUNNING DYNAMICS SELECTORS
// =============================================================================

export function selectRunningDynamicsForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<RunningDynamics | null> {
    const record = state.runningDynamics.find(r => r.timestamp.startsWith(date)) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'running dynamics', date, `No running dynamics for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const displayValue = `Power ${record.runningPower}W · GCT ${record.groundContactTime}ms`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestRunningDynamics(
    state: HealthStoreState,
): HealthMetricViewModel<RunningDynamics | null> {
    const sorted = [...state.runningDynamics].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'running dynamics', state.selectedDate, 'No running dynamics recorded yet')
    }
    const provenance = deriveProvenance(record)
    const effectiveDate = record.timestamp.slice(0, 10)
    const displayValue = `Power ${record.runningPower}W · GCT ${record.groundContactTime}ms`
    return presentViewModel(record, displayValue, 'latest', effectiveDate, 'normalized', provenance)
}

export function selectRolling7dRunningDynamics(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<{ avgPower: number | null; avgGCT: number | null; avgStrideLength: number | null; daysWithData: number; dailyRecords: RunningDynamics[] } | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.runningDynamics.filter(r => {
        const d = r.timestamp.slice(0, 10)
        return d >= start && d <= end
    })

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'running dynamics',
            endDate,
            `No running dynamics between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = new Set(dailyRecords.map(r => r.timestamp.slice(0, 10))).size
    const powerVals = dailyRecords.filter(r => r.runningPower > 0).map(r => r.runningPower)
    const gctVals = dailyRecords.filter(r => r.groundContactTime > 0).map(r => r.groundContactTime)
    const strideVals = dailyRecords.filter(r => r.strideLength > 0).map(r => r.strideLength)

    const avgPower = powerVals.length > 0 ? Math.round((powerVals.reduce((a, b) => a + b, 0) / powerVals.length) * 10) / 10 : null
    const avgGCT = gctVals.length > 0 ? Math.round((gctVals.reduce((a, b) => a + b, 0) / gctVals.length) * 10) / 10 : null
    const avgStrideLength = strideVals.length > 0 ? Math.round((strideVals.reduce((a, b) => a + b, 0) / strideVals.length) * 100) / 100 : null

    const status = daysWithData < 2 ? 'insufficient' as const : 'present' as const
    const provenance = deriveProvenance(dailyRecords[0])
    const value = { avgPower, avgGCT, avgStrideLength, daysWithData, dailyRecords }
    const displayValue = `7d avg Power ${avgPower ?? '—'}W · GCT ${avgGCT ?? '—'}ms`

    return {
        value,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have running dynamics` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

// =============================================================================
// WEIGHT SELECTORS
// =============================================================================

export function selectWeightForDate(
    state: HealthStoreState,
    date: string,
): HealthMetricViewModel<WeightRecord | null> {
    const record = state.weightHistory.find(w => w.timestamp.startsWith(date)) ?? null
    if (!record) {
        return emptyViewModel('selectedDate', 'weight', date, `No weight recorded for ${date}`)
    }
    const provenance = deriveProvenance(record)
    const displayValue = `${record.weightKg}kg${record.leanBodyMassPercent != null ? ` · ${record.leanBodyMassPercent}% lean` : ''}`
    return presentViewModel(record, displayValue, 'selectedDate', date, 'normalized', provenance)
}

export function selectLatestWeight(
    state: HealthStoreState,
): HealthMetricViewModel<WeightRecord | null> {
    const sorted = [...state.weightHistory].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    const record = sorted[0] ?? null
    if (!record) {
        return emptyViewModel('latest', 'weight', state.selectedDate, 'No weight recorded yet')
    }
    const provenance = deriveProvenance(record)
    const effectiveDate = record.timestamp.slice(0, 10)
    const displayValue = `${record.weightKg}kg${record.leanBodyMassPercent != null ? ` · ${record.leanBodyMassPercent}% lean` : ''}`
    return presentViewModel(record, displayValue, 'latest', effectiveDate, 'normalized', provenance)
}

export function selectRolling7dWeight(
    state: HealthStoreState,
    endDate: string,
): HealthMetricViewModel<{ avgWeightKg: number; daysWithData: number; dailyRecords: WeightRecord[] } | null> {
    const { start, end } = getDateRange(7, endDate)
    const dailyRecords = state.weightHistory.filter(w => {
        const d = w.timestamp.slice(0, 10)
        return d >= start && d <= end
    })

    if (dailyRecords.length === 0) {
        return emptyViewModel(
            'rolling7d',
            'weight',
            endDate,
            `No weight recorded between ${start} and ${end}`,
            'derived',
        )
    }

    const daysWithData = new Set(dailyRecords.map(w => w.timestamp.slice(0, 10))).size
    const avgWeightKg = Math.round((dailyRecords.reduce((a, w) => a + w.weightKg, 0) / dailyRecords.length) * 10) / 10

    const status = daysWithData < 2 ? 'insufficient' as const : 'present' as const
    const provenance = deriveProvenance(dailyRecords[0])
    const value = { avgWeightKg, daysWithData, dailyRecords }
    const displayValue = `7d avg ${avgWeightKg}kg`

    return {
        value,
        displayValue,
        status,
        scope: 'rolling7d',
        effectiveDate: endDate,
        dateWindow: { start, end },
        sourceKind: 'derived',
        confidence: status === 'insufficient' ? 50 : 75,
        emptyStateReason: status === 'insufficient' ? `Only ${daysWithData} of 7 days have weight data` : null,
        provenanceSummary: status === 'insufficient'
            ? `insufficient data: ${daysWithData}/7 days`
            : provenance.provenanceSummary.replace('sync_run #', `7d avg via sync_run #`),
        lastUpdated: provenance.lastUpdated,
        algorithmVersion: provenance.algorithmVersion,
        inputCoverage: { available: daysWithData, required: 7 },
    }
}

// =============================================================================
// DERIVED METRIC SELECTORS (biological age, pace of aging, recovery, sleep debt, etc.)
// These select from the pre-computed DailyScores, respecting scope.
// =============================================================================

// ── Biological Age ────────────────────────────────────────────────────────────

export function selectBiologicalAgeForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<{ displayAge: number; rawAge: number; confidence: number; primaryDriver: string }> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'biologicalAge', date, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    if (s.bioAgeConfidence === 0) {
        return emptyViewModel('selectedDate', 'biologicalAge', date, 'Insufficient biomarkers to compute biological age')
    }
    return presentViewModel(
        { displayAge: s.displayAge, rawAge: s.rawAge, confidence: s.bioAgeConfidence, primaryDriver: s.bioAgePrimaryDriver },
        `${s.displayAge}y`,
        'selectedDate',
        date,
        'derived',
        deriveProvenance(s),
    )
}

export function selectLatestBiologicalAge(
    state: HealthStoreState,
): HealthMetricViewModel<{ displayAge: number; rawAge: number; confidence: number; primaryDriver: string }> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'biologicalAge', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    if (s.bioAgeConfidence === 0) {
        return emptyViewModel('latest', 'biologicalAge', state.selectedDate, 'Insufficient biomarkers to compute biological age')
    }
    return presentViewModel(
        { displayAge: s.displayAge, rawAge: s.rawAge, confidence: s.bioAgeConfidence, primaryDriver: s.bioAgePrimaryDriver },
        `${s.displayAge}y`,
        'latest',
        s.date,
        'derived',
        deriveProvenance(s),
    )
}

// ── Pace of Aging ─────────────────────────────────────────────────────────────

export function selectPaceOfAgingForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<number> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'paceOfAging', date, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    if (s.bioAgeConfidence === 0) {
        return emptyViewModel('selectedDate', 'paceOfAging', date, 'Insufficient biomarkers to compute pace of aging')
    }
    return presentViewModel(s.paceOfAging, `${s.paceOfAging}×`, 'selectedDate', date, 'derived', deriveProvenance(s))
}

export function selectLatestPaceOfAging(
    state: HealthStoreState,
): HealthMetricViewModel<number> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'paceOfAging', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    if (s.bioAgeConfidence === 0) {
        return emptyViewModel('latest', 'paceOfAging', state.selectedDate, 'Insufficient biomarkers to compute pace of aging')
    }
    return presentViewModel(s.paceOfAging, `${s.paceOfAging}×`, 'latest', s.date, 'derived', deriveProvenance(s))
}

// ── Recovery Score ────────────────────────────────────────────────────────────

export function selectRecoveryScoreForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<{ score: number; zone: string; hrvZScore: number; rhrZScore: number }> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'recoveryScore', date, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    return presentViewModel(
        { score: s.recoveryScore, zone: s.recoveryZone, hrvZScore: s.hrvZScore, rhrZScore: s.rhrZScore },
        `${s.recoveryScore}`,
        'selectedDate',
        date,
        'derived',
        deriveProvenance(s),
    )
}

export function selectLatestRecoveryScore(
    state: HealthStoreState,
): HealthMetricViewModel<{ score: number; zone: string; hrvZScore: number; rhrZScore: number }> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'recoveryScore', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    return presentViewModel(
        { score: s.recoveryScore, zone: s.recoveryZone, hrvZScore: s.hrvZScore, rhrZScore: s.rhrZScore },
        `${s.recoveryScore}`,
        'latest',
        s.date,
        'derived',
        deriveProvenance(s),
    )
}

// ── HRV Z-Score ───────────────────────────────────────────────────────────────

export function selectHRVZScoreForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<number> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'hrvZScore', date, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.hrvZScore, `${scores.value!.hrvZScore}`, 'selectedDate', date, 'derived', deriveProvenance(scores.value!))
}

export function selectLatestHRVZScore(
    state: HealthStoreState,
): HealthMetricViewModel<number> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'hrvZScore', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.hrvZScore, `${scores.value!.hrvZScore}`, 'latest', scores.value!.date, 'derived', deriveProvenance(scores.value!))
}

// ── RHR Z-Score ───────────────────────────────────────────────────────────────

export function selectRHRZScoreForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<number> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'rhrZScore', date, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.rhrZScore, `${scores.value!.rhrZScore}`, 'selectedDate', date, 'derived', deriveProvenance(scores.value!))
}

export function selectLatestRHRZScore(
    state: HealthStoreState,
): HealthMetricViewModel<number> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'rhrZScore', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.rhrZScore, `${scores.value!.rhrZScore}`, 'latest', scores.value!.date, 'derived', deriveProvenance(scores.value!))
}

// ── Strain Score ──────────────────────────────────────────────────────────────

export function selectStrainScoreForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<number> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'strainScore', date, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.strainScore, `${scores.value!.strainScore}`, 'selectedDate', date, 'derived', deriveProvenance(scores.value!))
}

export function selectLatestStrainScore(
    state: HealthStoreState,
): HealthMetricViewModel<number> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'strainScore', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.strainScore, `${scores.value!.strainScore}`, 'latest', scores.value!.date, 'derived', deriveProvenance(scores.value!))
}

// ── Sleep Debt ────────────────────────────────────────────────────────────────

export function selectSleepDebtForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<{ debtHours: number; needHours: number }> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'sleepDebt', date, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    return presentViewModel(
        { debtHours: s.sleepDebtHours, needHours: s.sleepNeedHours },
        `${s.sleepDebtHours}h`,
        'selectedDate',
        date,
        'derived',
        deriveProvenance(s),
    )
}

export function selectLatestSleepDebt(
    state: HealthStoreState,
): HealthMetricViewModel<{ debtHours: number; needHours: number }> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'sleepDebt', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    const s = scores.value!
    return presentViewModel(
        { debtHours: s.sleepDebtHours, needHours: s.sleepNeedHours },
        `${s.sleepDebtHours}h`,
        'latest',
        s.date,
        'derived',
        deriveProvenance(s),
    )
}

// ── Sleep Need ────────────────────────────────────────────────────────────────

export function selectSleepNeedForDate(
    state: HealthStoreState,
    date: string = state.selectedDate,
): HealthMetricViewModel<number> {
    const scores = selectScoresForDate(state, date)
    if (scores.status === 'missing') {
        return emptyViewModel('selectedDate', 'sleepNeed', date, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.sleepNeedHours, `${scores.value!.sleepNeedHours}h`, 'selectedDate', date, 'derived', deriveProvenance(scores.value!))
}

export function selectLatestSleepNeed(
    state: HealthStoreState,
): HealthMetricViewModel<number> {
    const scores = selectLatestScores(state)
    if (scores.status === 'missing') {
        return emptyViewModel('latest', 'sleepNeed', state.selectedDate, scores.emptyStateReason ?? undefined)
    }
    return presentViewModel(scores.value!.sleepNeedHours, `${scores.value!.sleepNeedHours}h`, 'latest', scores.value!.date, 'derived', deriveProvenance(scores.value!))
}

// ── Rolling aggregates for derived scores ─────────────────────────────────────

export function selectRolling7dStrainScores(
    state: HealthStoreState,
    endDate: string = state.selectedDate,
): HealthMetricViewModel<{ avgScore: number; maxScore: number; daysWithData: number }> {
    const scores = selectRolling7dScores(state, endDate)
    if (scores.status === 'missing') {
        return emptyViewModel('rolling7d', 'strainScore', endDate, scores.emptyStateReason ?? undefined)
    }
    const aggregate = scores.value!
    const vals = aggregate.dailyRecords
    const avg = vals.reduce((sum, s) => sum + s.strainScore, 0) / vals.length
    const max = vals.reduce((m, s) => Math.max(m, s.strainScore), 0)
    return presentViewModel(
        { avgScore: Math.round(avg * 10) / 10, maxScore: max, daysWithData: vals.length },
        `7d avg ${Math.round(avg * 10) / 10}`,
        'rolling7d',
        endDate,
        'derived',
        deriveProvenance(vals[vals.length - 1]),
    )
}

export function selectRolling7dRecoveryScores(
    state: HealthStoreState,
    endDate: string = state.selectedDate,
): HealthMetricViewModel<{ avgScore: number; minScore: number; daysWithData: number }> {
    const scores = selectRolling7dScores(state, endDate)
    if (scores.status === 'missing') {
        return emptyViewModel('rolling7d', 'recoveryScore', endDate, scores.emptyStateReason ?? undefined)
    }
    const aggregate = scores.value!
    const vals = aggregate.dailyRecords
    const avg = vals.reduce((sum, s) => sum + s.recoveryScore, 0) / vals.length
    const min = vals.reduce((m, s) => Math.min(m, s.recoveryScore), Infinity)
    return presentViewModel(
        { avgScore: Math.round(avg * 10) / 10, minScore: min, daysWithData: vals.length },
        `7d avg ${Math.round(avg * 10) / 10}`,
        'rolling7d',
        endDate,
        'derived',
        deriveProvenance(vals[vals.length - 1]),
    )
}

export function selectRolling7dSleepDebt(
    state: HealthStoreState,
    endDate: string = state.selectedDate,
): HealthMetricViewModel<{ avgDebtHours: number; totalDebtHours: number; daysWithData: number }> {
    const scores = selectRolling7dScores(state, endDate)
    if (scores.status === 'missing') {
        return emptyViewModel('rolling7d', 'sleepDebt', endDate, scores.emptyStateReason ?? undefined)
    }
    const aggregate = scores.value!
    const vals = aggregate.dailyRecords
    const totalDebt = vals.reduce((sum, s) => sum + s.sleepDebtHours, 0)
    const avgDebt = totalDebt / vals.length
    return presentViewModel(
        { avgDebtHours: Math.round(avgDebt * 10) / 10, totalDebtHours: Math.round(totalDebt * 10) / 10, daysWithData: vals.length },
        `${Math.round(avgDebt * 10) / 10}h`,
        'rolling7d',
        endDate,
        'derived',
        deriveProvenance(vals[vals.length - 1]),
    )
}
