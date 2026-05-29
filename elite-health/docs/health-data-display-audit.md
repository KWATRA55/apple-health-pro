# Health Data Display Audit — Complete Screen → Selector → Storage → Scope Mapping

> **Date:** 2026-05-24  
> **Scope:** All screen/component files in `elite-health/` that display health data  
> **Method:** Read-only discovery — no files modified

---

## 1. SCREEN → SELECTOR → STORAGE → SCOPE MAPPING TABLE

### Tab Pages

| Screen | Selector(s) / Store Key(s) | Backing Tables | Scope | Raw / Derived |
|---|---|---|---|---|
| **Home** (`app/(tabs)/index.tsx`) | `useHealthStore()` + `useSelectedDateHealthState()` → `currentScores`, `currentVitals`, `currentSleep`, `currentActivities`, `synthesis`, `trendReport`, `cnsStressScore`, `injuryRisk`; also `useHealthStore()` directly for `scores` (all), `activities` (all), `sleep` (all) for streaks/planner; `computeCorrelationInsightsSelector`, `generateWeeklyPlanSelector` | `scores`, `vitals`, `sleep`, `activities`, `journalEntries`, `mobility`, `environmental`, `cardioMetabolic`, `runningDynamics` | **selectedDate** (hook-derived) + **allTime** (streaks, planner, correlations) | Mixed |
| **Health** (`app/(tabs)/health.tsx`) | `useHealthStore()` + `useSelectedDateHealthState()` → all `current*` fields, `synthesis`, `rhrBaseline`; also `useHealthStore()` for `vitalsHistory` (7d), `scoresHistory` (7d), `sleepHistory` (7d) in Readiness/Resilience views | `scores`, `vitals`, `sleep`, `activities`, `runningDynamics`, `mobility`, `environmental`, `cardioMetabolic` | **selectedDate** (primary) + **rolling7d** (ReadinessView, ResilienceView, LongevityView history arrays) | Mixed |
| **Coach** (`app/(tabs)/coach.tsx`) | `useHealthStore()` + `useSelectedDateHealthState()` → `currentScores`, `currentVitals`, `currentSleep`, `synthesis`, `trendReport`; also `useHealthStore()` → `latestScores`, `latestVitals`, `latestSleep` (fallback), `messages`, `journalEntries`, `meals`, `scores` (all), `sleep` (all); `computeTrendReportSelector` | All tables | **selectedDate** (preferred) → **latest** (fallback via `effectiveScores`/`effectiveVitals`/`effectiveSleep` pattern); **allTime** (sleep schedule, nutritional metrics, cardiorespiratory, recovery protocols, trend patterns) | Mixed |
| **Profile** (`app/(tabs)/profile.tsx`) | `useHealthStore()` → `weightHistory`, `activities` (all), `scores` (all), `sleep` (all), `exportCsv`, `shareSummaryText` | `weightHistory`, `activities`, `scores`, `sleep` | **allTime** (unfiltered) | Raw records |

### Drilldown Pages

| Screen | Selector(s) / Store Key(s) | Backing Tables | Scope | Raw / Derived |
|---|---|---|---|---|
| **Sleep Drilldown** (`app/drilldown/sleep.tsx`) | `useHealthStore()` → `computeSleepArchitecture()`; also `sleep`, `scores` filtered by URL date param | `sleep`, `scores` | **selectedDate** (single date) + **rolling7d** (history slice) | Derived (architecture) + raw (history) |
| **Weekly Summary** (`app/drilldown/weekly-summary.tsx`) | `useHealthStore()` → `computeTrendReportSelector()`; also `scores`, `vitals`, `sleep`, `environmental`, `cardioMetabolic` filtered by week window | `scores`, `vitals`, `sleep`, `environmental`, `cardioMetabolic` | **rolling7d** (via `getWeekWindow()`) | Mixed (trendReport-derived + raw filtered records) |
| **Monthly Summary** (`app/drilldown/monthly-summary.tsx`) | `useHealthStore()` → `scores`, `vitals`, `environmental`, `activities`, `cardioMetabolic`, `journalEntries` filtered by month window | `scores`, `vitals`, `environmental`, `activities`, `cardioMetabolic`, `journalEntries` | **rolling30d** (via `getMonthWindow()`) | Mixed |
| **Live Workout** (`app/workout/live.tsx`) | `useHealthStore()` → minimally `profileAge`, `addActivity()`; primary state from `LiveWorkoutSession` class | `LiveWorkoutSession` (in-memory) → `activities` (persisted via `addActivity`) | **real-time** (not date-scoped) | Real-time simulated/calculated |
| **Edit Profile** (`app/drilldown/edit-profile.tsx`) | `useHealthStore()` → `latestScores?.biologicalAge` | `scores` (latest entry) | **latest** | Derived (biological age) |

### Home Sub-Components

| Component | Data Displayed | Props / Selectors | Backing Tables | Scope | Empty State |
|---|---|---|---|---|---|
| **BodySystemsStatusBar** | Heart, Lungs, CNS, Temp status dots (green/amber/red) | Props: `vitals`, `cnsStress`, `rhrBaseline`, `dateStr` | `vitals` + derived `cnsStressScore` (from synthesis) | selectedDate | Gray 'unknown' dots |
| **PerformanceRingRow** | 3 rings (Recovery, Strain, Sleep) with scores | Props: `synthesis` | Derived from `synthesis.readiness/resilience/longevity` | selectedDate | "NO DATA", "--", dimmed rings |
| **ActivityTimeline** | Workout list with strain scores | Props: `activities`, `displayDate` | `activities` | selectedDate | "No workouts logged" in GlassCard |
| **HRSplineTrace** | 24-hr heart rate spline chart + sleep/activity overlays | Props: `samples`, `sleep`, `activities` | Heart rate samples, `sleep`, `activities` | selectedDate | Empty chart with default axes; **fabricates default sleep block (10PM–6AM)** when no sleep data |
| **SleepMiniCard** | Total sleep, REM/DEEP/EFF pills, sleep debt badge | Props: `sleep`, `sleepDebtHours` | `sleep` + derived `sleepDebtHours` | selectedDate | "No sleep data recorded" |
| **SleepDrilldown** | Stage bar, quality score, REM/Deep/Core, 7-night history | Props: `architecture`, `history` | Derived `SleepArchitecture` + `sleep` history | selectedDate + rolling7d | "No sleep data available" |
| **StreakTracker** | 3 streak counters (Recovery, Training, HRV) | Props: `scores`, `activities`; uses `computeStreaks()` | All `scores` + `activities` | allTime | "Start today →" when count=0 |
| **AIPromptBar** | Text input for AI queries | None | None | N/A (pure UI) | N/A |
| **InterceptModal** | Health alert cards | Props: `triggers` (InterceptTrigger[]) | Derived from synthesis/trend | latest | Returns null (hidden) |
| **JournalWeeklyChecklist** | 7-day M–S check dots | Props: `status` (boolean[]) | Derived from `journalEntries` | selectedDate week | Unchecked dots |
| **HabitImpactEngine** | Behavior insights (±X% Recovery) | Props: `insights` (HabitInsight[]) | Derived from habit-impact algorithm | selectedDate | "Log more habits to unlock correlation insights." |
| **ImmunityShield** | Illness risk level + explanation | Props: `risk`, `explanation` | Derived from illness-predictor algorithm | selectedDate | Returns null (hidden entirely when risk=LOW) |
| **AuroraBackground/Canvas** | Decorative animated bg | None | None | N/A (pure visual) | N/A |
| **CorrelationInsightModal** | Habit correlation + statistical significance | Props: `insight` (CorrelationInsight) | Derived from pearson-correlation algorithm | selectedDate | Returns null (hidden) |

### Health Sub-Components

| Component | Data Displayed | Props / Selectors | Backing Tables | Scope | Empty State |
|---|---|---|---|---|---|
| **BiologicalAge** | Bio age ring, chrono comparison, aging pace | Props: `biologicalAge`, `chronologicalAge`, `paceOfAging` | Derived from `scores.biologicalAge`, `scores.paceOfAging` | selectedDate | **Fabricates:** uses `safeBiologicalAge` → falls back to `chronologicalAge` when bio age invalid/null |
| **VitalsGrid** | 5 vital cards (HRV, RHR, SpO2, Breathing, Skin Temp) | Props: `vitals` | `vitals` | selectedDate | "No vitals data available"; shows "--" for individual missing metrics |
| **HealthMonitorStrip** | 5 icon dots (metrics in range) | Props: `count`, `total` | Derived from vitals validation | selectedDate | Shows 0/total |
| **PremiumOrb** | Animated particle orb + value/label/sublabel | Props: `variant`, `primaryValue`, `primaryLabel`, `secondaryLabel`, `isEmpty`, `fallbackText`, `onPress` | N/A (pure display) | N/A | `isEmpty` → dims particles 0.28x, shows fallbackText, dimmed value at 0.25 opacity. When no Skia: FallbackOrb with same dimming |
| **orbConfig.ts** | Theme config (colors, particle counts, radii) | N/A | Static config | N/A | N/A |
| **RunningDynamicsCard** | Running power, contact time, oscillation, stride length; form degradation warning | Props: `recent`, `baseline`; uses `computeFormDegradation()` | `runningDynamics` | selectedDate + allTime (baseline) | "No recent running data found." |

### Coach Sub-Components

| Component | Data Displayed | Props / Selectors | Backing Tables | Scope | Empty State |
|---|---|---|---|---|---|
| **ChatWindow** | Message list (CoachMessage[]), parsed ### blocks | Props: `messages`, `ListFooterComponent` | In-memory message state | N/A (pure chat UI) | "Your Health Coach" welcome screen with brain icon |
| **VisionCapture** | Gemini Vision meal/workout photo analysis | `useHealthStore()` → `addMeal()`, `addActivity()` | `meals`, `activities` (via add* actions) | real-time | Fallback when native module unavailable; loading spinner |

### Profile Sub-Components

| Component | Data Displayed | Props / Selectors | Backing Tables | Scope | Empty State |
|---|---|---|---|---|---|
| **PersonalRecords** | All-time max strain, best sleep, deep sleep, lowest recovery | Props: `activities`, `sleep`, `scores` | `activities`, `sleep`, `scores` | allTime | "--" when no data |
| **ActivitySummary** | Activity type breakdown + counts + avg strain | Props: `activities` | `activities` | allTime | "No workouts recorded yet" |
| **StrainRecoveryChart** | 7-day dual bar chart (strain + recovery) | Props: `scores` | `scores` | rolling7d (last 7) | "Need more data" |
| **SegmentedControl** | Time range selector (1M/3M/ALL) | None | None | N/A (pure UI) | N/A |
| **Export Tools** | CSV, PDF HTML, summary text | Receives full `HealthState` | All tables | allTime | "No data available" sections |

### Hook

| Hook | Behavior | Store Keys Read | Computed Output | Key Detail |
|---|---|---|---|---|
| **useSelectedDateHealthState** | Derives ALL date-scoped state from `selectedDate` in Zustand store | `selectedDate`, `scores`, `vitals`, `sleep`, `activities`, `runningDynamics`, `mobility`, `environmental`, `cardioMetabolic`, `profileAge`, `injuryRisk`, `cnsStressScore` | `currentScores`, `currentVitals`, `currentSleep`, `currentActivities`, `currentDynamics`, `currentMobility`, `currentEnvironmental`, `currentCardio`, `chronologicalAge`, `displayBioAge`, `displayPace`, `rhrBaseline`, `isLongevityFallback`, `biologicalAge`, `paceOfAging`, `synthesis`, `trendReport`, `canonicalCnsStress`, `canonicalInjuryRisk`, `shiftDate` | Uses `getState()` for synthesis computation (non-reactive read). `synthesis` and `trendReport` re-derived on every render. `isLongevityFallback` computed from `hasValidBioAge`/`hasValidPace`/confidence guards. |

### Layout Files

| File | Role | Data Involvement |
|---|---|---|
| **`app/_layout.tsx`** | Root layout; triggers `loadFromDB()` then `syncHealthKit()` on mount; registers background sync task; auto-generates runtime snapshot | DB init, HealthKit sync |
| **`app/(tabs)/_layout.tsx`** | Tab navigator with 4 tabs (Home, Health, Coach, Profile) | None (pure navigation) |

---

## 2. SCREENS THAT SILENTLY MIX SCOPES

| # | Screen / Component | Scopes Mixed | Detail |
|---|---|---|---|
| 1 | **Home (`index.tsx`)** | `selectedDate` + `allTime` | Uses hook-derived `currentScores`/`currentVitals` for PremiumOrb, rings, body systems, etc., but simultaneously uses ALL `scores`/`activities`/`sleep` for `StreakTracker`, `WeeklyPlanner`, `CorrelationExplorer`, `computeCorrelationInsightsSelector`. User sees a mix of today's data and all-time streaks on the same screen with no visual delimiter. |
| 2 | **Health (`health.tsx`)** | `selectedDate` + `rolling7d` | DefaultHealthView uses selectedDate data; ReadinessView/ResilienceView switch to 7-day histories (`vitalsHistory`, `scoresHistory`, `sleepHistory`) within the same tab via segmented sub-tabs. The premium orb in Readiness/Resilience views shows selectedDate score but the bar charts below use 7-day arrays. |
| 3 | **Coach (`coach.tsx`)** | `selectedDate` → `latest` (fallback) + `allTime` | `effectiveScores`/`effectiveVitals`/`effectiveSleep` pattern silently falls back from selectedDate to latest when the former is null. BiometricsContextWidget, insight cards, and suggestion chips may use different scopes simultaneously. Trend patterns (allTime), cardiorespiratory fitness (allTime `cardioMetabolic`), and sleep schedule (allTime `sleep`/`scores`) coexist with selectedDate data. |
| 4 | **Sleep Drilldown (`sleep.tsx`)** | `selectedDate` + `rolling7d` | Single date architecture + 7-night history displayed together. |
| 5 | **Profile (`profile.tsx`)** | `allTime` + `latest` (implicit) | Body Composition uses `weightHistory[0]` (latest weight entry) alongside all-time records (max strain, best sleep, lowest recovery). |
| 6 | **HRSplineTrace** | `selectedDate` + **fabricated** | When no sleep data exists, fabricates a default 10PM–6AM sleep block instead of showing nothing. Sleep block is fabricated, HR data is real. |
| 7 | **BiologicalAge** | `selectedDate` + **fabricated** | When `biologicalAge` is invalid/null, silently falls back to `chronologicalAge` as display value via `safeBiologicalAge`. User cannot distinguish measured bio age from fabricated chrono age fallback. |

---

## 3. SCREENS THAT FABRICATE / FALLBACK IN EMPTY STATE

| # | Screen / Component | Fabrication/Fallback Behavior | Severity |
|---|---|---|---|
| 1 | **BiologicalAge** | `safeBiologicalAge(bioAge, chronoAge) ?? chronoAge` — when bio age is null/invalid/zero-confidence, silently displays chronological age as if it were biological age. User sees e.g. "29.4" and cannot tell if it's measured or the fallback. | **HIGH** — data integrity concern; user may believe they have a valid biological age reading when they don't |
| 2 | **HRSplineTrace** | When `sleep` is null or `totalDurationMins <= 0`, fabricates a default sleep block (22:00–06:00, 8 hours) with 0.08 opacity. Shown in legend as "Sleep" — user cannot tell it's fabricated. | **MEDIUM** — visual fabrication; the sleep block implies sleep data exists |
| 3 | **PremiumOrb** | When `isEmpty=true`, particles dim to 0.28x, value text dims to 0.25 opacity, shows `fallbackText` instead of `primaryLabel`. Visual dimming is the only signal — no explicit "no data" label. | **MEDIUM** — dimmed orb may be interpreted as "low score" rather than "no data" |
| 4 | **PerformanceRingRow** | When no synthesis, shows "NO DATA" zone labels and "--" values with dimmed ring colors — this is the **correct** behavior, not a fabrication. | N/A (correct) |
| 5 | **BodySystemsStatusBar** | When vitals null, shows gray 'unknown' status dots — this is the **correct** behavior, not a fabrication. | N/A (correct) |
| 6 | **VitalsGrid** | Individual missing metrics show "--" with "Check" status and red dot — this conflates "missing data" with "out of range" visually. | **LOW** — ambiguous signal |
| 7 | **Coach (`coach.tsx`)** | `effectiveScores = currentScores ?? latestScores` — silently falls back from selectedDate to latest. No visual indication that the displayed data is from a different date than what the user selected. | **MEDIUM** — date mismatch without user awareness |

---

## 4. SCREENS THAT SURFACE PROVENANCE TO THE USER

| # | Screen / Component | Provenance Indicator | Quality |
|---|---|---|---|
| 1 | **Live Workout (`live.tsx`)** | `isSimulated` flag → shows "⚡ SIMULATED" badge adjacent to HR display. Clear, prominent, color-coded. | **EXCELLENT** — the only component with explicit provenance surfacing |
| 2 | **Edit Profile (`edit-profile.tsx`)** | Biological age displayed as read-only with "--" when null — indicates data absence but not source. | **MINIMAL** |
| 3 | **Health (`health.tsx`)** | Empty states show "Sync HealthKit to populate your health data" — explains *how* to get data but not *where* current data came from. | **PARTIAL** |
| 4 | **CorrelationInsightModal** | Shows "14-day sample size" and "Pearson Correlation Coefficient (r)" — explains the statistical method and data window. | **GOOD** — mathematical provenance |
| 5 | **VisionCapture** | Shows "GEMINI VISION ANALYZER" header — identifies the AI model used for analysis. | **GOOD** — model provenance |
| 6 | **Export Tools (PDF)** | Footer: "Generated by KILO AI Elite Health" + ISO timestamp. CSV includes "EXPORT METADATA" section with record counts. | **GOOD** — export provenance |

---

## 5. SUMMARY STATISTICS

| Metric | Count |
|---|---|
| Total files audited | 33 |
| Screens that mix scopes silently | 7 |
| Screens that fabricate/fallback in empty state | 7 (3 HIGH, 3 MEDIUM, 1 LOW severity) |
| Screens that surface provenance | 6 (1 excellent, 3 good, 1 partial, 1 minimal) |
| Components using `useSelectedDateHealthState` hook | 4 (Home, Health, Coach, and any consumer of it) |
| Components using raw `useHealthStore()` directly | 16+ |
| Table types backing displays | 10: `scores`, `vitals`, `sleep`, `activities`, `runningDynamics`, `mobility`, `environmental`, `cardioMetabolic`, `journalEntries`, `weightHistory` |

---

## 6. KEY ARCHITECTURAL OBSERVATIONS

1. **`useSelectedDateHealthState` is the canonical derivation point** — it computes `synthesis`, `trendReport`, `isLongevityFallback`, `biologicalAge`, `paceOfAging`, `rhrBaseline`, `canonicalCnsStress`, and `canonicalInjuryRisk` once per render. Home, Health, and Coach tabs all consume this hook, avoiding duplicate derivation.

2. **Coach screen has the most complex scope mixing** — it uses a `currentScores ?? latestScores` fallback pattern (`effectiveScores`), combines selectedDate data with allTime trend patterns, and builds biometric context for Gemini from multiple date ranges simultaneously.

3. **BiologicalAge component is the most dangerous fabrication** — `safeBiologicalAge` silently substitutes chronological age for biological age with zero visual distinction. This means a user who hasn't synced enough data sees what appears to be a valid biological age reading.

4. **Live Workout is the only screen with excellent provenance** — the "SIMULATED" badge is the gold standard for how provenance should be surfaced elsewhere.

5. **No screen displays data source timestamps** — while export tools include generation timestamps, no live UI shows when data was last synced from HealthKit or how fresh it is.

6. **Profile screen is the only tab that doesn't use `useSelectedDateHealthState`** — it reads raw store arrays directly, operating entirely in allTime scope.

7. **The `_layout.tsx` auto-generates a runtime snapshot** — it posts the full store state to an SSH tunnel endpoint 3 seconds after app load, which is a development/debugging concern but not a health data display issue.
