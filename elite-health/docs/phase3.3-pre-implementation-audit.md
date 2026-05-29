# Phase 3.3 — Home Page Fix + Data Pipeline Audit (Pre-Implementation)

## PHASE 1 — HOME HEADER / DATE ROW FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 1.1 | Date row layout: date label is left-aligned with arrows, sync status is right-aligned. Date is not visually centered — it sits in a `flexDirection: 'row'` with arrows. The `DataFreshnessRow` pushes everything left. | 🟡 MEDIUM | `index.tsx:410-429` |
| 1.2 | Sync status hardcodes `"Just now"` and `"Up to date"` — never reflects actual `lastSync` timestamp. | 🔴 HIGH | `index.tsx:428` |
| 1.3 | No manual sync affordance. The "Synced Just now" text is not tappable. | 🔴 HIGH | `index.tsx:428` |
| 1.4 | `isSyncing` state is available but `DataFreshnessRow` ignores it — no loading spinner when syncing. | 🟡 MEDIUM | `index.tsx:428`, `data-freshness-row.tsx` |
| 1.5 | Header calendar icon (line 393) is a dead tap — does nothing. | 🟢 LOW | `index.tsx:392-394` |

## PHASE 2 — LONGEVITY ORB / PACE-OF-AGING FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 2.1 | `computeBiologicalAge()` only uses HRV+RHR+SpO2. Ignores VO₂ Max, sleep quality, mobility, inflammation markers. | 🔴 HIGH | `biological-age.ts:1-40` |
| 2.2 | The composite score maps HRV/RHR to a 10-year age shift (`compositeScore * 10` on line 30). With extreme inputs, pace can go to 8.86x or higher. The `safePaceOfAging` helper rejects >3, but the raw storage still has absurd values. | 🔴 HIGH | `biological-age.ts:30`, `display-helpers.ts:86-90` |
| 2.3 | Visual artifact: "Bottom shadow" View (`longevity-sphere.tsx:147-165`) creates a colored rectangle beneath the orb. When pace is `>1.08` (#FF453A/red), this appears as a red glow rectangle. | 🟡 MEDIUM | `longevity-sphere.tsx:147-165` |
| 2.4 | No confidence metadata. If only 3 days of HRV exist, the same formula runs as with 30 days. | 🔴 HIGH | `biological-age.ts`, `store.ts:353-366` |
| 2.5 | Fallback pipeline (`index.tsx:184-190`): when `paceOfAging` is null, derives from `1.3 - longevity.score/200`. This is a hidden heuristic with no user explanation. | 🟡 MEDIUM | `index.tsx:184-190` |
| 2.6 | Orb tap navigates to `health?focus=longevity` — good routing, but user can't see *how* the number was computed. | 🟡 MEDIUM | `index.tsx:432-436` |
| 2.7 | The `derivePalette` thresholds are narrow: <0.92 = REVERSING, 0.92-0.98 = OPTIMAL, 0.98-1.03 = STEADY, 1.03-1.08 = ELEVATED, >1.08 = CRITICAL. A user at 1.09 sees a red "AT RISK" state with no nuance. | 🟡 MEDIUM | `longevity-sphere.tsx:34-40` |

## PHASE 3 — APPLE HEALTH / HEALTHKIT DATA INGESTION GAPS

| Metric | HealthKit Source | Status | Issue |
|---|---|---|---|
| HRV (SDNN) | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | ✅ Working | Fetched daily, stored correctly |
| Resting HR | `HKQuantityTypeIdentifierRestingHeartRate` | ✅ Working | Fetched daily, stored correctly |
| SpO2 | `HKQuantityTypeIdentifierOxygenSaturation` | ✅ Working | Fetched with `%` unit |
| Respiratory Rate | `HKQuantityTypeIdentifierRespiratoryRate` | ✅ Working | Fetched with `count/min` unit |
| Wrist Temp | `HKQuantityTypeIdentifierAppleSleepingWristTemperature` | ✅ Working | Fetched with `degC` unit |
| Sleep Stages | `HKCategoryTypeIdentifierSleepAnalysis` | ✅ Working | Correctly parses Core/Deep/REM/Awake |
| VO₂ Max | `HKQuantityTypeIdentifierVO2Max` | ✅ Working | Fetched in cardio query, NOT used in bio-age |
| Walking Asymmetry | `HKQuantityTypeIdentifierWalkingAsymmetryPercentage` | ✅ Working | Fetched with `%` unit |
| Double Support | `HKQuantityTypeIdentifierWalkingDoubleSupportPercentage` | ✅ Working | Fetched with `%` unit |
| Walking Speed | `HKQuantityTypeIdentifierWalkingSpeed` | ✅ Working | Fetched with `m/s` unit |
| Stair Speed | `HKQuantityTypeIdentifierStairAscentSpeed` / `StairDescentSpeed` | ✅ Working | Fetched, used in injury predictor |
| Daylight | `HKQuantityTypeIdentifierTimeInDaylight` | ✅ Working | Fetched with `min` unit |
| Headphone Audio | `HKQuantityTypeIdentifierHeadphoneAudioExposure` | ✅ Working | Fetched with `dBASPL` unit |
| Breathing Disturbances | `HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances` | ✅ Working | Fetched with `count/hr`, may be nil |
| Physical Effort | `HKQuantityTypeIdentifierPhysicalEffort` | ✅ Working | Fetched but not displayed on Home |
| Walking HR Avg | `HKQuantityTypeIdentifierWalkingHeartRateAverage` | ✅ Working | Fetched but not displayed on Home |
| Steps | `HKQuantityTypeIdentifierStepCount` | ✅ Working | Fetched, stored in mobility |
| Workouts | `HKWorkoutTypeIdentifier` | ✅ Working | Fetched with type mapping |

**Summary**: The HealthKit pipeline is actually very thorough. All metrics the user might see in Apple Health are being fetched. The gaps are in *algorithm usage*, not in data collection:
- VO₂ Max is fetched but never used in biological-age computation
- Sleep stages are stored but only total duration enters readiness
- Walking HR average is fetched but unused
- Cardio data exists but doesn't influence pace-of-aging

## PHASE 4 — GAIT CARD FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 4.1 | Injury risk explanation is technical: `"Moderate gait changes detected (Asymmetry: 0.0%, Double Support Delta: +6.9%)"` | 🔴 HIGH | `injury-predictor.ts:47` |
| 4.2 | The MODERATE risk uses raw biomechanical language without plain-English interpretation. | 🔴 HIGH | `injury-predictor.ts:38-48` |
| 4.3 | No action-oriented recommendation in the injury risk output — just "consider monitoring." | 🟡 MEDIUM | `injury-predictor.ts:47` |
| 4.4 | The intercept message at `synthesis.ts:294` is better but only fires for HIGH severity. | 🟡 MEDIUM | `heuristic-synthesis.ts:290-298` |

## PHASE 5 — GAIT MODAL FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 5.1 | `InterceptModal` shows readiness, resilience, CNS, target strain, bedtime but none are individually tappable. | 🔴 HIGH | `intercept-modal.tsx` (need to read) |
| 5.2 | Intervention checklist is tied to `synthesis.recoveryTips` — same tips for all triggers of same type. | 🟡 MEDIUM | `heuristic-synthesis.ts:360-425` |
| 5.3 | Sports science rationale is a single static paragraph per trigger type. | 🟡 MEDIUM | `heuristic-synthesis.ts:366-398` |

## PHASE 6 — TRAINING WINDOW FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 6.1 | Window times are derived from readiness score only — ignores sleep debt, circadian data, recent workout timing. | 🟡 MEDIUM | `training-window-card.tsx:32-76`, `training-window-modal.tsx:33-76` |
| 6.2 | Modal shows time range + workout type but doesn't explain *why* that window was chosen. | 🟡 MEDIUM | `training-window-modal.tsx` |
| 6.3 | No "why this window" or contributing factors displayed. | 🟡 MEDIUM | `training-window-modal.tsx` |
| 6.4 | Target strain in DailyDirective shows a number but tapping it does nothing. | 🟡 MEDIUM | `daily-directive-v2.tsx:114-120` |
| 6.5 | Bedtime in DailyDirective shows a time but tapping it does nothing. | 🟡 MEDIUM | `daily-directive-v2.tsx:124-130` |

## PHASE 7 — "WHY TODAY LOOKS LIKE THIS" FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 7.1 | `InsightPriorityStack` items are NOT tappable — they're just styled `<View>` components. | 🔴 HIGH | `insight-priority-stack.tsx:46-73` |
| 7.2 | Insights say "VO2 Max declining" (from trend alerts) but tapping gives no evidence. | 🔴 HIGH | `index.tsx:272-278`, `insight-priority-stack.tsx` |
| 7.3 | The `description` field on PriorityInsight is always synthesis detail text — no actual metric values. | 🟡 MEDIUM | `index.tsx:268-318` |
| 7.4 | No date stamps, trend lines, or evidence for any insight claim. | 🟡 MEDIUM | `insight-priority-stack.tsx` |

## PHASE 8 — "PRIME TO PERFORM" / DAILY STATUS FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 8.1 | Readiness score weights: HRV 50%, RHR 25%, Sleep 25%. Sleep at 4h (50% of need) can be overridden by good HRV. Result: 90+ score, "PRIMED — Full work capacity available." | 🔴 HIGH | `heuristic-synthesis.ts:34-101` |
| 8.2 | Missing sleep weight floors — no minimum sleep threshold to allow "PRIMED" status. | 🔴 HIGH | `heuristic-synthesis.ts:34-101` |
| 8.3 | "Full work capacity available" is shown even when sleep debt exists. | 🔴 HIGH | `heuristic-synthesis.ts:95` |
| 8.4 | No confidence metadata in readiness output — user doesn't know if this is based on 3 days or 30 days. | 🟡 MEDIUM | `heuristic-synthesis.ts:34-101` |

## PHASE 9 — HEALTH PILLARS LAYOUT FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 9.1 | PillarCard uses `flex: 1` in a `flexDirection: 'row', gap: 10` container. Middle card "RESILIENCE" wraps on narrower screens because text is longer. | 🟡 MEDIUM | `pillar-card.tsx:56-66`, `index.tsx:499-518` |
| 9.2 | When synthesis is null, fallback cards use different styling (`index.tsx:523-538`) — they're just static placeholders, not PillarCard components. | 🟢 LOW | `index.tsx:520-542` |
| 9.3 | Cards don't have consistent vertical rhythm — label → score → zone badge. Score font size differs between insufficient (16) and normal (24). | 🟢 LOW | `pillar-card.tsx:103,109` |

## PHASE 10 — BODY SYSTEMS ROUTING FINDINGS

| # | Issue | Severity | Location |
|---|---|---|---|
| 10.1 | All 4 system icons route to `health?focus=readiness`. HEART should route to overview, LUNGS to readiness, CNS to resilience, TEMP to readiness or overview. | 🔴 HIGH | `body-systems-bar.tsx:77-79` |
| 10.2 | No per-system routing — entire bar is one `TouchableOpacity`. | 🔴 HIGH | `body-systems-bar.tsx:77` |

## PHASE 11 — TAP MAP FINDINGS

| Element | Current Tap Behavior | Status |
|---|---|---|
| LongevitySphere orb | → `health?focus=longevity` | ✅ Working |
| DailyDirective card | → opens DailyDirectiveDetailModal | ✅ Working |
| Target Strain in DailyDirective | No tap | 🔴 Dead |
| Bedtime in DailyDirective | No tap | 🔴 Dead |
| TrainingWindowCard | → opens TrainingWindowDetailModal | ✅ Working |
| PillarCard (Readiness) | → `health?focus=readiness` (when not insufficient) | ✅ Working |
| PillarCard (Resilience) | → `health?focus=resilience` | ✅ Working |
| PillarCard (Longevity) | → `health?focus=longevity` | ✅ Working |
| BodySystemsStatusBar (entire bar) | → `health?focus=readiness` | 🔴 Wrong — all 4 go to same place |
| InsightPriorityStack items | No tap | 🔴 Dead |
| HRVTrendSpark | → Opens correlational modal? (need to verify) | 🟡 Verify |
| SleepMiniCard | → Routes to sleep detail? (need to verify) | 🟡 Verify |
| HrvTrendSpark | Tap behavior unclear | 🟡 Verify |
| WeeklyPlannerCard day chips | → `setSelectedDate(day.date)` | ✅ Working |
| StreakTracker streak chips | → opens StreakDetailModal | ✅ Working |
| CorrelationExplorer items | → `onPressInsight` callback | ✅ Working |
| Header avatar | → No tap (should route to profile) | 🔴 Dead |
| Header calendar icon | No tap | 🔴 Dead |
| Header info icon | → opens BiometricsInfoModal | ✅ Working |

---

## IMPLEMENTATION PRIORITY

1. **P0 (Safety/Trust)**: Pace-of-aging algorithm trustworthiness → rebalance `biological-age.ts`
2. **P0 (Safety/Trust)**: "PRIMED" with poor sleep → add sleep floor to readiness
3. **P1 (UX)**: InsightPriorityStack dead taps → make tappable with evidence
4. **P1 (UX)**: Body systems per-system routing → individual tap targets
5. **P1 (Data)**: Header sync affordance + real sync status → tappable sync with live status
6. **P1 (UX)**: Target strain / bedtime tappable in DailyDirective
7. **P1 (Copy)**: Gait card plain-English rewrite → human-friendly language
8. **P2 (Visual)**: Pillar card layout balance → consistent sizing
9. **P2 (Visual)**: Orb shadow artifact → remove or restyle
10. **P2 (Explainability)**: Training window "why" explanation
11. **P2 (Explainability)**: Orb confidence metadata
12. **P2 (Routing)**: Header avatar → profile navigation
