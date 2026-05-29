# Elite Health AI — Phase 1.5 Truthfulness Gap Audit

**Date:** 2026-05-22  
**Scope:** Phase A — Find all `??` numeric fallbacks, hardcoded defaults, fake-safe metrics, and stale placeholders  
**Goal:** Every number on screen must be traceable to real HealthKit data or explicitly labeled as unavailable/stale

---

## AUDIT RESULTS: All Truthfulness Gaps Found

### 🔴 HIGH RISK — User sees fake-normal data without any disclaimer

| # | File | Component | Metric | Current Behavior | Why Misleading | Planned Fix |
|---|------|-----------|--------|-----------------|----------------|-------------|
| 1 | `src/components/home/body-systems-bar.tsx:68-71` | `BodySystemsStatusBar` | HEART, LUNGS, TEMP status dots | When `vitals` is `null`, returns `'green'` (all-good) for HEART, LUNGS, TEMP | Shows all-green system health when there's NO data. User believes everything is normal. | Return `'unknown'` / gray dot when `vitals` is null; show "No vitals" label |
| 2 | `src/components/home/vitals-rings.tsx:16-18` | `PerformanceRingRow` | Readiness, Resilience, Longevity scores | `synthesis?.readiness?.score ?? 0` — shows 0/100 without explanation | Shows "0" as a score which looks like a real (terrible) reading, not "no data" | Show `'--'` or "Insufficient data" when synthesis is null |
| 3 | `app/drilldown/weekly-summary.tsx:661` | `spo2Values` array | SpO2 per day | `safeSpO2(v?.spo2) ?? 95` — returns 95% (clinically normal!) for missing SpO2 | Makes every day without SpO2 data look perfectly normal. User sees a flat green line at 95%. | Return `null` in the array; skip nulls in chart rendering |

### 🟡 MEDIUM RISK — Derived fake values shown without recency labeling

| # | File | Component | Metric | Current Behavior | Why Misleading | Planned Fix |
|---|------|-----------|--------|-----------------|----------------|-------------|
| 4 | `app/(tabs)/index.tsx:429` | `LongevitySphere` | paceOfAging, biologicalAge | `paceOfAging ?? 1.0`, `biologicalAge ?? 25` — shows "1.00x" and "BIO AGE 25.0 YRS" | When no data, shows exactly 1.00x pace (neutral aging) and 25.0 bio age — looks like real measurements | Overlay "Awaiting recent longevity inputs" when both are fallbacks; add recency label |
| 5 | `app/(tabs)/health.tsx:1003-1004` | `LongevityView` | biologicalAge, paceOfAging | `safeBiologicalAge(currentScores?.biologicalAge) ?? chronologicalAge`, `safePaceOfAging(currentScores?.paceOfAging) ?? 1.0` | Falls back to chronological age (which may itself be the default 25) and 1.0x pace — indistinguishable from real data | Add recency date label; show "Baseline estimate" when using fallbacks |
| 6 | `app/drilldown/weekly-summary.tsx:650,656` | `hrvValues`, `rhrValues` arrays | HRV, RHR per day | `safeHRV(v?.hrv) ?? 0` — returns 0 for missing days | Zeros in sparkline arrays create visual artifacts (flat line at bottom). Missing HRV ≠ 0 ms HRV. | Return `null` for missing days; sparkline should handle nulls (skip point or show gap) |
| 7 | `app/(tabs)/coach.tsx:397,402` | `recoveryProtocols`, `metabolicEfficiency` | recoveryScore, rhr | `latestScores?.recoveryScore ?? 0`, `(safeRHR(latestVitals.rhr) ?? 0) > 70` | When no data: recoveryScore=0 triggers wrong protocol path; rhr=0 never > 70 so condition silently fails | Guard entire protocol section with null check; show "Awaiting biometric data" |
| 8 | `src/components/home/hrv-trend-spark.tsx:67` | `hrv-trend-spark` | hrvZScore | `todayScores?.hrvZScore ?? 0` — shows 0.0 z-score | Z-score of 0 means "exactly at baseline" — a normal reading. Missing ≠ normal. | Show `'--'` or null state when no scores data |
| 9 | `src/components/home/bento-grid.tsx:60,112,116,120,125` | `BentoGrid` | sleepScore, deepMins, remMins, efficiency, sleepNeed | Various `?? 0`, `?? 8` — shows zeros and 8h need | Shows "0m DEEP", "0m REM", "0% EFFICIENCY", "8h" need — zeros look like measurements, 8h is misleading | Show `'--'` or "No sleep data" for all fields when sleep is null |

### 🟢 LOW RISK — Backend algorithm fallbacks (internally gated)

| # | File | Component | Metric | Current Behavior | Why It's OK | Notes |
|---|------|-----------|--------|-----------------|-------------|-------|
| 10 | `src/lib/algorithms/heuristic-synthesis.ts:34-38` | `computeReadiness` | hrv, rhr, sleep | `?? 0` for all inputs | Gated by `dataCoverage: 'insufficient'` returning `score: 0, zone: 'insufficient'` — never shows fake scores | Safe as-is |
| 11 | `src/lib/algorithms/heuristic-synthesis.ts:105-109` | `computeResilience` | skinTempDelta, spo2, etc. | `?? 0`, `?? 98`, `?? 3.5`, `?? 'LOW'` | Gated by `dataCoverage` check; `?? 98` for SpO2 is a neutral baseline for penalty computation | Safe as-is | 
| 12 | `src/lib/algorithms/heuristic-synthesis.ts:181-182` | `computeLongevity` | vo2Max, doubleSupport | `?? 0` | Gated by `dataCoverage` check; returns `'insufficient'` when no data | Safe as-is |
| 13 | `src/lib/store.ts:347,714` | `computeScores` / `computeSynthesis` | chronologicalAge | `?? 25` | Default age 25 when profile not configured | Acceptable — user should configure profile |
| 14 | `src/lib/algorithms/weekly-planner.ts:124-130` | `generateWeeklyPlan` | recoveryScore, strainScore, etc. | `?? 50`, `?? 'yellow'`, `?? 0`, `?? 8` | Used only for plan generation; plan shows "Insufficient data" when no inputs | Safe as-is |

### ⚪ DEV-ONLY — Mock data fallback

| # | File | Component | Metric | Current Behavior | Notes |
|---|------|-----------|--------|-----------------|-------|
| 15 | `src/lib/healthkit.ts:310-320` | `fetchVitalsForDate` | All vitals | MOCK data when `!hkAvailable()` | Dev convenience; generates realistic random vitals. Should be removed or gated behind `__DEV__` in production. |

### 🔵 FALLBACK COACH — Uses hardcoded biometrics as if real

| # | File | Component | Current Behavior | Why Misleading | Planned Fix |
|---|------|-----------|-----------------|----------------|-------------|
| 16 | `src/lib/gemini/fallback-coach.ts:13-28` | `generateFallbackCoachResponse` | Uses hardcoded biometrics: `recoveryScore ?? 62`, `hrv ?? 33.8`, `rhr ?? 61`, `vo2Max ?? 44.5`, etc. — presents analysis as if these are the user's actual metrics | Generates convincing coaching text with fake numbers. User cannot tell if this is their data or made up. | Add header: "⚠️ Offline estimate — sync HealthKit for your actual metrics"; or require real biometrics to be present |

---

## SUMMARY: Changes Required

### Phase C (Recency-Aware Display) — ALL COMPLETE ✅
- **Fix #1** ✅: `body-systems-bar.tsx` — null vitals → gray unknown dots
- **Fix #2** ✅: `vitals-rings.tsx` — null synthesis → `'--'` scores
- **Fix #3** ✅: `weekly-summary.tsx:661` — `?? 95` → `null` for missing SpO2
- **Fix #4** ✅: `LongevitySphere` — `isFallback` prop + "Awaiting recent longevity inputs" overlay
- **Fix #5** ✅: `LongevityView` (health.tsx) — `isLongevityFallback` + disclaimer text
- **Fix #6** ✅: `weekly-summary.tsx` sparkline arrays — `null` instead of `0`
- **Fix #7** ✅: `coach.tsx` protocols — guarded with real null checks (no `?? 0` for RHR)
- **Fix #8** ✅: `hrv-trend-spark.tsx` — `'NO BASELINE'` for null z-score
- **Fix #9** ✅: `bento-grid.tsx` — `'--'` for null sleep metrics
- **Fix #16** ✅: `fallback-coach.ts` — offline disclaimer prepended to all 7 response types

### No action needed:
- **Fixes #10-14**: Backend algorithm fallbacks are properly gated
- **Fix #15**: Mock data is dev-only (consider `__DEV__` guard)
