# Elite Health AI — Phase 2: Screen-by-Screen Truthfulness Audit

> **Pre-Fix Audit Report** — May 22, 2026
>
> Covers: Home Screen (`index.tsx`), Health Screen (`health.tsx`), Profile Screen (`profile.tsx`)

---

## 🟢 CONFIRMED FIXED (Phase 1.5 — Still Working)

| # | Component | Fix | Status |
|---|-----------|-----|--------|
| 1 | `VitalsRings` | '--' scores, 'NO DATA' zones when no synthesis | ✅ |
| 2 | `BodySystemsBar` | 'unknown' status type, gray dim dots when no vitals | ✅ |
| 3 | `LongevitySphere` | `isFallback` overlay: "Awaiting recent longevity inputs" | ✅ |
| 4 | `LongevityView` (Health) | `isLongevityFallback` detection + disclosure text | ✅ |
| 5 | `HrvTrendSpark` | 'NO BASELINE' for null z-score | ✅ |
| 6 | `BentoGrid` | '--' for null sleep metrics | ✅ |
| 7 | `FallbackCoach` | `OFFLINE_DISCLAIMER` prepended to all responses | ✅ |
| 8 | `Coach` screen | Recovery protocols guarded with null checks | ✅ |
| 9 | `WeeklySummary` drilldown | Nullable arrays for SpO2/Hrv/RHR | ✅ |
| 10 | `Recency` utility | 15 metric categories, `getDisplayMetric()`, badge/label | ✅ |
| 11 | `PillarCard` | Uses synthesis `dataCoverage` for zone/score rendering | ✅ |

---

## 🔴 HIGH RISK — Fake-Normal Defaults Without Disclosure

### H1. `chronologicalAge = 25` — Hardcoded (Health Screen)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:1264)
```typescript
const chronologicalAge = 25
```
**Impact:** Every bio age comparison, delta badge (`"X yr younger/older"`), and slider position is computed against a fixed 25-year-old reference. If the user is 45, the app shows them as "20 yr older" — or if the actual `biologicalAge` from scores is 25.0 (because it falls back to `chronologicalAge`), it shows "aligned" when it's actually a fake alignment.

**Affected areas:**
- `DefaultHealthView` bio age slider (line 352-428)
- `LongevityView` bio age vs chronological (line 1027-1084)
- `LongevityView` age delta badge (line 1052-1062)
- `HealthScreen` → `biologicalAge = safeBiologicalAge(currentScores?.biologicalAge) ?? chronologicalAge` (line 1291)

**Fix:** Make chronological age a configurable value (from profile/settings), default to null when unknown, show "Set your age in Profile" when missing.

### H2. Protocol Adherence — Hardcoded Booleans (Health → LongevityView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:1016-1022)
```typescript
const protocols = [
    { label: 'Daily daylight ≥ 30 min', done: true },           // ← FAKE TRUE
    { label: 'Bedtime before 11 PM', done: ...sleepDebt },      // ← Partially real
    { label: 'Strength training 2x/week', done: true },          // ← FAKE TRUE
    { label: 'Aerobic zone 2 ≥ 180 min/week', done: false },     // ← FAKE FALSE
    { label: 'Protein ≥ 1.6 g/kg BW', done: true },              // ← FAKE TRUE
]
```
**Impact:** 3 of 5 protocols show fake completion status. The user sees green checkmarks for protocols they may not be following, creating false confidence.

**Fix:** Either compute all protocols from real data, or mark unverified protocols with a distinct "unverified / track to verify" state.

### H3. Risk/Status Defaults to Healthy (Health → ResilienceView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:775-782)
```typescript
const immunityLabel = currentScores?.immunityRisk ?? 'Low'     // ← FAKE LOW
const injuryLabel = injuryRisk?.risk ?? 'Low'                    // ← FAKE LOW
const cnsLabel = cnsStressScore?.risk ?? 'Low'                   // ← FAKE LOW
```
**Impact:** All three defense statuses default to 'LOW' risk when the underlying data is null. User sees green "PROTECTED", "STABLE", and "LOW" CNS load with progress bars at 85%, 90%, 20% — all fake-normal.

**Fix:** Show '--' or 'UNKNOWN' when data is null. Progress bars should show 0% with gray color or be hidden.

### H4. Recovery Zone Defaults to 'yellow' (Health → ReadinessView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:596)
```typescript
const recoveryZone = currentScores?.recoveryZone ?? 'yellow'
```
**Impact:** When no scores exist, user sees "MODERATE" badge with warning color — a middle-ground fake that looks like a real assessment.

**Fix:** Default to null, show '--' or 'NO DATA' when no scores.

### H5. ANS Balance Defaults to 50 (Health → ReadinessView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:733)
```typescript
<AnsBalanceBar parasympathetic={recoveryValues.length > 0 ? recoveryValues[0] : 50} />
```
**Impact:** When no recovery data exists, the ANS bar shows perfect 50/50 balance — fake-normal.

**Fix:** Hide the ANS bar or show a "Need recovery data" message when empty.

### H6. `rhrBaseline` Falls Back to 60 (Home Screen)
**File:** [`index.tsx`](elite-health/app/(tabs)/index.tsx:119-122)
```typescript
const rhrBaseline = useMemo(() => {
    const valid = vitals.filter(v => v.rhr > 0).map(v => v.rhr)
    if (valid.length === 0) return 60  // ← HARDCODED
    return valid.reduce((a, b) => a + b, 0) / valid.length
}, [vitals])
```
**Impact:** `BodySystemsStatusBar` heart status uses this baseline for comparison. When no historical vitals exist, RHR status is computed against 60 bpm — making any RHR reading show a potentially misleading status color.

**Fix:** Return null when no valid baselines exist. `BodySystemsStatusBar` should mark heart as 'unknown' when baseline is null.

---

## 🟡 MEDIUM RISK — Misleading or Unlabeled

### M1. Hardcoded Micro-Narratives (Health Screen — All Views)
**Files & Lines:**
| Location | Text |
|----------|------|
| `DefaultHealthView` L511 | `"Vitals have remained stable. Readiness is influenced mainly by recent cardiac strain."` |
| `ReadinessView` L734 | `"Recovery score currently suggests parasympathetic dominance, indicating a primed state."` |
| `ResilienceView` L979 | `"Your defense systems are strong, primarily driven by low CNS load."` |
| `LongevityView` L1206 | `"Strong cardiovascular health and protocol consistency are optimizing your pace of aging."` |

**Impact:** These appear as AI-generated insights but are static strings that don't reflect actual data. They're always shown regardless of real metrics.

**Fix:** Either make dynamic using `MicroNarrative` with real data context, or label them as "Health Tip" instead of appearing as data-driven insights.

### M2. Cardiac Strain 0.0 = "Low Load" (Health → DefaultHealthView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:360-361)
```typescript
const strainVal = currentScores?.strainScore ?? 0
const strainPct = Math.min(100, (strainVal / 21) * 100)
```
**Impact:** When strain score is 0 (null → 0), the bar shows 0.0/21.0 with label "Low Load — Active Recovery Optimal". This conflates "no data" with "intentional rest day".

**Fix:** Only show strain bar when `currentScores` exists and `strainScore > 0`. Otherwise show "No strain data" message.

### M3. Readiness Drivers: Null → 'negative' (Health → ReadinessView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:740-744)
```typescript
{ label: 'Resting Heart Rate', value: `${rhrLatest ?? '--'} bpm`, impact: rhrLatest && rhrLatest < 60 ? 'positive' : 'negative' },
{ label: 'Heart Rate Variability', value: `${hrvLatest ?? '--'} ms`, impact: hrvLatest && hrvLatest > 60 ? 'positive' : 'neutral' }
```
**Impact:** When rhrLatest is null, impact defaults to 'negative' (red). When hrvLatest is null, impact defaults to 'neutral'. Should be 'unknown' for both.

**Fix:** Use `impact: rhrLatest == null ? 'neutral' : rhrLatest < 60 ? 'positive' : 'negative'`.

### M4. Resilience Drivers: 'LOW' passed as value when null (Health → ResilienceView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:974-978)
```typescript
{ label: 'Immunity Risk', value: injuryRisk?.risk ?? 'LOW', ... },
{ label: 'CNS Stress', value: cnsStressScore?.risk ?? 'LOW', ... },
{ label: 'Environmental Stress', value: 'Stable', ... }  // ← always "Stable"
```
**Impact:** Fake values when data is missing. "Environmental Stress: Stable" is always shown.

**Fix:** Show '--' for null values. Make environmental stress dynamic or remove it.

### M5. TrainingWindowCard `cnsStressRisk` Default (Home)
**File:** [`index.tsx`](elite-health/app/(tabs)/index.tsx:447)
```typescript
cnsStressRisk={synthesis.cnsStressScore?.risk ?? 'LOW'}
```
**Impact:** CNS stress defaults to 'LOW' when synthesis doesn't have it, affecting the training window recommendation.

**Fix:** Default to null and handle in component.

### M6. `displayBioAge` Fallback Chain (Home)
**File:** [`index.tsx`](elite-health/app/(tabs)/index.tsx:192-200)
```typescript
const displayBioAge = useMemo(() => {
    const fromScores = safeBiologicalAge(scores.find(s => s.date === dateStr)?.biologicalAge)
    if (fromScores !== null) return fromScores
    // Fallback: latest recent biological age from scores
    for (const s of scoresSorted) {
        const v = safeBiologicalAge(s.biologicalAge)
        if (v !== null) return v
    }
    return null
}, [scoresSorted, dateStr])
```
**Impact:** Falls back to any historical biological age without recency labeling. The `LongevitySphere` gets `isFallback={displayBioAge == null}` but doesn't know if the value is from today or from weeks ago.

**Fix:** Add recency labeling for historical fallback values.

---

## ⚪ LOW RISK / OBSERVATIONS

### L1. Gait Symmetry Uses Raw Values Without Safe Helpers (Health → LongevityView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:1130,1144,1158)
```typescript
{(100 - mobilityRecord.walkingAsymmetry).toFixed(0)}%
{mobilityRecord.doubleSupport.toFixed(1)}
{mobilityRecord.walkingSpeed.toFixed(1)}
```
**Impact:** If mobilityRecord values are 0 or NaN, these show "100%" symmetry, "0.0" stability, "0.0" m/s — all misleading. The `ResilienceView` correctly uses `safeNumber()` for these.

**Fix:** Use `safeWalkingSpeed()`, `safeNumber()` consistently.

### L2. Hardcoded Sleep Need (Health → ReadinessView)
**File:** [`health.tsx`](elite-health/app/(tabs)/health.tsx:608)
```typescript
const sleepNeedHours = 8
```
**Impact:** Minor — 8 hours is a reasonable default, but could be configurable.

### L3. Profile Target Days = 90 (Profile)
**File:** [`profile.tsx`](elite-health/app/(tabs)/profile.tsx)
Hardcoded 90-day target for progress bar. Acceptable as a fixed goal but should be noted.

---

## 📋 CROSS-SCREEN CONSISTENCY ISSUES

| Issue | Home | Health | Profile |
|-------|------|--------|---------|
| `chronologicalAge` | Uses `25` for `ageYears` in synthesis input | Hardcoded `25` | N/A |
| Safe helpers usage | Partial (some raw `.toFixed()`) | Mixed (LongevityView raw, ResilienceView safe) | Mostly safe |
| Recency labeling | Only on LongevitySphere | Only on LongevityView fallback | None |
| '--' for null values | In BentoGrid/VitalsRings | In Core Vitals, RHR/HRV modules | In Records |
| Empty state copy | "No data available for this date" | Skeleton loader | Handled per-component |
| Hardcoded defaults | rhrBaseline=60 | 6 risk/zone defaults, chronologicalAge=25, protocols | None |

---

## 🔍 MANUAL QA SCENARIOS (Post-Fix)

1. **Fresh install, no sync** → All screens should show empty/setup states, no fake numbers
2. **Sync 1 day of data** → PillarCards show "insufficient" zone, LongevitySphere shows fallback overlay
3. **Sync 14 days of data** → All metrics should show computed values with recency labels
4. **Navigate to past date with no data** → Screen shows "No data available" with no fake defaults
5. **Toggle between Health focus tabs** → Each view handles null data gracefully
6. **Check Profile after 1-day sync** → Records show '--', ActivitySummary shows real count
7. **Health: Overview → Resilience** when no injuryRisk/cnsStressScore → Should show '--' not 'LOW'
8. **Health: Longevity protocols** → Unverified protocols should not show green checkmarks
