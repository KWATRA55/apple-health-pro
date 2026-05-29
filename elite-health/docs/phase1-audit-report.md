# Elite Health AI — Data Integrity & UX Audit Report

**Date:** 2026-05-22  
**Scope:** Phase 1 — Repetitive screen-by-screen, feature-by-feature audit  
**Goal:** Eliminate empty numbers, blank placeholders, zeroed fake metrics, dead charts, and hardcoded values

---

## Files Modified

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `app/drilldown/sleep.tsx` | UTC date skew: `new Date().toISOString().split('T')[0]` returns UTC date, showing tomorrow's date for EDT timezone after 8pm | Replaced with `localDateString()` from `src/lib/healthkit.ts` which uses local timezone |
| 2 | `src/lib/healthkit.ts` | `fetchRunningDynamicsForDate` returned zero-filled `RunningDynamics` objects (`runningPower: 0, groundContactTime: 0, ...`) when no running data exists, causing UI to render "Power 0 W", "Contact 0 ms" | Changed return type to `RunningDynamics \| null`; returns `null` when no real dynamics data is available |
| 3 | `app/(tabs)/coach.tsx` | Three hardcoded values: "Metabolic Efficiency: High", "Recovery Forecast: 24h 12m", and static protocol rows (NSDR, Cold Exposure, etc.) | Made all three data-driven: `metabolicEfficiency` derived from VO2Max/restingEnergy ratio, `recoveryProtocols` derived from CNS stress risk + recovery score + RHR, recovery forecast countdown derived from actual recovery score |
| 4 | `app/drilldown/weekly-summary.tsx` | `weekScores` returned sentinel objects with `recoveryScore: 0, recoveryZone: 'red'` for missing dates, making it look like every day without data had terrible recovery | Changed to return `null` for missing dates; added `nonNullScores` memo to filter nulls safely; all 6 downstream consumers (`WeeklyInsightCard`, `StrainBarChart`, `ZoneDonut`, `VitalsGrid`, `CnsDaylightChart`, `WeekOverview` stats) updated to use `nonNullScores` |
| 5 | `app/(tabs)/index.tsx` | Fallback synthesis constructed fake data with hardcoded scores (Readiness: 80, Resilience: 85, Longevity: 90), hardcoded `displayPace: 0.88`, hardcoded `displayBioAge: 25`, hardcoded "SH" avatar initials | Removed fake fallback synthesis entirely — `synthesis` now directly uses `computeSynthesis()` (returns real data or `null`). `displayPace` and `displayBioAge` now return `null` when no data exists. `LongevitySphere` receives `?? 1.0` and `?? 25` fallbacks. Avatar changed from "SH" to "AT" |
| 6 | `app/(tabs)/profile.tsx` | Hardcoded name "Shashwat", hardcoded tagline "ENDURANCE SPECIALIST", hardcoded avatar initials "SH" | Changed to generic "Athlete" / "ATHLETE" / "AT" |

## Files Verified (Already Safe)

| File | Why Safe |
|------|----------|
| `app/(tabs)/health.tsx` `LongevityView` | Uses `safeBiologicalAge()`, `safePaceOfAging()` display helpers with `?? chronologicalAge` / `?? 1.0` fallbacks. VO2Max block guarded by `vo2Max > 0`. All vitals values use `'--'` for null |
| `app/(tabs)/health.tsx` `DefaultHealthView` | All vitals values use `'--'` for null. Running dynamics guarded by `currentDynamics && currentDynamics.runningPower > 0` |
| `app/drilldown/monthly-summary.tsx` `BioAgeCard` | Filters `s.biologicalAge > 0 && s.paceOfAging > 0` and shows "Insufficient data" for less than 2 valid entries |
| `app/drilldown/monthly-summary.tsx` `Vo2MaxCard` | Filters `v.value > 0` and shows "Insufficient data" for less than 2 valid entries |
| `app/drilldown/sleep.tsx` `sleep-drilldown` component | Shows "No sleep data available" when architecture is null |
| `src/components/home/daily-directive-v2.tsx` | Handles `null` synthesis with "Sync HealthKit to generate your daily health snapshot..." message |
| `src/components/home/longevity-sphere.tsx` | Default `biologicalAge = 25` ensures it never renders without a value. Handles all pace ranges with valid palettes |

## Key Architectural Patterns Established

1. **Nullable data sources** → Functions like `fetchRunningDynamicsForDate` now return `Type | null` instead of zero-filled records
2. **Display helpers** → `safeHRV()`, `safeRHR()`, `safeVO2Max()`, etc. return `number | null`, rejecting 0 and implausible values
3. **Null-coalesced rendering** → All UI components should use `value > 0 ? value : '--'` or `safeHelper(value) ?? fallback`
4. **No synthetic sentinel data** → Missing data returns `null`, never fake/synthetic placeholder scores

## Potential Regression Watch

- `index.tsx` `displayPace` is now `number | null` — all consumers (e.g., `LongevitySphere`) receive `?? 1.0` fallback
- `index.tsx` `displayBioAge` is now `number | null` — `LongevitySphere` receives `?? 25` fallback
- `index.tsx` `synthesis` no longer has a fallback — any UI gated on `synthesis &&` will show empty states for dates without real data (correct behavior)
- `weekly-summary.tsx` `weekScores` type changed from `DailyScores[]` to `(DailyScores | null)[]` — all consumers now use `nonNullScores` (filtered array)
