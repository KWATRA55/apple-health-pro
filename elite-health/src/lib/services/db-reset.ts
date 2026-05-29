// ── Safe Database Reset + Recompute Utility ──────────────────────────────────
// Provides a controlled pipeline for clearing derived data and recomputing
// all scores from raw source tables. Never deletes raw tables by default.
//
// Usage:
//   import { safeResetAndRecompute, getResetSummary } from '@/lib/services/db-reset'
//   const summary = await getResetSummary()
//   const result = await safeResetAndRecompute({ hard: false })

import {
    documentDirectory,
    getInfoAsync,
    makeDirectoryAsync,
    copyAsync,
} from 'expo-file-system/legacy'
import { getDB, runQuery, getOne, getAll } from '../db'
import { useHealthStore } from '../store'
import { invalidateAllCaches } from '../utils/cache'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ResetResult {
    success: boolean
    backupPath: string | null
    clearedDerivedCount: number
    clearedHardResetCount: number
    totalDatesRecomputed: number
    datesWithErrors: string[]
    verification: VerificationSummary | null
    errors: string[]
}

export interface VerificationSummary {
    beforeReset: {
        dailyScores: number
        derivedOutputs: number
    }
    afterRecompute: {
        dailyScores: number
        derivedOutputs: number
        datesWithScores: number
        datesMissingScores: string[]
    }
    rawTableCounts: Record<string, number>
}

export interface ResetSummary {
    totalDailyScores: number
    totalDerivedOutputs: number
    distinctDatesWithData: number
    oldestDate: string | null
    newestDate: string | null
    rawTableCounts: Record<string, number>
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DB_FILENAME = 'elite_health.db'
const BACKUP_DIR = `${documentDirectory}backups/`

const DERIVED_TABLES = ['daily_scores', 'derived_outputs'] as const

const RAW_TABLES = [
    'vitals',
    'sleep',
    'activities',
    'running_dynamics',
    'mobility',
    'environmental',
    'cardio_metabolic',
    'weight_history',
    'journal_entries',
    'meals',
] as const

const HARD_RESET_TABLES = [
    'raw_health_samples',
    'sync_runs',
    'sync_metadata',
    'provenance_log',
] as const

// ── Backup ─────────────────────────────────────────────────────────────────────

/**
 * Creates a timestamped backup of the SQLite database file.
 * The backup is stored in the app's document directory under `backups/`.
 * Uses expo-file-system legacy API; safe with WAL-mode SQLite.
 */
export async function backupDatabase(): Promise<string> {
    // Ensure backup directory exists
    const dirInfo = await getInfoAsync(BACKUP_DIR)
    if (!dirInfo.exists) {
        await makeDirectoryAsync(BACKUP_DIR, { intermediates: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFilename = `elite_health_backup_${timestamp}.db`
    const backupPath = `${BACKUP_DIR}${backupFilename}`

    // Copy the live database file (safe in WAL mode)
    const dbPath = `${documentDirectory}SQLite/${DB_FILENAME}`
    await copyAsync({
        from: dbPath,
        to: backupPath,
    })

    console.log(`[db-reset] ✓ Database backed up to: ${backupPath}`)
    return backupPath
}

// ── Clear Derived Tables ───────────────────────────────────────────────────────

/**
 * Clears derived tables (daily_scores, derived_outputs).
 * When `hard` is true, also clears all raw tables, sync runs, and provenance data.
 *
 * ⚠️ Hard reset requires double-confirmation at the UI level before calling.
 */
export async function clearDerivedTables(
    options: { hard?: boolean } = {}
): Promise<{ derivedCount: number; hardResetCount: number }> {
    let derivedCount = 0
    let hardResetCount = 0

    // Phase 1: Clear derived tables
    for (const table of DERIVED_TABLES) {
        const result = await runQuery(`DELETE FROM ${table}`)
        derivedCount += result.changes
        console.log(`[db-reset] Cleared ${result.changes} rows from ${table}`)
    }

    // Phase 2: Hard reset — clear raw + sync/provenance tables
    if (options.hard) {
        const allHardTables = [...RAW_TABLES, ...HARD_RESET_TABLES]
        for (const table of allHardTables) {
            try {
                const result = await runQuery(`DELETE FROM ${table}`)
                hardResetCount += result.changes
                console.log(`[db-reset] Hard reset: cleared ${result.changes} rows from ${table}`)
            } catch (e) {
                console.warn(`[db-reset] Could not clear ${table}:`, e)
            }
        }
    }

    return { derivedCount, hardResetCount }
}

// ── Collect Distinct Dates ─────────────────────────────────────────────────────

/**
 * Scans all raw data tables for distinct dates.
 * Returns a sorted array of date strings (YYYY-MM-DD).
 */
export async function collectDistinctDates(): Promise<string[]> {
    const dates = new Set<string>()

    // Query all raw tables for distinct dates
    for (const table of RAW_TABLES) {
        try {
            const rows = await getAll<{ date: string }>(
                `SELECT DISTINCT date FROM ${table} WHERE date IS NOT NULL AND date != ''`
            )
            for (const row of rows) {
                dates.add(row.date)
            }
        } catch (e) {
            // Table may not exist yet (e.g., first run before migrations)
            console.warn(`[db-reset] Could not query dates from ${table}:`, e)
        }
    }

    // Also check raw_health_samples (uses sample_date column)
    try {
        const sampleRows = await getAll<{ sample_date: string }>(
            `SELECT DISTINCT sample_date FROM raw_health_samples WHERE sample_date IS NOT NULL AND sample_date != ''`
        )
        for (const row of sampleRows) {
            dates.add(row.sample_date)
        }
    } catch (e) {
        console.warn('[db-reset] Could not query dates from raw_health_samples:', e)
    }

    const sorted = Array.from(dates).sort()
    console.log(`[db-reset] Found ${sorted.length} distinct dates with data`)
    return sorted
}

// ── Recompute All Scores ───────────────────────────────────────────────────────

/**
 * Loads all raw data from the database, then recomputes scores for every
 * date that has raw data using the canonical store.computeScores() algorithm.
 *
 * @param onProgress - Optional callback: (current, total, dateString)
 */
export async function recomputeAllScores(
    onProgress?: (current: number, total: number, date: string) => void
): Promise<{ totalDates: number; datesWithErrors: string[] }> {
    const dates = await collectDistinctDates()
    const datesWithErrors: string[] = []
    const store = useHealthStore.getState()

    // Load all raw data from DB into the Zustand store so computeScores
    // can access vitals, sleep, activities, etc. for each date.
    console.log('[db-reset] Loading raw data from DB into store...')
    await store.loadFromDB()

    console.log(`[db-reset] Recomputing scores for ${dates.length} dates...`)

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i]
        try {
            onProgress?.(i + 1, dates.length, date)

            // computeScores writes to daily_scores + derived_outputs tables
            // and updates the store's scores array. Returns null if there
            // is no real data (no vitals with HRV/RHR, no sleep, no activities).
            const result = await store.computeScores(date)

            if (result) {
                console.log(`[db-reset]  ✓ ${date}`)
            } else {
                console.log(`[db-reset]  ⊘ ${date} (no real data, skipped)`)
            }
        } catch (e) {
            console.error(`[db-reset]  ✗ ${date} FAILED:`, e)
            datesWithErrors.push(date)
        }
    }

    // Invalidate the application-level cache so all selectors re-derive
    invalidateAllCaches()

    const succeeded = dates.length - datesWithErrors.length
    console.log(`[db-reset] Recompute complete: ${succeeded}/${dates.length} dates succeeded`)

    return {
        totalDates: dates.length,
        datesWithErrors,
    }
}

// ── Verify After Reset ─────────────────────────────────────────────────────────

/**
 * Compares post-recompute state against raw data to verify completeness.
 * Returns counts, dates that have scores, and dates that are missing scores.
 */
export async function verifyAfterReset(): Promise<VerificationSummary> {
    // Post-recompute counts
    const dailyScoresCount = await getOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM daily_scores'
    )
    const derivedOutputsCount = await getOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM derived_outputs'
    )

    // Dates that now have scores
    const scoredDates = await getAll<{ date: string }>(
        'SELECT DISTINCT date FROM daily_scores ORDER BY date'
    )

    // Dates that have raw data but no scores
    const rawDates = await collectDistinctDates()
    const scoredDateSet = new Set(scoredDates.map(r => r.date))
    const datesMissingScores = rawDates.filter(d => !scoredDateSet.has(d))

    // Raw table row counts
    const rawTableCounts: Record<string, number> = {}
    for (const table of RAW_TABLES) {
        try {
            const row = await getOne<{ cnt: number }>(
                `SELECT COUNT(*) as cnt FROM ${table}`
            )
            rawTableCounts[table] = row?.cnt ?? 0
        } catch {
            rawTableCounts[table] = 0
        }
    }

    return {
        beforeReset: {
            dailyScores: -1, // filled in by safeResetAndRecompute
            derivedOutputs: -1,
        },
        afterRecompute: {
            dailyScores: dailyScoresCount?.cnt ?? 0,
            derivedOutputs: derivedOutputsCount?.cnt ?? 0,
            datesWithScores: scoredDates.length,
            datesMissingScores,
        },
        rawTableCounts,
    }
}

// ── Main Orchestration ─────────────────────────────────────────────────────────

/**
 * Runs the full safe-reset pipeline:
 *   1. Captures pre-reset counts
 *   2. Backs up the database
 *   3. Clears derived tables (and raw tables if `hard: true`)
 *   4. Recomputes all scores from raw data
 *   5. Verifies the results
 *
 * @param options.hard - If true, performs a hard reset (clears ALL tables).
 *   Must be guarded by double-confirmation at the UI level.
 * @param options.onProgress - Callback for phase/progress updates.
 */
export async function safeResetAndRecompute(
    options: {
        hard?: boolean
        onProgress?: (phase: string, detail?: string) => void
    } = {}
): Promise<ResetResult> {
    const progress = options.onProgress

    const result: ResetResult = {
        success: false,
        backupPath: null,
        clearedDerivedCount: 0,
        clearedHardResetCount: 0,
        totalDatesRecomputed: 0,
        datesWithErrors: [],
        verification: null,
        errors: [],
    }

    try {
        // ── Phase 1: Capture pre-reset counts ──────────────────────────────
        progress?.('preflight', 'Capturing pre-reset counts...')
        const preDailyScores = await getOne<{ cnt: number }>(
            'SELECT COUNT(*) as cnt FROM daily_scores'
        )
        const preDerivedOutputs = await getOne<{ cnt: number }>(
            'SELECT COUNT(*) as cnt FROM derived_outputs'
        )

        // ── Phase 2: Backup ────────────────────────────────────────────────
        progress?.('backup', 'Copying database file...')
        result.backupPath = await backupDatabase()

        // ── Phase 3: Clear derived tables ──────────────────────────────────
        progress?.(
            'clear',
            options.hard
                ? 'Clearing ALL tables (HARD RESET)...'
                : 'Clearing derived tables (daily_scores, derived_outputs)...'
        )
        const cleared = await clearDerivedTables({ hard: options.hard })
        result.clearedDerivedCount = cleared.derivedCount
        result.clearedHardResetCount = cleared.hardResetCount

        // ── Phase 4: Recompute ─────────────────────────────────────────────
        progress?.('recompute', 'Recomputing all scores...')
        const recomputeResult = await recomputeAllScores((current, total, date) => {
            progress?.('recompute', `${date} (${current}/${total})`)
        })
        result.totalDatesRecomputed = recomputeResult.totalDates
        result.datesWithErrors = recomputeResult.datesWithErrors

        // ── Phase 5: Verify ────────────────────────────────────────────────
        progress?.('verify', 'Verifying results...')
        const verification = await verifyAfterReset()
        verification.beforeReset = {
            dailyScores: preDailyScores?.cnt ?? 0,
            derivedOutputs: preDerivedOutputs?.cnt ?? 0,
        }
        result.verification = verification

        result.success = recomputeResult.datesWithErrors.length === 0

        progress?.(
            'complete',
            result.success
                ? 'Reset and recompute completed successfully!'
                : `Completed with ${recomputeResult.datesWithErrors.length} errors`
        )
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        result.errors.push(errorMsg)
        console.error('[db-reset] Fatal error during reset:', e)
    }

    return result
}

// ── Get Reset Summary ──────────────────────────────────────────────────────────

/**
 * Returns a read-only summary of the current database state.
 * Use this to preview what a reset would affect before running it.
 */
export async function getResetSummary(): Promise<ResetSummary> {
    const dailyScoresCount = await getOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM daily_scores'
    )
    const derivedOutputsCount = await getOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM derived_outputs'
    )

    const dates = await collectDistinctDates()

    const rawTableCounts: Record<string, number> = {}
    for (const table of RAW_TABLES) {
        try {
            const row = await getOne<{ cnt: number }>(
                `SELECT COUNT(*) as cnt FROM ${table}`
            )
            rawTableCounts[table] = row?.cnt ?? 0
        } catch {
            rawTableCounts[table] = 0
        }
    }

    return {
        totalDailyScores: dailyScoresCount?.cnt ?? 0,
        totalDerivedOutputs: derivedOutputsCount?.cnt ?? 0,
        distinctDatesWithData: dates.length,
        oldestDate: dates.length > 0 ? dates[0] : null,
        newestDate: dates.length > 0 ? dates[dates.length - 1] : null,
        rawTableCounts,
    }
}
