# Elite Health Pipeline Re-Architecture Plan

> **Date:** 2026-05-24
> **Scope:** Complete health data pipeline — from Apple HealthKit ingestion through SQLite storage, Zustand hydration, algorithm derivation, UI rendering, and AI coach payload assembly
> **Status:** Architectural plan — no code changes yet

---

## Table of Contents

1. [Current-State Architecture Map](#1-current-state-architecture-map)
2. [Problems Found in the Current Pipeline](#2-problems-found-in-the-current-pipeline)
3. [Proposed Target Architecture](#3-proposed-target-architecture)
4. [Data Model Redesign](#4-data-model-redesign)
5. [Sync/Reconciliation Design](#5-syncreconciliation-design)
6. [Canonical Selector / View-Model Contract Design](#6-canonical-selector--view-model-contract-design)
7. [Screen-by-Screen Migration Plan](#7-screen-by-screen-migration-plan)
8. [AI Payload Redesign](#8-ai-payload-redesign)
9. [Debug/Observability Plan](#9-debugobservability-plan)
10. [Rollout Plan in Safe Migration Phases](#10-rollout-plan-in-safe-migration-phases)
11. [Risks, Tradeoffs, and Validation Plan](#11-risks-tradeoffs-and-validation-plan)
12. [Assumptions Needing Device-Side Validation](#12-assumptions-needing-device-side-validation)

---

## 1. Current-State Architecture Map

### 1.1 Pipeline Layers (Top-Down)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LAYER 5: UI COMPONENTS                           │
│                                                                          │
│  ┌──────┐ ┌───────┐ ┌───────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Home │ │Health │ │Coach  │ │ Profile  │ │  Sleep   │ │  Live    │  │
│  │index │ │health │ │coach  │ │profile   │ │ Drilldown│ │ Workout  │  │
│  │.tsx  │ │.tsx   │ │.tsx   │ │.tsx      │ │sleep.tsx │ │live.tsx  │  │
│  └──┬───┘ └──┬────┘ └──┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│     │        │         │           │             │            │         │
│     │  33 screen/component files total (see audit)              │         │
│     │  ◄── 7 screens silently mix scopes                       │         │
│     │  ◄── 7 empty-state fabrications                          │         │
│     │  ◄── Only 6 surface any provenance                       │         │
└─────┼────────┼─────────┼───────────┼─────────────┼────────────┼─────────┘
      │        │         │           │             │            │
      ▼        ▼         ▼           ▼             ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: HOOKS / SELECTOR BRIDGE                      │
│                                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  useSelectedDateHealthState()              │  primary derivation pt   │
│  │  • currentScores  = scores.find(date)      │  ◄── NO scope label     │
│  │  • currentVitals  = vitals.find(date)      │  ◄── silently nulls     │
│  │  • currentSleep   = sleep.find(date)       │                         │
│  │  • synthesis      = computeSynthesis()     │                         │
│  │  • trendReport    = computeTrendReport()   │                         │
│  │  • cnsStressScore = synthesis.cnsStress    │                         │
│  │  • injuryRisk     = synthesis.injuryRisk   │                         │
│  └────────────────────────────────────────────┘                         │
│                                                                          │
│  Also: computeSleepArchitecture(), computeTrendReportSelector(),         │
│        computeCorrelationInsightsSelector(), generateWeeklyPlanSelector()│
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: ZUSTAND STORE (store.ts)                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  useHealthStore() — In-Memory State                             │    │
│  │  • vitals[], sleep[], activities[], meals[], scores[]           │    │
│  │  • runningDynamics[], mobility[], environmental[]               │    │
│  │  • cardioMetabolic[], weightHistory[], journalEntries[]         │    │
│  │  • latestVitals, latestSleep, latestScores                      │    │
│  │  • injuryRisk, cnsStressScore (recomputed in-memory)            │    │
│  │  • selectedDate (string), isSyncing, isLoading                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Key actions:                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ syncHealthKit()                                                 │    │
│  │  1. requestHealthPermissions()                                  │    │
│  │  2. Fetch dates (today, yesterday, any missing in last 30d)     │    │
│  │  3. For each date: parallel fetch 8 categories                  │    │
│  │  4. Transactional write to SQLite (DELETE-INSERT for each)      │    │
│  │  5. loadFromDB() → rehydrate all arrays                         │    │
│  │  6. computeScores() for each synced date (oldest→newest)        │    │
│  │  7. invalidateAllCaches(), set lastSync                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ computeInjuryRisk() — line 246                                   │    │
│  │   todayMobility = mobility.find(date) || mobility[0]  ◄── SCOPE │    │
│  │   todayDynamics  = dynamics.find(date) || dynamics[0]  ◄── MIX  │    │
│  │ computeCnsStressScore() — line 298                               │    │
│  │   todayEnv = environmental.find(date) || environmental[0]        │    │
│  │   todayCardio = cardioMetabolic.find(date) || cardioMetabolic[0] │    │
│  │   todayVitals = vitals.find(date) || vitals[0]                   │    │
│  │   todaySleep = sleep.find(date) || sleep[0]                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Fingerprint-based memoization (module-level Map):                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ derivedCache: Map<string, CacheEntry>                            │    │
│  │ Fingerprint = lengths + first entries of 7 arrays joined by '|'  │    │
│  │ Only invalidated on: array length changes OR first entry change  │    │
│  │ NOT invalidated on: data freshness, sync completion (indirectly) │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               LAYER 2: SQLITE STORAGE (db.ts)                            │
│                                                                          │
│  Tables (13):                                                            │
│  ┌──────────────┬──────────────────────────────────────────────────┐    │
│  │ vitals       │ timestamp, hrv, rhr, spo2, respiratory_rate,     │    │
│  │              │ skin_temp_delta                                    │    │
│  │ sleep        │ date (UNIQUE), total_duration_mins, rem_mins,     │    │
│  │              │ deep_mins, core_mins, awake_mins, sleep_need_hrs, │    │
│  │              │ sleep_debt_hrs, bedtime_start, wake_time_end      │    │
│  │ activity     │ timestamp, active_calories, workout_type,         │    │
│  │              │ duration_mins, hr_zones (JSON), max_hr,           │    │
│  │              │ strain_score, avg_hr, source                      │    │
│  │ daily_scores │ date (UNIQUE), recovery_score, strain_score,     │    │
│  │              │ sleep_debt_hours, sleep_need_hours, hrv_z_score,  │    │
│  │              │ rhr_z_score, recovery_zone, biological_age,       │    │
│  │              │ pace_of_aging, immunity_risk, bio_age_confidence, │    │
│  │              │ bio_age_inputs_used, bio_age_inputs_missing,      │    │
│  │              │ bio_age_primary_driver                             │    │
│  │ mobility     │ date (UNIQUE), steps, walking_speed,              │    │
│  │              │ walking_step_length, walking_asymmetry,           │    │
│  │              │ double_support, stair_speed_up, stair_speed_down, │    │
│  │              │ flights_climbed                                    │    │
│  │ environmental│ date (UNIQUE), time_in_daylight, headphone_audio, │    │
│  │              │ exercise_minutes, stand_minutes, stand_hours,     │    │
│  │              │ mindful_minutes                                    │    │
│  │ cardio_meta- │ date (UNIQUE), vo2_max, walking_hr_avg,          │    │
│  │ bolic        │ resting_energy, physical_effort,                  │    │
│  │              │ breathing_disturbances, hr_recovery               │    │
│  │ running_     │ timestamp, running_power, ground_contact_time,    │    │
│  │ dynamics     │ vertical_oscillation, stride_length               │    │
│  │ weight_      │ timestamp, weight_kg, lean_body_mass_percent      │    │
│  │ history      │                                                    │    │
│  │ meals        │ timestamp, protein_grams, carbs_grams,            │    │
│  │              │ fat_grams, total_calories, meal_description       │    │
│  │ journal_     │ date (UNIQUE), habits (JSON), notes               │    │
│  │ entries      │                                                    │    │
│  │ sync_        │ key (PRIMARY), value, updated_at                  │    │
│  │ metadata     │                                                    │    │
│  │ vector_      │ id, content, embedding (BLOB), source,            │    │
│  │ documents    │ chunk_index, title                                 │    │
│  │ migration_   │ key (PRIMARY), applied_at                         │    │
│  │ meta         │                                                    │    │
│  └──────────────┴──────────────────────────────────────────────────┘    │
│                                                                          │
│  Key observations:                                                       │
│  ◄── NO raw_sample table (samples are normalized to daily rows on       │
│       ingestion, individual sample identity/provenance is discarded)    │
│  ◄── NO sync_run tracking (syncs are fire-and-forget)                   │
│  ◄── NO provenance columns on any table (no algorithm_version,          │
│       computed_at, source_raw_sample_ids)                                │
│  ◄── NO stale-data detection columns (no invalidated_at, sync_run_id)   │
│  ◄── DELETE-before-INSERT pattern loses history on re-sync               │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               LAYER 1: HEALTHKIT INGESTION (healthkit.ts)                │
│                                                                          │
│  Fetches per-date (single day):                                          │
│  ┌───────────────────────┬──────────────────────────────────────────┐   │
│  │ fetchVitalsForDate()  │ Queries: HRV, RHR, SpO2, RR, WristTemp   │   │
│  │                       │ limit 1, descending → takes LATEST sample │   │
│  │ fetchSleepForDate()   │ Query: SleepAnalysis (prev 7pm → 2pm)    │   │
│  │                       │ Aggregates stage durations from all       │   │
│  │                       │ samples in window                         │   │
│  │ fetchActivitiesFor-   │ Query: Workout samples, then per-workout  │   │
│  │ Date()                │ HR samples (limit 500) for zone calc      │   │
│  │ fetchRunningDynamics- │ Queries: Power, GCT, Vertical Osc,       │   │
│  │ ForDate()             │ Stride Length (limit 1 descending each)   │   │
│  │ fetchMobilityForDate()│ Queries: Steps (limit 100 sum), Walking   │   │
│  │                       │ Speed, Step Length, Asymmetry, Double     │   │
│  │                       │ Support, Stair Speed Up/Down, Flights     │   │
│  │ fetchEnvironmental-   │ Queries: Daylight, Headphone Audio,       │   │
│  │ ForDate()             │ Exercise, Stand, Mindful Sessions         │   │
│  │ fetchCardioMetabolic- │ Queries: VO2Max, Walking HR, Resting      │   │
│  │ ForDate()             │ Energy, Physical Effort, Breathing        │   │
│  │                       │ Disturbances, HR Recovery, HRV, RHR       │   │
│  │ fetchWeightForDate()  │ Queries: Body Mass (limit 1), Lean Mass   │   │
│  └───────────────────────┴──────────────────────────────────────────┘   │
│                                                                          │
│  Key observations:                                                       │
│  ◄── QUANTITY samples: only the single LATEST (limit 1) per day per     │
│       type is preserved. All other samples within the day are discarded. │
│  ◄── No HKAnchoredObjectQuery usage → sync is NOT incremental, relies   │
│       on date-window re-fetch with DELETE-before-INSERT.                 │
│  ◄── Sample source app/device metadata is never captured.                │
│  ◄── No canonical_id recording (sample UUID from HealthKit is lost).    │
│  ◄── Timestamps are manufactured (`${dateStr}T06:30:00.000Z`) rather    │
│       than preserving the actual sample timestamp.                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Algorithm Layer Map

```
┌──────────────────┬───────────────┬───────────┬──────────┬─────────────┐
│ Algorithm File   │ Fabricates?   │ Has       │ Has      │ Input       │
│                  │ (when inputs  │ version?  │ timestamp│ Coverage?   │
│                  │  missing)     │           │          │             │
├──────────────────┼───────────────┼───────────┼──────────┼─────────────┤
│ recovery.ts       │ Partial —     │ NO        │ NO       │ NO          │
│                  │ weights shift │           │          │             │
│                  │ to sleep when │           │          │             │
│                  │ HRV/RHR absent│           │          │             │
│ strain.ts        │ NO            │ NO        │ NO       │ NO          │
│ sleep-debt.ts    │ Partial —     │ NO        │ NO       │ NO          │
│                  │ defaults to   │           │          │             │
│                  │ 8h need       │           │          │             │
│ biological-age.ts│ YES — returns │ NO        │ bioAgeConf│ YES         │
│                  │ chrono age    │           │ idence,   │ (bioAgeIn-  │
│                  │ when <3 data  │           │ inputsUsed│ putsUsed/   │
│                  │ points        │           │ ,Missing  │ Missing)    │
│ illness-         │ Partial —     │ NO        │ NO       │ NO          │
│ predictor.ts     │ defaults to   │           │          │             │
│                  │ LOW risk when │           │          │             │
│                  │ all signals 0 │           │          │             │
│ injury-          │ Partial —     │ NO        │ NO       │ NO          │
│ predictor.ts     │ defaults to   │           │          │             │
│                  │ LOW risk when │           │          │             │
│                  │ no mobility   │           │          │             │
│ cns-stress.ts    │ YES — score=20│ NO        │ NO       │ NO          │
│                  │ base, risk=LOW│           │          │             │
│                  │ when no data  │           │          │             │
│ heuristic-       │ YES — returns │ NO        │ NO       │ YES         │
│ synthesis.ts     │ insufficient  │           │          │ (dataCover- │
│                  │ pillars when  │           │          │  age field) │
│                  │ <2 data pts   │           │          │             │
│ habit-impact.ts  │ NO — returns  │ NO        │ NO       │ NO          │
│                  │ empty when    │           │          │             │
│                  │ <5 paired days│           │          │             │
│ sleep-           │ NO            │ NO        │ NO       │ NO          │
│ performance.ts   │               │           │          │             │
│ trend-engine.ts  │ NO — marks    │ YES       │ YES      │ YES         │
│                  │ hasSufficient │ (no formal│ (time-   │ (hasSuffi-  │
│                  │ false when    │ version)  │ stamp)   │ cient flag) │
│                  │ <7 data pts   │           │          │             │
│ z-score.ts       │ NO (pure math)│ NO        │ NO       │ NO          │
│ streaks.ts       │ NO            │ NO        │ NO       │ NO          │
│ pearson-         │ NO (pure math)│ NO        │ NO       │ NO          │
│ correlation.ts   │               │           │          │             │
│ weekly-          │ YES — returns │ NO        │ YES      │ YES         │
│ planner.ts       │ null when <7  │           │ (gener-  │ (confidence │
│                  │ days of data; │           │ atedAt)  │  field)     │
│                  │ defaults      │           │          │             │
│                  │ baseline to   │           │          │             │
│                  │ 50,50,8,8,40  │           │          │             │
│ running-form.ts  │ NO            │ NO        │ NO       │ NO          │
├──────────────────┴───────────────┴───────────┴──────────┴─────────────┤
│ SUMMARY:                                                               │
│ • 10 of 16 algorithms fabricate/default when inputs are missing        │
│ • 14 of 16 lack any version/provenance metadata                        │
│ • Only trend-engine.ts has timestamp; only weekly-planner.ts has      │
│   generatedAt                                                          │
│ • ZERO algorithms carry algorithm version identifiers                 │
│ • Only biological-age.ts and weekly-planner.ts expose confidence      │
│ • No algorithm imports synthetic-generator.ts (used only in tests)    │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.3 AI Coach Payload Trace (coach.tsx `buildBiometricsContext`)

```
Current payload structure (flat, scope-less):

{
  recoveryScore: effectiveScores?.recoveryScore ?? null,    // ?? latestScores
  strainScore:   effectiveScores?.strainScore ?? null,      // ?? latestScores
  sleepDebtHours: effectiveScores?.sleepDebtHours ?? null,
  sleepNeedHours: effectiveScores?.sleepNeedHours ?? null,
  hrvZScore:     effectiveScores?.hrvZScore ?? null,
  rhrZScore:     effectiveScores?.rhrZScore ?? null,
  recoveryZone:  effectiveScores?.recoveryZone ?? null,
  vitals: { hrv, rhr, spo2, respiratoryRate, skinTempDelta },  // scope: mixed
  sleep:  { totalDurationMins, remMins, deepMins },             // scope: mixed
  mobility:          mobility[0] || null,            // ◄── ALWAYS latest (index 0)
  runningDynamics:   runningDynamics[0] || null,     // ◄── ALWAYS latest (index 0)
  environmental:     environmental[0] || null,        // ◄── ALWAYS latest (index 0)
  cardioMetabolic:   cardioMetabolic[0] || null,      // ◄── ALWAYS latest (index 0)
  derivedPredictions: {
    injuryRisk:      { risk, confidence, explanation },   // confidence: 0-100
    cnsStressScore:  { risk, confidence, explanation },   // confidence: 0-100
  },
  trendAnalysis: {
    metrics: { hrv, rhr, spo2, ... }  // confidence: 0-1, hasSufficient
  },
}

KEY ISSUES:
◄── 4 data categories ALWAYS use latest (never date-scoped):
    mobility, runningDynamics, environmental, cardioMetabolic
◄── 8 categories use selectedDate first but silently fall back to latest
◄── ZERO scope/provenance/confidence markers on individual biometric fields
◄── Only injuryRisk and cnsStressScore carry confidence
◄── Trend patterns carry confidence (0-1) and hasSufficient
◄── System prompt tells AI to label scope, but payload contains no scope info
◄── Fallback coach fabricates ALL metrics (recoveryScore=62, hrv=33.8, rhr=61)
◄── Web pipeline: always "today" only, completely independent code path
```

### 1.4 Cache Layer (cache.ts + store.ts fingerprint)

```
Current cache architecture:
┌─────────────────┐    ┌──────────────────────────────┐
│ cache.ts        │    │ store.ts                     │
│ TTL-based Map   │    │ derivedCache: Map<string,     │
│ • synthesis     │    │   CacheEntry>                 │
│ • trend-report  │    │ Fingerprint = array lengths + │
│ • correlation   │    │ first-entry timestamps        │
│ • weekly-plan   │    │                               │
│ • biometrics-   │    │ Only tracks:                  │
│   context       │    │ • length change               │
│                 │    │ • first element change         │
└─────────────────┘    └──────────────────────────────┘

GAPS:
◄── No invalidation linkage to sync events (relies on invalidateAllCaches())
◄── No stale-data detection (a cached value from 5 minutes ago looks the same
    as one computed just now)
◄── No reconciliation with underlying data freshness
◄── Fingerprint is hash of structure, not of data content — if vitals[0]
    changes but vitals[5] is what the algorithm actually uses, cache won't
    invalidate
```

---

## 2. Problems Found in the Current Pipeline

### 2.1 TRUST-BREAKING

| # | Problem | File(s) & Line(s) | Trust Impact | Classification |
|---|---|---|---|---|
| **P1** | **Biological age silently substituted with chronological age** — [`biological-age.ts`](elite-health/src/lib/algorithms/biological-age.ts) returns chrono-age when inputs insufficient. [`useSelectedDateHealthState.ts:156-163`](elite-health/src/hooks/useSelectedDateHealthState.ts:156) uses `safeBiologicalAge` which falls back to chrono-age. [`BiologicalAge` component](elite-health/src/components/health/biological-age.tsx) renders the value with zero visual distinction between measured and fabricated. | User sees "29.4 years" and cannot tell if it's their measured biological age or their calendar age. This is a fabricated health metric masquerading as a measurement. | Algorithm + UI |
| **P2** | **Fallback coach fabricates all biometrics with hardcoded defaults** — [`fallback-coach.ts:15-28`](elite-health/src/lib/gemini/fallback-coach.ts:15) sets `recoveryScore=62`, `hrv=33.8`, `rhr=61`, `sleepDuration=6.8h`, `sleepDebt=1.2h`, `vo2Max=44.5` when Gemini is unavailable. These are presented as `[Selected Date]` values with "high confidence" labels. | User receives fabricated medical advice based on fake numbers. The `OFFLINE_DISCLAIMER` says "Biometrics may be estimated" but doesn't label WHICH values are estimated vs real. | AI |
| **P3** | **Zero provenance on any normalized/derived record** — No table in [`db.ts`](elite-health/src/lib/db.ts) stores `algorithm_version`, `computed_at`, `source_raw_sample_ids`, or `sync_run_id`. 14 of 16 algorithms in `elite-health/src/lib/algorithms/` lack version identifiers. Only [`trend-engine.ts`](elite-health/src/lib/algorithms/trend-engine.ts) has a timestamp; only [`weekly-planner.ts`](elite-health/src/lib/algorithms/weekly-planner.ts:48) has `generatedAt`. | A score shown to the user cannot be traced back to which algorithm version computed it, which raw samples fed into it, or which sync run produced those samples. Every derived number is un-auditable. | Data model |
| **P4** | **Raw HealthKit sample identity discarded on ingestion** — [`healthkit.ts:252-274`](elite-health/src/lib/healthkit.ts:252) takes only `quantity` values from samples, discards sample UUIDs, source app, source device, and original timestamps. Timestamps are manufactured at `T06:30:00.000Z` (line 259). | No ability to rebuild daily aggregates from raw samples. No ability to detect duplicates. No ability to trace a derived score back to a specific Apple Watch sample. | Data model |
| **P5** | **`safeSkinTempDelta` treats genuine 0°C delta as "no data"** — [`coach.tsx:609`](elite-health/app/\(tabs\)/coach.tsx:609) calls `safeSkinTempDelta()` which likely nulls zero values. A genuine reading of exactly 0°C delta (baseline match) is silently discarded. | User's actual wrist temperature reading is hidden because it happens to equal baseline. | Algorithm |

### 2.2 HIGH

| # | Problem | File(s) & Line(s) | Trust Impact | Classification |
|---|---|---|---|---|
| **P6** | **`sleep.remMins/deepMins = 0` treated as "no data"** — [`coach.tsx:615-616`](elite-health/app/\(tabs\)/coach.tsx:615) uses `remMins > 0 ? remMins : null` and `deepMins > 0 ? deepMins : null`. A short sleep where Apple Watch detected 0 REM is indistinguishable from a day with no sleep data at all. | The AI coach receives `null` for sleep stages when the user actually slept but got no REM. This fundamentally changes recovery/readiness analysis. | Selector |
| **P7** | **4 data categories always sent as latest to AI** — [`coach.tsx:619-622`](elite-health/app/\(tabs\)/coach.tsx:619) sends `mobility[0]`, `runningDynamics[0]`, `environmental[0]`, `cardioMetabolic[0]` regardless of `selectedDate`. When the user asks "how was my mobility on Tuesday?", the AI receives today's mobility data but is told the date is Tuesday. | AI makes recommendations based on wrong-date data. The system prompt tells AI to label scope, but the payload has no scope markers. | AI |
| **P8** | **8 data categories silently fall back from selectedDate to latest** — [`coach.tsx:591-593`](elite-health/app/\(tabs\)/coach.tsx:591) uses `currentScores ?? latestScores` pattern. The hook [`useSelectedDateHealthState.ts:113`](elite-health/src/hooks/useSelectedDateHealthState.ts:113) returns `null` for missing dates, then the coach silently substitutes latest data. | User navigates to last Tuesday and sees scores from today without any indication of the date mismatch. | Selector + UI |
| **P9** | **Sync is not idempotent** — [`store.ts:518-605`](elite-health/src/lib/store.ts:518) loops dates and for each date does DELETE-then-INSERT (e.g., `DELETE FROM vitals WHERE timestamp >= ... AND timestamp <= ...`). If sync is interrupted mid-loop, some dates have partial data, some have none, and the `lastSync` timestamp is never set (line 625-626 only runs after ALL dates succeed). | Half-synced state is indistinguishable from partial data. No sync run ID to detect orphaned rows from aborted syncs. | Data model |
| **P10** | **No "why am I seeing this?" capability** — No component, hook, or utility anywhere in the codebase can explain to a user WHY a particular score/value is being displayed, what raw data it came from, or what algorithm version computed it. | Every displayed metric is a black box. Users (and developers) cannot inspect the data lineage. | UI / Observability |
| **P11** | **Cache layer has no stale-data detection** — [`cache.ts`](elite-health/src/lib/utils/cache.ts) is pure TTL-based. The fingerprint system in [`store.ts:63-78`](elite-health/src/lib/store.ts:63) only detects structural changes (array lengths + first element), not content changes deeper in arrays. | The UI can display cached values from before the last sync, with no visual indication of staleness. | Cache / Selector |

### 2.3 MEDIUM

| # | Problem | File(s) & Line(s) | Trust Impact | Classification |
|---|---|---|---|---|
| **P12** | **Home screen mixes selectedDate + allTime without delimiter** — Audit §2 row 1. [`index.tsx`](elite-health/app/\(tabs\)/index.tsx) renders streaks (all-time), weekly planner (all-time), correlation insights (all-time) alongside PremiumOrb (selectedDate), rings (selectedDate), body systems (selectedDate). | User sees "3-day green streak" (all-time) next to "Recovery 72%" (selectedDate) — no visual separation between scopes. | UI |
| **P13** | **Coach screen has the most complex scope mixing** — Audit §2 row 3. Uses `effectiveScores`/`effectiveVitals`/`effectiveSleep` fallback + allTime trend patterns + allTime cardiorespiratory + allTime sleep schedule. | The AI receives a mix of date-scoped and all-time data with no markers. | Selector + AI |
| **P14** | **7-day sleep history mixed with single-date architecture in Sleep Drilldown** — Audit §2 row 4. | Visual chart shows 7-day trend bars next to single-date stage breakdown. No scope label on either. | UI |
| **P15** | **HRSplineTrace fabricates default sleep block** — Audit §3 row 2. When no sleep data exists, [`hr-spline-trace.tsx`](elite-health/src/components/home/hr-spline-trace.tsx) fabricates a 10PM-6AM sleep block at 0.08 opacity. | Sleep block on chart implies sleep data exists when it doesn't. | UI |
| **P16** | **PremiumOrb dims without explicit "no data" label** — Audit §3 row 3. [`PremiumOrb.tsx`](elite-health/src/components/health/PremiumOrb.tsx) dims particles to 0.28x and value text to 0.25 opacity when `isEmpty=true`. | Dimmed orb may be interpreted as "low score" rather than "no data." | UI |
| **P17** | **Coach silently falls back from selectedDate to latest** — Audit §3 row 7. No visual indication that the displayed data is from a different date. | User navigates between dates without realizing data hasn't changed. | UI |
| **P18** | **VitalsGrid conflates "missing data" with "out of range"** — Audit §3 row 6. Missing metrics show "--" with "Check" status and red dot. | Red dot is a warning signal; conflating absence with danger. | UI |
| **P19** | **Web and mobile AI pipelines are completely divergent** — Mobile uses `buildBiometricsContext()` in [`coach.tsx`](elite-health/app/\(tabs\)/coach.tsx) while web uses `coach-prompt.ts` in `src/lib/gemini/` with always-"today" scope and missing 4 categories. | Same AI model gets different data depending on platform. Responses diverge. | AI |
| **P20** | **No recompute-on-demand for derived scores** — [`store.ts:340-469`](elite-health/src/lib/store.ts:340) `computeScores` is called only during sync. If an algorithm is updated, existing scores are not recomputed unless a new sync triggers it. The `loadFromDB` stale-detection at line 708-726 only catches extreme outliers. | Scores can remain stale indefinitely after algorithm improvements. | Algorithm |
| **P21** | **DELETE-before-INSERT loses history** — [`store.ts:133`](elite-health/src/lib/store.ts:133) deletes all vitals for a day before inserting new ones. If the new insert fails (e.g., validation guard), data for that date is lost until next sync. | Transient failures cause permanent data gaps. | Data model |

### 2.4 LOW

| # | Problem | File(s) & Line(s) | Trust Impact | Classification |
|---|---|---|---|---|
| **P22** | **`profileAge` defaults to 25** — [`store.ts:384`](elite-health/src/lib/store.ts:384) `chronologicalAge = 25` when `profileAge` is null. Biological age computation uses this synthetic age as baseline. | Biological age can be "29.4 years" for a 25-year-old default — misleading if user hasn't set their real age. | Algorithm |
| **P23** | **Fingerprint-based cache only checks first element** — [`store.ts:66`](elite-health/src/lib/store.ts:66) `state.vitals[0]?.timestamp` is in the fingerprint. If vitals[5] changes (which an algorithm actually uses), the fingerprint doesn't change. | Cache can serve stale results when non-first elements change. | Cache |
| **P24** | **Background sync has no error reporting** — [`background-sync.ts`](elite-health/src/lib/services/background-sync.ts) registers a task but the task handler itself is not defined in this file. If the background sync fails, there's no audit log. | Silent sync failures. | Sync |
| **P25** | **`recency.ts` referenced but not audited** — Discovery findings mention `recency.ts` checks if vitals/sleep/mobility are stale, but its exact behavior and scope mixing patterns weren't verified. | Unknown freshness detection behavior. | Sync |

---

## 3. Proposed Target Architecture

### 3.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           LAYER 7: UI COMPONENTS                               │
│                                                                                │
│   Every component receives typed HealthMetricViewModel<T> props.              │
│   Every component renders provenanceSummary inline.                           │
│   Every empty state is explicit: "No data for May 20 — sync HealthKit."       │
│   Debug overlay available via secret gesture → tap any card to inspect.       │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 6: CANONICAL SELECTORS                                │
│                                                                                │
│   selectVitalsForDate(date) → HealthMetricViewModel<VitalsRecord>             │
│   selectLatestVitals()       → HealthMetricViewModel<VitalsRecord>            │
│   selectRolling7dVitals(date)→ HealthMetricViewModel<VitalsRecord[]>          │
│   selectRolling30dVitals(date)→ HealthMetricViewModel<VitalsRecord[]>         │
│   selectAllTimeVitalsMax()   → HealthMetricViewModel<number>                  │
│                                                                                │
│   Same pattern for: scores, sleep, mobility, activity, environmental,          │
│   cardioMetabolic, runningDynamics, weight                                     │
│                                                                                │
│   Every selector is SCOPE-GATED: returns null when data absent for scope.      │
│   NO silent fallback (`currentX ?? latestX`).                                  │
│   NO implicit latest (`mobility[0]`).                                          │
│   NO range-based nulling without reason.                                       │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│             LAYER 5: VIEW-MODEL FACTORY (HealthMetricViewModel<T>)             │
│                                                                                │
│   For every data access, wraps raw/derived value with:                         │
│   • status: 'present' | 'missing' | 'insufficient' | 'stale' | 'invalidated'  │
│   • scope: 'selectedDate' | 'latest' | 'rolling7d' | 'rolling30d' | 'allTime' │
│   • effectiveDate, dateWindow, sourceKind, confidence                          │
│   • emptyStateReason, provenanceSummary, lastUpdated                           │
│   • algorithmVersion, inputCoverage                                            │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: DERIVED OUTPUT REGISTRY                            │
│                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Algorithm Registry                                                   │     │
│   │  • Map<algorithmName, AlgorithmMeta>                                  │     │
│   │  • Each entry: id, version, inputRequirements, outputSchema           │     │
│   │  • Version compatibility matrix                                       │     │
│   │  • On algorithm update: invalidate all prior derived_outputs          │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Recompute Engine                                                     │     │
│   │  • invalidateDerived(date, algorithmName) → marks rows as stale       │     │
│   │  • recomputeDerived(date, algorithmName) → re-derives from raw        │     │
│   │  • recomputeAllStale() → batch re-derive all invalidated outputs      │     │
│   │  • rebuildDaily(date) → full re-derivation of ALL normalized +        │     │
│   │    derived rows for a date from raw samples                           │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: SYNC ENGINE (idempotent)                           │
│                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Sync Run Lifecycle                                                   │     │
│   │  started → querying → deduping → ingesting → deriving → completed     │     │
│   │  (or partial / failed)                                                │     │
│   │                                                                        │     │
│   │  Each sync_run row captures:                                           │     │
│   │  • id, started_at, completed_at, status                                │     │
│   │  • date_window_start, date_window_end                                  │     │
│   │  • sample_counts (total, inserted, deduped, updated, deleted, errors)  │     │
│   │  • permission_state, notes                                             │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Idempotency                                                          │     │
│   │  • Dedupe by canonical_id + start_time + source_type BEFORE insert    │     │
│   │  • UPSERT (INSERT OR REPLACE) for normalized daily aggregates         │     │
│   │  • Re-running same date window produces identical results           │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Reconciliation                                                       │     │
│   │  • On each sync: detect stale rows (sync_run_id < current)            │     │
│   │  • On algorithm update: bulk-invalidate affected derived_outputs       │     │
│   │  • On permission change: mark affected domains for re-sync            │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: SQLITE STORAGE (redesigned)                        │
│                                                                                │
│   NEW TABLES:                                                                  │
│   ┌──────────────────┬───────────────────────────────────────────────────┐    │
│   │ raw_health_      │ canonical_id (UUID), source_type, source_app,     │    │
│   │ samples          │ source_device, start_time, end_time, local_day_   │    │
│   │                  │ key, value, unit, metadata_json, ingestion_ts,    │    │
│   │                  │ sync_run_id, status (active|deleted|orphaned)     │    │
│   │ sync_runs        │ id, started_at, completed_at, status, date_       │    │
│   │                  │ window_start, date_window_end, sample_counts      │    │
│   │                  │ (JSON), permission_state, notes                   │    │
│   │ derived_outputs  │ id, output_type, algorithm_version, input_        │    │
│   │                  │ coverage, confidence, dependency_ids (JSON),      │    │
│   │                  │ computed_at, invalidated_at, payload_json         │    │
│   │ provenance_log   │ record_table, record_id, source_type, source_     │    │
│   │                  │ raw_sample_ids (JSON), sync_run_id, created_at    │    │
│   └──────────────────┴───────────────────────────────────────────────────┘    │
│                                                                                │
│   MODIFIED TABLES (new columns added):                                         │
│   ┌──────────────────┬───────────────────────────────────────────────────┐    │
│   │ ALL existing      │ + sync_run_id (INTEGER, FK→sync_runs)            │    │
│   │ tables:           │ + source_raw_sample_ids (TEXT, JSON array)       │    │
│   │ vitals, sleep,    │ + computed_at (TEXT, ISO timestamp)              │    │
│   │ activity, daily_  │ + algorithm_version (TEXT)                       │    │
│   │ scores, mobility, │                                                    │    │
│   │ environmental,    │                                                    │    │
│   │ cardio_metabolic, │                                                    │    │
│   │ running_dynamics, │                                                    │    │
│   │ weight_history    │                                                    │    │
│   └──────────────────┴───────────────────────────────────────────────────┘    │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              LAYER 1: HEALTHKIT INGESTION (preserving provenance)             │
│                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Raw Sample Preservation                                              │     │
│   │  • For each HealthKit sample: capture canonical_id (sample UUID),    │     │
│   │    source_type, source_app (e.g., "com.apple.health"), source_device │     │
│   │    (e.g., "Apple Watch Ultra 2"), start_time, end_time, local_day_   │     │
│   │    key, value, unit, metadata_json                                   │     │
│   │  • Insert into raw_health_samples with INSERT OR IGNORE              │     │
│   │    (deduped by canonical_id + start_time + source_type)              │     │
│   │  • Then normalize into daily aggregate tables (derived, cacheable)   │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Incremental Sync (future)                                            │     │
│   │  • Use HKAnchoredObjectQuery for delta detection                      │     │
│   │  • Track anchor per sample type in sync_metadata                      │     │
│   │  • Current date-window approach stays as fallback/backfill            │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │  Permission Change Detection                                          │     │
│   │  • On each sync: snapshot current authorization status                 │     │
│   │  • Compare to last known permission_state in sync_runs                │     │
│   │  • If delta: log in sync_run notes, mark affected domains for         │     │
│   │    re-sync                                                             │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Architectural Principles

1. **Raw samples are the source of truth.** Every normalized and derived record traces back to specific raw samples by ID. Rebuild is always possible.
2. **Every record carries provenance.** `sync_run_id`, `computed_at`, `algorithm_version` on every table. `derived_outputs` tracks dependency graph.
3. **Selectors are scope-gated.** A selector for `selectedDate` returns `null` when that date has no data. No silent fallback to latest, no implicit array indexing.
4. **View-models wrap every value with metadata.** `HealthMetricViewModel<T>` carries `status`, `scope`, `confidence`, `provenanceSummary`, `emptyStateReason`.
5. **Sync is auditable and idempotent.** Every sync gets a `sync_run_id`. Re-running the same date window produces identical normalized rows.
6. **Algorithm outputs are versioned and invalidatable.** When an algorithm updates, all prior `derived_outputs` are marked `invalidated_at` and recomputed.
7. **AI payload carries full scope/provenance.** Every metric in the payload includes `value`, `scope`, `effectiveDate`, `dateWindow`, `confidence`, `provenanceLabel`.
8. **Debug overlay answers "why am I seeing this?"** Tap any card to see selector name, scope, raw input rows, derived dependencies, empty-state reason, provenance summary, last sync run.

---

## 4. Data Model Redesign

### 4.1 New Table: `raw_health_samples`

```sql
CREATE TABLE IF NOT EXISTS raw_health_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_id TEXT NOT NULL,          -- HealthKit sample UUID
    source_type TEXT NOT NULL,           -- e.g., 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
    source_app TEXT,                     -- e.g., 'com.apple.health'
    source_device TEXT,                  -- e.g., 'Apple Watch Ultra 2'
    start_time TEXT NOT NULL,            -- ISO 8601 with timezone
    end_time TEXT NOT NULL,              -- ISO 8601 with timezone
    local_day_key TEXT NOT NULL,         -- 'YYYY-MM-DD' in device local timezone
    value REAL,                          -- the quantity value
    unit TEXT,                           -- e.g., 'ms', 'count/min', '%'
    metadata_json TEXT,                  -- full HealthKit metadata as JSON
    ingestion_ts TEXT NOT NULL,          -- ISO 8601, when this row was written
    sync_run_id INTEGER NOT NULL,        -- FK → sync_runs.id
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'deleted' | 'orphaned'
    UNIQUE(canonical_id, start_time, source_type)
);

CREATE INDEX idx_raw_samples_day ON raw_health_samples(local_day_key);
CREATE INDEX idx_raw_samples_type_day ON raw_health_samples(source_type, local_day_key);
CREATE INDEX idx_raw_samples_sync ON raw_health_samples(sync_run_id);
CREATE INDEX idx_raw_samples_canonical ON raw_health_samples(canonical_id);
```

**Purpose:** Preserve every HealthKit sample with full identity and provenance. This is the single source of truth. All normalized daily aggregates are derived from this table and can be rebuilt.

### 4.2 New Table: `sync_runs`

```sql
CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,            -- ISO 8601
    completed_at TEXT,                   -- ISO 8601, NULL if still running
    status TEXT NOT NULL DEFAULT 'started', -- 'started' | 'querying' | 'ingesting' | 'deriving' | 'completed' | 'partial' | 'failed'
    date_window_start TEXT NOT NULL,     -- 'YYYY-MM-DD'
    date_window_end TEXT NOT NULL,       -- 'YYYY-MM-DD'
    sample_counts TEXT,                  -- JSON: { total: N, inserted: N, deduped: N, updated: N, deleted: N, error_count: N }
    inserted_count INTEGER DEFAULT 0,
    deduped_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    deleted_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    permission_state TEXT,              -- JSON snapshot of current HK authorization
    notes TEXT
);

CREATE INDEX idx_sync_runs_status ON sync_runs(status);
CREATE INDEX idx_sync_runs_started ON sync_runs(started_at);
```

**Purpose:** Every sync operation is recorded. Enables audit trail, error diagnosis, and reconciliation. The `permission_state` snapshot enables detection of permission changes between syncs.

### 4.3 New Table: `derived_outputs`

```sql
CREATE TABLE IF NOT EXISTS derived_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    output_type TEXT NOT NULL,           -- 'daily_scores', 'recovery', 'strain', 'biological_age', 'illness_risk', etc.
    algorithm_version TEXT NOT NULL,     -- e.g., 'recovery.v1.2.0'
    input_coverage REAL,                 -- 0.0–1.0, fraction of required inputs available
    confidence REAL,                     -- 0.0–100.0, algorithm's own confidence assessment
    dependency_ids TEXT,                 -- JSON array of raw_health_samples.id or derived_outputs.id
    computed_at TEXT NOT NULL,           -- ISO 8601
    invalidated_at TEXT,                 -- ISO 8601, set when output is superseded/stale
    payload_json TEXT NOT NULL           -- the full output as JSON
);

CREATE INDEX idx_derived_outputs_type ON derived_outputs(output_type);
CREATE INDEX idx_derived_outputs_version ON derived_outputs(algorithm_version);
CREATE INDEX idx_derived_outputs_invalidated ON derived_outputs(invalidated_at);
CREATE INDEX idx_derived_outputs_computed ON derived_outputs(computed_at);
```

**Purpose:** Every algorithm output is versioned, timestamped, and linked to its inputs. When an algorithm is updated, all prior outputs of that type are marked `invalidated_at` and recomputed. This gives complete lineage from raw sample → derived score.

### 4.4 New Table: `provenance_log`

```sql
CREATE TABLE IF NOT EXISTS provenance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_table TEXT NOT NULL,          -- 'vitals', 'sleep', 'daily_scores', etc.
    record_id INTEGER NOT NULL,          -- FK to the record in the target table
    source_type TEXT NOT NULL,           -- 'healthkit' | 'manual' | 'derived' | 'synthetic'
    source_raw_sample_ids TEXT,          -- JSON array of raw_health_samples.id
    sync_run_id INTEGER,                 -- FK → sync_runs.id (NULL for manual entries)
    created_at TEXT NOT NULL             -- ISO 8601
);

CREATE INDEX idx_provenance_record ON provenance_log(record_table, record_id);
CREATE INDEX idx_provenance_sync ON provenance_log(sync_run_id);
```

**Purpose:** Every record in every normalized table has a corresponding provenance_log entry. This makes it possible to trace any displayed value back to its origin.

### 4.5 Modified Existing Tables

Every existing table (vitals, sleep, activity, daily_scores, mobility, environmental, cardio_metabolic, running_dynamics, weight_history) gains these columns:

```sql
-- Add to each table via migration:
ALTER TABLE vitals ADD COLUMN sync_run_id INTEGER;
ALTER TABLE vitals ADD COLUMN source_raw_sample_ids TEXT;  -- JSON array
ALTER TABLE vitals ADD COLUMN computed_at TEXT;
ALTER TABLE vitals ADD COLUMN algorithm_version TEXT;

-- Repeat for: sleep, activity, daily_scores, mobility, environmental,
--             cardio_metabolic, running_dynamics, weight_history
```

Additionally, `daily_scores` gains:

```sql
ALTER TABLE daily_scores ADD COLUMN computation_input_coverage REAL;    -- 0.0-1.0
ALTER TABLE daily_scores ADD COLUMN computation_dependency_ids TEXT;    -- JSON array
```

### 4.6 Table Relationships Diagram

```
raw_health_samples           sync_runs
┌──────────────────┐        ┌──────────────────┐
│ id (PK)          │──┐     │ id (PK)          │
│ canonical_id     │  │     │ started_at       │
│ source_type      │  │     │ completed_at     │
│ local_day_key    │  │     │ status           │
│ sync_run_id (FK)─┼──┼────►│ ...              │
│ ...              │  │     └──────────────────┘
└──────────────────┘  │
                      │     derived_outputs
                      │     ┌──────────────────┐
                      │     │ id (PK)          │
┌──────────────────┐  │     │ output_type      │
│ vitals           │  │     │ algorithm_version│
│ (modified)       │  │     │ dependency_ids ──┼──► raw_health_samples.id
│ sync_run_id (FK)─┼──┤     │ ...              │    derived_outputs.id
│ source_raw_      │──┼────►└──────────────────┘
│   sample_ids     │  │
│ computed_at      │  │     provenance_log
│ algorithm_version│  │     ┌──────────────────┐
└──────────────────┘  │     │ record_table     │
                      │     │ record_id        │──► any normalized table
┌──────────────────┐  │     │ source_raw_      │
│ daily_scores     │  │     │   sample_ids ────┼──► raw_health_samples.id
│ (modified)       │  │     │ sync_run_id ─────┼──► sync_runs.id
│ ...              │  │     │ ...              │
└──────────────────┘  │     └──────────────────┘
                      │
(same pattern for:    │
 sleep, activity,     │
 mobility,            │
 environmental,       │
 cardio_metabolic,    │
 running_dynamics,    │
 weight_history)      │
```

---

## 5. Sync/Reconciliation Design

### 5.1 Sync Run Lifecycle

```
                    ┌─────────┐
                    │ started │
                    └────┬────┘
                         │ INSERT INTO sync_runs (status='started')
                         ▼
                 ┌──────────────┐
                 │  querying    │
                 └──────┬───────┘
                        │ Fetch raw samples from HealthKit for each date
                        │ in the window. Capture all sample metadata.
                        ▼
                 ┌──────────────┐
                 │  deduping    │◄── Check raw_health_samples for existing
                 └──────┬───────┘    canonical_id + start_time + source_type.
                        │            Skip duplicates, count them.
                        ▼
                 ┌──────────────┐
                 │  ingesting   │
                 └──────┬───────┘
                        │ INSERT raw_health_samples (deduped)
                        │ UPSERT normalized tables (vitals, sleep, etc.)
                        │    with sync_run_id and source_raw_sample_ids
                        │ INSERT provenance_log rows
                        ▼
                 ┌──────────────┐
                 │  deriving    │
                 └──────┬───────┘
                        │ Run computeScores, computeInjuryRisk, etc.
                        │ INSERT derived_outputs rows
                        │ UPDATE normalized rows with computed values
                        ▼
                 ┌──────────────┐
                 │  completed   │ (or 'partial' if some dates failed,
                 └──────────────┘  or 'failed' if all failed)
                        │ UPDATE sync_runs SET status, completed_at, sample_counts
                        ▼
                   invalidateAllCaches()
                   clearDerivedCache()
                   loadFromDB() — rehydrate Zustand store
```

### 5.2 Idempotency

```
INSERT OR IGNORE INTO raw_health_samples
  (canonical_id, source_type, source_app, source_device,
   start_time, end_time, local_day_key, value, unit,
   metadata_json, ingestion_ts, sync_run_id, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
-- UNIQUE constraint on (canonical_id, start_time, source_type)
-- prevents duplicates. IGNORE silently skips existing rows.
```

For normalized tables, use `INSERT OR REPLACE` with the existing UNIQUE constraints (e.g., `date` on sleep, daily_scores, mobility, etc.):

```sql
INSERT OR REPLACE INTO vitals
  (timestamp, hrv, rhr, spo2, respiratory_rate, skin_temp_delta,
   sync_run_id, source_raw_sample_ids, computed_at, algorithm_version)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
-- Existing UNIQUE not on vitals (timestamp only) — we maintain
-- the DELETE-then-INSERT pattern within a transaction for vitals:
BEGIN;
DELETE FROM vitals WHERE timestamp >= ? AND timestamp <= ?;
INSERT INTO vitals (...) VALUES (...);
COMMIT;
```

### 5.3 Reconciliation

```typescript
// On each sync completion:
async function reconcileStaleRows(syncRunId: number): Promise<void> {
  // 1. Find any normalized rows whose sync_run_id is not current
  const staleRows = await getAll<{ table: string; id: number; date: string }>(`
    SELECT 'vitals' as table, id, date(timestamp) as date FROM vitals
    WHERE sync_run_id IS NULL OR sync_run_id != ?
    UNION ALL
    SELECT 'sleep', id, date FROM sleep
    WHERE sync_run_id IS NULL OR sync_run_id != ?
    -- ... repeat for all tables
  `, [syncRunId, syncRunId])

  // 2. For each stale row, re-derive from raw samples
  for (const row of staleRows) {
    await rebuildDaily(row.date, row.table)
  }
}

// On algorithm update:
async function invalidateAlgorithmOutputs(algorithmType: string): Promise<void> {
  await runQuery(
    'UPDATE derived_outputs SET invalidated_at = ? WHERE output_type = ? AND invalidated_at IS NULL',
    [new Date().toISOString(), algorithmType]
  )
  // Then trigger recompute for all affected dates
  await recomputeAllStale()
}
```

### 5.4 Backfill/Replay

```typescript
async function syncWindow(from: string, to: string): Promise<SyncRunResult> {
  // Creates a new sync_run, fetches all dates in [from, to],
  // dedupes against existing raw_health_samples,
  // inserts only new samples,
  // rebuilds normalized aggregates for dates that received new data.
  // Safe to call multiple times — idempotent by design.
}

async function rebuildDaily(date: string, tableName?: string): Promise<void> {
  // 1. Query all raw_health_samples for this date
  // 2. Re-compute normalized aggregate for the specified table (or all)
  // 3. UPSERT normalized row with new computed_at and algorithm_version
  // 4. INSERT new derived_outputs row
  // 5. UPDATE provenance_log
}
```

### 5.5 Permission Change Handling

```typescript
// Compare current permission state to last known state
async function detectPermissionDelta(): Promise<PermissionDelta | null> {
  const lastRun = await getOne<{ permission_state: string }>(
    'SELECT permission_state FROM sync_runs WHERE status = ? ORDER BY completed_at DESC LIMIT 1',
    ['completed']
  )
  if (!lastRun) return null

  const previous = JSON.parse(lastRun.permission_state)
  const current = await getCurrentPermissionState() // queries HK authorization

  const delta = diffPermissions(previous, current)
  if (delta.added.length > 0 || delta.removed.length > 0) {
    return delta
  }
  return null
}

// If delta detected:
// - Mark sync_run with notes about permission change
// - Mark affected domains for re-sync
// - If permission was REMOVED: mark existing rows for that domain as potentially stale
```

---

## 6. Canonical Selector / View-Model Contract Design

### 6.1 `HealthMetricViewModel<T>` Interface

```typescript
// File: elite-health/src/lib/selectors/types.ts

export interface HealthMetricViewModel<T> {
  /** The actual value, null if unavailable */
  value: T | null

  /** Human-readable display string (e.g., "72%", "48 ms", "7h 23m") */
  displayValue: string

  /** Data availability status */
  status: 'present' | 'missing' | 'insufficient' | 'stale' | 'invalidated'

  /** Temporal scope of this metric */
  scope: 'selectedDate' | 'latest' | 'rolling7d' | 'rolling30d' | 'allTime'

  /** The effective date this data represents (ISO 8601 date string) */
  effectiveDate: string

  /** For windowed scopes, the date range */
  dateWindow?: { start: string; end: string }

  /** Origin of this data */
  sourceKind: 'raw' | 'normalized' | 'derived' | 'manual'

  /** Algorithm confidence (0-100), null for raw data */
  confidence: number | null

  /** Human-readable explanation for empty/missing states */
  emptyStateReason: string | null

  /** One-line provenance summary for UI display */
  provenanceSummary: string

  /** ISO timestamp of last update */
  lastUpdated: string

  /** Algorithm version that produced this (derived only) */
  algorithmVersion?: string

  /** Input coverage: how many required inputs were available */
  inputCoverage?: { available: number; required: number }
}
```

### 6.2 Canonical Selector Catalog

Every selector is a pure function that takes the Zustand state (or subset) and returns `HealthMetricViewModel<T>`.

```
┌──────────────────────────────────┬──────────────────────────────────────┐
│ Selector                         │ Returns                              │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectVitalsForDate(date)        │ HealthMetricViewModel<VitalsRecord>  │
│ selectLatestVitals()             │ HealthMetricViewModel<VitalsRecord>  │
│ selectRolling7dVitals(date)      │ HealthMetricViewModel<VitalsRecord[]>│
│ selectRolling30dVitals(date)     │ HealthMetricViewModel<VitalsRecord[]>│
│ selectAllTimeVitalsMax(field)    │ HealthMetricViewModel<number>        │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectScoresForDate(date)        │ HealthMetricViewModel<DailyScores>   │
│ selectLatestScores()             │ HealthMetricViewModel<DailyScores>   │
│ selectRolling7dScores(date)      │ HealthMetricViewModel<DailyScores[]> │
│ selectRolling30dScores(date)     │ HealthMetricViewModel<DailyScores[]> │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectSleepForDate(date)         │ HealthMetricViewModel<SleepRecord>   │
│ selectLatestSleep()              │ HealthMetricViewModel<SleepRecord>   │
│ selectRolling7dSleep(date)       │ HealthMetricViewModel<SleepRecord[]> │
│ selectRolling30dSleep(date)      │ HealthMetricViewModel<SleepRecord[]> │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectMobilityForDate(date)      │ HealthMetricViewModel<MobilityRecord>│
│ selectLatestMobility()           │ HealthMetricViewModel<MobilityRecord>│
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectEnvironmentalForDate(date) │ HealthMetricViewModel<Environmental> │
│ selectLatestEnvironmental()      │ HealthMetricViewModel<Environmental> │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectCardioMetabolicForDate(d)  │ HealthMetricViewModel<CardioMetab>   │
│ selectLatestCardioMetabolic()    │ HealthMetricViewModel<CardioMetab>   │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectRunningDynamicsForDate(d)  │ HealthMetricViewModel<RunningDyn>    │
│ selectLatestRunningDynamics()    │ HealthMetricViewModel<RunningDyn>    │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectActivitiesForDate(date)    │ HealthMetricViewModel<Activity[]>    │
│ selectRolling7dActivities(date)  │ HealthMetricViewModel<Activity[]>    │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectWeightForDate(date)        │ HealthMetricViewModel<WeightRecord>  │
│ selectLatestWeight()             │ HealthMetricViewModel<WeightRecord>  │
├──────────────────────────────────┼──────────────────────────────────────┤
│ selectRecoveryForDate(date)      │ HealthMetricViewModel<RecoveryResult>│
│ selectStrainForDate(date)        │ HealthMetricViewModel<number>        │
│ selectSleepDebtForDate(date)     │ HealthMetricViewModel<SleepDebt>     │
│ selectBiologicalAgeForDate(date) │ HealthMetricViewModel<BioAgeResult>  │
│ selectIllnessRiskForDate(date)   │ HealthMetricViewModel<IllnessPred>   │
│ selectInjuryRiskForDate(date)    │ HealthMetricViewModel<InjuryRisk>    │
│ selectCnsStressForDate(date)     │ HealthMetricViewModel<CnsStress>     │
│ selectTrendReport()              │ HealthMetricViewModel<TrendReport>   │
└──────────────────────────────────┴──────────────────────────────────────┘
```

### 6.3 Selector Implementation Pattern

```typescript
// File: elite-health/src/lib/selectors/vitals-selectors.ts

import { useHealthStore } from '../store'
import type { HealthMetricViewModel, VitalsRecord } from './types'
import { getProvenanceSummary } from './provenance-helpers'

export function selectVitalsForDate(date: string): HealthMetricViewModel<VitalsRecord> {
  const state = useHealthStore.getState()
  const record = state.vitals.find(v => v.timestamp.startsWith(date))

  if (!record) {
    return {
      value: null,
      displayValue: '--',
      status: 'missing',
      scope: 'selectedDate',
      effectiveDate: date,
      sourceKind: 'raw',
      confidence: null,
      emptyStateReason: `No vitals data recorded for ${date}. Sync HealthKit to populate.`,
      provenanceSummary: 'No data',
      lastUpdated: state.lastSync ?? 'never',
    }
  }

  return {
    value: record,
    displayValue: `${record.hrv}ms HRV · ${record.rhr}bpm RHR`,
    status: 'present',
    scope: 'selectedDate',
    effectiveDate: record.timestamp.slice(0, 10),
    sourceKind: 'raw',
    confidence: null, // raw data has no confidence score
    emptyStateReason: null,
    provenanceSummary: getProvenanceSummary('vitals', record),
    lastUpdated: record.computed_at ?? state.lastSync ?? 'unknown',
  }
}
```

### 6.4 Anti-Patterns That MUST Be Eliminated

| Anti-Pattern | Example | Replacement |
|---|---|---|
| **Silent latest fallback** | `currentVitals ?? latestVitals` | `selectVitalsForDate(date)` — returns `status: 'missing'` when absent. Caller decides whether to also call `selectLatestVitals()` and present a scope label. |
| **Implicit latest via `[0]`** | `mobility[0]`, `environmental[0]` | `selectLatestMobility()`, `selectLatestEnvironmental()` — explicitly labeled as `scope: 'latest'`. |
| **Range-based nulling without reason** | `safeHRV(v)` returns null if v < 5 or v > 200 | `selectVitalsForDate(date)` returns the raw value. If it's out of plausible range, the `status` should be `'insufficient'` with `emptyStateReason: 'HRV value Xms is outside physiological range (5-200ms)'`. |
| **Zero-as-missing** | `remMins > 0 ? remMins : null` | Return the actual value (0). Set `insufficient` only when the source data is absent (no sleep record at all). 0 REM is a valid measurement from a short sleep. |
| **Fabrication in selector** | `safeBiologicalAge(bioAge, chronoAge) ?? chronoAge` | `selectBiologicalAgeForDate(date)` returns `status: 'missing'` when insufficient inputs. Never fabricates. |
| **Mixed scope in single component** | Home screen shows selectedDate rings + allTime streaks | Either: (a) visually group by scope with section headers, or (b) pass explicit scope labels in each child component's props. |

---

## 7. Screen-by-Screen Migration Plan

### 7.1 General Migration Pattern

For every screen and sub-component, apply this migration pattern:

1. **Audit current data access** — list every `useHealthStore()` read, `useSelectedDateHealthState()` field, and direct prop.
2. **Map to canonical selectors** — replace each raw access with the appropriate `select*ForDate()` or `selectLatest*()` call.
3. **Render the `HealthMetricViewModel`** — use `status` for empty states, `scope` for provenance badges, `emptyStateReason` for tooltips.
4. **Remove silent fallbacks** — no more `?? latestScores`, `?? [0]`.
5. **Add provenance surface** — every card/component shows a small provenance indicator (dot color, badge, or tap-to-inspect).

### 7.2 Screen: Home (`app/(tabs)/index.tsx`)

| Attribute | Specification |
|---|---|
| **Purpose** | Daily dashboard — at-a-glance view of today's health |
| **Allowed Scopes** | `selectedDate` (primary) + `allTime` (streaks, planner — visually separated) |
| **Canonical Selectors** | All `*ForDate(selectedDate)` for main cards. `selectTrendReport()` for planner. `selectCorrelationInsights()` for habit impact. `selectStreaks()` for streak tracker. |
| **Raw vs Derived** | Raw: vitals, sleep, activities. Derived: recovery, strain, sleep-debt, bio-age, illness-risk, injury-risk, cns-stress, synthesis, trend-report. |
| **Empty State** | Each card shows explicit "No data for [date]" with reason. No fabrication. |
| **Insufficient Confidence** | Show value with "[confidence]% confidence" badge. Dim if <30%. Never hide. |
| **Provenance** | Each card has a small info icon (ⓘ) that shows: selector name, scope, last sync, raw data provenance on tap. |

**Sub-Components:**

| Component | Current Access | Migrated To | Notes |
|---|---|---|---|
| `body-systems-bar.tsx` | Props: `vitals`, `cnsStress`, `rhrBaseline`, `dateStr` | `selectVitalsForDate(date)` + `selectCnsStressForDate(date)` | Already scoped, just add provenance |
| `vitals-rings.tsx` | Props: `synthesis` | `selectSynthesisForDate(date)` | Already derived from synthesis |
| `hr-spline-trace.tsx` | Props: `samples`, `sleep`, `activities` | `selectHeartRateSamplesForDate(date)` + `selectSleepForDate(date)` | **CRITICAL:** Remove fabricated sleep block. Show empty state "No sleep data for this date" instead. |
| `sleep-mini-card.tsx` | Props: `sleep`, `sleepDebtHours` | `selectSleepForDate(date)` + `selectSleepDebtForDate(date)` | Add scope badge |
| `streak-tracker.tsx` | Props: `scores`, `activities` | `selectStreaks()` | Add "ALL TIME" scope badge |
| `immunity-shield.tsx` | Props: `risk`, `explanation` | `selectIllnessRiskForDate(date)` | Show confidence %. Don't hide when LOW — show "Immune system stable" with green status. |
| `journal-weekly-checklist.tsx` | Props: `status` | `selectJournalForWeek(date)` | Add provenance |
| `habit-impact-engine.tsx` | Props: `insights` | `selectCorrelationInsights()` | Already has "14-day sample size" — good. Add algorithm version. |
| `ai-prompt-bar.tsx` | Pure UI | No change needed | N/A |

### 7.3 Screen: Health (`app/(tabs)/health.tsx`)

| Attribute | Specification |
|---|---|
| **Purpose** | Health drilldown with readiness/resilience/longevity sub-views |
| **Allowed Scopes** | `selectedDate` (DefaultHealthView) + `rolling7d` (ReadinessView, ResilienceView, LongevityView) |
| **Key Issue** | Sub-tab views switch scopes silently. Fix: add scope header to each sub-tab. |

**Sub-Components:**

| Component | Current Access | Migrated To | Notes |
|---|---|---|---|
| `biological-age.tsx` | `safeBiologicalAge(bioAge, chronoAge)` | `selectBiologicalAgeForDate(date)` | **CRITICAL:** Must show `status: 'missing'` instead of silently substituting chrono-age. Add "(Chronological)" label when bio age unavailable. Show `inputCoverage` and `confidence`. |
| `PremiumOrb.tsx` | Props: `variant`, `primaryValue`, `isEmpty`, `fallbackText` | Accept `HealthMetricViewModel` as prop | When `status !== 'present'`, show explicit "NO DATA" label (not just dimming). Dimming is a secondary signal. |
| `running-dynamics.tsx` | Props: `recent`, `baseline` | `selectRunningDynamicsForDate(date)` + `selectLatestRunningDynamics()` | Separate selectedDate reading from baseline. Label baseline as "YOUR AVERAGE (all-time)" |

### 7.4 Screen: Coach (`app/(tabs)/coach.tsx`)

| Attribute | Specification |
|---|---|
| **Purpose** | AI-powered health coach with biometrics context |
| **Allowed Scopes** | `selectedDate` (primary, explicit) + `latest` (explicitly labeled when used) + `rolling7d` (sleep schedule) + `allTime` (trend patterns, labeled) |
| **Key Issues** | `effectiveScores`/`effectiveVitals`/`effectiveSleep` silent fallback; 4 categories always latest; flat payload |

**Critical Changes:**

```typescript
// BEFORE (current):
const effectiveScores = useMemo(() => currentScores ?? latestScores, [currentScores, latestScores])
const effectiveVitals = useMemo(() => currentVitals ?? latestVitals, [currentVitals, latestVitals])
const effectiveSleep = useMemo(() => currentSleep ?? latestSleep, [currentSleep, latestSleep])

// AFTER:
const datedScores = useMemo(() => selectScoresForDate(dateStr), [dateStr])
const datedVitals = useMemo(() => selectVitalsForDate(dateStr), [dateStr])
const datedSleep = useMemo(() => selectSleepForDate(dateStr), [dateStr])
// NO silent fallback. If status is 'missing', show "No data for [date]" in UI.
// Coach message can explicitly say "I don't have data for that date — here's the latest:"
```

**Sub-Components:**

| Component | Current Access | Migrated To |
|---|---|---|
| `chat-window.tsx` | Messages array, parsed blocks | Accept `messages` with provenance metadata per block |
| `vision-capture.tsx` | `addMeal()`, `addActivity()` | No change — already uses `source: 'manual'` for provenance |

### 7.5 Screen: Profile (`app/(tabs)/profile.tsx`)

| Attribute | Specification |
|---|---|
| **Purpose** | All-time records, body composition, export tools |
| **Allowed Scopes** | `allTime` + `latest` (body composition — explicitly labeled) |
| **Key Issue** | `weightHistory[0]` is implicit latest |

```typescript
// BEFORE:
const latestWeight = weightHistory[0]

// AFTER:
const latestWeightVM = selectLatestWeight()
// Renders: "Latest: 72.4 kg (May 23, 2026)" with scope badge
```

### 7.6 Screen: Sleep Drilldown (`app/drilldown/sleep.tsx`)

| Attribute | Specification |
|---|---|
| **Purpose** | Single-date sleep architecture + 7-night history |
| **Allowed Scopes** | `selectedDate` (architecture) + `rolling7d` (history chart) — visually separated |
| **Key Issue** | Architecture and history on same screen without scope delimiter |

### 7.7 Screens: Weekly Summary, Monthly Summary

| Attribute | Specification |
|---|---|
| **Purpose** | Aggregated weekly/monthly health metrics |
| **Allowed Scopes** | `rolling7d` (weekly) or `rolling30d` (monthly) — entire screen is one scope |
| **Change** | Add scope header: "Week of May 18–24, 2026" |

### 7.8 Screen: Live Workout (`app/workout/live.tsx`)

| Attribute | Specification |
|---|---|
| **Purpose** | Real-time workout tracking |
| **Allowed Scopes** | `realTime` — not date-scoped |
| **Provenance** | Already excellent: "⚡ SIMULATED" badge when simulated. Model for all other screens. |

### 7.9 Screen: Edit Profile (`app/drilldown/edit-profile.tsx`)

| Attribute | Specification |
|---|---|
| **Purpose** | User profile editing with biological age display |
| **Key Issue** | Reads `latestScores?.biologicalAge` — implicit latest scope |
| **Fix** | `selectLatestBiologicalAge()` — explicitly labeled as "Latest reading" |

---

## 8. AI Payload Redesign

### 8.1 New Payload Structure

Every metric in the AI payload becomes a structured object instead of a raw value:

```typescript
// File: elite-health/src/lib/gemini/biometrics-context.ts

export interface ScopedMetric<T> {
  value: T | null
  scope: 'selectedDate' | 'latest' | 'rolling7d' | 'rolling30d' | 'allTime'
  effectiveDate: string           // ISO 8601 date
  dateWindow?: { start: string; end: string }  // for windowed scopes
  confidence: number | null       // 0-100
  provenanceLabel: string         // e.g., 'daily_scores.recovery_score via computeRecovery v1.2'
  status: 'present' | 'missing' | 'insufficient' | 'stale'
}

export interface BiometricsContext {
  // ── Selected-Date Scores ──
  recoveryScore: ScopedMetric<number>
  strainScore: ScopedMetric<number>
  sleepDebtHours: ScopedMetric<number>
  sleepNeedHours: ScopedMetric<number>
  hrvZScore: ScopedMetric<number>
  rhrZScore: ScopedMetric<number>
  recoveryZone: ScopedMetric<'green' | 'yellow' | 'red'>

  // ── Selected-Date Vitals ──
  vitals: {
    hrv: ScopedMetric<number>
    rhr: ScopedMetric<number>
    spo2: ScopedMetric<number>
    respiratoryRate: ScopedMetric<number>
    skinTempDelta: ScopedMetric<number>
  }

  // ── Selected-Date Sleep ──
  sleep: {
    totalDurationMins: ScopedMetric<number>
    remMins: ScopedMetric<number | null>     // null = stage data unavailable
    deepMins: ScopedMetric<number | null>
    coreMins: ScopedMetric<number | null>
    awakeMins: ScopedMetric<number | null>
  }

  // ── Selected-Date Mobility (was: always latest) ──
  mobility: {
    steps: ScopedMetric<number>
    walkingSpeed: ScopedMetric<number>
    walkingAsymmetry: ScopedMetric<number>
    doubleSupport: ScopedMetric<number>
    stairSpeedUp: ScopedMetric<number>
    stairSpeedDown: ScopedMetric<number>
    flightsClimbed: ScopedMetric<number>
  }

  // ── Selected-Date Running Dynamics (was: always latest) ──
  runningDynamics: {
    runningPower: ScopedMetric<number>
    groundContactTime: ScopedMetric<number>
    verticalOscillation: ScopedMetric<number>
    strideLength: ScopedMetric<number>
  }

  // ── Selected-Date Environmental (was: always latest) ──
  environmental: {
    timeInDaylight: ScopedMetric<number>
    headphoneAudio: ScopedMetric<number>
    exerciseMinutes: ScopedMetric<number>
    standMinutes: ScopedMetric<number>
    standHours: ScopedMetric<number>
    mindfulMinutes: ScopedMetric<number>
  }

  // ── Selected-Date CardioMetabolic (was: always latest) ──
  cardioMetabolic: {
    vo2Max: ScopedMetric<number>
    walkingHRavg: ScopedMetric<number>
    restingEnergy: ScopedMetric<number>
    physicalEffort: ScopedMetric<number>
    breathingDisturbances: ScopedMetric<number>
    hrRecovery: ScopedMetric<number>
  }

  // ── Derived Predictions (selected-date) ──
  derivedPredictions: {
    injuryRisk: ScopedMetric<{
      risk: 'LOW' | 'MODERATE' | 'HIGH'
      primaryMetric: string
      explanation: string
    }>
    cnsStressScore: ScopedMetric<{
      risk: 'LOW' | 'MODERATE' | 'HIGH'
      audioLoad: number
      daylightDeficit: number
      hrvSuppression: number
      explanation: string
    }>
  }

  // ── Trend Analysis (rolling windows) ──
  trendAnalysis: {
    referenceDate: string
    patterns: Array<{
      type: string
      confidence: number
      description: string
      severity: string
      provenanceLabel: string
    }>
    metrics: Record<string, ScopedMetric<{
      slope7d: number
      direction7d: string
      latest: number
      zScore: number
      hasSufficient: boolean
    }>>
  }

  // ── Metadata ──
  meta: {
    generatedAt: string
    lastSyncRunId: number | null
    lastSyncCompletedAt: string | null
    dataCoverageSummary: string
  }
}
```

### 8.2 Eliminating Silent Fallback in `buildBiometricsContext`

```typescript
// File: elite-health/src/lib/gemini/biometrics-context.ts

export function buildBiometricsContext(
  dateStr: string,
  state: HealthState,
  trendReport: TrendReport | null
): BiometricsContext {

  // Use canonical selectors — no ?? fallback
  const datedScores = selectScoresForDate(dateStr)
  const datedVitals = selectVitalsForDate(dateStr)
  const datedSleep = selectSleepForDate(dateStr)
  const datedMobility = selectMobilityForDate(dateStr)
  const datedDynamics = selectRunningDynamicsForDate(dateStr)
  const datedEnv = selectEnvironmentalForDate(dateStr)
  const datedCardio = selectCardioMetabolicForDate(dateStr)

  // If data is missing for the selected date, the metric carries status: 'missing'.
  // The AI system prompt instructs the model to check status before making claims.
  // No silent substitution.

  function toScopedMetric<T>(
    vm: HealthMetricViewModel<T>,
    provenanceLabel: string
  ): ScopedMetric<T> {
    return {
      value: vm.value,
      scope: vm.scope,
      effectiveDate: vm.effectiveDate,
      dateWindow: vm.dateWindow,
      confidence: vm.confidence,
      provenanceLabel,
      status: vm.status,
    }
  }

  return {
    recoveryScore: toScopedMetric(
      selectRecoveryForDate(dateStr),
      'daily_scores.recovery_score via computeRecovery v1.2'
    ),
    // ... all other metrics follow the same pattern
    mobility: {
      steps: toScopedMetric(
        datedMobility.value ? { ...datedMobility, value: datedMobility.value.steps } : datedMobility,
        'mobility.steps from HealthKit normalized'
      ),
      // ...
    },
    // ...
  }
}
```

### 8.3 System Prompt Updates

The system prompt must be updated to:

1. **Read scope from payload** — not infer it. Every metric carries `scope` and `effectiveDate`.
2. **Check status before using** — if `status !== 'present'`, the AI must say "I don't have [metric] data for [date]" rather than fabricating.
3. **Cite provenance in responses** — when making a claim, reference the provenance label: "Based on your recovery score (computed by recovery algorithm v1.2 from today's HRV data)..."
4. **Never fabricate** — the prompt must explicitly forbid making up values when `status` is not `'present'`.

```markdown
## CRITICAL: Data Scope & Provenance Rules

Every biometric in the `biometrics` JSON payload contains:
- `value`: the actual number (null if unavailable)
- `scope`: where this data comes from ('selectedDate', 'latest', 'rolling7d', etc.)
- `effectiveDate`: the date this data represents
- `status`: 'present', 'missing', 'insufficient', or 'stale'
- `provenanceLabel`: which algorithm/table produced this value

RULES:
1. NEVER use a metric where `status !== 'present'` without explicitly noting it.
2. When `status === 'missing'`, say "I don't have [metric] data for [date]."
3. When `status === 'stale'`, say "This data is from [date] and may be outdated."
4. When answering, cite the provenance: "Your recovery score (computed by recovery v1.2) is 72%."
5. NEVER fabricate values. If data is missing, say so.
```

### 8.4 "Explain This Answer" Mode

Add a new mode triggered by user asking "why?" or "explain this" after a coach response:

```typescript
interface ExplainPayload {
  originalQuery: string
  coachResponse: string
  metricsUsed: Array<{
    metricName: string
    value: unknown
    scope: string
    effectiveDate: string
    provenanceLabel: string
    contribution: string  // how this metric influenced the response
  }>
  dataWindowSummary: string
  confidenceSummary: string
}
```

### 8.5 Fallback Coach — Explicit Estimation Labeling

```typescript
// Update every response in fallback-coach.ts:
// BEFORE:
// "Recovery Score [Selected Date]: 62%"
// AFTER:
// "Recovery Score [ESTIMATE — NO REAL DATA]: 62%"

const ESTIMATE_LABEL = '⚠️ ESTIMATE — NO REAL DATA AVAILABLE'

// Only use real data when biometrics are actually from HealthKit.
// When using defaults, label EVERY metric with ESTIMATE_LABEL.
```

### 8.6 Web/Mobile AI Payload Unification

Both platforms must use the same `buildBiometricsContext()` function. The web pipeline (`src/lib/gemini/coach-prompt.ts`) must be updated to:

1. Import and use the shared `buildBiometricsContext()` from `elite-health/src/lib/gemini/biometrics-context.ts`
2. Accept a date parameter (not just "today")
3. Include all 8 data categories (currently missing: mobility, runningDynamics, environmental, cardioMetabolic)
4. Use the same `ScopedMetric<T>` structure

---

## 9. Debug/Observability Plan

### 9.1 Developer Debug Overlay

Accessible via:
- **Secret gesture:** 5-finger long-press on any screen for 3 seconds
- **Dev menu:** Environment variable `DEV_DEBUG_OVERLAY=true` or shake gesture

```typescript
// File: elite-health/src/lib/debug/debug-overlay.tsx

interface DebugOverlayState {
  isVisible: boolean
  selectedCardId: string | null
  selectedCardInfo: CardDebugInfo | null
}

interface CardDebugInfo {
  componentName: string
  selectorName: string
  scope: string
  effectiveDate: string
  status: string
  emptyStateReason: string | null
  provenanceSummary: string
  lastSyncRun: {
    id: number
    completedAt: string
    status: string
  } | null
  rawInputRows: Array<{
    table: string
    id: number
    key_fields: Record<string, unknown>
  }>
  derivedDependencies: Array<{
    outputType: string
    algorithmVersion: string
    computedAt: string
    confidence: number | null
  }>
}
```

**Interaction:** Tap any health data card while debug overlay is active → overlay shows `CardDebugInfo` for that card. Swipe down to dismiss.

### 9.2 Data Inspection Tools

Available from a dev-only "Data Inspector" screen accessible from Profile → Developer Tools:

| Tool | Description | Query |
|---|---|---|
| **Raw Samples Browser** | Browse all raw_health_samples for a date, filtered by source_type | `SELECT * FROM raw_health_samples WHERE local_day_key = ? ORDER BY source_type, start_time` |
| **Normalized Records Browser** | Browse all normalized rows for a date across all tables | Union query across vitals, sleep, activity, mobility, environmental, cardio_metabolic, running_dynamics |
| **Derived Scores Inspector** | Browse all derived_outputs for a date, showing version and dependency chain | `SELECT * FROM derived_outputs WHERE json_extract(payload_json, '$.date') = ?` |
| **Sync Run Log Viewer** | Browse all sync_runs with filtering by status, date range. Show per-run sample counts. | `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 50` |
| **Orphan/Stale Record Detector** | Find records with no provenance_log entry, or sync_run_id not matching any active sync | `SELECT 'vitals', id FROM vitals WHERE sync_run_id IS NULL UNION ALL ...` |
| **Provenance Gap Detector** | Find records in any table that lack corresponding provenance_log entries | `SELECT * FROM vitals v LEFT JOIN provenance_log p ON p.record_table='vitals' AND p.record_id=v.id WHERE p.id IS NULL` |

### 9.3 "Why Am I Seeing This?" Inspector

Every health data component gets a long-press handler (when debug mode is on) that shows:

```
┌─────────────────────────────────────┐
│  Why Am I Seeing This?              │
├─────────────────────────────────────┤
│  Component: BiologicalAge           │
│  Selector: selectBiologicalAgeFor   │
│            Date('2026-05-24')       │
│  Scope: selectedDate                │
│  Status: present                    │
│  Confidence: 78%                    │
│  Input Coverage: 4/6 biomarkers     │
│                                     │
│  ── PROVENANCE ──                   │
│  Algorithm: biological-age v1.3.0   │
│  Computed: 2026-05-24T06:30:00Z     │
│  Sync Run: #247 (completed)         │
│                                     │
│  ── RAW INPUTS ──                   │
│  HRV: 48ms (vitals.id=1523)         │
│  RHR: 62bpm (vitals.id=1523)        │
│  SpO2: 98% (vitals.id=1523)         │
│  VO2Max: 44.5 (cardio_metab.id=412) │
│  Sleep Quality: 0.82 (sleep.id=723) │
│  Chronological Age: 29 (profile)    │
│                                     │
│  ── MISSING INPUTS ──               │
│  Weight: no data for this date      │
│  Lean Body Mass: not configured     │
│                                     │
│  ── DEPENDENCY CHAIN ──             │
│  raw_health_samples[hrv, rhr, ...]  │
│  → vitals.normalized                │
│  → daily_scores.computed            │
│  → biological-age.derived           │
└─────────────────────────────────────┘
```

### 9.4 Data Quality Dashboard

Accessible from Profile → Developer Tools → Data Quality:

```
┌────────────────────────────────────────────────────┐
│              DATA QUALITY DASHBOARD                 │
├────────────────────────────────────────────────────┤
│  Total Raw Samples:      12,847                     │
│  Normalized Records:      2,103                     │
│  Derived Outputs:           847                     │
│  Sync Runs:                  52                     │
│                                                     │
│  ── COVERAGE ──                                     │
│  Last 30 Days Synced:    30 / 30 (100%)             │
│  Last 7 Days Synced:      7 / 7  (100%)             │
│  Today Synced:           YES                        │
│                                                     │
│  ── DATA HEALTH ──                                  │
│  Records w/o Provenance:   0                        │
│  Duplicate Raw Samples:    0                        │
│  Stale Derived Outputs:    0                        │
│  Orphaned Records:         0                        │
│  Sync Failures:            0                        │
│                                                     │
│  ── ALGORITHM HEALTH ──                             │
│  recovery:            v1.2.0 — 365 outputs, 0 stale │
│  biological-age:      v1.3.0 — 365 outputs, 12 stale│
│  illness-predictor:   v1.1.0 — 365 outputs, 0 stale │
│  trend-engine:        v2.0.0 —  52 outputs, 0 stale │
│  weekly-planner:      v1.0.0 —  52 outputs, 0 stale │
│                                                     │
│  ── LAST SYNC ──                                    │
│  Run #52: completed at 2026-05-24T07:30:00Z         │
│  Window: 2026-04-24 → 2026-05-24 (30 days)         │
│  Samples: 142 new, 0 deduped, 3 updated              │
│  Permission: all 30 types authorized                 │
└────────────────────────────────────────────────────┘
```

### 9.5 Sync Run Log Viewer

```
┌──────────────────────────────────────────────────────────────────┐
│  SYNC RUN LOG                                                     │
├────┬─────────────────────┬──────────┬────────┬───────┬───────────┤
│ ID │ Started             │ Status   │ Window │ New   │ Errors    │
├────┼─────────────────────┼──────────┼────────┼───────┼───────────┤
│ 52 │ 2026-05-24 07:30:00 │ completed│ 30 days│ 142   │ 0         │
│ 51 │ 2026-05-23 07:30:00 │ completed│ 30 days│ 89    │ 0         │
│ 50 │ 2026-05-22 07:31:00 │ completed│ 30 days│ 112   │ 0         │
│ 49 │ 2026-05-21 07:30:00 │ partial  │ 30 days│ 45    │ 3         │
│    │                     │          │        │       │ (tap→)    │
└────┴─────────────────────┴──────────┴────────┴───────┴───────────┘

Tap row → expand to show per-category sample counts, error details,
          permission snapshot, and notes.
```

---

## 10. Rollout Plan in Safe Migration Phases

### Phase A: Add raw_samples and sync_runs Tables (Write-Only)

**Goal:** Introduce new tables without changing any existing behavior. Data flows into new tables alongside existing pipeline.

**Changes:**
- [ ] Add `raw_health_samples` table to [`db.ts`](elite-health/src/lib/db.ts) schema
- [ ] Add `sync_runs` table to [`db.ts`](elite-health/src/lib/db.ts) schema
- [ ] Add `derived_outputs` table to [`db.ts`](elite-health/src/lib/db.ts) schema
- [ ] Add `provenance_log` table to [`db.ts`](elite-health/src/lib/db.ts) schema
- [ ] Modify `syncHealthKit()` in [`store.ts`](elite-health/src/lib/store.ts:471) to:
  - [ ] Create a `sync_runs` row at start (status: 'started')
  - [ ] Write raw samples to `raw_health_samples` (INSERT OR IGNORE — deduped)
  - [ ] Write provenance_log entries for normalized rows
  - [ ] Update `sync_runs` row at completion (status, sample_counts)
- [ ] Existing normalized writes (vitals, sleep, etc.) continue unchanged

**Acceptance Criteria:**
- [ ] `raw_health_samples` populates with deduped sample data
- [ ] `sync_runs` has one row per sync (completed or failed)
- [ ] Existing UI and AI payload unchanged
- [ ] No performance regression in sync time
- [ ] Storage increase < 50MB for 30-day window (baseline measurement)

**Rollback:** Drop new tables, revert `syncHealthKit` to original. No data loss.

---

### Phase B: Dual-Write to raw_samples + Existing Normalized Tables

**Goal:** Validate that raw samples produce identical normalized aggregates to the existing pipeline.

**Changes:**
- [ ] Add `normalizeFromRawSamples(date, table)` functions that derive normalized records from raw samples
- [ ] After each sync, run dual-write: existing normalization + new normalization
- [ ] Compare outputs — log discrepancies
- [ ] Don't use new normalization for reads yet

**Acceptance Criteria:**
- [ ] < 0.1% discrepancy rate between old and new normalization
- [ ] All discrepancies logged and understood (timing, rounding, aggregation differences)
- [ ] New normalization produces at least as many records as old (no data loss)

**Rollback:** Stop calling new normalization functions. Existing pipeline unchanged.

---

### Phase C: Add Provenance Columns to Existing Tables

**Goal:** Every existing record gains `sync_run_id`, `source_raw_sample_ids`, `computed_at`, `algorithm_version`.

**Changes:**
- [ ] Migration: `ALTER TABLE` each table to add 4 new columns (nullable)
- [ ] Update all INSERT/UPDATE statements in [`store.ts`](elite-health/src/lib/store.ts) to populate new columns
- [ ] Backfill existing rows: for each table, walk rows by date, match to raw_health_samples, populate sync_run_id and source_raw_sample_ids
- [ ] Set `computed_at` to current timestamp for backfilled rows
- [ ] Set `algorithm_version` to 'v0.0.0-legacy' for backfilled rows

**Acceptance Criteria:**
- [ ] All existing rows have non-null `sync_run_id` and `computed_at`
- [ ] Backfill covers all dates with raw sample data
- [ ] UI unchanged — provenance columns are read but not displayed

**Rollback:** Provenance columns are nullable — dropping them is safe. Back to Phase B state.

---

### Phase D: Introduce Canonical Selectors (Dual-Path)

**Goal:** New selector functions exist alongside old selectors. Old selectors unchanged. New selectors tested.

**Changes:**
- [ ] Create [`elite-health/src/lib/selectors/`](elite-health/src/lib/selectors/) directory
- [ ] Implement all canonical selectors (see §6.2) as pure functions
- [ ] Implement `HealthMetricViewModel<T>` interface
- [ ] Implement `toScopedMetric()` helper
- [ ] Add comprehensive unit tests for each selector:
  - [ ] Returns `status: 'missing'` when data absent
  - [ ] Returns `status: 'present'` with correct scope label
  - [ ] Returns `emptyStateReason` for missing data
  - [ ] Returns `provenanceSummary` from provenance_log
  - [ ] Never falls back silently
- [ ] Old selectors (`currentScores`, `currentVitals`, etc.) remain unchanged

**Acceptance Criteria:**
- [ ] All canonical selectors have >90% test coverage
- [ ] Selectors handle all edge cases (null, empty, zero, stale)
- [ ] Old code path completely unaffected

**Rollback:** Delete `selectors/` directory. No production code changed.

---

### Phase E: Migrate Screens One-by-One to Canonical Selectors

**Goal:** Each screen switches from old access patterns to canonical selectors. One screen per PR. Each screen verified independently.

**Migration order (least risky first):**

1. [ ] **Edit Profile** — simplest, only reads `latestScores?.biologicalAge`
2. [ ] **Live Workout** — already has good provenance, minimal change
3. [ ] **Sleep Drilldown** — two scopes, clearly separable
4. [ ] **Profile (all-time records)** — reads raw arrays, straightforward conversion
5. [ ] **Health (DefaultHealthView)** — selectedDate only
6. [ ] **Health (ReadinessView, ResilienceView, LongevityView)** — rolling7d + selectedDate mixed
7. [ ] **Home sub-components** — one at a time, starting with simplest:
   - [ ] `ai-prompt-bar.tsx` (no data)
   - [ ] `immunity-shield.tsx` (single derived metric)
   - [ ] `journal-weekly-checklist.tsx` (journal data)
   - [ ] `sleep-mini-card.tsx` (sleep data)
   - [ ] `streak-tracker.tsx` (all-time streaks)
   - [ ] `vitals-rings.tsx` (synthesis derived)
   - [ ] `body-systems-bar.tsx` (vitals + cns)
   - [ ] `habit-impact-engine.tsx` (correlation)
   - [ ] `hr-spline-trace.tsx` (sleep block fabrication removal)
8. [ ] **Home (index.tsx)** — the orchestration screen
9. [ ] **Coach** — most complex, last to migrate

**Acceptance Criteria (per screen):**
- [ ] Screen renders identically to pre-migration (visual regression)
- [ ] Empty states show explicit "No data for [date]" messages
- [ ] Provenance badges visible on every data card
- [ ] No silent fallback — `currentX ?? latestX` patterns removed
- [ ] Date navigation shows correct data for each date (no cross-contamination)

**Rollback:** Revert screen to old selectors. Other screens unaffected.

---

### Phase F: Add Algorithm Versioning and derived_outputs Table

**Goal:** Every algorithm output is versioned, timestamped, and traceable.

**Changes:**
- [ ] Create Algorithm Registry: `Map<string, { version: string, inputs: string[], compute: Function }>`
- [ ] Update every algorithm in [`elite-health/src/lib/algorithms/`](elite-health/src/lib/algorithms/) to:
  - [ ] Export a version constant (e.g., `export const RECOVERY_VERSION = '1.2.0'`)
  - [ ] Accept and return metadata (input_coverage, confidence)
- [ ] Update `computeScores()` in [`store.ts`](elite-health/src/lib/store.ts:340) to:
  - [ ] INSERT into `derived_outputs` after each computation
  - [ ] Include `algorithm_version`, `input_coverage`, `confidence`, `dependency_ids`
- [ ] Implement `recomputeAllStale()` — walks `derived_outputs` where `invalidated_at IS NOT NULL`, re-runs algorithm, inserts new row, marks old as superseded
- [ ] Implement `invalidateAlgorithm(type)` — marks all `derived_outputs` of that type as `invalidated_at = now`

**Acceptance Criteria:**
- [ ] All 16 algorithms export version constants
- [ ] Every `computeScores` call writes a `derived_outputs` row
- [ ] `recomputeAllStale()` successfully re-derives from raw samples
- [ ] Algorithm update (version bump) triggers automatic invalidation + recompute

**Rollback:** Remove `derived_outputs` writes. Algorithms continue to work without versioning.

---

### Phase G: Rebuild AI Payload with Scoped Metrics

**Goal:** AI receives structured, provenance-carrying biometric context.

**Changes:**
- [ ] Create [`elite-health/src/lib/gemini/biometrics-context.ts`](elite-health/src/lib/gemini/biometrics-context.ts) with `ScopedMetric<T>` and `BiometricsContext`
- [ ] Implement `buildBiometricsContext(dateStr, state, trendReport)` using canonical selectors
- [ ] Replace inline `buildBiometricsContext()` in [`coach.tsx:567`](elite-health/app/\(tabs\)/coach.tsx:567) with import
- [ ] Date-scope all 4 categories that were always latest (mobility, runningDynamics, environmental, cardioMetabolic)
- [ ] Update system prompt in [`coach-prompt.ts`](src/lib/gemini/coach-prompt.ts) (and mobile equivalent) to reference scope metadata
- [ ] Update fallback coach [`fallback-coach.ts`](elite-health/src/lib/gemini/fallback-coach.ts) to:
  - [ ] Label every fabricated value with `ESTIMATE — NO REAL DATA`
  - [ ] Only fabricate when biometrics are genuinely unavailable (not just for offline mode)
- [ ] Unify web pipeline — import shared `buildBiometricsContext()`
- [ ] Add "explain this answer" mode

**Acceptance Criteria:**
- [ ] AI payload has `scope`, `effectiveDate`, `status`, `provenanceLabel` on every metric
- [ ] `status: 'missing'` metrics are sent as null with explanation, not fabricated
- [ ] Fallback coach labels fabricated values clearly
- [ ] Web and mobile produce identical payload structure
- [ ] "Explain this answer" returns metric-level contribution breakdown

**Rollback:** Switch back to flat payload. AI prompt reverts to original.

---

### Phase H: Add Debug/Observability Tools

**Goal:** Developers (and eventually power users) can inspect the full data lineage of any displayed value.

**Changes:**
- [ ] Implement debug overlay (5-finger long-press gesture) in [`_layout.tsx`](elite-health/app/_layout.tsx)
- [ ] Implement `CardDebugInfo` panel — tap any card to inspect
- [ ] Implement Data Inspector screen (dev-only route)
- [ ] Implement Sync Run Log Viewer
- [ ] Implement Data Quality Dashboard
- [ ] Implement "Why Am I Seeing This?" long-press handler on all health data components

**Acceptance Criteria:**
- [ ] Debug overlay accessible via gesture
- [ ] Card inspector shows selector name, scope, raw inputs, derived dependencies, provenance
- [ ] Data Quality Dashboard shows coverage %, health metrics, algorithm health
- [ ] Sync Run Log shows all historical syncs with per-category counts

**Rollback:** Feature-flagged behind dev mode. Disable flag to hide all debug tools.

---

### Phase I: Remove Legacy Selectors and Silent Fallbacks

**Goal:** Delete the old access patterns that caused scope mixing.

**Changes:**
- [ ] Remove `latestVitals`, `latestSleep`, `latestScores` from Zustand store (or deprecate — keep for data hydration)
- [ ] Remove `currentVitals ?? latestVitals` patterns everywhere
- [ ] Remove `mobility[0]`, `environmental[0]`, `cardioMetabolic[0]`, `runningDynamics[0]` patterns
- [ ] Remove `safeHRV` range-based nulling (keep the range check as `status: 'insufficient'` in selectors)
- [ ] Remove `safeBiologicalAge` chrono-age fallback
- [ ] Remove `safeSkinTempDelta` zero-as-null
- [ ] Audit: grep for `?? latest`, `[0] ||`, `safeBiologicalAge`, `safeSkinTempDelta`

**Acceptance Criteria:**
- [ ] Zero silent fallbacks in production code
- [ ] All `??` patterns replaced with explicit `select*()` calls
- [ ] All `[0]` array access replaced with `selectLatest*()`
- [ ] No regression in data display

**Rollback:** Restore legacy selectors. This is the most coupled phase — rollback to Phase H.

---

### Phase J: Performance Optimization

**Goal:** Ensure the re-architected pipeline performs at least as well as the current one.

**Changes:**
- [ ] Add indexes: `raw_health_samples(local_day_key, source_type)`, `derived_outputs(output_type, computed_at)`, `provenance_log(record_table, record_id)`
- [ ] Batch INSERT for raw samples (current approach: per-sample INSERT)
- [ ] Incremental recomputation: only recompute scores for dates that received NEW raw samples
- [ ] Background processing: derived computation off main thread (expo-task-manager)
- [ ] Configurable raw sample retention: delete raw samples older than N days (default: 90), rebuild daily aggregates before deleting
- [ ] Lazy provenance loading: provenance_log queried only when debug overlay is active

**Acceptance Criteria:**
- [ ] Sync time ≤ current sync time + 20% (with raw sample preservation)
- [ ] App cold start ≤ current cold start + 10%
- [ ] Memory usage ≤ current + 15MB
- [ ] Storage for 30-day raw samples ≤ 100MB

---

## 11. Risks, Tradeoffs, and Validation Plan

### 11.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Storage increase from raw sample preservation** | High | Medium | Configurable retention window (default 90 days). Raw samples older than retention are deleted after daily aggregates are confirmed rebuilt. Compression: metadata_json stores only essential fields. |
| **Sync performance with per-sample writes** | Medium | Medium | Batch INSERT (100 samples per transaction). Background processing for derived computation. Incremental sync via HKAnchoredObjectQuery (future) avoids full window re-scan. |
| **UI disruption during screen migration** | Medium | High | Dual-path approach: canonical selectors introduced alongside legacy selectors. One screen per PR. Visual regression testing per screen. |
| **Algorithm version mismatches during migration** | Medium | Medium | Version registry with compatibility matrix. Old outputs marked `invalidated_at` but NOT deleted — fallback to reading old format. |
| **Breaking change for existing users on app update** | Medium | High | All new tables are additive. All new columns are nullable. Migration runs on first app open, backfills existing data. Old code paths coexist during transition. |
| **HealthKit sample identifier instability** | Low | High | UNIQUE constraint on (canonical_id, start_time, source_type) provides soft dedup. If canonical_id is not stable, fall back to (start_time, end_time, source_type, value) hash. |
| **Apple Watch background delivery unreliability** | Medium | Low | Sync tracks permission_state changes. Background sync failures logged in sync_runs with status 'failed'. User notified on next foreground open. |

### 11.2 Tradeoffs

| Tradeoff | What We Gain | What We Lose |
|---|---|---|
| **More storage** | Complete audit trail, rebuild capability, data lineage, trust | Raw samples for 30 days ≈ 15-30MB per user; 90 days ≈ 50-100MB |
| **Slower initial sync** | Idempotency, dedup, provenance capture | First sync writes 2x more data (raw + normalized). Subsequent syncs only write net-new samples. |
| **More complex code** | Simpler reasoning about data scope and correctness | Selector layer adds indirection; HealthMetricViewModel wrapping adds ceremony to simple value reads |
| **Explicit scope everywhere** | No more silent fallbacks, users always know what date they're seeing | UI needs provenance badges on every card — more visual elements |
| **Algorithm versioning** | Debuggability, reproducibility, safe algorithm updates | Algorithm authors must bump versions on every change; dependency tracking adds complexity |
| **Rebuild from raw samples** | Resilience — any bug in normalization can be fixed and replayed | Raw samples must be preserved; adds storage cost |

### 11.3 Validation Plan

#### Per-Phase Acceptance Tests

| Phase | Test Type | What to Test |
|---|---|---|
| A | Integration | sync_runs row created/updated on each sync; raw_health_samples populated with deduped data |
| A | Performance | Sync time before/after; storage size increase |
| B | Correctness | Dual-write: old vs new normalized records — field-by-field comparison for 100 random dates |
| B | Coverage | New normalization produces records for all dates old normalization did |
| C | Data integrity | All backfilled rows have non-null provenance columns; provenance_log entries exist for all records |
| D | Unit | Every canonical selector tested with: null data, partial data, complete data, stale data, future dates, boundary dates |
| D | Unit | HealthMetricViewModel status field correct for all input states |
| E | Visual regression | Per-screen before/after screenshots; empty states; date navigation |
| E | Functional | Date picker changes show correct data; no cross-date contamination |
| F | Correctness | derived_outputs created for every algorithm run; invalidation + recompute cycle produces identical outputs |
| G | Payload structure | AI payload validates against BiometricsContext type; every field has scope/status/provenance |
| G | Fallback | Fallback coach labels every fabricated value; system prompt references scope metadata |
| H | UI | Debug overlay activates; card inspector shows correct data; data quality dashboard populated |
| I | Regression | Full app smoke test — every screen, every interaction; zero silent fallbacks |
| J | Performance | Sync time, cold start time, memory usage, storage size benchmarks |

#### Rollback Conditions Per Phase

| Phase | Rollback Trigger |
|---|---|
| A | Sync time increases >50% OR storage increases >200MB for 30-day window |
| B | Discrepancy rate >1% between old and new normalization |
| C | Backfill fails for >1% of rows OR backfill takes >5 minutes |
| D | Any selector returns wrong scope or false positive status |
| E | Any screen shows wrong-date data OR regression in empty state behavior |
| F | Algorithm recompute produces different outputs for same inputs |
| G | AI responses degrade in quality (manual review of 20 responses) |
| H | Debug overlay causes >5% frame drop |
| I | Any `?? latest` or `[0]` pattern found in production code |
| J | Any performance metric degrades >20% from baseline |

---

## 12. Assumptions Needing Device-Side Validation

The following assumptions are critical to the re-architecture plan but can only be validated with a real Apple Watch / HealthKit device. These must be tested before committing to the design.

### 12.1 HealthKit Sample Identity

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A1 | HealthKit samples have stable UUIDs (`sample.uuid`) that persist across syncs and device restarts | Query same sample on two consecutive app launches; compare UUIDs | High — if UUIDs change, dedup by canonical_id fails; fall back to content-based dedup |
| A2 | The same HealthKit sample (same start_time, end_time, source, value) always has the same UUID | Query HealthKit for a known date range; export UUIDs; re-query; compare | High — same as A1 |
| A3 | HealthKit sample UUIDs are truly unique (no collisions across users/devices) | Query 1000+ samples; check for UUID collisions | Low — UUIDv4 collision probability is negligible, but HealthKit may use a different scheme |

### 12.2 HealthKit Source Metadata

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A4 | `HKSource` provides `name` (e.g., "Apple Watch Ultra 2") and `bundleIdentifier` (e.g., "com.apple.health") for every sample type | Query one sample of each type; inspect `source.name` and `source.bundleIdentifier` | Medium — some sample types may lack device-level source granularity |
| A5 | `HKDevice` provides `name`, `manufacturer`, `model`, `softwareVersion` for Apple Watch samples | Query Watch-generated samples (HRV, RHR, sleep stages); inspect `device` property | Low — device metadata is nice-to-have for provenance but not critical |
| A6 | Third-party app samples (e.g., Strava, Whoop) carry identifiable source app metadata distinguishable from Apple Health | Query samples from third-party apps if available; compare source fields | Low — relevant only if user uses multiple health apps |

### 12.3 HealthKit Query Behavior

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A7 | `HKQuantitySample` queries with `limit: N` and `ascending: false` return the N most recent samples in deterministic, stable order | Query same date twice with same parameters; compare order of returned samples | Medium — if order is non-deterministic, `limit: 1` picks arbitrary sample → `fetchAll` with client-side sort needed |
| A8 | `HKCategorySample` (sleep) queries return all samples for the date window without pagination (`limit: 0`) | Query sleep for a date with many samples; verify all are returned | Medium — if limit: 0 doesn't return all, sleep aggregation is incomplete |
| A9 | `HKWorkout` queries return workout `totalEnergyBurned`, `duration`, and nested `HKWorkoutRoute` data | Query a known workout; inspect all available fields | Medium — route data needed for running dynamics enrichment |
| A10 | Sample timestamps (`startDate`, `endDate`) are in the device's local timezone and accurately reflect when the measurement occurred | Compare sample timestamps to known measurement times (e.g., workout start) | Medium — incorrect timezone handling could shift samples to wrong `local_day_key` |

### 12.4 HealthKit Deletion Detection

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A11 | `HKAnchoredObjectQuery` returns deleted sample IDs in the `deletedObjects` array (or via anchor delta) | Query anchored; note anchor; delete a sample in Health.app; re-query anchored; check deletedObjects | High — if deletions are undetectable, we must rely on periodic reconciliation: query all samples, mark any missing from `raw_health_samples` as `status: 'deleted'` |
| A12 | `HKAnchoredObjectQuery` anchor is stable and monotonic across app restarts | Save anchor to sync_metadata; restart app; query anchored with saved anchor; verify no duplicate samples returned | High — if anchors reset, incremental sync produces duplicates which dedup must handle |

### 12.5 Sleep Data

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A13 | Apple Watch provides sleep stage data (REM, Core, Deep, Awake) via `HKCategoryValueSleepAnalysis` enum values 3, 4, 5 | Query sleep samples; check for `value` 3 (Core), 4 (Deep), 5 (REM) | Medium — if Watch doesn't provide stages, sleep architecture can't be computed from HealthKit |
| A14 | Sleep samples from iPhone-only (no Watch) only provide `inBed` (value 0) and `asleep` (value 1), never stages | Query sleep on iPhone-only device; verify no staged data | Low — already handled in current code |
| A15 | Sleep `startDate`/`endDate` for staged data reflects actual sleep onset/offset, not just the scheduled sleep window | Compare staged sleep start/end to user-reported bedtime/wake time | Low — affects bedtimeStart/wakeTimeEnd accuracy |

### 12.6 Background Sync

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A16 | `expo-background-task` fires reliably at ~60-minute intervals when app is backgrounded | Monitor background task execution over 24 hours; count actual vs expected firings | Medium — background sync is a secondary data path; foreground sync is primary |
| A17 | HealthKit queries work from background tasks (no "protected health data is inaccessible" error when device is unlocked but app is backgrounded) | Trigger background sync; check for permission errors in logs | High — if HK queries fail in background, background sync must be disabled |
| A18 | Background task has sufficient execution time (~30 seconds) to complete a full sync cycle | Time background sync execution; verify it completes before system terminates | Medium — if not, background sync must be limited to "today only" |

### 12.7 Permission State

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A19 | `HKHealthStore.authorizationStatus(for:)` returns accurate, up-to-date authorization status for each sample type | Read authorization status for all 30 types; toggle a permission in Settings.app; re-read; verify delta | Medium — permission change detection is a nice-to-have; manual sync covers missed data |
| A20 | Permission changes are detectable in real-time (not just on next app launch) | Subscribe to `HKHealthStore` authorization changes; toggle permission; verify callback fires | Low — even poll-based detection on each sync is sufficient |

### 12.8 Sensor-Specific Assumptions

| # | Assumption | Validation Method | Risk if False |
|---|---|---|---|
| A21 | `HKQuantityTypeIdentifierAppleSleepingWristTemperature` provides a baseline-relative delta, not absolute temperature | Query wrist temp samples; check if values are centered around 0 (delta) or around 36-37°C (absolute) | High — current `normalizeSkinTempDelta` and `safeSkinTempDelta` assume delta format |
| A22 | `HKQuantityTypeIdentifierHeartRateRecoveryOneMinute` is populated after workouts | Do a workout; wait 3+ minutes; query HR Recovery; verify value > 0 | Low — this is a new metric, absence is acceptable |
| A23 | `HKQuantityTypeIdentifierPhysicalEffort` (MET-hours) is populated for workout days | Query Physical Effort for a workout day; verify value > 0 | Low — new metric, absence is acceptable |
| A24 | `HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances` is available on watchOS 11+ | Check watchOS version; if >= 11, query Breathing Disturbances; verify samples exist | Medium — important for illness risk algorithm |

---

## Document Metadata

| Field | Value |
|---|---|
| **Version** | 1.0.0 |
| **Date** | 2026-05-24 |
| **Authors** | Architecture analysis based on discovery of `elite-health/` codebase |
| **Review Status** | Pending review — not yet approved for implementation |
| **Next Step** | Validate device-side assumptions (§12); approve Phase A design for implementation |
