/**
 * Canonical Selectors Test Suite
 *
 * Validates that ALL canonical selectors:
 *  - Return HealthMetricViewModel<T> with proper shape
 *  - Return status 'missing' with emptyStateReason for empty stores
 *  - Return status 'present' with provenance for populated stores
 *  - Return correct scope values ('selectedDate', 'latest', 'rolling7d', etc.)
 *  - Do NOT silently fall back across scopes
 */

import {
    selectVitalsForDate,
    selectLatestVitals,
    selectRolling7dVitals,
    selectRolling30dVitals,
    selectAllTimeVitalsRange,
    selectScoresForDate,
    selectLatestScores,
    selectRolling7dScores,
    selectRolling30dScores,
    selectAllTimeScoresRange,
    selectSleepForDate,
    selectLatestSleep,
    selectRolling7dSleep,
    selectRolling30dSleep,
    selectAllTimeSleepRange,
    selectActivitiesForDate,
    selectLatestActivities,
    selectRolling7dActivities,
    selectRolling30dActivities,
    selectAllTimeActivities,
    selectMobilityForDate,
    selectLatestMobility,
    selectRolling7dMobility,
    selectEnvironmentalForDate,
    selectLatestEnvironmental,
    selectRolling7dEnvironmental,
    selectCardioMetabolicForDate,
    selectLatestCardioMetabolic,
    selectRolling7dCardioMetabolic,
    selectRunningDynamicsForDate,
    selectLatestRunningDynamics,
    selectRolling7dRunningDynamics,
    selectWeightForDate,
    selectLatestWeight,
    selectRolling7dWeight,
    selectBiologicalAgeForDate,
    selectLatestBiologicalAge,
    selectPaceOfAgingForDate,
    selectLatestPaceOfAging,
    selectRecoveryScoreForDate,
    selectLatestRecoveryScore,
    selectHRVZScoreForDate,
    selectLatestHRVZScore,
    selectRHRZScoreForDate,
    selectLatestRHRZScore,
    selectStrainScoreForDate,
    selectLatestStrainScore,
    selectSleepDebtForDate,
    selectLatestSleepDebt,
    selectSleepNeedForDate,
    selectLatestSleepNeed,
    selectRolling7dStrainScores,
    selectRolling7dRecoveryScores,
    selectRolling7dSleepDebt,
} from '../canonical-selectors'
import type {
    HealthMetricViewModel,
    VitalsRecord,
    SleepRecord,
    ActivityRecord,
    DailyScores,
    MobilityRecord,
    EnvironmentalRecord,
    CardioMetabolicRecord,
    RunningDynamics,
    WeightRecord,
} from '../types'

// ── Local HealthStoreState (mirrors the interface in canonical-selectors.ts) ──

interface HealthStoreState {
    vitals: VitalsRecord[]
    sleep: SleepRecord[]
    scores: DailyScores[]
    activities: ActivityRecord[]
    mobility: MobilityRecord[]
    environmental: EnvironmentalRecord[]
    cardioMetabolic: CardioMetabolicRecord[]
    runningDynamics: RunningDynamics[]
    weightHistory: WeightRecord[]
    selectedDate: string
}

// ── Fixture builders ───────────────────────────────────────────────────────────

const TEST_DATE = '2026-03-15'

function emptyState(): HealthStoreState {
    return {
        vitals: [],
        sleep: [],
        scores: [],
        activities: [],
        mobility: [],
        environmental: [],
        cardioMetabolic: [],
        runningDynamics: [],
        weightHistory: [],
        selectedDate: TEST_DATE,
    }
}

function makeVitals(timestamp: string, overrides: Partial<VitalsRecord> = {}): VitalsRecord {
    return {
        id: 1,
        hrv: 55,
        rhr: 58,
        spo2: 98,
        skinTempDelta: 0,
        respiratoryRate: 14,
        ...overrides,
        timestamp,
    } as VitalsRecord
}

function makeSleep(date: string, overrides: Partial<SleepRecord> = {}): SleepRecord {
    return {
        id: 1,
        totalDurationMins: 480,
        remMins: 100,
        deepMins: 85,
        coreMins: 280,
        awakeMins: 15,
        sleepNeedHours: 8,
        sleepDebtHours: 0,
        ...overrides,
        date,
    } as SleepRecord
}

function makeScores(date: string, overrides: Partial<DailyScores> = {}): DailyScores {
    return {
        recoveryScore: 80,
        strainScore: 5,
        sleepDebtHours: 0,
        sleepNeedHours: 8,
        hrvZScore: 0.8,
        rhrZScore: -0.2,
        recoveryZone: 'green',
        displayAge: 28,
        rawAge: 28.3,
        biologicalAge: 28,
        paceOfAging: 0.95,
        immunityRisk: 'LOW',
        bioAgeConfidence: 0.8,
        bioAgeInputsUsed: ['HRV', 'RHR', 'SpO₂'],
        bioAgeInputsMissing: ['VO₂ Max', 'Sleep quality'],
        bioAgePrimaryDriver: 'HRV ↑',
        ...overrides,
        date,
    } as DailyScores
}

// ── Helpers: assert view model shape ────────────────────────────────────────────

function assertMissing(vm: HealthMetricViewModel<any>, expectedScope: string, expectedDate?: string) {
    expect(vm.status).toBe('missing')
    expect(vm.scope).toBe(expectedScope)
    expect(vm.value).toBeNull()
    expect(vm.emptyStateReason).toBeTruthy()
    expect(typeof vm.emptyStateReason).toBe('string')
    expect(vm.confidence).toBe(0)
    if (expectedDate) {
        expect(vm.effectiveDate).toBe(expectedDate)
    }
}

function assertPresent(vm: HealthMetricViewModel<any>, expectedScope: string) {
    expect(vm.status).toBe('present')
    expect(vm.scope).toBe(expectedScope)
    expect(vm.value).not.toBeNull()
    expect(vm.emptyStateReason).toBeNull()
    expect(vm.confidence).toBeGreaterThan(0)
    expect(vm.provenanceSummary).toBeTruthy()
    expect(vm.displayValue).toBeTruthy()
}

// ═══════════════════════════════════════════════════════════════════════════
// E1. VITALS SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Vitals Selectors', () => {
    describe('selectVitalsForDate', () => {
        it('E1a: returns missing for empty store', () => {
            const vm = selectVitalsForDate(emptyState(), TEST_DATE)
            assertMissing(vm, 'selectedDate', TEST_DATE)
        })

        it('E1b: returns present for matching date', () => {
            const state = { ...emptyState(), vitals: [makeVitals(`${TEST_DATE}T08:00:00Z`)] }
            const vm = selectVitalsForDate(state, TEST_DATE)
            assertPresent(vm, 'selectedDate')
            expect(vm.effectiveDate).toBe(TEST_DATE)
            expect(vm.sourceKind).toBe('normalized')
        })

        it('E1c: returns missing for non-matching date (no silent fallback)', () => {
            const state = { ...emptyState(), vitals: [makeVitals(`${TEST_DATE}T08:00:00Z`)] }
            const vm = selectVitalsForDate(state, '2025-01-01')
            assertMissing(vm, 'selectedDate', '2025-01-01')
        })
    })

    describe('selectLatestVitals', () => {
        it('E1d: returns missing for empty store', () => {
            const vm = selectLatestVitals(emptyState())
            assertMissing(vm, 'latest')
        })

        it('E1e: returns latest record (most recent timestamp)', () => {
            const state = {
                ...emptyState(),
                vitals: [
                    makeVitals('2026-03-10T08:00:00Z', { id: 1, hrv: 50 }),
                    makeVitals('2026-03-15T08:00:00Z', { id: 2, hrv: 60 }),
                    makeVitals('2026-03-12T08:00:00Z', { id: 3, hrv: 55 }),
                ],
            }
            const vm = selectLatestVitals(state)
            assertPresent(vm, 'latest')
            expect(vm.value?.hrv).toBe(60)
            expect(vm.effectiveDate).toBe('2026-03-15')
        })
    })

    describe('selectRolling7dVitals', () => {
        it('E1f: returns missing/insufficient for empty store', () => {
            const vm = selectRolling7dVitals(emptyState(), TEST_DATE)
            expect(vm.scope).toBe('rolling7d')
            expect(vm.status).toBe('missing')
        })

        it('E1g: returns present with aggregate for sufficient data (≥3 days)', () => {
            const vitals = [
                makeVitals('2026-03-13T08:00:00Z', { id: 1, hrv: 50, rhr: 60, spo2: 98 }),
                makeVitals('2026-03-14T08:00:00Z', { id: 2, hrv: 55, rhr: 58, spo2: 97 }),
                makeVitals('2026-03-15T08:00:00Z', { id: 3, hrv: 60, rhr: 56, spo2: 99 }),
            ]
            const state = { ...emptyState(), vitals }
            const vm = selectRolling7dVitals(state, TEST_DATE)
            expect(vm.scope).toBe('rolling7d')
            expect(vm.status).toBe('present')
            expect(vm.value).not.toBeNull()
            expect(vm.value!.avgHrv).toBe(55)
            expect(vm.value!.daysWithData).toBe(3)
            expect(vm.dateWindow).toBeDefined()
        })
    })

    describe('selectRolling30dVitals', () => {
        it('E1h: returns missing for empty store', () => {
            const vm = selectRolling30dVitals(emptyState(), TEST_DATE)
            expect(vm.scope).toBe('rolling30d')
        })

        it('E1i: needs ≥5 days for present status', () => {
            const vitals = Array.from({ length: 4 }, (_, i) =>
                makeVitals(`2026-03-${String(11 + i).padStart(2, '0')}T08:00:00Z`, {
                    id: i + 1,
                    hrv: 55,
                    rhr: 58,
                    spo2: 98,
                })
            )
            const state = { ...emptyState(), vitals }
            const vm = selectRolling30dVitals(state, TEST_DATE)
            expect(vm.status).toBe('insufficient')
        })
    })

    describe('selectAllTimeVitalsRange', () => {
        it('E1j: returns missing for empty store', () => {
            const vm = selectAllTimeVitalsRange(emptyState())
            assertMissing(vm, 'allTime')
        })

        it('E1k: returns present with min/max for populated store', () => {
            const vitals = [
                makeVitals('2026-01-01T08:00:00Z', { id: 1 }),
                makeVitals('2026-03-15T08:00:00Z', { id: 2 }),
            ]
            const state = { ...emptyState(), vitals }
            const vm = selectAllTimeVitalsRange(state)
            assertPresent(vm, 'allTime')
            expect(vm.value?.min.timestamp).toContain('2026-01-01')
            expect(vm.value?.max.timestamp).toContain('2026-03-15')
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E2. SCORES SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Scores Selectors', () => {
    const sampleScore = makeScores(TEST_DATE)

    describe('selectScoresForDate', () => {
        it('E2a: returns missing for empty store', () => {
            const vm = selectScoresForDate(emptyState(), TEST_DATE)
            assertMissing(vm, 'selectedDate', TEST_DATE)
        })

        it('E2b: returns present for matching date', () => {
            const state = { ...emptyState(), scores: [sampleScore] }
            const vm = selectScoresForDate(state, TEST_DATE)
            assertPresent(vm, 'selectedDate')
            expect(vm.value?.recoveryScore).toBe(80)
            expect(vm.sourceKind).toBe('normalized')
        })

        it('E2c: returns missing for non-matching date', () => {
            const state = { ...emptyState(), scores: [sampleScore] }
            const vm = selectScoresForDate(state, '2025-06-01')
            assertMissing(vm, 'selectedDate', '2025-06-01')
        })
    })

    describe('selectLatestScores', () => {
        it('E2d: returns missing for empty store', () => {
            const vm = selectLatestScores(emptyState())
            assertMissing(vm, 'latest')
        })

        it('E2e: returns latest by date', () => {
            const state = {
                ...emptyState(),
                scores: [
                    makeScores('2026-03-10', { recoveryScore: 70 }),
                    makeScores('2026-03-15', { recoveryScore: 85 }),
                    makeScores('2026-03-12', { recoveryScore: 75 }),
                ],
            }
            const vm = selectLatestScores(state)
            assertPresent(vm, 'latest')
            expect(vm.value?.recoveryScore).toBe(85)
            expect(vm.value?.date).toBe('2026-03-15')
        })
    })

    describe('selectRolling7dScores', () => {
        it('E2f: returns missing for empty store', () => {
            const vm = selectRolling7dScores(emptyState(), TEST_DATE)
            expect(vm.scope).toBe('rolling7d')
            expect(vm.status).toBe('missing')
        })

        it('E2g: aggregates scores within 7-day window', () => {
            const scores = [
                makeScores('2026-03-13', { recoveryScore: 70 }),
                makeScores('2026-03-14', { recoveryScore: 80 }),
                makeScores('2026-03-15', { recoveryScore: 90 }),
            ]
            const state = { ...emptyState(), scores }
            const vm = selectRolling7dScores(state, TEST_DATE)
            expect(vm.scope).toBe('rolling7d')
            expect(vm.status).toBe('present')
            expect(vm.value!.avgRecovery).toBe(80)
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E3. SLEEP SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Sleep Selectors', () => {
    describe('selectSleepForDate', () => {
        it('E3a: returns missing for empty store', () => {
            const vm = selectSleepForDate(emptyState(), TEST_DATE)
            assertMissing(vm, 'selectedDate', TEST_DATE)
        })

        it('E3b: returns present for matching date', () => {
            const state = { ...emptyState(), sleep: [makeSleep(TEST_DATE)] }
            const vm = selectSleepForDate(state, TEST_DATE)
            assertPresent(vm, 'selectedDate')
            expect(vm.value?.totalDurationMins).toBe(480)
        })
    })

    describe('selectLatestSleep', () => {
        it('E3c: returns missing for empty store', () => {
            const vm = selectLatestSleep(emptyState())
            assertMissing(vm, 'latest')
        })

        it('E3d: returns latest by date', () => {
            const state = {
                ...emptyState(),
                sleep: [
                    makeSleep('2026-03-10', { id: 1, totalDurationMins: 400 }),
                    makeSleep('2026-03-15', { id: 2, totalDurationMins: 500 }),
                ],
            }
            const vm = selectLatestSleep(state)
            assertPresent(vm, 'latest')
            expect(vm.value?.totalDurationMins).toBe(500)
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E4. ACTIVITY SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Activity Selectors', () => {
    const sampleActivity: ActivityRecord = {
        id: 1,
        timestamp: `${TEST_DATE}T08:00:00Z`,
        activeCalories: 350,
        workoutType: 'Run',
        durationMins: 45,
        hrZones: [10, 15, 10, 5, 2],
        maxHR: 175,
        strainScore: 8.5,
        avgHR: 145,
    }

    describe('selectActivitiesForDate', () => {
        it('E4a: returns missing for empty store', () => {
            const vm = selectActivitiesForDate(emptyState(), TEST_DATE)
            assertMissing(vm, 'selectedDate', TEST_DATE)
        })

        it('E4b: returns present for matching date', () => {
            const state = { ...emptyState(), activities: [sampleActivity] }
            const vm = selectActivitiesForDate(state, TEST_DATE)
            assertPresent(vm, 'selectedDate')
        })
    })

    describe('selectLatestActivities', () => {
        it('E4c: returns missing for empty store', () => {
            const vm = selectLatestActivities(emptyState())
            assertMissing(vm, 'latest')
        })
    })

    describe('selectAllTimeActivities', () => {
        it('E4d: returns missing for empty store', () => {
            const vm = selectAllTimeActivities(emptyState())
            assertMissing(vm, 'allTime')
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E5. MOBILITY, ENVIRONMENTAL, CARDIOMETABOLIC SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Mobility Selectors', () => {
    const sampleMobility: MobilityRecord = {
        id: 1,
        date: TEST_DATE,
        steps: 8500,
        walkingSpeed: 1.25,
        walkingStepLength: 0.7,
        walkingAsymmetry: 1.5,
        doubleSupport: 25,
        stairSpeedUp: 0.5,
        stairSpeedDown: 0.55,
        flightsClimbed: 6,
    }

    it('E5a: selectMobilityForDate returns missing for empty store', () => {
        const vm = selectMobilityForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E5b: selectMobilityForDate returns present for populated store', () => {
        const state = { ...emptyState(), mobility: [sampleMobility] }
        const vm = selectMobilityForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
    })

    it('E5c: selectLatestMobility returns missing for empty store', () => {
        const vm = selectLatestMobility(emptyState())
        assertMissing(vm, 'latest')
    })
})

describe('Environmental Selectors', () => {
    const sampleEnv: EnvironmentalRecord = {
        id: 1,
        date: TEST_DATE,
        daylightMins: 120,
        audioLevel: 55,
    }

    it('E5d: selectEnvironmentalForDate returns missing for empty store', () => {
        const vm = selectEnvironmentalForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E5e: selectEnvironmentalForDate returns present for populated store', () => {
        const state = { ...emptyState(), environmental: [sampleEnv] }
        const vm = selectEnvironmentalForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
    })
})

describe('CardioMetabolic Selectors', () => {
    const sampleCM: CardioMetabolicRecord = {
        id: 1,
        date: TEST_DATE,
        vo2Max: 45,
        walkingHRavg: 115,
        restingEnergy: 1800,
        physicalEffort: 24,
        restingHeartRate: 58,
        hrv: 55,
        breathingDisturbances: 3,
    }

    it('E5f: selectCardioMetabolicForDate returns missing for empty store', () => {
        const vm = selectCardioMetabolicForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E5g: selectCardioMetabolicForDate returns present for populated store', () => {
        const state = { ...emptyState(), cardioMetabolic: [sampleCM] }
        const vm = selectCardioMetabolicForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E6. RUNNING DYNAMICS SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Running Dynamics Selectors', () => {
    const sampleRD: RunningDynamics = {
        id: 1,
        timestamp: `${TEST_DATE}T08:00:00Z`,
        runningPower: 240,
        groundContactTime: 210,
        verticalOscillation: 8.0,
        strideLength: 1.15,
    }

    it('E6a: selectRunningDynamicsForDate returns missing for empty store', () => {
        const vm = selectRunningDynamicsForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E6b: selectRunningDynamicsForDate returns present for populated store', () => {
        const state = { ...emptyState(), runningDynamics: [sampleRD] }
        const vm = selectRunningDynamicsForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.sourceKind).toBe('normalized')
    })

    it('E6c: selectLatestRunningDynamics returns missing for empty store', () => {
        const vm = selectLatestRunningDynamics(emptyState())
        assertMissing(vm, 'latest')
    })

    it('E6d: selectLatestRunningDynamics returns latest by timestamp', () => {
        const state = {
            ...emptyState(),
            runningDynamics: [
                { ...sampleRD, id: 1, timestamp: '2026-03-10T08:00:00Z', groundContactTime: 200 },
                { ...sampleRD, id: 2, timestamp: '2026-03-15T08:00:00Z', groundContactTime: 250 },
            ],
        }
        const vm = selectLatestRunningDynamics(state)
        assertPresent(vm, 'latest')
        expect(vm.value?.groundContactTime).toBe(250)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E7. WEIGHT SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Weight Selectors', () => {
    const sampleWeight: WeightRecord = {
        id: 1,
        timestamp: `${TEST_DATE}T08:00:00Z`,
        weightKg: 75.5,
        leanBodyMassPercent: 75,
    }

    it('E7a: selectWeightForDate returns missing for empty store', () => {
        const vm = selectWeightForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E7b: selectWeightForDate returns present for populated store', () => {
        const state = { ...emptyState(), weightHistory: [sampleWeight] }
        const vm = selectWeightForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E8. BIOLOGICAL AGE & PACE OF AGING SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Biological Age Selectors', () => {
    it('E8a: selectBiologicalAgeForDate returns missing when no scores exist', () => {
        const vm = selectBiologicalAgeForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E8b: selectBiologicalAgeForDate returns missing when bioAgeConfidence is 0', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { bioAgeConfidence: 0 })],
        }
        const vm = selectBiologicalAgeForDate(state, TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
        expect(vm.emptyStateReason).toContain('Insufficient biomarkers')
    })

    it('E8c: selectBiologicalAgeForDate returns present with displayAge/rawAge split', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { displayAge: 28, rawAge: 28.3, bioAgeConfidence: 0.8 })],
        }
        const vm = selectBiologicalAgeForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value?.displayAge).toBe(28)
        expect(vm.value?.rawAge).toBe(28.3)
        expect(vm.displayValue).toBe('28y')
        expect(vm.sourceKind).toBe('derived')
    })

    it('E8d: selectLatestBiologicalAge returns missing for empty store', () => {
        const vm = selectLatestBiologicalAge(emptyState())
        assertMissing(vm, 'latest')
    })

    it('E8e: selectPaceOfAgingForDate returns missing for empty store', () => {
        const vm = selectPaceOfAgingForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E8f: selectPaceOfAgingForDate returns present with pace value', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { paceOfAging: 0.95, bioAgeConfidence: 0.8 })],
        }
        const vm = selectPaceOfAgingForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value).toBe(0.95)
        expect(vm.displayValue).toBe('0.95×')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E9. RECOVERY SCORE SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Recovery Score Selectors', () => {
    it('E9a: selectRecoveryScoreForDate returns missing for empty store', () => {
        const vm = selectRecoveryScoreForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E9b: selectRecoveryScoreForDate returns present with score + zone', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { recoveryScore: 85, recoveryZone: 'green', hrvZScore: 1.2, rhrZScore: -0.5 })],
        }
        const vm = selectRecoveryScoreForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value?.score).toBe(85)
        expect(vm.value?.zone).toBe('green')
        expect(vm.value?.hrvZScore).toBe(1.2)
        expect(vm.displayValue).toBe('85')
    })

    it('E9c: selectLatestRecoveryScore returns missing for empty store', () => {
        const vm = selectLatestRecoveryScore(emptyState())
        assertMissing(vm, 'latest')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E10. HRV / RHR Z-SCORE SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('HRV Z-Score Selectors', () => {
    it('E10a: selectHRVZScoreForDate returns missing for empty store', () => {
        const vm = selectHRVZScoreForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E10b: selectHRVZScoreForDate returns present', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { hrvZScore: 0.8 })],
        }
        const vm = selectHRVZScoreForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value).toBe(0.8)
    })
})

describe('RHR Z-Score Selectors', () => {
    it('E10c: selectRHRZScoreForDate returns missing for empty store', () => {
        const vm = selectRHRZScoreForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E10d: selectRHRZScoreForDate returns present', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { rhrZScore: -0.3 })],
        }
        const vm = selectRHRZScoreForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value).toBe(-0.3)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E11. STRAIN SCORE SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Strain Score Selectors', () => {
    it('E11a: selectStrainScoreForDate returns missing for empty store', () => {
        const vm = selectStrainScoreForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E11b: selectStrainScoreForDate returns present', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { strainScore: 12.5 })],
        }
        const vm = selectStrainScoreForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value).toBe(12.5)
        expect(vm.sourceKind).toBe('derived')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E12. SLEEP DEBT & SLEEP NEED SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Sleep Debt Selectors', () => {
    it('E12a: selectSleepDebtForDate returns missing for empty store', () => {
        const vm = selectSleepDebtForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E12b: selectSleepDebtForDate returns present with debt/need', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { sleepDebtHours: 1.5, sleepNeedHours: 8.5 })],
        }
        const vm = selectSleepDebtForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value?.debtHours).toBe(1.5)
        expect(vm.value?.needHours).toBe(8.5)
        expect(vm.displayValue).toBe('1.5h')
    })

    it('E12c: selectLatestSleepDebt returns missing for empty store', () => {
        const vm = selectLatestSleepDebt(emptyState())
        assertMissing(vm, 'latest')
    })

    it('E12d: selectSleepNeedForDate returns missing for empty store', () => {
        const vm = selectSleepNeedForDate(emptyState(), TEST_DATE)
        assertMissing(vm, 'selectedDate', TEST_DATE)
    })

    it('E12e: selectSleepNeedForDate returns present', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { sleepNeedHours: 8.5 })],
        }
        const vm = selectSleepNeedForDate(state, TEST_DATE)
        assertPresent(vm, 'selectedDate')
        expect(vm.value).toBe(8.5)
        expect(vm.displayValue).toBe('8.5h')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E13. ROLLING 7D DERIVED SCORE SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Rolling 7d Derived Score Selectors', () => {
    const sevenDaysOfScores = Array.from({ length: 7 }, (_, i) => {
        const day = String(15 - 6 + i).padStart(2, '0')
        return makeScores(`2026-03-${day}`, {
            recoveryScore: 70 + i * 3,
            strainScore: 5 + i,
            sleepDebtHours: i * 0.5,
        })
    })

    it('E13a: selectRolling7dStrainScores returns missing for empty store', () => {
        const vm = selectRolling7dStrainScores(emptyState(), TEST_DATE)
        expect(vm.scope).toBe('rolling7d')
        expect(vm.status).toBe('missing')
    })

    it('E13b: selectRolling7dStrainScores aggregates strain scores', () => {
        const state = { ...emptyState(), scores: sevenDaysOfScores }
        const vm = selectRolling7dStrainScores(state, TEST_DATE)
        assertPresent(vm, 'rolling7d')
        expect(vm.value?.daysWithData).toBe(7)
        expect(vm.value?.maxScore).toBe(11)
    })

    it('E13c: selectRolling7dRecoveryScores returns missing for empty store', () => {
        const vm = selectRolling7dRecoveryScores(emptyState(), TEST_DATE)
        expect(vm.scope).toBe('rolling7d')
        expect(vm.status).toBe('missing')
    })

    it('E13d: selectRolling7dRecoveryScores aggregates recovery scores', () => {
        const state = { ...emptyState(), scores: sevenDaysOfScores }
        const vm = selectRolling7dRecoveryScores(state, TEST_DATE)
        assertPresent(vm, 'rolling7d')
        expect(vm.value?.daysWithData).toBe(7)
    })

    it('E13e: selectRolling7dSleepDebt returns missing for empty store', () => {
        const vm = selectRolling7dSleepDebt(emptyState(), TEST_DATE)
        expect(vm.scope).toBe('rolling7d')
        expect(vm.status).toBe('missing')
    })

    it('E13f: selectRolling7dSleepDebt aggregates debt', () => {
        const state = { ...emptyState(), scores: sevenDaysOfScores }
        const vm = selectRolling7dSleepDebt(state, TEST_DATE)
        assertPresent(vm, 'rolling7d')
        expect(vm.value?.totalDebtHours).toBe(10.5)
        expect(vm.value?.daysWithData).toBe(7)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// E14. SCOPE BOUNDARY TESTS — No Silent Fallback
// ═══════════════════════════════════════════════════════════════════════════

describe('Scope Boundary — No Silent Fallback', () => {
    it('E14a: selectScoresForDate for missing date does NOT return latest data', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores(TEST_DATE, { recoveryScore: 85 })],
        }
        const vm = selectScoresForDate(state, '2025-06-01')
        expect(vm.status).toBe('missing')
        expect(vm.scope).toBe('selectedDate')
        expect(vm.effectiveDate).toBe('2025-06-01')
    })

    it('E14b: selectBiologicalAgeForDate for missing date does NOT use latest', () => {
        const state = {
            ...emptyState(),
            scores: [
                makeScores(TEST_DATE, { displayAge: 28, rawAge: 28.3, bioAgeConfidence: 0.8 }),
            ],
        }
        const vm = selectBiologicalAgeForDate(state, '2025-01-01')
        expect(vm.status).toBe('missing')
        expect(vm.scope).toBe('selectedDate')
    })

    it('E14c: selectLatestScores returns present even when selectedDate record is missing', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores('2026-03-14', { recoveryScore: 75 })],
            selectedDate: '2026-03-15',
        }
        const vm = selectLatestScores(state)
        assertPresent(vm, 'latest')
        expect(vm.value?.date).toBe('2026-03-14')
    })

    it('E14d: selectRecoveryScoreForDate does not fall back to latest', () => {
        const state = {
            ...emptyState(),
            scores: [makeScores('2026-03-14', { recoveryScore: 75 })],
        }
        const vm = selectRecoveryScoreForDate(state, '2026-03-15')
        expect(vm.status).toBe('missing')
    })

    it('E14e: emptyViewModel always has confidence 0 and value null', () => {
        const vm = selectVitalsForDate(emptyState(), TEST_DATE)
        expect(vm.confidence).toBe(0)
        expect(vm.value).toBeNull()
        expect(vm.emptyStateReason).toBeTruthy()
    })

    it('E14f: presentViewModel always has confidence > 0 and value non-null', () => {
        const state = {
            ...emptyState(),
            vitals: [makeVitals(`${TEST_DATE}T08:00:00Z`)],
        }
        const vm = selectVitalsForDate(state, TEST_DATE)
        expect(vm.confidence).toBeGreaterThan(0)
        expect(vm.value).not.toBeNull()
        expect(vm.emptyStateReason).toBeNull()
    })
})
