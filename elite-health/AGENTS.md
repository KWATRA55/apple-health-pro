# KILO AI V2 — Elite Health Expo Application Reference

 npx expo start --clear --tunnel

Welcome to the **Elite Health (KILO AI V2)** mobile app codebase documentation. This document serves as a complete, high-fidelity reference for AI agents and developers. It details the app architecture, screen-by-screen UI structure, HealthKit data pipeline, Zustand state store, local SQLite database schemas, and the sports science algorithms powering the predictive engines.

---

## 🌟 Concise App Summary & Flow

**Elite Health (KILO AI V2)** is a premium, OLED dark-mode mobile application designed for high-performance longevity and sports science. 

### Data Captured (The Input)
The app runs a highly optimized background sync pipeline using Apple HealthKit to capture real-time physiological data:
- **Vitals**: Heart Rate Variability (HRV), Resting Heart Rate (RHR), SpO2, Respiratory Rate, and Skin Temperature Delta.
- **Sleep**: Full sleep architecture (REM, Deep, Core, Awake times).
- **Activity**: Workout sessions, active calories, and heart rate zones.
- **Mobility & Dynamics**: Walking asymmetry, ground contact time, vertical oscillation, and VO2 Max.

### Analysis Performed (The Engine)
Raw data is passed through local sports-science heuristic algorithms:
- **Whoop-style Strain & Recovery**: Calculates a 0-100% recovery score and an exponential 0-21.0 daily strain limit.
- **Biological Age Engine**: Compares vitals to ideal medical baselines (e.g., a 25-year-old vs. a 40-year-old) to compute a "Pace of Aging" multiplier.
- **Risk Predictors**: Evaluates mobility data for injury risk and environmental/vitals data for Central Nervous System (CNS) burnout.

### UI Flow & Pages (The Output)
1. **Home Screen (`index.tsx`)**: The dashboard. Features a 3D procedural morphing "Longevity Sphere" that dynamically changes shape and speed based on your Pace of Aging (e.g., displaying `15.0% REVERSING`). Below it, a Daily Directive card gives you an AI-generated actionable command (e.g., "CNS OVERLOAD: Target 8:30 PM bedtime"), followed by three core pillar scores (Readiness, Resilience, Longevity).
2. **Health Screen (`health.tsx`)**: The data deep-dive. Displays a sliding Biological Age tracker, a glowing 5-metric Vitals Grid, your daily cardiac strain capacity bar, running dynamics, and your workout history timeline.
3. **Coach Screen (`coach.tsx`)**: An interactive terminal. A Gemini-powered AI Sports Scientist analyzes your live biometric payload (strain, sleep debt, recovery zone) and answers questions or suggests protocols dynamically using Retrieval-Augmented Generation (RAG).
4. **Profile Screen (`profile.tsx`)**: The historical record. Highlights your all-time Personal Records (PRs), aggregated activity summaries, and a dual-axis 7-day Strain vs. Recovery progress chart.
5. **Sleep Drilldown (`sleep.tsx`)**: Detailed sleep stage hypnograms analyzing exact REM/Deep ratios and tracking cumulative sleep debt.

---

## 📱 1. Architecture & Technology Stack

*   **Framework**: Expo SDK 54 (React Native) with `expo-router` (file-based navigation stack).
*   **Navigation Layout**: 
    *   **Root Stack**: Handled by `app/_layout.tsx` (manages deep linking, root page transitions, and registers the global Background Sync task).
    *   **Tabs Navigation**: Handled by `app/(tabs)/_layout.tsx` containing:
        *   `index.tsx` (Home Dashboard / Longevity Sphere)
        *   `health.tsx` (Biological Age, Vitals Grid, Running Dynamics)
        *   `coach.tsx` (AI Sports Scientist Chat interface)
        *   `profile.tsx` (Personal Records & Cumulative Analytics)
    *   **Drilldowns**: `app/drilldown/sleep.tsx` (Sleep architecture analysis).
*   **State Management**: `Zustand` global store (`src/lib/store.ts`) acting as the single source of truth for vitals, activity logging, and score generation.
*   **Local Storage**: `expo-sqlite` (`src/lib/db.ts`) running in Write-Ahead Logging (WAL) mode for low-latency caching and offline availability.
*   **Biometric Ingestion**: Apple HealthKit integration via `@kingstinct/react-native-healthkit` (`src/lib/healthkit.ts`), enforcing strict timezone boundaries.
*   **Styling**: `nativewind` (Tailwind CSS for React Native) paired with an OLED black theme.
*   **Animations**: `react-native-reanimated` (pressable card transitions, interactive menus) + `react-native-svg` (linear gradient vitals rings and charts).
*   **AI Coach**: Google Gemini Pro via `@google/generative-ai` (`src/lib/gemini/client.ts`) for real-time sports science dialogue and daily coaching directives.

---

## 📂 2. Directory Layout & Key Files

```
elite-health/
├── app/                      # Expo Router File-Based Routing
│   ├── (tabs)/               # Core Tab Views
│   │   ├── _layout.tsx       # Bottom Tab Navigator Configuration
│   │   ├── index.tsx         # Home Dashboard / 3D Longevity Canvas
│   │   ├── health.tsx        # Vitals Grid, Biological Age & Running Dynamics
│   │   ├── coach.tsx         # AI Sports Scientist Chat Window
│   │   └── profile.tsx       # Personal Records & 7d Strain-Recovery Charts
│   ├── drilldown/            # Push Navigation Screen Drilldowns
│   │   └── sleep.tsx         # Sleep Architecture Stage Visualizer
│   ├── workout/              # Live Activity Modules
│   │   └── live.tsx          # Real-time workout session tracker
│   └── _layout.tsx           # Global Root Navigation and Task Registration
├── src/
│   ├── components/           # Modular UI Components
│   │   ├── coach/            # Chat bubbles, message windows, typing loaders
│   │   ├── health/           # Biological age card, running dynamics charts
│   │   ├── home/             # 3D canvas sphere, bento pillar cards, directives
│   │   ├── profile/          # Record widgets, activity summaries
│   │   └── ui/               # Reusable pressable glass cards, emissive rings
│   ├── lib/                  # Application Logic and Pipelines
│   │   ├── __tests__/        # Jest math algorithm suites
│   │   ├── algorithms/       # Sports science score engines
│   │   ├── gemini/           # Gemini API Client and system prompts
│   │   ├── services/         # Background fetch sync managers
│   │   ├── workout/          # Live workout session manager (HKWorkoutSession)
│   │   ├── date.ts           # Timezone-boundary calculation helpers
│   │   ├── db.ts             # SQLite schemas, tables, query bindings
│   │   ├── healthkit.ts      # HealthKit native permission & ingestion pipeline
│   │   ├── store.ts          # Zustand Global Health Store & derived selectors
│   │   └── types.ts          # Unified TypeScript interfaces
```

---

## 🖥️ 3. Screen-by-Screen UI Reference & Data Fetching

The application operates in **absolute dark mode (OLED Black)**, with accent typography, HSL glow cards, and smooth micro-transitions.

### 🏠 A. Home Screen (`app/(tabs)/index.tsx`)
*   **Visual Layout & Components**:
    1.  **Premium 3D Orb (`PremiumOrb.tsx`)**: Rendered natively on the GPU using `react-native-reanimated`. It uses a fully hardware-accelerated 3D coordinate projection system. Trigonometric math (sine/cosine) is pre-computed at the shell level rather than per-particle to eliminate layout thrashing and ensure buttery smooth 60fps scrolling. The core text dynamically shows your pace or metric.
    2.  **Date Selector Header**: Displays `◀ TODAY ▶`. Allows horizontal date scrolling. Left/Right buttons increment/decrement dates, which instantly hydrate the UI with cached SQLite database records.
    3.  **Daily Directive Panel V2 (`DailyDirective`)**: An elevated glassmorphic card displaying:
        *   **Headline & Command**: Dynamic status alert (e.g. `CNS OVERLOAD`) and an aggressive, direct action sentence.
        *   **Target Strain & Bedtime**: Optimal daily training ceiling and calculated sleep window.
        *   **Data Guard**: If sufficient baseline data is missing, the directive intelligently displays an "Awaiting Data" state with a **Sync Now** CTA to prevent zero-confidence hallucinations.
    4.  **Weekly Planner Card (`weekly-planner-card.tsx`)**: A macro-cycle training planner that generates a weekly forecast (e.g., Active Recovery, Peak Performance) based on your 7-day rolling average of cardiovascular strain and recovery.
    5.  **Bento Grid of Predictive Pillars (`PillarCard`)**: Displays three interactive tiles representing:
        *   **Readiness**: Autonomic nervous system status (0-100 score, Teal glow).
        *   **Resilience**: Immune system, biomechanics, and CNS defenses (0-100 score, Purple glow).
        *   **Longevity**: Aging deceleration and cardiorespiratory health (0-100 score, Cyan glow).
    5.  **Activity Timeline (`ActivityTimeline`)**: Custom scroll widgets listing logged physical workouts with active calorie counts, durations, and cardiac strain bounds.
    6.  **Ask KILO Floating Prompt Bar (`AIPromptBar`)**: Sleek bottom input docked above the tab bar. Typing a question and hitting send instantly navigates the athlete to the **Coach tab** preloaded with the query.
    7.  **Safety Intercept Modal (`InterceptModal`)**: An immediate overlay triggered when critical biometrics are compromised. Examples include:
        *   `workout_block` (Biomechanical injury risk is HIGH).
        *   `rest_mandate` (CNS Stress is HIGH or Readiness is DEPLETED).
        *   `sleep_prescription` (Accumulated sleep debt exceeds 2 hours).
*   **How Data is Fetched & Calculated**:
    *   On layout mount, calls `loadFromDB()` to pull all cached historical logs for local hydration.
    *   Initiates `syncHealthKit()` to sync any fresh native samples from Apple Health.
    *   Computes derived metrics using the `computeSynthesis(state, dateStr)` selector. This compiler pipes raw data arrays into the heuristic coordination engine to yield warning flags, directives, and pillar states.

### 📊 B. Health Screen (`app/(tabs)/health.tsx`)
*   **Visual Layout & Components**:
    1.  **Biological Age Visualizer (`BiologicalAge`)**: Features a horizontal offset slider aligning calendar chronological age against calculated biological cellular age, visually demonstrating longevity gaps.
    2.  **Health Monitor Strip (`HealthMonitorStrip`)**: A progress checklist comparing baseline stability (e.g., `5/5 Vitals Stable`).
    3.  **High-Resolution Vitals Grid (`VitalsGrid`)**: Renders five glowing status modules for:
        *   **HRV** [ms]
        *   **Resting HR** [bpm]
        *   **SpO2** [%]
        *   **Respiratory Rate** [breaths/min]
        *   **Skin Temp Delta** [°C]
    4.  **Cardiac Strain progress**: Expansive progress bar visualizing cumulative daily training load against the 21.0 capacity, colored green (light), yellow (moderate), or red (high).
    5.  **Running Dynamics Bento (`RunningDynamicsCard`)**: Standard double-column block comparing today's running parameters against the rolling 14-day average:
        *   **Ground Contact Time** [ms]
        *   **Running Power** [watts]
        *   **Vertical Oscillation** [cm]
        *   **Stride Length** [m]
    6.  **Workout History Cards**: Renders exercise session widgets showing active calories, duration, and cardiovascular strain metrics.
*   **How Data is Fetched & Calculated**:
    *   Binds directly to vitals, scores, and activity arrays cached in the Zustand state.
    *   Filters metrics via date parsing: `vitals.find(v => v.timestamp.startsWith(dateStr))`.
    *   Computes metrics-in-range counts using standard medical constraints:
        *   SpO2 $\ge 95\%$
        *   RHR between $40$ and $80$ bpm
        *   HRV $> 20$ ms
        *   Respiratory Rate between $8$ and $25$ breaths/min
        *   Skin Temp Delta within $\pm2^\circ\text{C}$ of baseline.

### 💬 C. Coach Screen (`app/(tabs)/coach.tsx`)
*   **Visual Layout & Components**:
    1.  **Sports Scientist Terminal**: Dedicated dark chat view showcasing interactive bubbles for the athlete (`user`) and the coach (`assistant`).
    2.  **Cardiorespiratory Dashboards**: Real-time evaluation of VO2 Max and Resting Energy. Displays explicit **Data Confidence** states (e.g., "High Confidence — Synced from Apple Health" or "Partial Confidence — RMR unavailable") to maintain transparency when biometrics are missing.
    3.  **Quick Suggestion Cards**: Rendered dynamically if chat history is empty:
        *   *"Analyze my CNS Fatigue"*
        *   *"Is my running form off? Check form dynamics."*
        *   *"Predict my injury risk based on mobility."*
        *   *"How is my sleep quality and deep sleep trend?"*
    4.  **Chat Input**: Anchored to the bottom, styled in glassmorphic overlay, disabled during coach synthesis.
*   **How Data is Fetched & Calculated**:
    *   When a prompt is sent, the store packages the user's latest biometrics into a high-density JSON payload:
        ```json
        {
          "recoveryScore": 84,
          "strainScore": 12.8,
          "sleepDebtHours": 0.4,
          "sleepNeedHours": 8.2,
          "hrvZScore": 1.2,
          "rhrZScore": -0.8,
          "recoveryZone": "green",
          "vitals": { "hrv": 78, "rhr": 54, "spo2": 99, "respiratoryRate": 14.5, "skinTempDelta": 0.1 },
          "sleep": { "totalDurationMins": 490, "remMins": 110, "deepMins": 95 },
          "mobility": { "walkingSpeed": 1.45, "walkingAsymmetry": 0.8, "doubleSupport": 26.2 },
          "runningDynamics": { "runningPower": 320, "groundContactTime": 215, "verticalOscillation": 7.8 },
          "derivedPredictions": { "injuryRisk": { "risk": "LOW" }, "cnsStressScore": { "risk": "LOW" } }
        }
        ```
    *   Pipes this biometric block along with the last 8 messages of history to the Gemini Pro model (`sendCoachMessage()`).
    *   Outputs aggressive, structured coaching commands aligned with the system persona rules.

### 👤 D. Profile Screen (`app/(tabs)/profile.tsx`)
*   **Visual Layout & Components**:
    1.  **Athlete Identity Panel**: Custom card presenting the athlete's initials, name, count of recorded workouts, database logging days, and subjective journal entries.
    2.  **Personal Records Bento Grid (`PersonalRecords`)**: Highlights all-time maximum parameters achieved:
        *   *Max Cardiac Strain*
        *   *Longest Sleep Duration*
        *   *Lowest Recovery Anomaly*
    3.  **Insights Navigation**: Direct routing buttons to `Weekly` and `Monthly` summary drilldown screens for macroeconomic historical analysis.
    4.  **Activity Summary widgets (`ActivitySummary`)**: Aggregated categorical list tracking logged training sessions by type (e.g., Running, HIIT, Strength) alongside their average strain.
    5.  **7-Day Strain vs. Recovery Chart (`StrainRecoveryChart`)**: Custom dual horizontal progress metrics illustrating daily cardiac stress (cyan) directly against nighttime sleep restoration (recovery HSL tone).
    6.  **Data Export Section (`ExportTools`)**: Allows athletes to export their raw local SQLite database into standard CSV formats for external coaching analysis.
*   **How Data is Fetched & Calculated**:
    *   Pipes raw activity, sleep, and scores arrays from the local Zustand store.
    *   Runs array reductions (`.reduce()`) to calculate average metrics per sport type and identify lifetime records dynamically.

### 😴 E. Sleep Architecture Drilldown Screen (`app/drilldown/sleep.tsx`)
*   **Visual Layout & Components**:
    1.  **Sleep Stage Hypnogram (`SleepDrilldown`)**: Custom graphical render charting exact sleep phase breakdowns (Core, REM, Deep, and Awake times in minutes).
    2.  **Sleep Quality Dashboard**: Displays calculated sleep efficiency (%), REM and Deep ratios, and rolling 7-day sleep debt offsets.
*   **How Data is Fetched & Calculated**:
    *   Pushed from the Home or Health screens with a `date` string parameter.
    *   Hydrates using `computeSleepArchitecture(sleepRecord)` which extracts sleep parameters and applies sleep quality scoring matrices.

### 📅 F. Weekly Summary Drilldown (`app/drilldown/weekly-summary.tsx`)
*   **Visual Layout & Components**:
    1.  **Week Offset Header**: Allows paginating back into historical 7-day windows.
    2.  **Mini Sparklines**: Miniature horizontal bar arrays visualizing rolling 7-day trends for HRV, RHR, SpO2, and Sleep durations.
    3.  **Strain Bar Chart**: Daily cardiac strain columns mapped over the 7 days, color-coded for optimal, overload, or under-training thresholds.
    4.  **CNS & Daylight Dual Chart**: Compares cumulative Central Nervous System stress against measured Daylight Exposure (in minutes) side-by-side.
    5.  **Trend & Correlation Explorers (`TrendExplorer`, `CorrelationExplorer`)**: Advanced statistical blocks identifying direct correlations (e.g., "Late sleep reduces HRV by 12%") based on the last 7 days of behavioral inputs and biometrics.
    6.  **AI Weekly Insight**: A dynamically generated semantic paragraph interpreting the week's physiological load and recovery status.

### 📆 G. Monthly Summary Drilldown (`app/drilldown/monthly-summary.tsx`)
*   **Visual Layout & Components**:
    1.  **Month Offset Header**: Allows paginating back into historical 30-day blocks.
    2.  **Recovery Heatmap / Map**: A calendar view or high-density distribution graph plotting 30 days of readiness scores (Green, Yellow, Red) to visualize long-term autonomic balance.
    3.  **VO2 Max & Long-Term Trends**: Focuses on slower-moving macro indicators like VO2 Max, Biological Age velocity, and chronic sleep debt accumulation over the month.

### 🏃‍♂️ H. Live Workout Screen (`app/workout/live.tsx`)
*   **Visual Layout & Components**:
    1.  **Live HUD**: Full-screen, high-contrast dashboard displaying real-time Heart Rate, Active Calories, and Elapsed Time.
    2.  **Simulation Badge**: A `SIMULATED` warning pill appears if native `HKWorkoutSession` is unavailable.
*   **How Data is Fetched & Calculated**:
    *   Uses `src/lib/workout/live-session.ts` to boot a native Apple Watch `HKWorkoutSession`.
    *   If running in Expo Go or a non-native environment, it gracefully degrades into **Simulated Mode**, feeding mathematical HR curves into the UI so developers can test the tracker without an Apple Watch.
    *   On workout end, automatically persists the session to Apple Health and re-computes today's Cardiac Strain score.

---

## 🚰 4. Data Ingestion & Storage Pipelines

### 🔁 A. Apple HealthKit Sync Engine (`src/lib/healthkit.ts`)
1.  **Permissions Request (`requestHealthPermissions`)**: Requests authorization to read biometrics across native categories:
    *   *Vitals*: Heart Rate, HRV (RMSSD), SpO2, Respiratory Rate, Wrist Temperature.
    *   *Sleep*: Sleep Analysis (REM, Deep, Core, Awake states).
    *   *Activity*: Active Energy, Workout logs, Heart Rate Zones.
    *   *Mobility*: Walking Speed, Walking Asymmetry %, Stride Length, Double Support %, Walking Step Length, Stair Speed Ascent/Descent, Flights Climbed.
    *   *Cardio-Metabolic & Environment*: VO2 Max, Environmental Audio Exposure (dB), Time in Daylight (mins), Standing Hours.
2.  **Strict Mocking Deprecation**: HealthKit queries explicitly return `null` if the native module is unavailable or permissions are denied. The previous mock-data generators have been removed to ensure the UI only ever operates on true, high-confidence athlete biometrics.
3.  **Hourly Background Execution**: Registered under the `expo-task-manager` API as `BACKGROUND_HEALTH_SYNC_TASK`. Triggers automatically in the background to fetch raw metrics, write them to the local SQLite DB, execute sports science scoring engines, and cache daily scores without requiring an app wake.
4.  **Timezone Integrity Helpers**: Ensures all metric queries align with local calendar windows using:
    *   `startOfDayLocal(date)` -> returns start of day ISO timestamp.
    *   `endOfDayLocal(date)` -> returns end of day ISO timestamp.
    *   `localDateString(date)` -> returns `YYYY-MM-DD` localized calendar date.

### 🗄️ B. SQLite Database Schema (`src/lib/db.ts`)
The database engine is initialized on startup under write-ahead logging (WAL) mode.
```sql
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
  source TEXT DEFAULT 'manual'
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
  immunity_risk TEXT DEFAULT 'LOW'
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
  stand_hours INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cardio_metabolic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  vo2_max REAL DEFAULT 0,
  walking_hr_avg REAL DEFAULT 0,
  resting_energy REAL DEFAULT 0,
  physical_effort REAL DEFAULT 0,
  breathing_disturbances REAL DEFAULT 0
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_vitals_timestamp ON vitals(timestamp);
CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep(date);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON daily_scores(date);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_mobility_date ON mobility(date);
CREATE INDEX IF NOT EXISTS idx_environmental_date ON environmental(date);
CREATE INDEX IF NOT EXISTS idx_cardio_metabolic_date ON cardio_metabolic(date);
```

### 🧠 C. Zustand Global Store (`src/lib/store.ts`)
*   **State Structure**: Coordinates cache hydration arrays, syncing flags (`isSyncing`), and derived predictions (`injuryRisk`, `cnsStressScore`).
*   **Key Operations**:
    *   `loadFromDB()`: Runs SQLite selection calls, normalizes types, maps raw snake_case database schema fields to typed camelCase properties, and computes initial biomechanical injury risks and CNS stress scores.
    *   `syncHealthKit()`: Requests permissions, queries the last 14 days of Apple Health records sequentially, triggers inserts to database tables, and executes scoring engines.
    *   `computeScores(dateStr)`: Core pipeline executing biometrics scoring and saving computed summaries to `daily_scores`. Includes a strict data guard: if no real biometrics or activities exist for the date, score computation is aborted and placeholders are purged.
    *   `computeSynthesis(state, dateStr)`: Core global selector unifying all 11 tables and dynamic metrics into a single reactive interface.

---

## 🧬 5. Sports Science Scoring Algorithms & Mathematical Formulas

The entire application biometrics core relies on calculated statistical models derived from sports medicine literature.

### 🟩 A. Whoop-Style Recovery Score (`src/lib/algorithms/recovery.ts`)
*   **Logical Overview**: Evaluates autonomic nervous system balance (RMSSD HRV and RHR) by calculating statistical deviations (Z-scores) from rolling 14-day baselines, combined with a non-linear sleep quality factor.
*   **Formula**:
    $$\text{Recovery Score} = \text{clamp}\left( \text{Norm}_{\text{HRV}} \cdot 0.5 + \text{Norm}_{\text{RHR}} \cdot 0.3 + \text{Sleep Quality Factor} \cdot 0.2 \right) \times 100$$
*   **Mathematical Derivation**:
    1.  **Z-Scores**: Measures how today's HRV and RHR deviate from the rolling 14-day baseline:
        $$Z_{\text{HRV}} = \frac{\text{HRV}_{\text{today}} - \mu_{\text{HRV}}}{\sigma_{\text{HRV}}}$$
        $$Z_{\text{RHR}} = \frac{\text{RHR}_{\text{today}} - \mu_{\text{RHR}}}{\sigma_{\text{RHR}}}$$
    2.  **Normalization**: Z-scores are clamped strictly between 0 and 1:
        $$\text{Norm}_{\text{HRV}} = \text{clamp}\left(\frac{Z_{\text{HRV}} + 2}{4}, 0, 1\right)$$
        $$\text{Norm}_{\text{RHR}} = \text{clamp}\left(\frac{-Z_{\text{RHR}} + 2}{4}, 0, 1\right)$$
        *(Note: Resting HR is inversely related to recovery, so $-Z_{\text{RHR}}$ is utilized).*
    3.  **Sleep Quality Factor (Sigmoid Function)**:
        $$\text{Ratio}_{\text{sleep}} = \min\left(\frac{\text{Hours}_{\text{actual}}}{\text{Hours}_{\text{need}}}, 2\right)$$
        $$\text{Sleep Quality Factor} = \frac{1}{1 + e^{-4 \cdot (\text{Ratio}_{\text{sleep}} - 0.85)}}$$
        *(This creates a sigmoidal curve: sleeping below 85% of need severely penalizes recovery, while sleep above it reaches a flat plateau).*
*   **Zones**: 🟢 **Green** ($67-100\%$), 🟡 **Yellow** ($34-66\%$), 🔴 **Red** ($0-33\%$).

---

### 🟥 B. Whoop-Style Cardiac Strain Score (`src/lib/algorithms/strain.ts`)
*   **Logical Overview**: Quantifies physical exertion by integrating heart rate zones exponentially. Utilizes a logarithmic compression model so that a score of 21.0 represents physiological absolute maximum effort.
*   **Formula**:
    $$\text{Weighted Sum} = \sum (\text{Zone Duration in seconds})_i \cdot \text{Weight}_i$$
    $$\text{Strain Score} = \text{clamp}\left(\ln(1 + \text{Weighted Sum}) \times 2.5, 0, 21.0\right)$$
*   **Weights per Heart Rate Zone**:
    *   **Zone 1** (Recovery, 50-60% Max HR): Weight = $1$
    *   **Zone 2** (Endurance, 60-70% Max HR): Weight = $2$
    *   **Zone 3** (Tempo, 70-80% Max HR): Weight = $4$
    *   **Zone 4** (Threshold, 80-90% Max HR): Weight = $8$
    *   **Zone 5** (VO2 Max, 90-100% Max HR): Weight = $16$
    *(High-intensity zones accumulate strain exponentially faster, while logarithmic compression simulates cardiovascular limits).*

---

### 🌙 C. Sleep Need and Sleep Debt (`src/lib/algorithms/sleep-debt.ts`)
*   **Logical Overview**: Manages a rolling 7-day sleep debt accumulation model. As sleep debt grows, the daily target sleep need is dynamically increased to pay back the physiological debt.
*   **Formula**:
    1.  **Baseline Sleep Need**: Set to a standard $8.0$ hours.
    2.  **Cumulative Sleep Debt**:
        $$\text{Sleep Debt} = \sum_{d=1}^{7} \max\left(0, \text{Sleep Need}_d - \text{Sleep Duration}_d\right)$$
    3.  **Adjusted Sleep Need**:
        $$\text{Average Daily Debt} = \frac{\text{Sleep Debt}}{\text{Days Recorded}}$$
        $$\text{Adjusted Sleep Need} = 8.0 + (\text{Average Daily Debt} \times 0.5)$$

---

### 📈 D. Sleep Quality & Performance Score (`src/lib/algorithms/sleep-performance.ts`)
*   **Logical Overview**: Analyzes sleep phases (REM and Deep ratios) and applies compounding penalties for sleep debt and excessive awake periods.
*   **Formula**:
    1.  **Phase Sub-Scores** *(deviations against medical standards)*:
        *   **Ideal REM ratio**: $22\%$ ($0.22$)
        *   **Ideal Deep ratio**: $17\%$ ($0.17$)
        $$\text{Score}_{\text{REM}} = 1 - \min\left(1, \frac{|\text{Ratio}_{\text{REM}} - 0.22|}{0.22}\right)$$
        $$\text{Score}_{\text{Deep}} = 1 - \min\left(1, \frac{|\text{Ratio}_{\text{Deep}} - 0.17|}{0.17}\right)$$
        $$\text{Score}_{\text{Duration}} = \min\left(1, \frac{\text{Hours}_{\text{actual}}}{\text{Hours}_{\text{need}}}\right)$$
    2.  **Weighted Base Sleep Quality**:
        $$\text{Base Quality} = (\text{Score}_{\text{REM}} \cdot 0.35 + \text{Score}_{\text{Deep}} \cdot 0.35 + \text{Score}_{\text{Duration}} \cdot 0.3) \cdot 100$$
    3.  **Compounding Penalties**:
        *   *Sleep Debt penalty*:
            *   If $\text{Sleep Debt} > 2.0\text{ hrs} \implies \text{Base Quality} \leftarrow \text{Base Quality} \cdot 0.85$
            *   Else if $\text{Sleep Debt} > 1.0\text{ hr} \implies \text{Base Quality} \leftarrow \text{Base Quality} \cdot 0.92$
        *   *Awake Ratio penalty*:
            *   If $\frac{\text{Awake Mins}}{\text{Total Sleep Duration}} > 10\% \implies \text{Base Quality} \leftarrow \text{Base Quality} \cdot 0.90$

---

### ⏳ E. Biological Age & Longevity Engine (`src/lib/algorithms/biological-age.ts`)
*   **Logical Overview**: Translates biometric markers (HRV, RHR, SpO2) into cellular health age, evaluating them against average metrics of a healthy 25-year-old vs. 40-year-old.
*   **Formula**:
    1.  **Ideal References**:
        *   **Age 25 (Ideal)**: $\text{HRV} = 65\text{ms}$, $\text{RHR} = 62\text{bpm}$, $\text{SpO2} = 98\%$
        *   **Age 40 (Reference)**: $\text{HRV} = 55\text{ms}$, $\text{RHR} = 66\text{bpm}$, $\text{SpO2} = 97\%$
    2.  **Biometric Deviations**:
        $$\text{Sub}_{\text{HRV}} = \frac{65 - \text{HRV}_{\text{today}}}{10}$$
        $$\text{Sub}_{\text{RHR}} = \frac{\text{RHR}_{\text{today}} - 62}{4}$$
        $$\text{Sub}_{\text{SpO2}} = 98 - \text{SpO2}_{\text{today}}$$
    3.  **Composite Age Delta**:
        $$\text{Composite} = \frac{\text{Sub}_{\text{HRV}} \cdot (-0.4) + \text{Sub}_{\text{RHR}} \cdot 0.35 + \text{Sub}_{\text{SpO2}} \cdot (-0.15)}{0.9}$$
        $$\text{Biological Age} = \text{clamp}(25 + \text{Composite} \cdot 15, 18, 80)$$
    4.  **Pace of Aging**:
        $$\text{Pace of Aging} = \text{clamp}\left(1.0 + \frac{\text{Biological Age} - \text{Age}_{\text{chronological}}}{\max(1, \text{Age}_{\text{chronological}} - 18)}, 0.5, 2.0\right)$$
        *(Pace of Aging < 1.0 indicates physiological deceleration of aging).*

---

### ⚡ F. Central Nervous System (CNS) Stress (`src/lib/algorithms/cns-stress.ts`)
*   **Logical Overview**: Tracks autonomic fatigue and lifestyle/environmental stress (lack of natural daylight exposure and high decibel auditory load).
*   **Formula**: Starts at a baseline stress score of 20, adding cumulative penalty points up to 100:
    *   **Auditory Decibels Penalty**: $+25$ points if average dB > 80dB; $+10$ points if > 70dB.
    *   **Daylight Penalty**: $+20$ points if daylight exposure < 20 mins; $+10$ points if < 40 mins.
    *   **Autonomic HRV Suppression**: $+25$ points if HRV is suppressed by $\ge 10\%$ below baseline.
    *   **Sleep Deficit**: Up to $+20$ points scaled linearly with daily sleep debt.
*   **Stress Risk Boundaries**: 🟢 **Low** ($\le 40$), 🟡 **Moderate** ($41-65$), 🔴 **High** ($>65$).

---

### 🛡️ G. Clinical Illness & Injury Predictors

#### 🌡️ Immune/Illness Risk (`src/lib/algorithms/illness-predictor.ts`)
Evaluates nocturnal physiological anomalies:
*   Wrist temperature spike: $\ge +0.5^\circ\text{C}$ baseline delta.
*   Respiratory rate disturbances: $\ge 8$ apnea/disruption events/hour.
*   Resting HR elevation: $+4$ bpm above baseline.
*   SpO2 drop: $&lt; 95\%$.
*   HRV crash: $\ge 15\%$ drop below rolling baseline.
*   *Triggers: **LOW** (0-1 alerts), **ELEVATED** (2 alerts), or **HIGH** (3+ alerts) risk flags.*

#### 🦵 Biomechanical Injury Risk (`src/lib/algorithms/injury-predictor.ts`)
Analyzes flat-ground walking dynamics and running kinematics:
*   Walking Asymmetry: $> 5.0\%$ gait imbalance.
*   Double Support Phase: Spike of $\ge +2.0\%$ deviation from historical average.
*   Stair Descent Speed: $\ge 10\%$ decrease (indicates quadricep/knee instability).
*   Ground Contact Time (GCT): Running contact time increase of $> 15$ ms from baseline.
*   *Triggers: **LOW**, **MODERATE**, or **HIGH** injury risk alerts.*

---

### 📅 H. Weekly Periodization Planner (`src/lib/algorithms/weekly-planner.ts`)
*   **Logical Overview**: Analyzes the last 7 days of Recovery, Strain, and Sleep to output a macro-cycle daily recommendation (e.g., Peak Performance vs. Base Build).
*   **Formula**:
    *   Compares the 3-day short-term rolling average (Acute Load) vs. the 7-day rolling average (Chronic Load).
    *   Outputs categorical intensity targets based on the Acute:Chronic Workload Ratio (ACWR).
    *   Guards against predicting without at least 7 days of real, solid biometric data.

---

### 🧬 I. Heuristic Synthesis Coordination (`src/lib/algorithms/heuristic-synthesis.ts`)
Unifies individual vitals and algorithms into three master pillars:

#### 1. Readiness (Autonomic Reserve)
Compiles autonomic capacity using weighted biometric scores:
*   $50$ points allocated to HRV rolling baseline ratio.
*   $25$ points allocated to RHR rolling baseline ratio.
*   $25$ points allocated to daily Sleep Duration ratio.
*   *Ranges*: 🟢 **Optimal/Primed** ($\ge 75$), 🟡 **Attention/Moderate** ($41-74$), 🔴 **Critical/Depleted** ($\le 40$).

#### 2. Resilience (Defensive Integrity)
Evaluates physiological structural integrity. Starts at 85 points and subtracts compounding penalties:
*   Immunity Risk: $-30$ for HIGH, $-15$ for ELEVATED.
*   Injury Risk: $-25$ for HIGH, $-12$ for MODERATE.
*   Wrist Temp: $-8$ for temperature delta $> 0.5^\circ\text{C}$.
*   Breathing: $-8$ for disturbances $> 8$ events/hour.
*   SpO2: $-10$ for blood oxygen saturation $&lt; 95\%$.
*   CNS Stress: $-20$ for HIGH, $-8$ for MODERATE.
*   *Ranges*: 🟢 **Optimal/Robust** ($\ge 75$), 🟡 **Attention/Guarded** ($36-74$), 🔴 **Critical/Fragile** ($\le 35$).

#### 3. Longevity (Senescence Trajectory)
Assesses cellular longevity. Starts at 50 points and applies adjustments:
*   Pace of Aging: $+40$ points if rejuvenating ($\le 1.0$), $+20$ points if steady ($&lt; 1.1$), $+5$ points if neutral ($&lt; 1.2$), $-15$ points if accelerating ($\ge 1.2$).
*   VO2 Max: $+20$ points for every $10\%$ ratio improvement over physiological age ideals (ideal VO2 Max $= 45 - (\text{age} - 25) \times 0.3$).
*   Double Support: Subtracts $4$ points per percent deviation above double support gait ideals (ideal double support $= 26 + (\text{age} - 25) \times 0.1$).
*   *Ranges*: 🟢 **Optimal/Rejuvenating** ($\ge 75$), 🟡 **Attention/Neutral** ($36-74$), 🔴 **Critical/Accelerating** ($\le 35$).

#### 4. Derived Directives & Intercept Modal Triggers
*   **Target Strain**:
    $$\text{Target Strain} = \text{clamp}\left(21 \times \min(\text{Readiness Factor}, \text{Resilience Factor}), 2.0, 21.0\right)$$
    *(Forces the physical training ceiling down to protect the athlete if recovery or structural resilience is compromised).*
*   **Target Bedtime**:
    *   If sleep debt $> 2$ hours or CNS Stress is HIGH $\implies$ `8:30 PM` bedtime prescription.
    *   If sleep debt $> 1$ hour or CNS Stress is MODERATE $\implies$ `9:00 PM` or `9:30 PM` bedtime prescription.
    *   All systems nominal $\implies$ standard `10:30 PM` bedtime.
*   **Workout Block Alert (`workout_block`)**:
    *   Triggered when Biomechanical Injury Risk is **HIGH**. Enforces an interface block advising against impact training, recommending restorative mobility alternatives.
*   **Rest Mandate Alert (`rest_mandate`)**:
    *   Triggered when CNS Stress is **HIGH** or Readiness is **DEPLETED**. Advises against high-intensity training, suggesting active recovery protocols instead.

---

## 🎨 6. Design System & Aesthetics Tokens

### 🌈 Color Palette (Tailwind / NativeWind)
*   **Base Canvas**: OLED Black (`#000000`) for absolute contrast, visual premium quality, and battery savings.
*   **Surfaces**:
    *   `obsidian-900` (`#121214`): Primary card backgrounds, floating inputs.
    *   `obsidian-800` (`#161618`): Secondary widgets, dropdown headers.
    *   `obsidian-700` (`#18181B`): Selectors, list row surfaces.
*   **Borders**: `border-dim` (`rgba(255,255,255,0.05)`): Subtle, micro-borders for refined card division.
*   **Accent Channels**:
    *   `accent-volt` (`#CCFF00`): High-energy biometrics, Strain scores.
    *   `accent-cyan` (`#00E5FF`): Coach interfaces, Vitals, active points.
    *   `accent-crimson` (`#FF3366`): Alerts, delete buttons, critical zones.
    *   `accent-amber` (`#FFB800`): Moderate warning flags, progress indicators.
*   **Pillars**:
    *   `pillar-readiness`: Teal (`#14B8A6`)
    *   `pillar-resilience`: Purple (`#A855F7`)
    *   `pillar-longevity`: Cyan (`#00E5FF`)

### ✍️ Typography Hierarchy
*   **Numbers & Primary Headings**: `SF Pro Display` (featuring dynamic letter-spacing tracking for metrics).
*   **Body & Guidelines**: `Inter` (optimal reading scale across device screens).
*   **Biometrics logs & SQLite logs**: `JetBrains Mono` (monospaced numeric layouts).
