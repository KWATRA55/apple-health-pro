CREATE TABLE IF NOT EXISTS vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  hrv REAL,
  rhr REAL,
  spo2 REAL,
  respiratory_rate REAL,
  skin_temp_delta REAL,
  created_at TEXT DEFAULT (datetime('now'))
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
  avg_hr REAL
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  image_base64 TEXT,
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
  recovery_zone TEXT
);

CREATE TABLE IF NOT EXISTS vector_documents (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,
  source TEXT,
  chunk_index INTEGER,
  title TEXT
);

CREATE INDEX IF NOT EXISTS idx_vitals_timestamp ON vitals(timestamp);
CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep(date);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals(timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON daily_scores(date);
