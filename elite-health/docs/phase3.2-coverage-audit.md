# Phase 3.2 — Health Coverage Restoration Audit

## Pre-Implementation Coverage Gap Analysis

### Rule Applied
> "Do not confuse 'section is visible' with 'screen is complete.' A visible placeholder card is not enough."

For each metric area: show exact selected-date value → recent valid value with recency label → informative empty state. Never remove the metric area.

---

## 1. Overview View (DefaultHealthView) — Coverage Gaps

**What's present:** Bio Age slider, 5 Core Vitals (HRV/RHR/SpO2/RR/Temp), Cardiac Strain bar, MicroNarrative, Running Dynamics, Workouts, TrendExplorer (conditional).

| Gap | Severity | Description |
|-----|----------|-------------|
| No Recovery Score | 🔴 CRITICAL | Primary daily health headline (Recovery Score) completely absent from Overview. Only appears in Readiness drilldown. |
| No Sleep summary | 🔴 CRITICAL | Overview doesn't show sleep duration, quality, or debt at all. Essential daily metric. |
| No Body Systems visual | 🔴 CRITICAL | BodySystemsStatusBar exists as a component but isn't used in the Health Overview. |
| TrendExplorer vanishes | 🟡 HIGH | Gated behind `{trendReport && (...)}`. When no trend data, entire section disappears. |
| No Strain/Exercise summary | 🟡 HIGH | No aggregated strain score, exercise minutes, or step count. |
| Cardiac Strain is 1D | 🟡 HIGH | Only a progress bar. No contextual explanation, no target strain, no day-over-day comparison. |
| Running Dynamics raw only | 🟢 MEDIUM | Shows raw numbers with no interpretation, benchmarks, or trend arrows. |
| No Resilience snapshot | 🟢 MEDIUM | No CNS, immunity, or injury risk indicators at all. |

---

## 2. Readiness View — Coverage Gaps

**What's present:** Recovery Score hero, RHR/HRV modules with MiniSparkline, 7-day Recovery History bars, Sleep Duration bar, Autonomic Balance, Readiness Drivers.

| Gap | Severity | Description |
|-----|----------|-------------|
| Missing Respiratory Rate | 🔴 CRITICAL | RR is a key readiness signal (elevated RR = poor readiness) — absent. |
| Missing Skin Temp | 🔴 CRITICAL | Temperature is a readiness signal (elevated = illness/recovery demand) — absent. |
| Missing SpO2 | 🔴 CRITICAL | Oxygen saturation directly impacts readiness — absent. |
| Sleep is ONLY a bar | 🟡 HIGH | No sleep stages (REM, Deep, Core), no sleep quality score. Only shows total duration. |
| No Strain/Readiness balance | 🟡 HIGH | Relationship between yesterday's strain and today's readiness is powerful context, missing. |
| RHR no z-score context | 🟢 MEDIUM | RHR has MiniSparkline but no comparison to baseline/z-score. |
| Recovery bars no ref line | 🟢 MEDIUM | No "good" threshold marker on history bars. |

---

## 3. Resilience View — Coverage Gaps

**What's present:** Defense Grid (Immune/Injury labels), CNS Load gauge, CNS Detail rows, 7-Day Resilience Trend bars, Body Details (Movement/Environment/Breathing), Resilience Drivers.

| Gap | Severity | Description |
|-----|----------|-------------|
| Resilience Trend = Recovery data | 🔴 CRITICAL | 7-Day Resilience Trend shows `scoresHistory.map(s => s.recoveryScore)` — that's Recovery, not Resilience. Misleading. |
| Defense is label-only | 🟡 HIGH | "LOW"/"HIGH" labels with no underlying scores, no trend arrows, no z-score context. |
| No HRV in resilience | 🟡 HIGH | HRV is THE key resilience biomarker — absent from this view. |
| No RHR in resilience | 🟡 HIGH | RHR changes signal autonomic stress — absent. |
| CNS Load has no numeric score | 🟡 HIGH | Only a progress bar at 20%/55%/90% — no actual score value shown. |
| No Sleep quality in resilience | 🟢 MEDIUM | Sleep is a primary resilience builder — absent. |
| Body Details raw only | 🟢 MEDIUM | No interpretation, benchmarks, or trends on any body metric. |
| Environment thin | 🟢 MEDIUM | Sunlight/Standing/Exercise are raw numbers with no interpretation. |

---

## 4. Longevity View — Coverage Gaps

**What's present:** Bio vs Chrono Age, VO₂ Max card, Movement rings (3), AI Protocol checklist, Longevity Drivers.

| Gap | Severity | Description |
|-----|----------|-------------|
| No HRV/RHR as longevity biomarkers | 🔴 CRITICAL | HRV and RHR are established longevity biomarkers — completely absent. |
| VO₂ Max has no trend/percentile | 🟡 HIGH | Single number + bar vs 60 elite. No historical trend, direction arrow, or age/sex percentile. |
| AI Protocols mostly unverified | 🟡 HIGH | 4/5 show '?' — truthful but thin. No explanation of *why* each protocol matters for longevity. |
| Movement rings no benchmarks | 🟡 HIGH | Raw numbers with no ideal range, percentile, or interpretation. |
| No inflammatory proxy | 🟢 MEDIUM | HRV, RHR, SpO2 can proxy inflammation — not surfaced. |
| Longevity Drivers are labels | 🟢 MEDIUM | "VO₂ Max: 42.0 / neutral" doesn't explain what that means for longevity. |

---

## 5. Home Screen — Remaining Thin Areas

**What's present:** LongevitySphere, DailyDirective, TrainingWindowCard, InsightPriorityStack, PillarCards, BodySystemsStatusBar, CorrelationExplorer, HrvTrendSpark, SleepMiniCard, Timeline/Workouts, WeeklyPlannerCard (conditional), StreakTracker (conditional).

| Gap | Severity | Description |
|-----|----------|-------------|
| PillarCards skeleton identical | 🟢 MEDIUM | Three identical "Awaiting data" cards. Could minimally differentiate. |
| WeeklyPlannerCard vanishes | 🟢 MEDIUM | Gated behind `{timelinePlan &&`. No placeholder. |
| StreakTracker vanishes | 🟢 MEDIUM | Gated behind `{scores.length > 0 &&`. Could show "Start a streak" state. |
| No strain/recovery balance | 🟢 MEDIUM | Home missing strain-vs-recovery at-a-glance. |

---

## 6. Profile Screen — Remaining Thin Areas

| Gap | Severity | Description |
|-----|----------|-------------|
| No sleep trends | 🟢 MEDIUM | Sleep is a major pillar, absent from Profile. |
| No longevity snapshot | 🟢 MEDIUM | Bio age / pace of aging should appear on Profile. |

---

## Implementation Priority Order

1. **Health Overview**: Recovery Score headline, Sleep summary, Body Systems, TrendExplorer fallback
2. **Health Readiness**: Respiratory Rate, Skin Temp, SpO2 stats
3. **Health Resilience**: Fix Resilience Trend, add HRV/RHR, add CNS numeric score
4. **Health Longevity**: Add HRV/RHR biomarkers, VO₂ Max trend context, protocol explanations
5. **Home**: Placeholder states for WeeklyPlannerCard and StreakTracker
6. **Explanation layer**: Add context to thin metric areas
