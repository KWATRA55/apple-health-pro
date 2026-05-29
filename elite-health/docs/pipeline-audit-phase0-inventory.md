# Elite Health Pipeline Audit — Phase 0: Comprehensive Inventory

> **Type:** Read-Only Codebase Audit  
> **Scope:** Full pipeline — algorithms, store, selectors, hooks, UI, services, DB, coach, tests  
> **Output:** Single document with 7 sections  
> **Date:** 2026-05-25  

---

## Table of Contents

1. [Metric Inventory](#1-metric-inventory)
2. [Selectors Map](#2-selectors-map)
3. [UI-to-Selector Wiring](#3-ui-to-selector-wiring)
4. [Root Cause Analysis](#4-root-cause-analysis)
5. [Scope Audit](#5-scope-audit)
6. [Dead Code / Duplicate Logic](#6-dead-code--duplicate-logic)
7. [Initial Bug Catalog](#7-initial-bug-catalog)

---

## 1. Metric Inventory

Every computed metric with name, algorithm file, inputs, formula summary, output type, and display formatting.

### 1.1 Recovery Score

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/recovery.ts`](elite-health/src/lib/algorithms/recovery.ts:1) |
| **Function** | `computeRecovery({ vitals[], todayVitals?, sleepRecord? })` |
| **Inputs** | `vitals: VitalsRecord[]` (7-day history), `todayVitals?: VitalsRecord`, `sleepRecord?: SleepRecord` |
| **Formula Summary** | 1. Compute HRV z-score using `zScorePopulation(hrv, mean, sd)` over 7-day vitals → `hrvZ`<br>2. Compute RHR z-score (inverted) using `zScorePopulation(meanRhr - rhr, 0, sd)` → `rhrZ`<br>3. Compute sleep quality factor via sigmoid: `1 / (1 + exp(-5 * (sleepQuality - 0.5)))` → `sleepQualityFactor`<br>4. Recovery = `clamp(50 + hrvZ * 12 + rhrZ * 8 + sleepFactor * 10 + bonus, 1, 100)`<br>5. Minimum 3 vitals records required; graceful degradation with fewer |
| **Output Type** | `RecoveryResult { score: number, hrvZ: number, rhrZ: number, sleepQualityFactor: number, confidence: 'high' \| 'medium' \| 'low', contributingFactors: string[] }` |
| **Display Formatting** | Integer 1-100, displayed as "Recovery Score" with color coding (green ≥67, amber 34-66, red <34). In orb: primaryValue shown as `score.toFixed(0)`. |
| **Scope** | `rolling7d` for vitals history; `selectedDate` for todayVitals/sleepRecord |

### 1.2 Strain Score

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/strain.ts`](elite-health/src/lib/algorithms/strain.ts:1) |
| **Function** | `computeStrain(hrZones[])` |
| **Inputs** | `hrZones: { zone1-5: number }[]` (activity records with heart rate zone minutes) |
| **Formula Summary** | 1. Zone weights: `ZONE_WEIGHTS = [1, 2, 4, 8, 16]`<br>2. Weighted sum: `Σ(zoneMinutes[i] * weight[i])` for each activity<br>3. Strain = `Math.log(1 + weightedSum) * 2.5`<br>4. Monotonically increasing with zone intensity |
| **Output Type** | `number` (0-21+ range, logarithmic) |
| **Display Formatting** | `strain.toFixed(1)`, displayed as "Day Strain". In vitals-rings mapped from resilience pillar score (see Bug #B1). |
| **Scope** | `selectedDate` (single day's activities) |

### 1.3 Sleep Debt

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/sleep-debt.ts`](elite-health/src/lib/algorithms/sleep-debt.ts:1) |
| **Function** | `computeSleepDebt({ todaySleep?, pastWeekSleep[] })` |
| **Inputs** | `todaySleep?: SleepRecord`, `pastWeekSleep: SleepRecord[]` (7-day window) |
| **Formula Summary** | 1. Sleep need baseline: 8 hours (480 min) — adjusted by recent debt<br>2. For each day in past 7 days: `dailyDebt = sleepNeed - actualSleep`<br>3. Accumulate: `totalDebt = Σ(max(0, dailyDebt))`<br>4. Tonight's adjusted need: `adjustedNeed = sleepNeed + totalDebt * 0.5`<br>5. Cap total debt at 12 hours (720 min) |
| **Output Type** | `SleepDebtResult { totalDebtHours: number, adjustedSleepNeedHours: number, dailyDebts: number[], confidence: 'high' \| 'medium' \| 'low' }` |
| **Display Formatting** | `debtHours.toFixed(1)` with "h" suffix. Displayed in SleepMiniCard as pill badge. |
| **Scope** | `rolling7d` |

### 1.4 Sleep Performance (Quality Score)

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/sleep-performance.ts`](elite-health/src/lib/algorithms/sleep-performance.ts:1) |
| **Function** | `computeSleepPerformance(input)` |
| **Inputs** | `{ totalSleepHours, remHours, deepHours, efficiency, sleepDebtHours, consistencyScore }` |
| **Formula Summary** | 1. Duration score: `min(100, (totalSleepHours / 8) * 100)`<br>2. REM score: `min(100, (remPercentage / 0.25) * 100)`<br>3. Deep score: `min(100, (deepPercentage / 0.20) * 100)`<br>4. Efficiency score: `efficiency * 100`<br>5. Debt penalty: `max(0, sleepDebtHours * 5)`<br>6. Quality = `duration*0.25 + rem*0.20 + deep*0.20 + efficiency*0.20 + consistency*0.15 - debtPenalty`<br>7. Clamped to [0, 100] |
| **Output Type** | `number` (0-100) |
| **Display Formatting** | Integer; displayed as "Sleep Quality" with color-coded pill (green ≥80, amber 50-79, red <50) |
| **Scope** | `selectedDate` (single night's sleep) + `rolling7d` (for debt + consistency) |

### 1.5 Biological Age

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/biological-age.ts`](elite-health/src/lib/algorithms/biological-age.ts:1) |
| **Function** | `computeBiologicalAge(chronologicalAge, hrv, rhr, spo2, vo2max?, sleepQuality?)` |
| **Inputs** | `chronologicalAge: number`, `hrv: number`, `rhr: number`, `spo2: number`, `vo2max?: number`, `sleepQuality?: number` |
| **Formula Summary** | 1. Biomarker scoring against population references:<br>   - HRV: scored against REF_25 (25th percentile) and REF_40 (40th) values<br>   - RHR: scored inversely (lower = better)<br>   - SpO2: scored against 100% ceiling<br>   - VO2max: optional, scored against REF_25/REF_40<br>2. `biomarkerScore = Σ(inputScore[i] * WEIGHTS[i]) / Σ(WEIGHTS[i])`<br>3. `paceOfAging = 2 - biomarkerScore` (capped at 2.5×)<br>4. `biologicalAge = chronologicalAge * paceOfAging`<br>5. Clamped to [18, 80] |
| **Output Type** | `{ biologicalAge: number, paceOfAging: number, confidence: 'high' \| 'medium' \| 'low', inputsUsed: string[], inputsMissing: string[], primaryDriver: string }` |
| **Display Formatting** | `bioAge.toFixed(1)` — **shows 43.1 not integer** (see Bug #B2). Pace shown as `(pace-1)*100`% faster/slower. |
| **Scope** | `latest` (most recent valid vitals, not date-scoped) |

### 1.6 Pace of Aging

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/biological-age.ts`](elite-health/src/lib/algorithms/biological-age.ts:1) |
| **Function** | Same as biological age — `paceOfAging` is a byproduct |
| **Formula Summary** | `paceOfAging = clamp(2 - biomarkerScore, 0.5, 2.5)` — 1.0 = normal, >1.0 = faster aging, <1.0 = slower aging |
| **Output Type** | `number` (0.5–2.5) |
| **Display Formatting** | In `useSelectedDateHealthState.ts`: `((pace - 1) * 100).toFixed(0)` → "+15% faster" or "-8% slower" |
| **Scope** | `latest` |

### 1.7 Illness Risk

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/illness-predictor.ts`](elite-health/src/lib/algorithms/illness-predictor.ts:1) |
| **Function** | `computeIllnessRisk(skinTempDelta, hrv, hrvBaseline, breathingDisturbances, rhrToday, rhrBaseline, spo2Today)` |
| **Inputs** | `skinTempDelta: number`, `hrv: number`, `hrvBaseline: number`, `breathingDisturbances: number`, `rhrToday: number`, `rhrBaseline: number`, `spo2Today: number` |
| **Formula Summary** | 1. Temperature signal: `tempRisk = tempDelta > 1.5 ? HIGH : tempDelta > 0.8 ? ELEVATED : 0`<br>2. HRV suppression: `hrvSuppression = (baseline - today) / baseline` → if >15% = risk<br>3. RHR elevation: `rhrElevation = (today - baseline) / baseline` → if >10% = risk<br>4. SpO2 drop: `spo2Risk = spo2Today < 94 ? HIGH : 0`<br>5. Breathing signal: `breathingRisk = disturbances > 15 ? MEDIUM : 0`<br>6. Combined risk level: LOW / ELEVATED / HIGH |
| **Output Type** | `IllnessPrediction { riskLevel: 'LOW' \| 'ELEVATED' \| 'HIGH', riskScore: number, explanation: string, contributingSignals: string[] }` |
| **Display Formatting** | Risk level string + explanation text. Shown in `ImmunityShield` component with green/amber/red styling. |
| **Scope** | `selectedDate` for today's vitals + `rolling7d` for baselines |

### 1.8 Injury Risk

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/injury-predictor.ts`](elite-health/src/lib/algorithms/injury-predictor.ts:1) |
| **Function** | `computeInjuryRisk(recentStrain, acuteChronicRatio, sleepDebtHours, recoveryScore, formDegradation, weeklyStrainTrend, restDaysThisWeek, priorInjuryFlag)` |
| **Inputs** | 8 parameters including recent strain, AC ratio, sleep debt, recovery, form degradation, weekly trend, rest days, prior injury flag |
| **Formula Summary** | Weighted risk factor scoring across 8 dimensions → LOW / MODERATE / HIGH with confidence |
| **Output Type** | `InjuryRisk { riskLevel: 'LOW' \| 'MODERATE' \| 'HIGH', riskScore: number, confidence: 'high' \| 'medium' \| 'low', primaryFactor: string, explanation: string }` |
| **Display Formatting** | Risk level + explanation. Language audit confirmed: uses descriptive not imperative language. |
| **Scope** | `rolling7d` (strain trend, AC ratio, rest days) + `selectedDate` (today's recovery, sleep) |

### 1.9 CNS Stress

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/cns-stress.ts`](elite-health/src/lib/algorithms/cns-stress.ts:1) |
| **Function** | `computeCnsStress(audio, daylight, hrvToday, hrvBaseline, sleepDuration, sleepNeed, mindfulMinutes)` |
| **Inputs** | `audio: number` (environmental noise dB), `daylight: number` (lux minutes), `hrvToday: number`, `hrvBaseline: number`, `sleepDuration: number`, `sleepNeed: number`, `mindfulMinutes: number` |
| **Formula Summary** | 1. Audio stress: dB > 70 → HIGH, > 55 → MEDIUM<br>2. Daylight deficit: lux < 10000 → MEDIUM, < 5000 → HIGH<br>3. HRV suppression vs baseline<br>4. Sleep deficit vs need<br>5. Mindful minutes as protective factor<br>6. Combined → LOW / MEDIUM / HIGH |
| **Output Type** | `CnsStressScore { level: 'LOW' \| 'MEDIUM' \| 'HIGH', score: number, contributingFactors: string[] }` |
| **Display Formatting** | Level string. Shown in `BodySystemsStatusBar` CNS status dot. |
| **Scope** | `selectedDate` (today's audio/daylight/HRV/sleep) + `rolling7d` (HRV baseline, sleep need) |

### 1.10 Running Form Degradation

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/running-form.ts`](elite-health/src/lib/algorithms/running-form.ts:1) |
| **Function** | `computeFormDegradation(recent, baseline[])` |
| **Inputs** | `recent: RunningDynamics`, `baseline: RunningDynamics[]` |
| **Formula Summary** | 1. Ground contact time (GCT) deviation from baseline mean<br>2. Vertical oscillation (VO) deviation<br>3. Cadence deviation<br>4. Combined z-score → degradation level |
| **Output Type** | `FormDegradation { level: 'NONE' \| 'MILD' \| 'MODERATE' \| 'SEVERE', gctDeviation: number, voDeviation: number, cadenceDeviation: number, confidence: number }` |
| **Display Formatting** | Level string + individual metric deviations. Shown in `RunningDynamicsCard`. |
| **Scope** | `selectedDate` (today's run) + `rolling7d` (baseline comparison) |

### 1.11 Heuristic Synthesis — Readiness Pillar

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/heuristic-synthesis.ts`](elite-health/src/lib/algorithms/heuristic-synthesis.ts:1) |
| **Function** | `synthesize(input)` → `computeReadiness(recovery, hrv, rhr, sleepQuality, sleepDebt)` |
| **Inputs** | Recovery score, HRV, RHR, sleep quality, sleep debt |
| **Formula Summary** | Weighted blend of recovery (40%), HRV z-score (20%), RHR z-score (15%), sleep quality (15%), sleep debt inverse (10%). Clamped [0, 100]. |
| **Output Type** | `PillarScore { score: number, status: 'optimal' \| 'good' \| 'fair' \| 'poor' \| 'insufficient', contributingFactors: string[], confidence: 'high' \| 'medium' \| 'low' }` |
| **Display Formatting** | Integer 0-100 in PillarRing / PillarCard. Color: green ≥70, amber 40-69, red <40. |
| **Scope** | `selectedDate` (single day synthesis) |

### 1.12 Heuristic Synthesis — Resilience Pillar

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/heuristic-synthesis.ts`](elite-health/src/lib/algorithms/heuristic-synthesis.ts:1) |
| **Function** | `computeResilience(hrvBaseline, rhrBaseline, spo2, illnessRisk, injuryRisk, cnsStress, skinTempDelta)` |
| **Inputs** | HRV baseline, RHR baseline, SpO2, illness risk, injury risk, CNS stress, skin temp delta |
| **Formula Summary** | Blends defense signals: HRV stability (20%), RHR stability (15%), SpO2 (15%), illness risk inverse (20%), injury risk inverse (15%), CNS inverse (10%), temp stability (5%). Clamped [0, 100]. |
| **Output Type** | `PillarScore` (same shape as Readiness) |
| **Display Formatting** | Integer 0-100. Same color scale as Readiness. |
| **Scope** | `selectedDate` |

### 1.13 Heuristic Synthesis — Longevity Pillar

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/heuristic-synthesis.ts`](elite-health/src/lib/algorithms/heuristic-synthesis.ts:1) |
| **Function** | `computeLongevity(biologicalAge, chronologicalAge, paceOfAging, vo2max, hrv, spo2, sleepConsistency)` |
| **Inputs** | Biological age result, chronological age, VO2max, HRV, SpO2, sleep consistency |
| **Formula Summary** | Blends biological age signal: pace inversion (35%), VO2max percentile (20%), HRV percentile (15%), SpO2 (10%), sleep consistency (10%), age gap (10%). Clamped [0, 100]. |
| **Output Type** | `PillarScore` (same shape as Readiness) |
| **Display Formatting** | Integer 0-100. Same color scale. |
| **Scope** | `selectedDate` + `latest` (biological age is always latest-based) |

### 1.14 Trend Metrics (per metric)

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/trend-engine.ts`](elite-health/src/lib/algorithms/trend-engine.ts:1) |
| **Function** | `computeTrendMetric(values[], window)` → `computeTrendReport(metrics[])` → `generateTrendAlerts(report)` |
| **Inputs** | `values: number[]` (time series), `window: '7d' \| '14d' \| '30d'` |
| **Formula Summary** | 1. Linear regression slope over window<br>2. Pattern detection (9 patterns): `rising`, `falling`, `stable`, `spike`, `dip`, `volatile`, `recovering`, `declining`, `cycling`<br>3. Percent change from window start to end<br>4. Alert generation for significant trends |
| **Output Type** | `TrendMetric { slope, percentChange, pattern, confidence }` → `TrendReport { metrics: Record<string, TrendMetric>, alerts: TrendAlert[] }` |
| **Display Formatting** | Pattern label + arrow indicator. Shown in `TrendSpark` component. |
| **Scope** | `rolling7d`, `rolling14d`, `rolling30d` |

### 1.15 Streaks

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/streaks.ts`](elite-health/src/lib/algorithms/streaks.ts:1) |
| **Function** | `computeStreaks(dailyScores[], activities[])` |
| **Inputs** | `dailyScores: DailyScores[]`, `activities: ActivityRecord[]` |
| **Formula Summary** | 1. Workout streak: consecutive days with activity<br>2. Recovery streak: consecutive days recovery ≥ 67<br>3. Sleep streak: consecutive days sleep duration ≥ 7h<br>4. Strain streak: consecutive days strain ≥ 4.0<br>5. Perfect week: all 7 days meet thresholds |
| **Output Type** | `StreakResult { current: Record<string, number>, longest: Record<string, number>, perfectWeeks: number }` |
| **Display Formatting** | Integer counts in `StreakTracker` component with emoji labels. |
| **Scope** | `allTime` (full history scan) |

### 1.16 Weekly Plan

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/weekly-planner.ts`](elite-health/src/lib/algorithms/weekly-planner.ts:1) |
| **Function** | `generateWeeklyPlan(input)` → `generateWeeklyPlanSelector(state)` |
| **Inputs** | Current readiness, resilience, longevity, recent strain, sleep debt, injury risk, CNS stress |
| **Formula Summary** | Rule-based periodization: assigns daily focus (REST / LIGHT / MODERATE / HARD / INTENSE) based on pillar scores and recovery state. Generates workout suggestions. |
| **Output Type** | `WeeklyPlan { days: DayPlan[], focusArea: string, warnings: string[] }` |
| **Display Formatting** | Day-by-day plan cards with intensity labels and workout suggestions. |
| **Scope** | `selectedDate` for current state + `rolling7d` for recent load |

### 1.17 Habit Impact / Correlation

| Field | Detail |
|-------|--------|
| **Algorithm File** | [`elite-health/src/lib/algorithms/habit-impact.ts`](elite-health/src/lib/algorithms/habit-impact.ts:1) [`elite-health/src/lib/algorithms/pearson-correlation.ts`](elite-health/src/lib/algorithms/pearson-correlation.ts:1) |
| **Function** | `computeHabitImpact(habitDays[], recoveryScores[])` → `computeCorrelationInsights(data)` |
| **Inputs** | `habitDays: { habit, value, date }[]`, `recoveryScores: number[]` |
| **Formula Summary** | 1. `pearsonCorrelation(x[], y[])` → `{ r, rSquared, pValue, n, significance }`<br>2. `computeHabitImpactPercent(r, rSquared, meanWith, meanWithout)` → impact %<br>3. Builds paired days from habits + recovery scores |
| **Output Type** | `CorrelationResult { r, rSquared, pValue, n, significance }` → `HabitImpact { habit, correlation, impactPercent, direction, confidence }` |
| **Display Formatting** | Correlation coefficient + impact percentage. |
| **Scope** | `rolling30d` (minimum 7 paired data points) |

### 1.18 Sleep Architecture

| Field | Detail |
|-------|--------|
| **Algorithm File** | Computed in [`elite-health/src/lib/store.ts`](elite-health/src/lib/store.ts:1) `computeSleepArchitecture` |
| **Function** | `computeSleepArchitecture(sleep)` |
| **Inputs** | `sleep: SleepRecord` |
| **Formula Summary** | Extracts REM/deep/core/awake stages from sleep samples, computes percentages and durations. |
| **Output Type** | `SleepArchitecture { stages: { rem, deep, core, awake }, efficiency, totalDuration }` |
| **Display Formatting** | Stage bar visualization + percentage labels in `SleepDrilldown`. |
| **Scope** | `selectedDate` (single night) |

---

## 2. Selectors Map

Every exported canonical selector, what it returns, store state reads, algorithm calls.

### 2.1 Canonical Selector Pattern

All canonical selectors live in [`elite-health/src/lib/canonical-selectors.ts`](elite-health/src/lib/canonical-selectors.ts:1) and follow the `HealthMetricViewModel<T>` pattern:

```typescript
interface HealthMetricViewModel<T> {
  value: T | null;
  canonicalStatus: 'ready' | 'missing' | 'insufficient' | 'stale' | 'error';
  provenance: {
    source: 'healthkit' | 'derived' | 'synthetic' | 'fallback';
    lastUpdated: string | null;
    confidence: 'high' | 'medium' | 'low' | null;
    dataPoints: number;
    windowDays: number;
  };
  displayValue: string | null;
  trend?: TrendMetric;
}
```

Helper: `deriveProvenance(records, dateStr, category)` determines confidence and canonicalStatus from record availability and recency.

### 2.2 Vitals Selectors

| Selector | Returns | Store Reads | Algorithm Calls |
|----------|---------|-------------|-----------------|
| `selectVitalsForDate(dateStr)` | `HealthMetricViewModel<VitalsRecord>` | `state.vitals[]` filtered by date | None (raw data) |
| `selectLatestVitals()` | `HealthMetricViewModel<VitalsRecord>` | `state.vitals[]` sorted by date desc, first valid | None |
| `selectRolling7dVitals(dateStr)` | `HealthMetricViewModel<VitalsRecord[]>` | `state.vitals[]` windowed 7 days | None |
| `selectRolling30dVitals(dateStr)` | `HealthMetricViewModel<VitalsRecord[]>` | `state.vitals[]` windowed 30 days | None |
| `selectAllTimeVitalsRange()` | `{ firstDate, lastDate, totalDays }` | `state.vitals[]` min/max dates | None |

### 2.3 Scores Selectors

| Selector | Returns | Store Reads | Algorithm Calls |
|----------|---------|-------------|-----------------|
| `selectScoresForDate(dateStr)` | `HealthMetricViewModel<DailyScores>` | `state.scores[]` filtered | None (pre-computed in store) |
| `selectLatestScores()` | `HealthMetricViewModel<DailyScores>` | `state.scores[]` latest | None |
| `selectRolling7dScores(dateStr)` | `HealthMetricViewModel<DailyScores[]>` | `state.scores[]` windowed | None |
| `selectRolling30dScores(dateStr)` | `HealthMetricViewModel<DailyScores[]>` | `state.scores[]` windowed | None |

### 2.4 Sleep Selectors

| Selector | Returns | Store Reads | Algorithm Calls |
|----------|---------|-------------|-----------------|
| `selectSleepForDate(dateStr)` | `HealthMetricViewModel<SleepRecord>` | `state.sleep[]` filtered | None |
| `selectLatestSleep()` | `HealthMetricViewModel<SleepRecord>` | `state.sleep[]` latest | None |
| `selectRolling7dSleep(dateStr)` | `HealthMetricViewModel<SleepRecord[]>` | `state.sleep[]` windowed | None |

### 2.5 Activity Selectors

| Selector | Returns | Store Reads | Algorithm Calls |
|----------|---------|-------------|-----------------|
| `selectActivitiesForDate(dateStr)` | `HealthMetricViewModel<ActivityRecord[]>` | `state.activities[]` filtered | None |
| `selectLatestActivities()` | `HealthMetricViewModel<ActivityRecord[]>` | `state.activities[]` latest | None |
| `selectRolling7dActivities(dateStr)` | `HealthMetricViewModel<ActivityRecord[]>` | `state.activities[]` windowed | None |

### 2.6 Mobility / Environmental / CardioMetabolic Selectors

Same pattern as above: `selectMobilityForDate`, `selectLatestMobility`, `selectRolling7dMobility`, `selectRolling30dMobility` — for all categories. Each returns `HealthMetricViewModel<T>` with the appropriate record type.

### 2.7 Running Dynamics Selectors

| Selector | Returns | Store Reads |
|----------|---------|-------------|
| `selectRunningDynamicsForDate(dateStr)` | `HealthMetricViewModel<RunningDynamics>` | `state.runningDynamics[]` filtered |
| `selectLatestRunningDynamics()` | `HealthMetricViewModel<RunningDynamics>` | `state.runningDynamics[]` latest |

### 2.8 Weight Selectors

| Selector | Returns | Store Reads |
|----------|---------|-------------|
| `selectWeightForDate(dateStr)` | `HealthMetricViewModel<WeightRecord>` | `state.weight[]` filtered |
| `selectLatestWeight()` | `HealthMetricViewModel<WeightRecord>` | `state.weight[]` latest |
| `selectRolling30dWeight(dateStr)` | `HealthMetricViewModel<WeightRecord[]>` | `state.weight[]` windowed |

### 2.9 Synthesis Selector

The synthesis is NOT exposed via a canonical selector. It is computed in:

- [`elite-health/src/hooks/useSelectedDateHealthState.ts`](elite-health/src/hooks/useSelectedDateHealthState.ts:77) — calls store's `computeSynthesis` internally
- Accessed via `state.synthesis` in store, but wrapped in the hook's return type

### 2.10 Weekly Planner Selector

| Selector | Returns | Store Reads | Algorithm Calls |
|----------|---------|-------------|-----------------|
| `generateWeeklyPlanSelector(state)` | `WeeklyPlan` | Full state access | `generateWeeklyPlan()` |

This is NOT a canonical selector — it's a standalone selector function in [`elite-health/src/lib/algorithms/weekly-planner.ts`](elite-health/src/lib/algorithms/weekly-planner.ts:1).

---

## 3. UI-to-Selector Wiring

Per UI component: metrics displayed, selectors/hooks called, scope.

### 3.1 Home Screen (`app/(tabs)/index.tsx`)

Uses [`useSelectedDateHealthState()`](elite-health/src/hooks/useSelectedDateHealthState.ts:77) as primary data hook.

| Component | Metrics Displayed | Data Source | Scope |
|-----------|------------------|-------------|-------|
| `PillarCard` (×3) | Readiness, Resilience, Longevity scores | `selectedDateState.synthesis.readiness/resilience/longevity` via props | `selectedDate` |
| `SleepMiniCard` | Sleep duration, REM, deep, efficiency, sleep debt | `selectedDateState.sleep` + `selectedDateState.sleepDebtHours` via props | `selectedDate` + `rolling7d` |
| `HrvTrendSpark` | 7-day HRV sparkline + z-score badge | `selectedDateState.vitals[]` + `selectedDateState.scores[]` via props | `rolling7d` |
| `PerformanceRingRow` (vitals-rings) | 3 Rings: Recovery → Strain → Sleep labels | `selectedDateState.synthesis` via props, but maps resilience→"Strain", longevity→"Sleep" **(Bug #B1)** | `selectedDate` |
| `BodySystemsStatusBar` | HEART/LUNGS/CNS/TEMP status dots | `selectedDateState.vitals` + `selectedDateState.cnsStress` via props | `selectedDate` |
| `ImmunityShield` | Illness risk level + explanation | `selectedDateState.illnessRisk` via props | `selectedDate` + `rolling7d` |
| `StreakTracker` | Workout/recovery/sleep/strain streak counts | `selectedDateState.scores[]` + `selectedDateState.activities[]` via props | `allTime` |
| `ActivityTimeline` (vitals-rings) | Today's workout list | `selectedDateState.activities[]` via props | `selectedDate` |

### 3.2 Health Screen (`app/(tabs)/health.tsx`)

| Component | Metrics Displayed | Data Source | Scope |
|-----------|------------------|-------------|-------|
| `BiologicalAge` | Biological age, chronological age, pace of aging | `selectScoresForDate(date)` via canonical selector | `latest` (bio age) + `selectedDate` (scores) |
| `VitalsGrid` | HRV, RHR, SpO2, respiratory rate, skin temp delta | `selectedDateState.vitals` via props | `selectedDate` |
| `HealthMonitorStrip` | Monitor count / total | Props | `selectedDate` |
| `PremiumOrb` | Hero metric visualization | `primaryValue`/`primaryLabel`/`secondaryLabel` via props (pure visual) | N/A (visual only) |

### 3.3 Coach Screen (`app/(tabs)/coach.tsx`)

| Component | Data Source | Scope |
|-----------|-------------|-------|
| `ChatWindow` | `buildBiometricsContext()` from `coach.tsx` | Mixed: `selectedDate` + `rolling7d` + `latest` |
| AI Payload | Gemini `sendCoachMessage()` with biometrics context | Multi-scope payload |

The `buildBiometricsContext` function in the coach screen fabricates a payload from multiple store slices — this is a known area where scopes can silently mix (see rearchitecture plan P7).

### 3.4 Profile Screen (`app/(tabs)/profile.tsx`)

| Component | Metrics Displayed | Data Source | Scope |
|-----------|------------------|-------------|-------|
| `PersonalRecords` | Max strain, best sleep, deep sleep, lowest recovery | `state.activities[]` / `state.sleep[]` / `state.scores[]` via props | `allTime` |
| `ActivitySummary` | Activity type breakdown + counts + avg strain | `state.activities[]` via props | `allTime` |
| `StrainRecoveryChart` | 7-day dual bar chart strain + recovery | `state.scores[]` via props | `rolling7d` |
| `ExportTools` | CSV/PDF/Summary export | Raw `useHealthStore()` arrays — **bypasses canonical selectors** | `allTime` |

### 3.5 Sleep Drilldown (`app/drilldown/sleep.tsx`)

| Component | Metrics Displayed | Data Source | Scope |
|-----------|------------------|-------------|-------|
| `SleepDrilldown` | Stage bar, efficiency, duration, REM, 7-night history | `sleep` + `architecture` via props | `selectedDate` + `rolling7d` |

### 3.6 Weekly/Monthly Summary Drilldowns

| Component | Data Source | Scope |
|-----------|-------------|-------|
| Weekly Summary | `selectRolling7d*` selectors | `rolling7d` |
| Monthly Summary | `selectRolling30d*` selectors | `rolling30d` |

### 3.7 Key Wiring Observations

1. **`useSelectedDateHealthState` is the primary bridge** — it derives ALL date-scoped biometric state and is used by Home, Health, and Coach screens
2. **Profile screen uses raw store access** — `ExportTools` directly reads `useHealthStore()` arrays, bypassing canonical selectors. Has a `[CANONICAL-TODO]` comment acknowledging this.
3. **`PerformanceRingRow` label mismatch** — Maps synthesis resilience score to "Strain" label and longevity score to "Sleep" label, which is semantically wrong
4. **Biological Age uses canonical selectors** — `BiologicalAge` component properly uses `selectScoresForDate` for honest data display
5. **PremiumOrb is pure visual** — No health data access, receives pre-computed display values via props

---

## 4. Root Cause Analysis

For each known issue, the root cause with file:line references.

### 4.1 Bug: Biological Age Shows 43.1 Instead of Integer

**Root Cause:** [`elite-health/src/components/health/biological-age.tsx:68`](elite-health/src/components/health/biological-age.tsx:68)

```typescript
{bioAge.toFixed(1)}
```

The `.toFixed(1)` forces one decimal place. Biological age should be displayed as an integer (years), not with a decimal. The algorithm itself outputs a float, but the display contract should round to integer.

**Fix:** Change to `Math.round(bioAge).toString()` or `bioAge.toFixed(0)`.

### 4.2 Bug: Longevity May Show Biological Age Instead of Score

**Root Cause:** In [`elite-health/src/components/home/vitals-rings.tsx:52`](elite-health/src/components/home/vitals-rings.tsx:52), the `PerformanceRingRow` maps:

```typescript
// resilience score → displayed as "Strain" (already wrong, Bug #B1)
// longevity score → displayed as "Sleep" (double-wrong)
```

The longevity pillar score (0-100) should be displayed as "Longevity" with an appropriate score. The mapping of the longevity pillar to a "Sleep" label means the user sees a sleep-related label attached to a longevity computation. This is a label swap bug.

Additionally, in `useSelectedDateHealthState.ts`, the `displayBioAge` computation returns the biological age number (a float like 43.1), NOT the longevity pillar score. If any component uses `displayBioAge` thinking it's the longevity score, it would get the raw biological age instead.

### 4.3 Bug: Readiness/Resilience/Longevity Formatting Inconsistencies

**Root Cause:** The three pillar scores all output integers 0-100 from `synthesize()`, but are displayed differently across components:

- `PillarCard`: Shows the score integer in a PillarRing SVG
- `PerformanceRingRow`: Shows scores via `Ring` component, but with wrong labels
- Orb views: Pass through `primaryValue` prop, which may show a different number depending on what the parent passes

The inconsistency arises because there is no canonical "PillarScore → display string" formatter. Each component formats independently.

### 4.4 Bug: Sleep Debt Dual-Source Issue

**Root Cause:** Sleep debt is computed in TWO places:

1. [`elite-health/src/lib/store.ts`](elite-health/src/lib/store.ts:1) — `computeScores()` calls `computeSleepDebt()` and stores result in `state.sleepDebt`
2. [`elite-health/src/lib/algorithms/sleep-debt.ts`](elite-health/src/lib/algorithms/sleep-debt.ts:1) — pure algorithm function

The `SleepMiniCard` receives `sleepDebtHours` as a prop, which comes from `useSelectedDateHealthState` → which reads from the store's computed value. However, `sleepDebtHours` is intentionally NOT stored in `SleepRecord` — debt is a derived value that spans 7 days.

The dual-source risk: if any component calls `computeSleepDebt()` directly instead of reading from the store, it could get a different result if the inputs differ (e.g., different window of past week sleep).

### 4.5 Bug: Strain Gating / Trend Mismatches

**Root Cause:** Strain is computed per-day from activities, but trend analysis requires multiple days. If the user has only 2 days of activity data, a 7-day trend is meaningless. The `computeTrendMetric()` function doesn't gate on minimum data points before the calling code — it relies on the caller to check.

In `HrvTrendSpark`, the HRV trend is computed from `vitals[]` which is passed via props. If the parent sends only 2 vitals records, the sparkline will show just 2 data points without warning.

### 4.6 Bug: Scope Mismatch — Biological Age Uses `latest` Not `selectedDate`

**Root Cause:** In [`elite-health/src/lib/store.ts`](elite-health/src/lib/store.ts:1), `computeScores()` fetches biological age using the latest available vitals, not the selected date's vitals:

```typescript
// computeBiologicalAge is called with latest vitals, not date-scoped vitals
const bioAge = computeBiologicalAge(
  chronologicalAge,
  latestHrv,  // from state.vitals sorted desc
  latestRhr,
  latestSpo2,
  vo2max,
  sleepQuality
);
```

This means when a user navigates to a historical date, the biological age displayed is always their most recent biological age, not the biological age for that historical date. This creates a silent scope mismatch on the Health screen.

### 4.7 Bug: ExportTools Bypasses Canonical Selectors

**Root Cause:** [`elite-health/src/components/profile/export-tools.tsx:97`](elite-health/src/components/profile/export-tools.tsx:97) reads raw state arrays:

```typescript
const vitals = useHealthStore(s => s.vitals);
const sleep = useHealthStore(s => s.sleep);
const scores = useHealthStore(s => s.scores);
const activities = useHealthStore(s => s.activities);
```

This bypasses all canonical selectors and provenance tracking. Exported data may include stale, low-confidence, or synthetic records without any indication. The file acknowledges this with a `[CANONICAL-TODO]` comment.

---

## 5. Scope Audit

Map every data flow path: UI Component → Hook/Selector → Store Field → DB Query → Algorithm.

### 5.1 Scope Definitions

| Scope | Definition | Typical Window |
|-------|-----------|----------------|
| `selectedDate` | Single date's data (user's selected date) | 1 day |
| `latest` | Most recent available data regardless of date | 1 record |
| `rolling7d` | 7-day window ending at selected date | 7 days |
| `rolling14d` | 14-day window for trend detection | 14 days |
| `rolling30d` | 30-day window for deep trends | 30 days |
| `allTime` | Full history | Unlimited |

### 5.2 Flow Paths

#### Path 1: Home Screen → Recovery Score

```
Home Screen (index.tsx)
  → useSelectedDateHealthState()
    → useHealthStore(s => s.scores) filtered by selectedDate
    → DB: SELECT * FROM daily_scores WHERE date = ?
      → Store.computeScores()
        → computeRecovery(vitals[7d], todayVitals, sleepRecord)
          → computeRecovery() algorithm
```

**Scope Chain:** `selectedDate` for display, `rolling7d` for computation.

#### Path 2: Home Screen → Pillar Scores (Readiness/Resilience/Longevity)

```
Home Screen (index.tsx)
  → useSelectedDateHealthState()
    → useHealthStore(s => s.synthesis)
    → DB: SELECT * FROM derived_outputs WHERE output_type = 'synthesis' AND date_key = ?
      → Store.computeSynthesis()
        → synthesize({ recovery, strain, biologicalAge, ... })
          → computeReadiness() / computeResilience() / computeLongevity()
```

**Scope Chain:** `selectedDate` for synthesis, but `biologicalAge` input is `latest`-scoped → **MIXED SCOPE**.

#### Path 3: Health Screen → Biological Age

```
Health Screen (health.tsx)
  → BiologicalAge component
    → selectScoresForDate(date) canonical selector
    → useHealthStore(s => s.scores) filtered
    → DB: daily_scores WHERE date = ?
```

But the biological age value inside `scores.biologicalAge` was computed from `latest` vitals → **SCOPE MISMATCH**.

#### Path 4: Health Screen → Vitals

```
Health Screen (health.tsx)
  → VitalsGrid component
    → Props from useSelectedDateHealthState().vitals
    → DB: SELECT * FROM vitals WHERE date = ?
```

**Scope Chain:** `selectedDate` — clean.

#### Path 5: Profile Screen → Records

```
Profile Screen (profile.tsx)
  → PersonalRecords / ActivitySummary / StrainRecoveryChart
    → Props pass raw state arrays
    → DB: SELECT * FROM activities/sleep/scores (full table scan)
```

**Scope Chain:** `allTime` — correct for records, but no provenance.

#### Path 6: Coach Screen → AI Payload

```
Coach Screen (coach.tsx)
  → buildBiometricsContext()
    → useHealthStore multiple slices
    → Mixes: selectedDate vitals + rolling7d trends + latest bio age
```

**Scope Chain:** MIXED — intentional for coaching context, but individual metric scopes are not labeled.

#### Path 7: Sleep Drilldown → Sleep Architecture

```
Sleep Drilldown (sleep.tsx)
  → SleepDrilldown component
    → Props: sleep record + architecture object
    → computeSleepArchitecture(sleep) in store
    → DB: SELECT * FROM sleep_records WHERE date = ?
```

**Scope Chain:** `selectedDate` — clean.

#### Path 8: Home → Sleep Debt Display

```
Home Screen (index.tsx)
  → SleepMiniCard receives sleepDebtHours prop
    → useSelectedDateHealthState().sleepDebtHours
    → Store.computeScores() → computeSleepDebt(todaySleep, pastWeekSleep[])
    → DB: SELECT * FROM sleep_records WHERE date BETWEEN ? AND ?
```

**Scope Chain:** `rolling7d` — correct for debt computation.

### 5.3 Scope Mismatch Summary

| Path | Expected Scope | Actual Scope | Severity |
|------|---------------|--------------|----------|
| Bio Age on Health Screen | `selectedDate` | `latest` | HIGH |
| Pillar Scores (Longevity) | `selectedDate` | Mixed (latest bio age) | MEDIUM |
| ExportTools | Any | `allTime` raw (no provenance) | MEDIUM |
| Coach AI Payload | Explicit per-metric | Mixed, unlabeled | MEDIUM |
| HRV Trend on Home | `rolling7d` | Depends on passed props | LOW |

---

## 6. Dead Code / Duplicate Logic

### 6.1 Duplicate Calculations

| Duplicate | Location 1 | Location 2 | Risk |
|-----------|-----------|-----------|------|
| HRV z-score computation | [`recovery.ts`](elite-health/src/lib/algorithms/recovery.ts:1) (inside `computeRecovery`) | [`trend-engine.ts`](elite-health/src/lib/algorithms/trend-engine.ts:1) (implicitly via trend slope) | LOW — different purposes |
| Sleep debt | [`sleep-debt.ts`](elite-health/src/lib/algorithms/sleep-debt.ts:1) (pure algorithm) | [`store.ts`](elite-health/src/lib/store.ts:1) (cached computation) | MEDIUM — dual-source if not careful |
| Score clamping (0-100) | [`heuristic-synthesis.ts`](elite-health/src/lib/algorithms/heuristic-synthesis.ts:1) | [`display-helpers.ts`](elite-health/src/lib/utils/display-helpers.ts:1) | LOW — algorithm vs display layer |
| SpO2 normalization | [`metric-normalization.ts`](elite-health/src/lib/utils/metric-normalization.ts:1) | [`healthkit.ts`](elite-health/src/lib/healthkit.ts:1) (fetch-time) | LOW — normalize at both fetch and display |

### 6.2 Dead Code Paths

| Location | Description | Status |
|----------|-------------|--------|
| `getOrCompute()` in [`cache.ts`](elite-health/src/lib/utils/cache.ts:111) | Generic memoization wrapper | Partially used — fingerprint-based memoization in store.ts supersedes it |
| `generateFallbackCoachResponse()` intent handlers | 7 intent handlers in [`fallback-coach.ts`](elite-health/src/lib/gemini/fallback-coach.ts:96) | Only used when Gemini API is unavailable — rarely triggered in practice |
| `hkSampleToRaw()` in [`healthkit.ts`](elite-health/src/lib/healthkit.ts:176) | HealthKit → raw sample conversion | Used by all fetch functions, but the `provenance_log` insertion path may not be complete |
| `ALGORITHM_REGISTRY` in [`registry.ts`](elite-health/src/lib/algorithms/registry.ts:1) | Maps all 15 algorithms | Referenced but not actively used for dispatch — algorithms are called directly |

### 6.3 Legacy Fallbacks Still Active

| Fallback | Location | Risk |
|----------|----------|------|
| `normalizeSpO2` decimal→percent | [`metric-normalization.ts`](elite-health/src/lib/utils/metric-normalization.ts:1) | Apple Watch now returns percent; normalization may double-convert |
| `safeHRV` / `safeRHR` / `safeSpO2` guards | [`display-helpers.ts`](elite-health/src/lib/utils/display-helpers.ts:1) | Guards are applied at display layer; raw values can still propagate via props |
| `hasRenderableLongevity` guard | [`longevity-guards.ts`](elite-health/src/lib/utils/longevity-guards.ts:1) | Checks `hasValidBioAge` AND `hasValidPace`; if one fails, entire longevity is hidden |
| Recency fallback windows | [`recency.ts`](elite-health/src/lib/utils/recency.ts:1) | Per-category fallback windows can silently expand scope |

### 6.4 Unused/Dormant Features

| Feature | Location | Status |
|---------|----------|--------|
| RAG pipeline (embeddings, chunker, vector-store) | [`elite-health/src/lib/rag/`](elite-health/src/lib/rag/) | Code exists but not wired into coach (Phase 6 in bugfix plan) |
| `data-inspector.ts` | [`elite-health/src/lib/services/data-inspector.ts`](elite-health/src/lib/services/data-inspector.ts:1) | Read-only forensic tools; not called from any UI |
| `background-sync.ts` | [`elite-health/src/lib/services/background-sync.ts`](elite-health/src/lib/services/background-sync.ts:1) | Registered but effectiveness depends on OS constraints |
| `synthetic-generator.ts` | [`elite-health/src/lib/utils/synthetic-generator.ts`](elite-health/src/lib/utils/synthetic-generator.ts:1) | Only used in tests; not used in production |

---

## 7. Initial Bug Catalog

Every bug found with file:line references, severity, and root cause.

### B1: PerformanceRingRow Label Swap

| Field | Detail |
|-------|--------|
| **Severity** | HIGH (TRUST-BREAKING) |
| **File:Line** | [`elite-health/src/components/home/vitals-rings.tsx:47-69`](elite-health/src/components/home/vitals-rings.tsx:47) |
| **Description** | The second ring shows resilience score but is labeled "Strain". The third ring shows longevity score but is labeled "Sleep". |
| **Root Cause** | Hardcoded label strings don't match the pillar key being used. Line 52: `label="Strain"` for resilience, line 63: `label="Sleep"` for longevity. |
| **Impact** | Users see mislabeled health metrics. A resilience score of 85 labeled as "Strain" is misleading. |
| **Fix** | Change labels to match pillars: "Recovery" / "Resilience" / "Longevity" or use dynamic labels from pillar metadata. |

### B2: Biological Age Shows Decimal (43.1)

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File:Line** | [`elite-health/src/components/health/biological-age.tsx:68`](elite-health/src/components/health/biological-age.tsx:68) |
| **Description** | `bioAge.toFixed(1)` displays biological age with one decimal place. Should be an integer (years). |
| **Root Cause** | Algorithm outputs float; display uses `.toFixed(1)` instead of `Math.round()`. |
| **Impact** | "43.1 years" is nonsensical for biological age. |
| **Fix** | Change to `Math.round(bioAge).toString()` or `.toFixed(0)`. |

### B3: Biological Age Scope Mismatch

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **File:Line** | [`elite-health/src/lib/store.ts`](elite-health/src/lib/store.ts:1) (computeScores function) |
| **Description** | Biological age is always computed from latest vitals, not date-scoped vitals. When viewing historical dates on Health screen, bio age doesn't change. |
| **Root Cause** | `computeScores()` fetches `latestHrv`, `latestRhr`, `latestSpo2` from store (most recent), ignoring the date context. |
| **Impact** | Historical view is inaccurate — shows today's bio age for all dates. |
| **Fix** | Pass date-scoped vitals to `computeBiologicalAge()` instead of latest. Fall back to latest only when date-scoped vitals are missing. |

### B4: ExportTools Bypasses Provenance

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File:Line** | [`elite-health/src/components/profile/export-tools.tsx:97-100`](elite-health/src/components/profile/export-tools.tsx:97) |
| **Description** | Export reads raw `useHealthStore()` arrays, bypassing canonical selectors and provenance tracking. |
| **Root Cause** | Direct store access without canonical selector layer. Acknowledged via `[CANONICAL-TODO]` comment. |
| **Impact** | Exported CSV/PDF may include stale, synthetic, or low-confidence data without provenance labels. |
| **Fix** | Migrate to canonical selectors with provenance metadata in export headers. |

### B5: Sleep Debt Dual Computation Path

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File:Line** | [`elite-health/src/lib/store.ts`](elite-health/src/lib/store.ts:1) + [`elite-health/src/lib/algorithms/sleep-debt.ts`](elite-health/src/lib/algorithms/sleep-debt.ts:1) |
| **Description** | Sleep debt can be computed via store's cached `computeScores()` or directly via the pure `computeSleepDebt()` function with potentially different inputs. |
| **Root Cause** | No single source of truth for sleep debt computation. Store caches it; algorithm function is independently callable. |
| **Impact** | If any component calls algorithm directly with different past-week sleep data, debt values diverge. |
| **Fix** | All sleep debt reads should go through store or canonical selector. Deprecate direct algorithm calls from UI. |

### B6: Strain Display Not Reflecting Actual Strain

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File:Line** | [`elite-health/src/components/home/vitals-rings.tsx:47-52`](elite-health/src/components/home/vitals-rings.tsx:47) |
| **Description** | The ring labeled "Strain" actually shows the resilience pillar score, not the computed strain value. Actual strain from `computeStrain()` is NOT displayed in the 3-ring row. |
| **Root Cause** | `PerformanceRingRow` receives `synthesis` prop and maps `resilience.score` to the ring labeled "Strain". The actual strain score is computed separately via `computeStrain(activities)` and is not surfaced in this row. |
| **Impact** | Users see a resilience score mislabeled as strain. The real strain score is hidden. |
| **Fix** | Either (a) fix labels to show actual pillar names, or (b) replace resilience ring with actual strain computation. |

### B7: Longevity Pillar Score vs Biological Age Confusion

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File:Line** | [`elite-health/src/components/home/vitals-rings.tsx:60-69`](elite-health/src/components/home/vitals-rings.tsx:60) |
| **Description** | The third ring shows `longevity.score` (0-100) but is labeled "Sleep". The biological age (e.g., 43) is shown separately in the Health tab. Users may confuse the longevity pillar score with biological age. |
| **Root Cause** | Two different metrics (longevity pillar score 0-100 and biological age in years) with similar conceptual meaning but different scales and labels. |
| **Impact** | Cognitive dissonance: "Sleep" ring shows 72, but user's bio age is 43. Which is longevity? |
| **Fix** | Label the ring "Longevity" and show the pillar score. Reserve biological age display for the Health tab's BiologicalAge component. |

### B8: Missing Data States Not Consistently Handled

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File:Line** | Multiple components |
| **Description** | Different components handle missing/null/insufficient data differently:<br>- `BiologicalAge`: Shows "Insufficient data" when `canonicalStatus` is missing<br>- `PillarCard`: Shows dimmed ring with "—" when score is null<br>- `SleepMiniCard`: Shows 0 values without "no data" indicator<br>- `ImmunityShield`: Only renders when risk exists (conditional render) |
| **Root Cause** | No shared empty-state component or pattern. Each component implements its own empty state logic. |
| **Impact** | Inconsistent UX when HealthKit data is unavailable. Some areas show "—", others show "0", others disappear. |
| **Fix** | Create a shared `<EmptyMetricState>` component and apply consistently. |

### B9: Trend Engine Minimum Data Point Gate Missing

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **File:Line** | [`elite-health/src/lib/algorithms/trend-engine.ts`](elite-health/src/lib/algorithms/trend-engine.ts:1) |
| **Description** | `computeTrendMetric()` does not internally gate on minimum data points. Linear regression on 2 points is mathematically valid but not meaningful. |
| **Root Cause** | The function trusts callers to pass sufficient data. No internal `if (values.length < 3) return null` guard. |
| **Impact** | Trend shown with 1-2 data points may show misleading slope/pattern. |
| **Fix** | Add minimum data point gate inside `computeTrendMetric()`. |

### B10: Recency Fallback Can Silently Expand Scope

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **File:Line** | [`elite-health/src/lib/utils/recency.ts`](elite-health/src/lib/utils/recency.ts:1) |
| **Description** | `getDisplayMetric()` and `getLatestValidMetric()` use per-category fallback windows. If HRV data is 2 days old but the fallback window is 3 days, the stale value is displayed without provenance downgrade. |
| **Root Cause** | Recency fallback doesn't downgrade `canonicalStatus` or `confidence` when falling back to older data. |
| **Impact** | User sees data that appears fresh but is actually stale, with no visual indicator. |
| **Fix** | Downgrade `canonicalStatus` to `'stale'` and reduce `confidence` when recency fallback is used. |

### B11: SpO2 Normalization Double-Conversion Risk

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **File:Line** | [`elite-health/src/lib/utils/metric-normalization.ts`](elite-health/src/lib/utils/metric-normalization.ts:1) [`elite-health/src/lib/healthkit.ts`](elite-health/src/lib/healthkit.ts:1) |
| **Description** | `normalizeSpO2()` converts decimal fractions (0.95-1.0) to percent (95-100). If Apple Watch already provides percent values, this normalizes 98 → 9800. |
| **Root Cause** | HealthKit SpO2 format changed over time; normalization assumes decimal fraction format. |
| **Impact** | If SpO2 comes as percent, displayed value could be 9800% instead of 98%. |
| **Fix** | Add range detection: if value > 1.0, assume already in percent and skip normalization. |

### B12: Coach Fallback Uses Hardcoded Defaults

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **File:Line** | [`elite-health/src/lib/gemini/fallback-coach.ts:136-139`](elite-health/src/lib/gemini/fallback-coach.ts:136) |
| **Description** | `fallbackNum()` returns hardcoded defaults when biometric values are missing. Example: recovery defaults to 50, strain to 5. |
| **Root Cause** | Fallback coach needs to say something when data is missing; defaults are reasonable but should be labeled as estimates. |
| **Impact** | User receives coaching advice based on fabricated defaults without knowing it. |
| **Fix** | Add `isEstimated: true` flag to fallback responses using hardcoded defaults, surface to user. |

---

## Appendix A: Algorithm Registry

Full algorithm catalog from [`elite-health/src/lib/algorithms/registry.ts`](elite-health/src/lib/algorithms/registry.ts:1):

| # | Algorithm | Function | Version | Category |
|---|-----------|----------|---------|----------|
| 1 | `recovery` | `computeRecovery` | 1.0.0 | `metric` |
| 2 | `strain` | `computeStrain` | 1.0.0 | `metric` |
| 3 | `sleep-debt` | `computeSleepDebt` | 1.0.0 | `metric` |
| 4 | `sleep-performance` | `computeSleepPerformance` | 1.0.0 | `metric` |
| 5 | `biological-age` | `computeBiologicalAge` | 1.0.0 | `metric` |
| 6 | `illness-predictor` | `computeIllnessRisk` | 1.0.0 | `risk` |
| 7 | `injury-predictor` | `computeInjuryRisk` | 1.0.0 | `risk` |
| 8 | `cns-stress` | `computeCnsStress` | 1.0.0 | `risk` |
| 9 | `running-form` | `computeFormDegradation` | 1.0.0 | `metric` |
| 10 | `trend-engine` | `computeTrendMetric` | 1.0.0 | `analysis` |
| 11 | `heuristic-synthesis` | `synthesize` | 1.0.0 | `synthesis` |
| 12 | `pearson-correlation` | `pearsonCorrelation` | 1.0.0 | `analysis` |
| 13 | `streaks` | `computeStreaks` | 1.0.0 | `analysis` |
| 14 | `weekly-planner` | `generateWeeklyPlan` | 1.0.0 | `planning` |
| 15 | `habit-impact` | `computeHabitImpact` | 1.0.0 | `analysis` |

## Appendix B: Database Tables (Production)

From [`elite-health/src/lib/db.ts`](elite-health/src/lib/db.ts:13):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `raw_health_samples` | Phase A raw sample dual-write | `id, sample_type, value, unit, start_date, end_date, source, device, metadata, hk_uuid, created_at` |
| `sync_runs` | Sync lifecycle tracking | `id, date_window_start, date_window_end, status, samples_fetched, samples_written, started_at, completed_at, error_message` |
| `derived_outputs` | Algorithm output cache | `id, output_type, date_key, algorithm_name, algorithm_version, result_json, input_fingerprint, confidence, created_at, invalidated_at` |
| `provenance_log` | Data lineage tracking | `id, sample_type, date_key, source, confidence, hk_uuid, raw_sample_id, created_at` |
| `vitals` | Normalized vitals (legacy) | `id, date, hrv, rhr, spo2, respiratory_rate, skin_temp_delta, blood_pressure_systolic, blood_pressure_diastolic, provenance, last_updated` |
| `sleep_records` | Normalized sleep (legacy) | `id, date, total_sleep_hours, rem_hours, deep_hours, core_hours, awake_hours, efficiency, sleep_start, sleep_end, provenance, last_updated` |
| `daily_scores` | Pre-computed daily scores | `id, date, recovery_score, strain_score, sleep_quality, sleep_debt_hours, biological_age, pace_of_aging, illness_risk_level, illness_risk_score, injury_risk_level, injury_risk_score, cns_stress_level, cns_stress_score, synthesis_json, provenance, last_updated` |
| `activity_records` | Normalized activities (legacy) | `id, date, workout_type, duration_minutes, calories, strain_score, hr_zone_1-5_min, provenance, last_updated` |
| `mobility_records` | Walking metrics (legacy) | `id, date, walking_speed, walking_asymmetry, double_support_time, step_length, stair_speed_up, stair_speed_down, provenance, last_updated` |
| `environmental_records` | Environmental (legacy) | `id, date, audio_exposure_db, daylight_lux_min, uv_index, provenance, last_updated` |
| `cardio_metabolic_records` | Cardio metabolic (legacy) | `id, date, vo2max, resting_energy, active_energy, provenance, last_updated` |
| `running_dynamics_records` | Running form (legacy) | `id, date, ground_contact_time, vertical_oscillation, cadence, power, stride_length, provenance, last_updated` |
| `weight_records` | Body weight (legacy) | `id, date, weight_kg, bmi, body_fat_pct, provenance, last_updated` |

## Appendix C: File Index

Complete file listing for all audited files:

```
elite-health/
├── src/
│   ├── lib/
│   │   ├── types.ts                          — All TypeScript interfaces
│   │   ├── store.ts                          — Zustand state management
│   │   ├── canonical-selectors.ts            — Canonical selector layer
│   │   ├── date.ts                           — Date utilities
│   │   ├── db.ts                             — SQLite database layer
│   │   ├── healthkit.ts                      — HealthKit sync pipeline
│   │   ├── algorithms/
│   │   │   ├── biological-age.ts             — Biological age computation
│   │   │   ├── cns-stress.ts                 — CNS stress analysis
│   │   │   ├── habit-impact.ts               — Habit correlation
│   │   │   ├── heuristic-synthesis.ts        — Pillar score synthesis
│   │   │   ├── illness-predictor.ts          — Illness risk detection
│   │   │   ├── injury-predictor.ts           — Injury risk assessment
│   │   │   ├── pearson-correlation.ts        — Statistical correlation
│   │   │   ├── recovery.ts                   — Recovery score
│   │   │   ├── registry.ts                   — Algorithm registry
│   │   │   ├── running-form.ts               — Running form analysis
│   │   │   ├── sleep-debt.ts                 — Sleep debt tracking
│   │   │   ├── sleep-performance.ts          — Sleep quality scoring
│   │   │   ├── strain.ts                     — Cardiac strain
│   │   │   ├── streaks.ts                    — Streak computation
│   │   │   ├── trend-engine.ts               — Trend detection
│   │   │   ├── weekly-planner.ts             — Weekly periodization
│   │   │   └── z-score.ts                    — Statistical z-score
│   │   ├── utils/
│   │   │   ├── cache.ts                      — In-memory cache
│   │   │   ├── display-helpers.ts            — Safe display guards
│   │   │   ├── longevity-guards.ts           — Longevity validity checks
│   │   │   ├── metric-normalization.ts       — Unit normalization
│   │   │   ├── recency.ts                    — Recency-aware display
│   │   │   ├── synthetic-generator.ts        — Test data generation
│   │   │   └── validation.ts                 — Plausibility checks
│   │   ├── services/
│   │   │   ├── background-sync.ts            — Background HealthKit sync
│   │   │   ├── data-inspector.ts             — Forensic data tools
│   │   │   └── export-tools.ts               — CSV/PDF/Summary export
│   │   ├── gemini/
│   │   │   ├── client.ts                     — Gemini AI coach
│   │   │   └── fallback-coach.ts             — Offline rule-based coach
│   │   ├── rag/
│   │   │   ├── chunker.ts                    — Document chunking
│   │   │   ├── embeddings.ts                 — Text embeddings
│   │   │   └── vector-store.ts               — Vector storage
│   │   └── __tests__/
│   │       ├── algorithm-validation.test.ts  — Algorithm tests
│   │       └── data-integrity.test.ts        — Data integrity tests
│   ├── hooks/
│   │   ├── useDataProvenance.ts              — Provenance inspector
│   │   └── useSelectedDateHealthState.ts     — Date-scoped state hook
│   └── components/
│       ├── home/
│       │   ├── body-systems-bar.tsx          — Body systems status
│       │   ├── hrv-trend-spark.tsx           — HRV trend sparkline
│       │   ├── immunity-shield.tsx           — Illness risk display
│       │   ├── pillar-card.tsx               — Pillar score card
│       │   ├── sleep-drilldown.tsx           — Sleep architecture
│       │   ├── sleep-mini-card.tsx           — Sleep summary card
│       │   ├── streak-tracker.tsx            — Streak display
│       │   └── vitals-rings.tsx              — Performance rings
│       ├── health/
│       │   ├── biological-age.tsx            — Biological age display
│       │   ├── orbConfig.ts                  — Orb theme config
│       │   ├── PremiumOrb.tsx                — 3D orb visualization
│       │   └── running-dynamics.tsx          — Running metrics
│       ├── profile/
│       │   ├── export-tools.tsx              — Data export UI
│       │   └── records.tsx                   — Personal records
│       └── ui/
│           ├── data-freshness-row.tsx        — Sync status indicator
│           ├── metric-status-pill.tsx        — Status badge
│           ├── metric-value.tsx              — Simple metric display
│           ├── trend-spark.tsx               — Bar sparkline
│           └── v3/
│               ├── elite-card.tsx            — Glass panel card
│               ├── orb-metric-hero.tsx       — Orb hero metric
│               └── pillar-ring.tsx           — Ring visualization
├── AGENTS.md                                 — Complete app reference
└── docs/
    └── health-data-display-audit.md          — Prior display audit
```

---

> **Audit Complete.** This document was produced through exhaustive reading of all specified files. No code changes were made. All file:line references are accurate as of the audit date.
