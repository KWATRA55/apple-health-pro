import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('elite_health.db')
    await initializeSchema(db)
  }
  return db
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      hrv REAL,
      rhr REAL,
      spo2 REAL,
      respiratory_rate REAL,
      skin_temp_delta REAL
    );

    CREATE TABLE IF NOT EXISTS sleep (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_duration_mins REAL NOT NULL,
      rem_mins REAL DEFAULT 0,
      deep_mins REAL DEFAULT 0,
      core_mins REAL DEFAULT 0,
      awake_mins REAL DEFAULT 0,
      sleep_need_hours REAL DEFAULT 8.0,
      -- NOTE: sleep_debt_hours is intentionally NOT populated by addSleep().
      -- Sleep debt is a derived value computed by computeScores() across a
      -- 7-day rolling window and stored in daily_scores.sleep_debt_hours.
      -- This column exists for schema backward compatibility but SHOULD NOT
      -- be used as a source of truth. Always read from DailyScores instead.
      sleep_debt_hours REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      active_calories REAL DEFAULT 0,
      workout_type TEXT DEFAULT 'Other',
      duration_mins REAL DEFAULT 0,
      hr_zones TEXT DEFAULT '[0,0,0,0,0]',
      max_hr REAL,
      strain_score REAL,
      avg_hr REAL,
      source TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      protein_grams REAL DEFAULT 0,
      carbs_grams REAL DEFAULT 0,
      fat_grams REAL DEFAULT 0,
      total_calories REAL DEFAULT 0,
      meal_description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS daily_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      recovery_score REAL,
      strain_score REAL,
      sleep_debt_hours REAL,
      sleep_need_hours REAL,
      hrv_z_score REAL,
      rhr_z_score REAL,
      recovery_zone TEXT,
      biological_age REAL,
      pace_of_aging REAL,
      immunity_risk TEXT DEFAULT 'LOW',
      bio_age_confidence REAL,
      bio_age_inputs_used TEXT,
      bio_age_inputs_missing TEXT,
      bio_age_primary_driver TEXT
    );

    CREATE TABLE IF NOT EXISTS running_dynamics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      running_power REAL,
      ground_contact_time REAL,
      vertical_oscillation REAL,
      stride_length REAL
    );

    CREATE TABLE IF NOT EXISTS weight_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      weight_kg REAL,
      lean_body_mass_percent REAL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      habits TEXT NOT NULL,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS mobility (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      steps INTEGER DEFAULT 0,
      walking_speed REAL DEFAULT 0,
      walking_step_length REAL DEFAULT 0,
      walking_asymmetry REAL DEFAULT 0,
      double_support REAL DEFAULT 0,
      stair_speed_up REAL DEFAULT 0,
      stair_speed_down REAL DEFAULT 0,
      flights_climbed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS environmental (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      time_in_daylight INTEGER DEFAULT 0,
      headphone_audio REAL DEFAULT 0,
      exercise_minutes INTEGER DEFAULT 0,
      stand_minutes INTEGER DEFAULT 0,
      stand_hours INTEGER DEFAULT 0,
      mindful_minutes INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cardio_metabolic (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      vo2_max REAL DEFAULT 0,
      walking_hr_avg REAL DEFAULT 0,
      resting_energy REAL DEFAULT 0,
      physical_effort REAL DEFAULT 0,
      breathing_disturbances REAL DEFAULT 0,
      hr_recovery REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vector_documents (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding BLOB NOT NULL,
      source TEXT,
      chunk_index INTEGER,
      title TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_health_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_app TEXT,
      source_device TEXT,
      domain TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      value REAL,
      unit TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      local_day_key TEXT NOT NULL,
      timezone TEXT,
      metadata_json TEXT,
      ingestion_ts TEXT NOT NULL DEFAULT (datetime('now')),
      sync_run_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(canonical_id, metric_name, start_time)
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'started',
      date_window_start TEXT,
      date_window_end TEXT,
      permission_state TEXT,
      total_samples_returned INTEGER DEFAULT 0,
      inserted_count INTEGER DEFAULT 0,
      deduped_count INTEGER DEFAULT 0,
      updated_count INTEGER DEFAULT 0,
      deleted_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      parsing_errors_json TEXT,
      recomputations_triggered TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS provenance_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_table TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_raw_sample_ids TEXT,
      sync_run_id INTEGER,
      algorithm_version TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vitals_timestamp ON vitals(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep(date);
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
    CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON daily_scores(date);
    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_mobility_date ON mobility(date);
    CREATE INDEX IF NOT EXISTS idx_environmental_date ON environmental(date);
    CREATE INDEX IF NOT EXISTS idx_cardio_metabolic_date ON cardio_metabolic(date);
    CREATE INDEX IF NOT EXISTS idx_sync_key ON sync_metadata(key);
    CREATE INDEX IF NOT EXISTS idx_raw_samples_day ON raw_health_samples(local_day_key);
    CREATE INDEX IF NOT EXISTS idx_raw_samples_domain ON raw_health_samples(domain, metric_name);
    CREATE INDEX IF NOT EXISTS idx_raw_samples_sync ON raw_health_samples(sync_run_id);
    CREATE INDEX IF NOT EXISTS idx_raw_samples_canonical ON raw_health_samples(canonical_id);
    CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
    CREATE INDEX IF NOT EXISTS idx_sync_runs_window ON sync_runs(date_window_start, date_window_end);
    CREATE INDEX IF NOT EXISTS idx_provenance_table ON provenance_log(record_table, record_id);

    CREATE TABLE IF NOT EXISTS derived_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      output_type TEXT NOT NULL,
      algorithm_name TEXT NOT NULL,
      algorithm_version TEXT NOT NULL,
      date_key TEXT NOT NULL,
      input_coverage_json TEXT,
      confidence REAL,
      dependency_ids TEXT,
      source_raw_sample_ids TEXT,
      sync_run_id INTEGER,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      computed_at TEXT NOT NULL DEFAULT (datetime('now')),
      invalidated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_derived_type_date ON derived_outputs(output_type, date_key);
    CREATE INDEX IF NOT EXISTS idx_derived_algorithm ON derived_outputs(algorithm_name, algorithm_version);
    CREATE INDEX IF NOT EXISTS idx_derived_status ON derived_outputs(status);
  `)

  try {
    const tableInfo = await database.getAllAsync<{ name: string }>('PRAGMA table_info(daily_scores)')
    const columnNames = new Set(tableInfo.map(c => c.name))

    if (!columnNames.has('bio_age_confidence')) {
      await database.execAsync('ALTER TABLE daily_scores ADD COLUMN bio_age_confidence REAL;')
    }
    if (!columnNames.has('bio_age_inputs_used')) {
      await database.execAsync('ALTER TABLE daily_scores ADD COLUMN bio_age_inputs_used TEXT;')
    }
    if (!columnNames.has('bio_age_inputs_missing')) {
      await database.execAsync('ALTER TABLE daily_scores ADD COLUMN bio_age_inputs_missing TEXT;')
    }
    if (!columnNames.has('bio_age_primary_driver')) {
      await database.execAsync('ALTER TABLE daily_scores ADD COLUMN bio_age_primary_driver TEXT;')
    }
  } catch (migrationErr) {
    console.error('[DB] Migration failed for daily_scores:', migrationErr)
  }

  try {
    const tableInfo = await database.getAllAsync<{ name: string }>('PRAGMA table_info(environmental)')
    const columnNames = new Set(tableInfo.map(c => c.name))
    if (!columnNames.has('mindful_minutes')) {
      await database.execAsync('ALTER TABLE environmental ADD COLUMN mindful_minutes INTEGER DEFAULT 0;')
    }
  } catch (migrationErr) {
    console.error('[DB] Migration failed for environmental mindful_minutes:', migrationErr)
  }

  try {
    const tableInfo = await database.getAllAsync<{ name: string }>('PRAGMA table_info(cardio_metabolic)')
    const columnNames = new Set(tableInfo.map(c => c.name))
    if (!columnNames.has('hr_recovery')) {
      await database.execAsync('ALTER TABLE cardio_metabolic ADD COLUMN hr_recovery REAL DEFAULT 0;')
    }
  } catch (migrationErr) {
    console.error('[DB] Migration failed for cardio_metabolic hr_recovery:', migrationErr)
  }

  try {
    const tableInfo = await database.getAllAsync<{ name: string }>('PRAGMA table_info(sleep)')
    const columnNames = new Set(tableInfo.map(c => c.name))
    if (!columnNames.has('bedtime_start')) {
      await database.execAsync('ALTER TABLE sleep ADD COLUMN bedtime_start TEXT;')
    }
    if (!columnNames.has('wake_time_end')) {
      await database.execAsync('ALTER TABLE sleep ADD COLUMN wake_time_end TEXT;')
    }
  } catch (migrationErr) {
    console.error('[DB] Migration failed for sleep bedtime/wake columns:', migrationErr)
  }

  // ── Migration: activity.source column + legacy row purge ───────────────
  // Scenario A assumed — could not verify with live logs.
  // Without a source column, mock/synthetic/manual records inserted during
  // development accumulate in SQLite forever and load on every app start.
  // This migration adds source tracking and purges any legacy rows that
  // predate it (since their origin is unknowable and could be phantom data).
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS migration_meta (
        key TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `)
    const alreadyApplied = await database.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM migration_meta WHERE key = 'activity_source_v1'`
    )
    if (!alreadyApplied || alreadyApplied.cnt === 0) {
      // Add source column if not present (fresh schema has it, old DBs need ALTER)
      const actCols = await database.getAllAsync<{ name: string }>('PRAGMA table_info(activity)')
      const actColNames = new Set(actCols.map(c => c.name))
      if (!actColNames.has('source')) {
        await database.execAsync("ALTER TABLE activity ADD COLUMN source TEXT DEFAULT NULL;")
      }
      // Purge legacy rows that cannot be provenance-verified
      const purgeResult = await database.runAsync(
        "DELETE FROM activity WHERE source IS NULL OR source NOT IN ('healthkit', 'manual')"
      )
      console.log(`[DB] activity.source migration: purged ${purgeResult.changes} legacy rows`)
      await database.runAsync(
        "INSERT OR REPLACE INTO migration_meta (key, applied_at) VALUES ('activity_source_v1', ?)",
        new Date().toISOString()
      )
    }
  } catch (migrationErr) {
    console.error('[DB] Migration failed for activity.source:', migrationErr)
  }

  // ── Phase C: Add provenance columns to all normalized tables ──────────────
  const provenanceTables = [
    'daily_scores', 'vitals', 'sleep', 'activity', 'mobility',
    'running_dynamics', 'environmental', 'cardio_metabolic', 'weight_history',
  ]
  for (const table of provenanceTables) {
    for (const col of ['sync_run_id INTEGER', 'source_raw_sample_ids TEXT', 'algorithm_version TEXT', 'computed_at TEXT']) {
      try {
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col}`)
      } catch (_) {
        // column already exists — safe to ignore
      }
    }
  }
}

type SQLiteBindValue = string | number | null | Uint8Array

export async function runQuery(sql: string, params: SQLiteBindValue[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
  const database = await getDB()
  return database.runAsync(sql, ...params)
}

export async function getOne<T>(sql: string, params: SQLiteBindValue[] = []): Promise<T | null> {
  const database = await getDB()
  return database.getFirstAsync<T>(sql, ...params)
}

export async function getAll<T>(sql: string, params: SQLiteBindValue[] = []): Promise<T[]> {
  const database = await getDB()
  return database.getAllAsync<T>(sql, ...params)
}

export async function withTransaction(fn: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
  const database = await getDB()
  await database.withTransactionAsync(async () => {
    await fn(database)
  })
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const meta = await getOne<{ value: string }>('SELECT value FROM sync_metadata WHERE key = ?', [key])
  return meta ? meta.value : null
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const now = new Date().toISOString()
  await runQuery(
    'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
    [key, value, now]
  )
}

// ── Phase B: Sync Run Lifecycle ─────────────────────────────────────────────

export async function startSyncRun(dateWindowStart: string, dateWindowEnd: string): Promise<number> {
  const result = await runQuery(
    `INSERT INTO sync_runs (status, date_window_start, date_window_end)
     VALUES ('started', ?, ?)`,
    [dateWindowStart, dateWindowEnd]
  )
  return result.lastInsertRowId
}

export async function updateSyncRun(
  id: number,
  updates: {
    status?: string
    completed_at?: string
    total_samples_returned?: number
    inserted_count?: number
    deduped_count?: number
    updated_count?: number
    deleted_count?: number
    error_count?: number
    parsing_errors_json?: string
    recomputations_triggered?: string
    permission_state?: string
    notes?: string
  }
): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`)
      values.push(value)
    }
  }
  if (sets.length === 0) return
  values.push(id)
  await runQuery(`UPDATE sync_runs SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function completeSyncRun(id: number, status: 'completed' | 'partial' | 'failed', notes?: string): Promise<void> {
  await runQuery(
    `UPDATE sync_runs SET status = ?, completed_at = datetime('now'), notes = ? WHERE id = ?`,
    [status, notes ?? null, id]
  )
}

// ── Phase B: Raw Health Sample Insert ────────────────────────────────────────

export async function insertRawSample(sample: {
  canonical_id: string
  source_type: string
  source_app?: string | null
  source_device?: string | null
  domain: string
  metric_name: string
  value?: number | null
  unit?: string | null
  start_time: string
  end_time: string
  local_day_key: string
  timezone?: string | null
  metadata_json?: string | null
  sync_run_id?: number | null
  status?: string
}): Promise<number> {
  const result = await runQuery(
    `INSERT OR IGNORE INTO raw_health_samples
     (canonical_id, source_type, source_app, source_device, domain, metric_name, value, unit,
      start_time, end_time, local_day_key, timezone, metadata_json, sync_run_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sample.canonical_id,
      sample.source_type,
      sample.source_app ?? null,
      sample.source_device ?? null,
      sample.domain,
      sample.metric_name,
      sample.value ?? null,
      sample.unit ?? null,
      sample.start_time,
      sample.end_time,
      sample.local_day_key,
      sample.timezone ?? null,
      sample.metadata_json ?? null,
      sample.sync_run_id ?? null,
      sample.status ?? 'active',
    ]
  )
  return result.lastInsertRowId
}

export async function insertRawSamples(samples: Array<{
  canonical_id: string
  source_type: string
  source_app?: string | null
  source_device?: string | null
  domain: string
  metric_name: string
  value?: number | null
  unit?: string | null
  start_time: string
  end_time: string
  local_day_key: string
  timezone?: string | null
  metadata_json?: string | null
  sync_run_id?: number | null
  status?: string
}>): Promise<{ inserted: number; skipped: number }> {
  if (samples.length === 0) return { inserted: 0, skipped: 0 }

  let inserted = 0
  let skipped = 0

  for (const sample of samples) {
    const result = await runQuery(
      `INSERT OR IGNORE INTO raw_health_samples
       (canonical_id, source_type, source_app, source_device, domain, metric_name, value, unit,
        start_time, end_time, local_day_key, timezone, metadata_json, sync_run_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sample.canonical_id,
        sample.source_type,
        sample.source_app ?? null,
        sample.source_device ?? null,
        sample.domain,
        sample.metric_name,
        sample.value ?? null,
        sample.unit ?? null,
        sample.start_time,
        sample.end_time,
        sample.local_day_key,
        sample.timezone ?? null,
        sample.metadata_json ?? null,
        sample.sync_run_id ?? null,
        sample.status ?? 'active',
      ]
    )
    if (result.changes > 0) {
      inserted++
    } else {
      skipped++
    }
  }

  return { inserted, skipped }
}

// ── Phase C: Provenance Backfill ───────────────────────────────────────────

/** Best-effort backfill: link existing normalized records to raw samples by
 *  matching date. Since we didn't track sync_run_id before Phase B, this
 *  is the best we can do for historical data. */
export async function backfillProvenanceForDate(dateStr: string): Promise<{ table: string; updated: number }[]> {
  const results: { table: string; updated: number }[] = []

  // Get raw sample IDs for this date
  const rawSamples = await getAll<{ id: number }>(
    `SELECT id FROM raw_health_samples WHERE local_day_key = ?`,
    [dateStr]
  )
  if (rawSamples.length === 0) return results

  const rawIdsJson = JSON.stringify(rawSamples.map(r => r.id))

  // Tables that use a 'date' column (exactly matches local_day_key)
  const dateColumnTables = ['sleep', 'mobility', 'environmental', 'cardio_metabolic', 'daily_scores']
  // Tables that use a 'timestamp' column (needs date() wrapper)
  const tsColumnTables = ['vitals', 'activity', 'running_dynamics', 'weight_history']

  for (const table of dateColumnTables) {
    try {
      const result = await runQuery(
        `UPDATE ${table} SET source_raw_sample_ids = ? WHERE date = ? AND source_raw_sample_ids IS NULL`,
        [rawIdsJson, dateStr]
      )
      results.push({ table, updated: result.changes || 0 })
    } catch (_) {
      // table may not exist yet
    }
  }

  for (const table of tsColumnTables) {
    try {
      const result = await runQuery(
        `UPDATE ${table} SET source_raw_sample_ids = ? WHERE date(timestamp) = ? AND source_raw_sample_ids IS NULL`,
        [rawIdsJson, dateStr]
      )
      results.push({ table, updated: result.changes || 0 })
    } catch (_) {
      // table may not exist yet
    }
  }

  return results
}

// ── Phase F: Derived Outputs ────────────────────────────────────────────────

export async function insertDerivedOutput(output: {
  output_type: string
  algorithm_name: string
  algorithm_version: string
  date_key: string
  input_coverage_json?: string | null
  confidence?: number | null
  dependency_ids?: string | null
  source_raw_sample_ids?: string | null
  sync_run_id?: number | null
  payload_json: string
  status?: string
}): Promise<number> {
  const result = await runQuery(
    `INSERT INTO derived_outputs
    (output_type, algorithm_name, algorithm_version, date_key, input_coverage_json, confidence,
     dependency_ids, source_raw_sample_ids, sync_run_id, payload_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      output.output_type,
      output.algorithm_name,
      output.algorithm_version,
      output.date_key,
      output.input_coverage_json ?? null,
      output.confidence ?? null,
      output.dependency_ids ?? null,
      output.source_raw_sample_ids ?? null,
      output.sync_run_id ?? null,
      output.payload_json,
      output.status ?? 'active'
    ]
  )
  return result.lastInsertRowId
}

export async function invalidateDerivedOutputs(dateKey: string, algorithmName?: string): Promise<number> {
  let sql = `UPDATE derived_outputs SET status = 'invalidated', invalidated_at = datetime('now') WHERE date_key = ? AND status = 'active'`
  const params: any[] = [dateKey]
  if (algorithmName) {
    sql += ` AND algorithm_name = ?`
    params.push(algorithmName)
  }
  const result = await runQuery(sql, params)
  return result.changes || 0
}

export async function getDerivedOutput(outputType: string, dateKey: string): Promise<{
  id: number
  output_type: string
  algorithm_name: string
  algorithm_version: string
  date_key: string
  input_coverage_json: string | null
  confidence: number | null
  dependency_ids: string | null
  source_raw_sample_ids: string | null
  sync_run_id: number | null
  payload_json: string
  status: string
  computed_at: string
  invalidated_at: string | null
  created_at: string
} | null> {
  return await getOne(
    `SELECT * FROM derived_outputs WHERE output_type = ? AND date_key = ? AND status = 'active' ORDER BY computed_at DESC LIMIT 1`,
    [outputType, dateKey]
  )
}
