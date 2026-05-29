# Phase 1 Data Integrity — Developer QA Checklist

## Pre-Flight (Before Every PR)
- [ ] `npx tsc --noEmit` passes clean (only pre-existing health.tsx errors)
- [ ] No new `describe`/`it`/`expect` errors in source code (test file excluded)

## 1. Timezone Integrity
- [ ] [`localDateString()`](src/lib/date.ts) produces local-timezone `YYYY-MM-DD` strings
- [ ] [`getWeekWindow()`](src/lib/date.ts) computes 7-day windows using local math, not UTC
- [ ] [`getMonthWindow()`](src/lib/date.ts) computes month boundaries using local math
- [ ] No remaining `toISOString().slice(0,10)` anywhere in app code
- [ ] Weekly Summary screen shows correct date range for user's timezone
- [ ] Monthly Summary screen shows correct month label
- [ ] Month navigation (← →) works across year boundaries (Dec↔Jan)

## 2. No Fabricated Data
- [ ] iPhone-only sleep (inBed) returns `0` for all sleep stages (remMins, deepMins, coreMins, awakeMins)
- [ ] No hardcoded `hrvBaseline || 65` or `rhrBaseline || 60` fallbacks in heuristic-synthesis.ts
- [ ] No hardcoded `?? 50`, `?? 60`, `?? 98` for HRV/RHR/SpO2 in computeScores
- [ ] Illness predictor doesn't flag false positives when baselines are zero
- [ ] Recovery does not use hardcoded `50`/`60` when data is missing

## 3. Minimum Data Coverage
- [ ] Readiness pillar shows "INSUFFICIENT" (not a fabricated score) when <2 data streams
- [ ] Resilience pillar shows "INSUFFICIENT" when no defense-system data exists
- [ ] Longevity pillar shows "INSUFFICIENT" when no biological age or VO₂ max
- [ ] PillarCard renders `--` instead of a score for insufficient data
- [ ] Biological age only computed when ≥3 vitals records exist AND today has real HRV+RHR
- [ ] Baselines computed only when ≥3 data points exist (returns 0 otherwise)

## 4. Display Contract
- [ ] No `(score * 100).toFixed(2)` raw floats in UI
- [ ] Pillar scores are `Math.round()`'d to integers
- [ ] z-scores shown with at most 2 decimal places
- [ ] Insufficient data cards show `--` not `0` or `NaN`
- [ ] `dataCoverage` field present on all PillarScore returns

## 5. Non-Causal Language
- [ ] Correlation Explorer: "associated with" not "improves"/"reduces"
- [ ] Correlation Insight Modal: "CORRELATES WITH ±X%" not "IMPROVES/DEPRESSES BY X%"
- [ ] Correlation Insight Modal footer: "This is a statistical association, not proof of causation"
- [ ] Running form: "associated with elevated injury risk" not "High injury risk"
- [ ] Injury predictor: "statistically associated with" not "Reduce training load immediately"

## 6. Date Integrity
- [ ] [`computeScores`](src/lib/store.ts) uses `getRollingWindow(14, date)` for rolling windows
- [ ] No UTC-crossing bugs when user's local date differs from UTC date
- [ ] `selectedDate` in store initialized via `localDateString()`

## 7. Profile Age
- [ ] `profileAge` is `null` by default, falls back to `25` only in computeScores
- [ ] `setProfileAge` wired up in store
- [ ] Health screen uses `s.profileAge ?? 25` for display
- [ ] Biological age computation uses actual `profileAge` when set

## 8. Data Source Transparency
- [ ] `dataCoverage` metadata available on every PillarScore
- [ ] `zone: 'insufficient'` clearly distinguishable from `zone: 'critical'`
- [ ] Pillar details explain WHY data is insufficient (e.g., "Need ≥2 days of HRV + sleep data")

## 9. Score Integrity
- [ ] All pillar scores clamped to [0, 100]
- [ ] Dynamic weighting in recovery when partial data (HRV-only, RHR-only, sleep-only)
- [ ] Readiness uses weighted scoring when partial inputs
- [ ] Recovery z-scores return 0 when population < 3

## 10. Edge Cases
- [ ] Empty store (fresh install) produces null synthesis
- [ ] Single day of data shows "partial" coverage, not "sufficient"
- [ ] Crossing DST boundaries doesn't corrupt date windows
- [ ] HealthKit sync for iPhone-only users (no Watch) doesn't fabricate sleep stages
