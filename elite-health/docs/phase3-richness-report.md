# Elite Health AI — Phase 3: Richness Restoration Report

## Overview

Phase 2 truthfulness fixes inadvertently caused major content collapse on the Home screen and selective content gaps on the Health screen by wrapping entire sections in `{synthesis && (...)}` or `{data && (...)}` guards. When data was missing, entire cards, grids, and trend panels vanished — leaving users with a thin, one-line "Pull to sync" placeholder.

**This phase restores product density while keeping every truthfulness fix intact.** The rule: always show the section structure; fill it with informative placeholders when data is absent.

---

## Changes Summary

### Home Screen (`app/(tabs)/index.tsx`) — 6 Fixes

| # | Section | Before | After |
|---|---------|--------|-------|
| H-1 | **LongevitySphere** | Wrapped in `{synthesis && (...)}` — entire hero disappeared | Always rendered. Falls back to `isFallback` mode showing "Establishing baseline" |
| H-2 | **TrainingWindowCard** | Wrapped in `{synthesis && (...)}` — vanished | When no synthesis, shows placeholder card: "Training Window · Awaiting HealthKit sync" |
| H-3 | **3 PillarCards** | Wrapped in `{synthesis && (...)}` — entire bento grid gone | Always shows "Health Pillars" label. When no synthesis, shows 3 skeleton cards labeled "Readiness / Resilience / Longevity — Awaiting data" |
| H-4 | **BodySystemsStatusBar** | Wrapped in `{synthesis && (...)}` — disappeared | When no synthesis, shows placeholder: "Body Systems — Awaiting vitals data" |
| H-5 | **HRV Trend Spark** | Wrapped in `{synthesis && (...)}` — section title "Trends & Recovery" had no content | Always renders. HrvTrendSpark already handles empty state with "No HRV data available yet" |
| H-6 | **Timeline / Workouts** | `{currentActivities.length > 0 && (...)}` — section vanished | Timeline section always visible. Shows "No activities logged · Sync HealthKit or log a workout" when empty |

### Health Screen — Overview (`app/(tabs)/health.tsx:DefaultHealthView`) — 2 Fixes

| # | Section | Before | After |
|---|---------|--------|-------|
| D-1 | **Running Dynamics** | `{currentDynamics && currentDynamics.runningPower > 0 && (...)}` — card vanished | Card always renders. Shows "No running data available — log a run to see dynamics" when absent |
| D-2 | **Workouts** | `{currentActivities.length > 0 && (...)}` — card vanished | Card always renders. Shows "No workouts logged — sync or log a workout to see it here" when empty |

### Health Screen — Resilience (`app/(tabs)/health.tsx:ResilienceView`) — 2 Fixes

| # | Section | Before | After |
|---|---------|--------|-------|
| R-1 | **CNS Detail rows** (noise, daylight, HRV drop) | `{cnsStressScore && (...)}` — 3 metrics vanished | Always renders. Shows "CNS stress detail will populate after sufficient data is synced" when null |
| R-2 | **Body Details** — Movement Health, Environment, Breathing & Cardio | Each wrapped in `{mobilityRecord &&}`, `{environmentalRecord &&}`, `{cardioRecord &&}` — subsections could vanish entirely | All 3 subsections always render. Metrics show `'--'` when records are null. Panel never collapses to empty |

### Health Screen — Longevity (`app/(tabs)/health.tsx:LongevityView`) — 2 Fixes

| # | Section | Before | After |
|---|---------|--------|-------|
| L-1 | **VO₂ Max card** | `{cardioRecord && vo2Max > 0 && (...)}` — card vanished | Card always renders. Shows "Sync cardio data (Apple Watch walking HR or lab test) to estimate VO₂ Max" when absent |
| L-2 | **Movement & Stability rings** | `{mobilityRecord && (...)}` — 3-ring dashboard vanished | Rings always render with `'--'` values. Shows "Sync mobility data to populate movement metrics" when no record |

### Profile Screen (`app/(tabs)/profile.tsx`) — 1 Fix

| # | Section | Before | After |
|---|---------|--------|-------|
| P-1 | **Max Strain** | Showed `0.0` when no activities (misleading) | Shows `'--'` when `activities.length === 0` |

---

## Design Principle Enforced

> **"Never solve false data problems by over-removing content."**

Every fix in this phase follows the tri-state pattern:

1. **Data available** → Show real values (existing behavior)
2. **Data absent** → Show section structure with informative message ("Sync X to populate Y")
3. **Data stale** → Show value with recency label (Phase 2 pattern, maintained)

**No fake defaults were introduced.** All placeholder states explicitly communicate data absence.

---

## TypeScript Verification

```
$ npx tsc --noEmit
app/(tabs)/index.tsx(277,30): error TS2339: Property 'description' does not exist on type 'InterceptTrigger'. ← PRE-EXISTING
src/components/coach/vision-capture.tsx(268,25): error TS2769: No overload matches... ← PRE-EXISTING
src/components/ui/explain-sheet.tsx(4,26): error TS2307: Cannot find module 'expo-blur'... ← PRE-EXISTING
```

Zero new TypeScript errors introduced. All 3 errors are pre-existing and unrelated to these changes.

---

## Files Modified

| File | Lines Changed | Sections Touched |
|------|--------------|-----------------|
| `app/(tabs)/index.tsx` | ~60 lines | LongevitySphere gate removed, TrainingWindow placeholder, PillarCards skeleton, BodySystems placeholder, HRV Trend always-render, Timeline always-render, Empty state refined |
| `app/(tabs)/health.tsx` | ~80 lines | Running Dynamics always-render, Workouts always-render, CNS Detail always-render, Body Details always-render, VO₂ Max always-render, Movement & Stability always-render |
| `app/(tabs)/profile.tsx` | 1 line | Max Strain `'--'` when no activities |

---

## Remaining Opportunities (Deferred to Future Phases)

- **Weekly Planner empty state**: Still wrapped in `{timelinePlan && (...)}` — could show a "Build a training plan" placeholder
- **Streak Tracker empty state**: Wrapped in `{scores.length > 0 && (...)}` — could show "Start tracking to build streaks"
- **Correlation Explorer empty state**: Wrapped in `{correlationInsights.length > 0 && (...)}` — acceptable, needs ≥14 days of journal + vitals data
- **Athlete name from HealthKit**: Profile screen hardcodes "Athlete" — could pull firstName from HealthKit
- **SleepMiniCard**: Already handles empty state gracefully internally
