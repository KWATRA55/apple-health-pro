# Phase 3.4 — Pre-Coding Root Cause Analysis

## HEALTH OVERVIEW DATA CONSISTENCY + SINGLE SOURCE OF TRUTH FIX

---

## 1. HEALTH OVERVIEW TRUTH MAP

Every metric displayed on the Health Overview screen, mapped to its data source.

### 1.1 Cards Section (DefaultHealthView, `health.tsx` lines 327–795)

All cards read **selected-date** data via `currentScores`, `currentVitals`, `currentSleep`, etc. — exact-date lookups.

| UI Section | Displayed Label | Source | Type |
|---|---|---|---|
| Bio Age card | `bioAge.toFixed(1)` | `safeBiologicalAge(currentScores?.biologicalAge) ?? chronologicalAge` (line 358) | selected-date DailyScores |
| Recovery card | `recoveryScore` | `currentScores?.recoveryScore` (line 373) | selected-date DailyScores |
| Sleep card (duration) | `sleepHours.toFixed(1)` | `currentSleep?.totalDurationMins / 60` (line 384) | selected-date SleepRecord |
| Sleep card (debt) | `sleepDebtHours.toFixed(1)` | `currentScores?.sleepDebtHours ?? null` (line 385) | selected-date DailyScores |
| Sleep card (stages) | Deep/REM/Core | `currentSleep?.deepSleepMins`, etc. (lines 559–582) | selected-date SleepRecord |
| Strain inline | `strainVal` | `currentScores?.strainScore` (line 367), gated by `> 0` (line 366) | selected-date DailyScores |
| Body Systems (HRV) | HRV status dot | `currentVitals.hrv` vs `rhrBaseline` (body-systems-bar.tsx line 34–40) | selected-date VitalsRecord |
| Body Systems (LUNGS) | RR + SpO₂ | `currentVitals.respiratoryRate`, `currentVitals.spo2` | selected-date VitalsRecord |
| Body Systems (CNS) | CNS stress | `cnsStressScore` from store (computed across all data) | cross-date aggregate |
| Body Systems (TEMP) | Skin temp delta | `currentVitals.skinTempDelta` | selected-date VitalsRecord |
| StatTiles (HRV) | HRV value | `safeHRV(currentVitals?.hrv)` (line 643-647) | selected-date VitalsRecord |
| StatTiles (RHR) | RHR value | `safeRHR(currentVitals?.rhr)` (line 650-656) | selected-date VitalsRecord |
| StatTiles (Steps) | Steps | `currentEnvironmental?.standMinutes` or similar | selected-date EnvironmentalRecord |
| StatTiles (Daylight) | Daylight mins | `currentEnvironmental?.timeInDaylight` | selected-date EnvironmentalRecord |
| StatTiles (Strain) | Strain | `safeStrainScore(currentScores?.strainScore)` (line 677-683) | selected-date DailyScores |
| Activities list | Workout cards | `currentActivities` (line 1684): `activities.filter(a => a.timestamp.startsWith(dateStr))` | selected-date ActivityRecord[] |
| Gait card | Running dynamics | `currentDynamics?.runningPower > 0` gate (line 725) | selected-date RunningDynamics |

### 1.2 Trend Explorer "All Metrics" List (`TrendExplorer`, `trend-explorer.tsx` lines 242–331)

**ALL metrics use 14-day rolling trend data** from `computeTrendReportSelector` → `computeTrendReport`. NONE use selected-date data.

| UI Row | Displayed Label | Source | Type |
|---|---|---|---|
| Recovery | `metric.latest` | `metrics.recovery.latest` — last value in 14-day scores trend series | rolling 14-day latest |
| HRV | `metric.latest` | `metrics.hrv.latest` — last value in 14-day vitals trend series | rolling 14-day latest |
| RHR | `metric.latest` | `metrics.rhr.latest` | rolling 14-day latest |
| Sleep Duration | `metric.latest` | `metrics.sleepDuration.latest` — from `SleepRecord.totalDurationMins` | rolling 14-day latest |
| **Sleep Debt** | `metric.latest` | `metrics.sleepDebt.latest` — from **`SleepRecord.sleepDebtHours`** field | rolling 14-day latest |
| **Strain** | `metric.latest` | `metrics.strain.latest` — from `DailyScores.strainScore` | rolling 14-day latest |
| SpO₂ | `metric.latest` | `metrics.spo2.latest` | rolling 14-day latest |
| Skin Temp | `metric.latest` | `metrics.skinTempDelta.latest` | rolling 14-day latest |
| Breathing Rate | `metric.latest` | `metrics.respiratoryRate.latest` | rolling 14-day latest |
| Aging Pace | `metric.latest` | `metrics.paceOfAging.latest` — from `DailyScores.paceOfAging` | rolling 14-day latest |
| Body Age | `metric.latest` | `metrics.biologicalAge.latest` — from `DailyScores.biologicalAge` | rolling 14-day latest |

### 1.3 Data Pipeline for Trend Report Sleep Debt (Critical Finding)

The sleep debt shown in "All Metrics" comes from a **completely different source** than the sleep card:

```
CARD:  currentScores.sleepDebtHours
       └─ store.computeScores() → computeSleepDebt({ todaySleep, pastWeekSleep })
          └─ Accumulates over past 7 days: Σ max(0, neededHours - actualHours)

TREND: metrics.sleepDebt.latest
       └─ computeTrendReportSelector() → state.sleep[].sleepDebtHours
          └─ computeTrendReport() → TrendMetric from SleepRecord.sleepDebtHours series
             └─ SleepRecord.sleepDebtHours ← loaded from DB column sleep_debt_hours
                └─ addSleep() DOES NOT write this column!
                   INSERT: (date, total_duration_mins, rem_mins, deep_mins, core_mins, awake_mins)
                   ^^^ NO sleep_debt_hours, NO sleep_need_hours
```

**The `addSleep` INSERT omits `sleep_debt_hours` and `sleep_need_hours` columns.** If the DB schema has these columns (they exist in `loadFromDB`'s SELECT), they will have NULL or default 0 values. The trend engine's `.filter(s => s.sleepDebtHours !== undefined)` lets `null` through (null !== undefined is true), but `null` as a value in the trend series causes the trend metric to compute with `null` values that coerce to `0` or `NaN` in arithmetic.

Simultaneously, the card's `currentScores?.sleepDebtHours` is computed fresh by `computeScores` using the `computeSleepDebt` algorithm and shows the real accumulated debt (e.g., 15.4h).

**This is the root cause of Bug A.**

---

## 2. ROOT CAUSE HYPOTHESES FOR EACH BUG

### BUG A — Sleep Debt conflict (card: 15.4h, All Metrics: 0.0h)

**Root Cause: Dual data source with different computation paths.**

| Path | Value | Source |
|---|---|---|
| Sleep card | 15.4h | `currentScores.sleepDebtHours` ← `computeScores()` → `computeSleepDebt()` — REAL computed debt over 7 days |
| All Metrics | 0.0h | `metrics.sleepDebt.latest` ← trend from `SleepRecord.sleepDebtHours` — DB column never populated by `addSleep()` |

**Why 0.0h:** `addSleep()` (store.ts line 144–146) inserts into `sleep` table without `sleep_debt_hours`:
```sql
INSERT INTO sleep (date, total_duration_mins, rem_mins, deep_mins, core_mins, awake_mins)
```
The `sleep_debt_hours` column (if present in schema) defaults to NULL or 0. `loadFromDB` maps `s.sleep_debt_hours` → `sleepDebtHours`. If NULL/0, trend series is all zeros → `latest = 0.0`.

**Fix:** Either (a) make TrendExplorer sleep debt read from `DailyScores.sleepDebtHours` instead of `SleepRecord.sleepDebtHours`, or (b) populate `SleepRecord.sleepDebtHours` when adding sleep (run `computeSleepDebt` at `addSleep` time), or (c) make the trend report's sleep debt series pull from scores, not sleep records.

**Recommended:** Option (c) — change `computeTrendReportSelector` to source sleep debt from `state.scores.sleepDebtHours` (already present in the scores map at line 814), NOT from `state.sleep.sleepDebtHours`.

---

### BUG B — Strain conflict (card: empty, All Metrics: 21.0)

**Root Cause: Gate condition vs. rolling window scope mismatch.**

The strain card has a visibility gate:
```typescript
const hasStrainData = currentScores?.strainScore != null && currentScores!.strainScore > 0  // line 366
```
If `currentScores` is `null` for the selected date (no scores computed yet, or a past date without activities), the card shows:
```
'No strain data — sync workouts to track cardiac load'
```

But the All Metrics strain row shows `metrics.strain.latest` — the LAST value in the 14-day rolling window of ALL scores across ALL dates. The trend report:
1. Filters `state.scores` for `recoveryScore > 0` (line 808)
2. Sorts chronologically
3. Computes trend: `latest = values[values.length - 1]` — the most recent score's strain, regardless of selected date
4. Even filters strain series for `strainScore > 0` (line 527 in trend-engine.ts)

So All Metrics shows the latest strain from the trend window (e.g., 21.0 from yesterday), while the card shows "no data" because today's `currentScores` is null.

**Secondary issue:** The `computeTrendReportSelector` filters scores by `recoveryScore > 0` but the strain trend in `computeTrendReport` further filters by `strainScore > 0`. If yesterday had strain=21.0 but recoveryScore=0, it would be excluded from the scores array entirely and not appear in either place. But if recoveryScore > 0 and strainScore > 0, it appears in the trend.

**Fix:** The All Metrics section should either (a) respect the selected date and show only that date's strain, or (b) clearly label its values as "latest" (rolling window) not "selected date". Option (a) is the correct single-source-of-truth approach — TrendExplorer should use selected-date values for the "latest" column when a date is selected.

---

### BUG C — HRV trend sign/styling error (current=40ms > avg=31.7ms, z=+0.6, but red ↓)

**Root Cause: Arrow direction and color are driven by 7-day SLOPE, not by current-vs-baseline comparison.**

`TrendMetricRow` renders (trend-explorer.tsx lines 78–123):
```
40.0ms  +0.6z  ↓ -0.3%/day
```

The components:
- `40.0ms` = `metric.latest` (latest value in series)
- `+0.6z` = `metric.recentZScore` — colored by `zColor(z)` (line 99): green if z>0 (higherIsBetter=true), red if z<0
- `↓` = `directionArrow(metric)` — uses `metric.direction7d` (line 23): 'rising'→↑, 'falling'→↓
- `-0.3%/day` = `metric.slope7d` — colored by `slopeColor(metric, higherIsBetter)` (line 108): green if slope positive (HRV higherIsBetter=true), red if slope negative
- `14d avg: 31.7ms` = `metric.mean14d` (informational, line 84)

**The conflict:** The z-score of +0.6 says "current is above average" (positive for HRV), colored green by `zColor`. But the slope of -0.3%/day says "HRV is declining over 7 days", shown as red ↓. Both are accurate, but the visual combination (green z-score + red arrow) is confusing. The user reads this as "HRV is red/down" when the current value is actually above baseline.

**This is a design ambiguity, not a data error.** The row conflates two distinct signals:
1. Current vs. baseline (z-score) — "where are we now?"
2. Trend direction (slope) — "where are we heading?"

**Fix:** 
- Option A: Make the arrow reflect z-score direction, not slope direction (semantically clearer for a "current status" row)
- Option B: Label the arrow as "7d trend" to disambiguate
- Option C: Show z-score based arrow/color as primary, with slope as secondary annotation labeled "7d: ↓"

**Recommended:** Option A — the arrow and primary color should reflect current-vs-baseline (z-score), since the row is showing "latest" value with "14d avg" as comparator. The slope should be a secondary annotation labeled "trending ↓".

---

### BUG D — Biological Age extreme output (80.0 vs chronological 25.0)

**Root Cause: Stale pre-rewrite data in the database.**

The `computeBiologicalAge` algorithm (rewritten in Phase 3.3) has a 2.5× hard cap:
```typescript
// biological-age.ts lines 211-218
const maxPace = 2.5
const clampedPace = Math.min(rawPace, maxPace)
const biologicalAge = Math.round(chronologicalAge * clampedPace * 10) / 10
```
For chronological age 25: max biological age = 25 × 2.5 = **62.5**. The algorithm CANNOT produce 80.0.

**Where 80.0 comes from:** The `loadFromDB` function (store.ts line 603–604) loads `biological_age` directly from the `daily_scores` DB table:
```typescript
const scores = await getAll<...>( 'SELECT * FROM daily_scores ORDER BY date DESC LIMIT 50')
// ...
biologicalAge: sc.biological_age  // line 626
```

If the database contains scores computed BEFORE the Phase 3.3 algorithm rewrite, those scores would have the OLD biological age values (which had no 2.5× cap). The `safeBiologicalAge` check (display-helpers.ts line 93–97) only rejects values `<= 0 || > 150`. A value of 80.0 passes this check.

**Secondary concern — synthetic generator leak:**
`synthetic-generator.ts` line 34: `const seed = 42` — generates 30 days of pseudo-random data. If this generator is ever called in production code paths, it could inject fake biological ages. A quick search for `generateSynthetic30DayDataset` imports in non-test files is needed.

**Fix:**
1. Primary: After `loadFromDB`, re-compute scores for dates that have vitals data but may have stale biological age values. OR: add a schema version check and force recomputation on load.
2. Secondary: Add instrumentation to log when biological age exceeds the 2.5× cap (defensive programming).
3. Tertiary: Verify `generateSynthetic30DayDataset` is only imported in test files, not production code.

---

## 3. WHICH UI SECTIONS READ FROM DIFFERENT SOURCES TODAY

### 3.1 Direct Conflicts (same metric, different source)

| Metric | Card Source | All Metrics Source | Conflict? |
|---|---|---|---|
| **Sleep Debt** | `DailyScores.sleepDebtHours` (computeScores) | `SleepRecord.sleepDebtHours` (DB column, never written) | **YES — Bug A** |
| **Strain** | `DailyScores.strainScore` (selected-date, gated) | Trend `latest` (14-day rolling, all dates) | **YES — Bug B** |
| **Biological Age** | `DailyScores.biologicalAge` (selected-date) | Trend `latest` (14-day rolling, from same DailyScores) | Same source, but stale DB values possible — Bug D |
| Recovery | `DailyScores.recoveryScore` (selected-date) | Trend `latest` (14-day rolling, from DailyScores) | Different computation scope, same source |
| HRV | `VitalsRecord.hrv` (selected-date) | Trend `latest` (14-day rolling, from VitalsRecord) | Different computation scope, same source |
| RHR | `VitalsRecord.rhr` (selected-date) | Trend `latest` (14-day rolling, from VitalsRecord) | Different computation scope, same source |
| Sleep Duration | `SleepRecord.totalDurationMins` (selected-date) | Trend `latest` (14-day rolling, from SleepRecord) | Different computation scope, same source |
| Pace of Aging | `DailyScores.paceOfAging` (selected-date) | Trend `latest` (14-day rolling, from DailyScores) | Same source |

### 3.2 Structural Mismatch

The fundamental architectural issue: **Cards use exact-date lookups; TrendExplorer uses rolling-window aggregates.** They will ALWAYS show different numbers when the selected date is not the latest date in the dataset. This is by design for the trend section, but the "latest" column in All Metrics is misleading — it implies "latest for selected date" when it actually means "latest in the 14-day window."

---

## 4. WHICH VISIBLE FALLBACKS ARE CAUSING CONFLICTS

| Fallback | Location | Effect |
|---|---|---|
| `?? chronologicalAge` | `bioAge = safeBiologicalAge(...) ?? chronologicalAge` (health.tsx line 358) | Hides missing data by showing chronological age as biological age. User can't tell if bio age is real or fallback. |
| `?? null` | `sleepDebtHours = currentScores?.sleepDebtHours ?? null` (line 385) | Correct — null means "not shown". |
| `> 0` gate | `hasStrainData = currentScores?.strainScore > 0` (line 366) | Hides strain=0 as "no data" — strain=0 is a valid value (rest day). |
| `safeNumber` returning `'--'` for `value === 0` | display-helpers.ts line 179 | Treats legitimate zero values as missing. This is the "null-to-zero ban" but it bans real zeros too. |
| `safeHRV` returning null for `value <= 0 \|\| value > 200` | display-helpers.ts line 102 | Correct range guard. |
| `safeBiologicalAge` returning null for `value <= 0 \|\| value > 150` | display-helpers.ts line 93-97 | Allows 80.0 through (80 ≤ 150). Upper bound should be tightened. |

---

## 5. MOCK / STALE / DEV DATA LEAK ASSESSMENT

### 5.1 Synthetic Generator (`synthetic-generator.ts`)

- Contains `seed = 42` for deterministic pseudo-random generation
- Generates 30 days of fake HRV (30–80ms), RHR (38–65bpm), sleep (4–10h), activities, etc.
- **Risk: LOW** — Only imported in `__tests__/algorithm-validation.test.ts` based on file structure. Not imported in any production component or store file.
- **Recommendation:** Verify with a grep across all non-test source files to confirm no production import.

### 5.2 Stale DB Data

- `loadFromDB` loads ALL columns including `biological_age`, `pace_of_aging`, `sleep_debt_hours`, `sleep_need_hours` from the `daily_scores` and `sleep` tables
- After the Phase 3.3 algorithm rewrite, old DB rows may have biological ages computed with the old (uncapped) algorithm
- **Risk: HIGH for Bug D** — any scores row from before the rewrite will have the old algorithm's output
- **Fix:** Add a schema version or `computed_at` timestamp check, or force recomputation of scores on next `computeScores` call for dates with vitals data

### 5.3 Sleep Record `sleepDebtHours` Column

- `addSleep` INSERT omits `sleep_debt_hours` → DB default value (likely 0 or NULL)
- `loadFromDB` maps it to `sleepDebtHours` on the `SleepRecord` object
- The trend report uses this field as its sleep debt data source
- **Risk: HIGH for Bug A** — this field is NEVER populated, making All Metrics sleep debt always 0.0

---

## 6. RECOMMENDED FIX ORDER

1. **Bug A (Sleep Debt):** Fix `computeTrendReportSelector` to source sleep debt from `state.scores[].sleepDebtHours` instead of `state.sleep[].sleepDebtHours`
2. **Bug B (Strain):** Add selected-date strain to TrendExplorer OR clearly label All Metrics as "14-day rolling" with date context
3. **Bug C (HRV Trend):** Change `TrendMetricRow` arrow/color to reflect z-score (current vs. baseline) instead of 7-day slope
4. **Bug D (Bio Age):** Add post-load score recomputation for dates with stale bio age; tighten `safeBiologicalAge` upper bound from 150 to `chronologicalAge * 3`
5. **Single Source of Truth:** Ensure ALL same-metric displays on Overview read from the same store field
6. **Null-to-Zero Ban:** Audit all `safe*` helpers for the Overview path; ensure real zeros are distinguishable from missing data
