// ── Phase H: Data Quality Inspector ───────────────────────────────────────────
// Read-only query functions for forensic inspection of the health data pipeline.
// Answers "why am I seeing this?" for any visible metric by tracing provenance,
// identifying orphans/duplicates, and summarizing data quality across all tables.

import { getAll, getOne } from '../db'
import type {
    RawHealthSample,
    SyncRun,
    VitalsRecord,
    SleepRecord,
    DailyScores,
    ActivityRecord,
    MobilityRecord,
    EnvironmentalRecord,
    CardioMetabolicRecord,
    RunningDynamics,
    WeightRecord,
    DerivedOutput,
} from '../types'

// ── Raw Samples ──────────────────────────────────────────────────────────────

/** Get all raw health samples for a given local_day_key date. */
export async function getRawSamplesForDate(date: string): Promise<RawHealthSample[]> {
    return getAll<RawHealthSample>(
        `SELECT * FROM raw_health_samples WHERE local_day_key = ? ORDER BY start_time ASC`,
        [date]
    )
}

// ── Normalized Records ───────────────────────────────────────────────────────

/** Get all normalized records across every domain table for a given date. */
export async function getNormalizedRecordsForDate(date: string): Promise<{
    vitals: VitalsRecord | null
    sleep: SleepRecord | null
    scores: DailyScores | null
    activities: ActivityRecord[]
    mobility: MobilityRecord | null
    environmental: EnvironmentalRecord | null
    cardioMetabolic: CardioMetabolicRecord | null
    runningDynamics: RunningDynamics | null
    weight: WeightRecord | null
}> {
    const [
        vitalsRaw,
        sleepRaw,
        scoresRaw,
        activitiesRaw,
        mobilityRaw,
        environmentalRaw,
        cardioMetabolicRaw,
        runningDynamicsRaw,
        weightRaw,
    ] = await Promise.all([
        // Vitals: timestamp-based, take the latest for the date
        getAll<any>(
            `SELECT id, timestamp, hrv, rhr, spo2, respiratory_rate AS respiratoryRate,
              skin_temp_delta AS skinTempDelta, sync_run_id, source_raw_sample_ids,
              algorithm_version, computed_at
       FROM vitals WHERE date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1`,
            [date]
        ),
        // Sleep: date-based
        getAll<any>(
            `SELECT id, date, total_duration_mins AS totalDurationMins, rem_mins AS remMins,
              deep_mins AS deepMins, core_mins AS coreMins, awake_mins AS awakeMins,
              sleep_need_hours AS sleepNeedHours, sleep_debt_hours AS sleepDebtHours,
              bedtime_start AS bedtimeStart, wake_time_end AS wakeTimeEnd,
              sync_run_id, source_raw_sample_ids, algorithm_version, computed_at
       FROM sleep WHERE date = ? LIMIT 1`,
            [date]
        ),
        // Daily Scores: date-based (note: no id needed for DailyScores as date is the key)
        getAll<any>(
            `SELECT date, recovery_score AS recoveryScore, strain_score AS strainScore,
              sleep_debt_hours AS sleepDebtHours, sleep_need_hours AS sleepNeedHours,
              hrv_z_score AS hrvZScore, rhr_z_score AS rhrZScore,
              recovery_zone AS recoveryZone, biological_age AS biologicalAge,
              pace_of_aging AS paceOfAging, immunity_risk AS immunityRisk,
              bio_age_confidence AS bioAgeConfidence,
              bio_age_inputs_used AS bioAgeInputsUsed,
              bio_age_inputs_missing AS bioAgeInputsMissing,
              bio_age_primary_driver AS bioAgePrimaryDriver,
              sync_run_id, source_raw_sample_ids, algorithm_version, computed_at
       FROM daily_scores WHERE date = ? LIMIT 1`,
            [date]
        ),
        // Activities: timestamp-based
        getAll<any>(
            `SELECT id, timestamp, active_calories AS activeCalories,
              workout_type AS workoutType, duration_mins AS durationMins,
              hr_zones AS hrZones, max_hr AS maxHR, strain_score AS strainScore,
              avg_hr AS avgHR, source, sync_run_id, source_raw_sample_ids,
              algorithm_version, computed_at
       FROM activity WHERE date(timestamp) = ? ORDER BY timestamp ASC`,
            [date]
        ),
        // Mobility: date-based
        getAll<any>(
            `SELECT id, date, steps, walking_speed AS walkingSpeed,
              walking_step_length AS walkingStepLength,
              walking_asymmetry AS walkingAsymmetry,
              double_support AS doubleSupport,
              stair_speed_up AS stairSpeedUp,
              stair_speed_down AS stairSpeedDown,
              flights_climbed AS flightsClimbed,
              sync_run_id, source_raw_sample_ids, algorithm_version, computed_at
       FROM mobility WHERE date = ? LIMIT 1`,
            [date]
        ),
        // Environmental: date-based
        getAll<any>(
            `SELECT id, date, time_in_daylight AS timeInDaylight,
              headphone_audio AS headphoneAudio,
              exercise_minutes AS exerciseMinutes,
              stand_minutes AS standMinutes,
              stand_hours AS standHours,
              mindful_minutes AS mindfulMinutes,
              sync_run_id, source_raw_sample_ids, algorithm_version, computed_at
       FROM environmental WHERE date = ? LIMIT 1`,
            [date]
        ),
        // Cardio Metabolic: date-based
        getAll<any>(
            `SELECT id, date, vo2_max AS vo2Max,
              walking_hr_avg AS walkingHRavg,
              resting_energy AS restingEnergy,
              physical_effort AS physicalEffort,
              breathing_disturbances AS breathingDisturbances,
              hr_recovery AS hrRecovery,
              sync_run_id, source_raw_sample_ids, algorithm_version, computed_at
       FROM cardio_metabolic WHERE date = ? LIMIT 1`,
            [date]
        ),
        // Running Dynamics: timestamp-based
        getAll<any>(
            `SELECT id, timestamp, running_power AS runningPower,
              ground_contact_time AS groundContactTime,
              vertical_oscillation AS verticalOscillation,
              stride_length AS strideLength,
              sync_run_id, source_raw_sample_ids, algorithm_version, computed_at
       FROM running_dynamics WHERE date(timestamp) = ? LIMIT 1`,
            [date]
        ),
        // Weight History: timestamp-based, take latest
        getAll<any>(
            `SELECT id, timestamp, weight_kg AS weightKg,
              lean_body_mass_percent AS leanBodyMassPercent,
              sync_run_id, source_raw_sample_ids, algorithm_version, computed_at
       FROM weight_history WHERE date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1`,
            [date]
        ),
    ])

    // Post-process: parse JSON columns for scores and activities
    const scores: DailyScores | null = scoresRaw.length > 0 ? {
        ...scoresRaw[0],
        bioAgeInputsUsed: scoresRaw[0].bioAgeInputsUsed
            ? (() => { try { return JSON.parse(scoresRaw[0].bioAgeInputsUsed) } catch { return [] } })()
            : [],
        bioAgeInputsMissing: scoresRaw[0].bioAgeInputsMissing
            ? (() => { try { return JSON.parse(scoresRaw[0].bioAgeInputsMissing) } catch { return [] } })()
            : [],
    } : null

    const activities: ActivityRecord[] = activitiesRaw.map((a: any) => ({
        ...a,
        hrZones: a.hrZones
            ? (() => { try { return JSON.parse(a.hrZones) } catch { return [0, 0, 0, 0, 0] } })()
            : [0, 0, 0, 0, 0],
    }))

    return {
        vitals: vitalsRaw.length > 0 ? vitalsRaw[0] : null,
        sleep: sleepRaw.length > 0 ? sleepRaw[0] : null,
        scores,
        activities,
        mobility: mobilityRaw.length > 0 ? mobilityRaw[0] : null,
        environmental: environmentalRaw.length > 0 ? environmentalRaw[0] : null,
        cardioMetabolic: cardioMetabolicRaw.length > 0 ? cardioMetabolicRaw[0] : null,
        runningDynamics: runningDynamicsRaw.length > 0 ? runningDynamicsRaw[0] : null,
        weight: weightRaw.length > 0 ? weightRaw[0] : null,
    }
}

// ── Derived Outputs ──────────────────────────────────────────────────────────

/** Get all derived outputs for a given date_key. */
export async function getDerivedOutputsForDate(date: string): Promise<DerivedOutput[]> {
    return getAll<DerivedOutput>(
        `SELECT * FROM derived_outputs WHERE date_key = ? ORDER BY computed_at DESC`,
        [date]
    )
}

// ── Sync Runs ────────────────────────────────────────────────────────────────

/** Get all sync runs, optionally filtered by status and limited. */
export async function getSyncRuns(status?: string, limit?: number): Promise<SyncRun[]> {
    let sql = `SELECT * FROM sync_runs`
    const params: any[] = []

    if (status) {
        sql += ` WHERE status = ?`
        params.push(status)
    }

    sql += ` ORDER BY started_at DESC`

    if (limit) {
        sql += ` LIMIT ?`
        params.push(limit)
    }

    return getAll<SyncRun>(sql, params)
}

// ── Orphaned Records ─────────────────────────────────────────────────────────

/** Find records across all normalized tables that lack provenance links
 *  (no source_raw_sample_ids and no sync_run_id). */
export async function getOrphanedRecords(): Promise<{
    table: string
    count: number
    records: any[]
}[]> {
    // Tables with date column
    const dateTables = ['sleep', 'daily_scores', 'mobility', 'environmental', 'cardio_metabolic']
    // Tables with timestamp column
    const tsTables = ['vitals', 'activity', 'running_dynamics', 'weight_history']

    const results: { table: string; count: number; records: any[] }[] = []

    for (const table of dateTables) {
        try {
            const rows = await getAll<any>(
                `SELECT * FROM ${table} WHERE source_raw_sample_ids IS NULL AND sync_run_id IS NULL LIMIT 20`
            )
            results.push({ table, count: rows.length, records: rows })
        } catch (_) {
            results.push({ table, count: 0, records: [] })
        }
    }

    for (const table of tsTables) {
        try {
            const rows = await getAll<any>(
                `SELECT * FROM ${table} WHERE source_raw_sample_ids IS NULL AND sync_run_id IS NULL LIMIT 20`
            )
            results.push({ table, count: rows.length, records: rows })
        } catch (_) {
            results.push({ table, count: 0, records: [] })
        }
    }

    return results
}

// ── Duplicate Detection ──────────────────────────────────────────────────────

/** Find potential duplicate records (same date, same domain table). */
export async function getDuplicateRecords(): Promise<{
    table: string
    count: number
    examples: any[]
}[]> {
    // Tables with a date column (exact match)
    const dateTables = ['sleep', 'daily_scores', 'mobility', 'environmental', 'cardio_metabolic']
    // Tables with a timestamp column (group by date)
    const tsTables: { table: string; dateExpr: string }[] = [
        { table: 'vitals', dateExpr: 'date(timestamp)' },
        { table: 'activity', dateExpr: 'date(timestamp)' },
        { table: 'running_dynamics', dateExpr: 'date(timestamp)' },
        { table: 'weight_history', dateExpr: 'date(timestamp)' },
    ]

    const results: { table: string; count: number; examples: any[] }[] = []

    for (const table of dateTables) {
        try {
            // Find dates with more than one record
            const dupeDates = await getAll<{ date: string; cnt: number }>(
                `SELECT date, COUNT(*) as cnt FROM ${table} GROUP BY date HAVING cnt > 1`
            )

            if (dupeDates.length > 0) {
                // Grab examples from the first few duplicate dates
                const examples: any[] = []
                for (const d of dupeDates.slice(0, 3)) {
                    const rows = await getAll<any>(
                        `SELECT * FROM ${table} WHERE date = ? ORDER BY id ASC`,
                        [d.date]
                    )
                    examples.push(...rows)
                }
                const totalDupes = dupeDates.reduce((sum, d) => sum + d.cnt - 1, 0)
                results.push({ table, count: totalDupes, examples })
            } else {
                results.push({ table, count: 0, examples: [] })
            }
        } catch (_) {
            results.push({ table, count: 0, examples: [] })
        }
    }

    for (const { table, dateExpr } of tsTables) {
        try {
            const dupeDates = await getAll<{ date: string; cnt: number }>(
                `SELECT ${dateExpr} as date, COUNT(*) as cnt FROM ${table} GROUP BY ${dateExpr} HAVING cnt > 1`
            )

            if (dupeDates.length > 0) {
                const examples: any[] = []
                for (const d of dupeDates.slice(0, 3)) {
                    const rows = await getAll<any>(
                        `SELECT * FROM ${table} WHERE ${dateExpr} = ? ORDER BY id ASC`,
                        [d.date]
                    )
                    examples.push(...rows)
                }
                const totalDupes = dupeDates.reduce((sum, d) => sum + d.cnt - 1, 0)
                results.push({ table, count: totalDupes, examples })
            } else {
                results.push({ table, count: 0, examples: [] })
            }
        } catch (_) {
            results.push({ table, count: 0, examples: [] })
        }
    }

    return results
}

// ── Data Quality Summary ─────────────────────────────────────────────────────

/** Comprehensive data quality summary across all pipeline stages. */
export async function getDataQualitySummary(): Promise<{
    rawSamples: { total: number; byDomain: Record<string, number> }
    normalized: {
        vitals: number
        sleep: number
        scores: number
        activities: number
        mobility: number
        environmental: number
        cardioMetabolic: number
        runningDynamics: number
        weight: number
    }
    derived: { total: number; byType: Record<string, number> }
    syncRuns: { total: number; completed: number; failed: number; partial: number }
    provenance: { recordsWithProvenance: number; recordsWithoutProvenance: number; totalRecords: number }
    duplicates: { table: string; count: number }[]
    syncCoverage: { earliestDate: string; latestDate: string; totalDays: number }
}> {
    const [
        rawTotal,
        rawByDomain,
        vitalCount,
        sleepCount,
        scoresCount,
        activityCount,
        mobilityCount,
        envCount,
        cardioCount,
        runningCount,
        weightCount,
        derivedTotal,
        derivedByType,
        syncTotal,
        syncCompleted,
        syncFailed,
        syncPartial,
        provWith,
        provWithout,
        provTotal,
        dupes,
        earliestSync,
        latestSync,
        syncDays,
    ] = await Promise.all([
        // Raw samples: total
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM raw_health_samples`),
        // Raw samples: by domain
        getAll<{ domain: string; cnt: number }>(
            `SELECT domain, COUNT(*) as cnt FROM raw_health_samples GROUP BY domain`
        ),
        // Normalized counts
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM vitals`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM sleep`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM daily_scores`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM activity`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM mobility`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM environmental`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM cardio_metabolic`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM running_dynamics`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM weight_history`),
        // Derived outputs
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM derived_outputs`),
        getAll<{ output_type: string; cnt: number }>(
            `SELECT output_type, COUNT(*) as cnt FROM derived_outputs GROUP BY output_type`
        ),
        // Sync runs
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM sync_runs`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM sync_runs WHERE status = 'completed'`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM sync_runs WHERE status = 'failed'`),
        getOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM sync_runs WHERE status = 'partial'`),
        // Provenance: records with both source_raw_sample_ids AND sync_run_id
        getOne<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM (
         SELECT id FROM vitals WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM sleep WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM daily_scores WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM activity WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM mobility WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM environmental WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM cardio_metabolic WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM running_dynamics WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
         UNION ALL SELECT id FROM weight_history WHERE source_raw_sample_ids IS NOT NULL AND sync_run_id IS NOT NULL
       )`
        ),
        getOne<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM (
         SELECT id FROM vitals WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM sleep WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM daily_scores WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM activity WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM mobility WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM environmental WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM cardio_metabolic WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM running_dynamics WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
         UNION ALL SELECT id FROM weight_history WHERE source_raw_sample_ids IS NULL OR sync_run_id IS NULL
       )`
        ),
        getOne<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM (
         SELECT id FROM vitals
         UNION ALL SELECT id FROM sleep
         UNION ALL SELECT id FROM daily_scores
         UNION ALL SELECT id FROM activity
         UNION ALL SELECT id FROM mobility
         UNION ALL SELECT id FROM environmental
         UNION ALL SELECT id FROM cardio_metabolic
         UNION ALL SELECT id FROM running_dynamics
         UNION ALL SELECT id FROM weight_history
       )`
        ),
        // Duplicates
        getDuplicateRecords(),
        // Sync coverage: earliest and latest dates in raw samples
        getOne<{ d: string }>(
            `SELECT MIN(local_day_key) as d FROM raw_health_samples`
        ),
        getOne<{ d: string }>(
            `SELECT MAX(local_day_key) as d FROM raw_health_samples`
        ),
        getOne<{ cnt: number }>(
            `SELECT COUNT(DISTINCT local_day_key) as cnt FROM raw_health_samples`
        ),
    ])

    // Build byDomain map
    const byDomain: Record<string, number> = {}
    for (const row of rawByDomain) {
        byDomain[row.domain] = row.cnt
    }

    // Build byType map
    const byType: Record<string, number> = {}
    for (const row of derivedByType) {
        byType[row.output_type] = row.cnt
    }

    return {
        rawSamples: {
            total: rawTotal?.cnt ?? 0,
            byDomain,
        },
        normalized: {
            vitals: vitalCount?.cnt ?? 0,
            sleep: sleepCount?.cnt ?? 0,
            scores: scoresCount?.cnt ?? 0,
            activities: activityCount?.cnt ?? 0,
            mobility: mobilityCount?.cnt ?? 0,
            environmental: envCount?.cnt ?? 0,
            cardioMetabolic: cardioCount?.cnt ?? 0,
            runningDynamics: runningCount?.cnt ?? 0,
            weight: weightCount?.cnt ?? 0,
        },
        derived: {
            total: derivedTotal?.cnt ?? 0,
            byType,
        },
        syncRuns: {
            total: syncTotal?.cnt ?? 0,
            completed: syncCompleted?.cnt ?? 0,
            failed: syncFailed?.cnt ?? 0,
            partial: syncPartial?.cnt ?? 0,
        },
        provenance: {
            recordsWithProvenance: provWith?.cnt ?? 0,
            recordsWithoutProvenance: provWithout?.cnt ?? 0,
            totalRecords: provTotal?.cnt ?? 0,
        },
        duplicates: dupes.map(d => ({ table: d.table, count: d.count })),
        syncCoverage: {
            earliestDate: earliestSync?.d ?? 'N/A',
            latestDate: latestSync?.d ?? 'N/A',
            totalDays: syncDays?.cnt ?? 0,
        },
    }
}
