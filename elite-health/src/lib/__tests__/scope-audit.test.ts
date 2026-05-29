/**
 * Scope Audit Test Suite
 *
 * Validates that canonical selectors respect scope boundaries:
 *  - selectedDate selectors return ONLY data for the requested date
 *  - latest selectors return the most recent data regardless of selectedDate
 *  - No silent cross-scope fallback
 *  - Empty stores produce emptyViewModel with proper emptyStateReason
 */

import {
    selectScoresForDate,
    selectLatestScores,
    selectBiologicalAgeForDate,
    selectLatestBiologicalAge,
    selectRecoveryScoreForDate,
    selectLatestRecoveryScore,
    selectSleepDebtForDate,
    selectLatestSleepDebt,
    selectStrainScoreForDate,
    selectLatestStrainScore,
    selectVitalsForDate,
    selectLatestVitals,
} from '../canonical-selectors'
import type { DailyScores, VitalsRecord } from '../types'

// ── Local HealthStoreState ──

interface HealthStoreState {
    vitals: VitalsRecord[]
    sleep: any[]
    scores: DailyScores[]
    activities: any[]
    mobility: any[]
    environmental: any[]
    cardioMetabolic: any[]
    runningDynamics: any[]
    weightHistory: any[]
    selectedDate: string
}

function emptyState(selectedDate = '2026-03-15'): HealthStoreState {
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
        selectedDate,
    }
}

function makeScores(date: string, overrides: Partial<DailyScores> = {}): DailyScores {
    return {
        date,
        recoveryScore: overrides.recoveryScore ?? 80,
        strainScore: overrides.strainScore ?? 5,
        sleepDebtHours: overrides.sleepDebtHours ?? 0,
        sleepNeedHours: overrides.sleepNeedHours ?? 8,
        hrvZScore: overrides.hrvZScore ?? 0.8,
        rhrZScore: overrides.rhrZScore ?? -0.2,
        recoveryZone: overrides.recoveryZone ?? 'green',
        displayAge: overrides.displayAge ?? 28,
        rawAge: overrides.rawAge ?? 28.3,
        biologicalAge: overrides.biologicalAge ?? 28,
        paceOfAging: overrides.paceOfAging ?? 0.95,
        immunityRisk: overrides.immunityRisk ?? 'LOW',
        bioAgeConfidence: overrides.bioAgeConfidence ?? 0.8,
        bioAgeInputsUsed: overrides.bioAgeInputsUsed ?? ['HRV', 'RHR', 'SpO₂'],
        bioAgeInputsMissing: overrides.bioAgeInputsMissing ?? ['VO₂ Max', 'Sleep quality'],
        bioAgePrimaryDriver: overrides.bioAgePrimaryDriver ?? 'HRV ↑',
        ...overrides,
    } as DailyScores
}

// ═══════════════════════════════════════════════════════════════════════════
// I. SCOPE AUDIT — Selected Date vs Latest
// ═══════════════════════════════════════════════════════════════════════════

describe('Scope Audit — selectedDate vs latest', () => {
    // ── I1: Scores selectedDate ────────────────────────────────────────────

    describe('I1: Scores — selectedDate selectors only return data for requested date', () => {
        it('I1a: selectScoresForDate returns missing when selectedDate has no data (even if other dates exist)', () => {
            const state = {
                ...emptyState('2026-03-15'),
                scores: [
                    makeScores('2026-03-14', { recoveryScore: 75 }),
                    makeScores('2026-03-13', { recoveryScore: 70 }),
                ],
            }
            const vm = selectScoresForDate(state, '2026-03-15')
            expect(vm.status).toBe('missing')
            expect(vm.scope).toBe('selectedDate')
            expect(vm.effectiveDate).toBe('2026-03-15')
            expect(vm.value).toBeNull()
        })

        it('I1b: selectScoresForDate returns present when selectedDate matches exactly', () => {
            const state = {
                ...emptyState('2026-03-15'),
                scores: [
                    makeScores('2026-03-14', { recoveryScore: 75 }),
                    makeScores('2026-03-15', { recoveryScore: 85 }),
                ],
            }
            const vm = selectScoresForDate(state, '2026-03-15')
            expect(vm.status).toBe('present')
            expect(vm.value?.recoveryScore).toBe(85)
        })

        it('I1c: selectLatestScores returns latest regardless of selectedDate', () => {
            const state = {
                ...emptyState('2026-03-10'), // selectedDate is old
                scores: [
                    makeScores('2026-03-10', { recoveryScore: 60 }),
                    makeScores('2026-03-14', { recoveryScore: 75 }),
                    makeScores('2026-03-15', { recoveryScore: 90 }),
                ],
            }
            const vm = selectLatestScores(state)
            expect(vm.status).toBe('present')
            expect(vm.scope).toBe('latest')
            expect(vm.value?.date).toBe('2026-03-15')
            expect(vm.value?.recoveryScore).toBe(90)
        })
    })

    // ── I2: Biological Age scope ──────────────────────────────────────────

    describe('I2: Biological Age — scope integrity', () => {
        it('I2a: selectBiologicalAgeForDate does NOT silently use latest when selectedDate is missing', () => {
            const state = {
                ...emptyState('2026-03-15'),
                scores: [
                    makeScores('2026-03-14', { displayAge: 30, bioAgeConfidence: 0.8 }),
                ],
            }
            const vm = selectBiologicalAgeForDate(state, '2026-03-15')
            expect(vm.status).toBe('missing')
            expect(vm.scope).toBe('selectedDate')
        })

        it('I2b: selectLatestBiologicalAge returns latest even when selectedDate is different', () => {
            const state = {
                ...emptyState('2026-03-10'),
                scores: [
                    makeScores('2026-03-10', { displayAge: 32, bioAgeConfidence: 0.7 }),
                    makeScores('2026-03-14', { displayAge: 28, bioAgeConfidence: 0.85 }),
                ],
            }
            const vm = selectLatestBiologicalAge(state)
            expect(vm.status).toBe('present')
            expect(vm.scope).toBe('latest')
            expect(vm.value?.displayAge).toBe(28)
        })
    })

    // ── I3: Recovery Score scope ──────────────────────────────────────────

    describe('I3: Recovery Score — scope integrity', () => {
        it('I3a: selectRecoveryScoreForDate returns only the selectedDate score', () => {
            const state = {
                ...emptyState('2026-03-15'),
                scores: [
                    makeScores('2026-03-13', { recoveryScore: 50, recoveryZone: 'red' }),
                    makeScores('2026-03-14', { recoveryScore: 70, recoveryZone: 'yellow' }),
                    makeScores('2026-03-15', { recoveryScore: 85, recoveryZone: 'green' }),
                ],
            }
            const vm = selectRecoveryScoreForDate(state, '2026-03-14')
            expect(vm.status).toBe('present')
            expect(vm.value?.score).toBe(70)
            expect(vm.value?.zone).toBe('yellow')
        })

        it('I3b: selectLatestRecoveryScore returns the most recent score', () => {
            const state = {
                ...emptyState('2026-03-13'),
                scores: [
                    makeScores('2026-03-13', { recoveryScore: 50 }),
                    makeScores('2026-03-15', { recoveryScore: 85 }),
                ],
            }
            const vm = selectLatestRecoveryScore(state)
            expect(vm.status).toBe('present')
            expect(vm.scope).toBe('latest')
            expect(vm.value?.score).toBe(85)
        })
    })

    // ── I4: Sleep Debt scope ─────────────────────────────────────────────

    describe('I4: Sleep Debt — scope integrity', () => {
        it('I4a: selectSleepDebtForDate returns only the selectedDate debt', () => {
            const state = {
                ...emptyState('2026-03-15'),
                scores: [
                    makeScores('2026-03-14', { sleepDebtHours: 3.0 }),
                    makeScores('2026-03-15', { sleepDebtHours: 1.5 }),
                ],
            }
            const vm = selectSleepDebtForDate(state, '2026-03-15')
            expect(vm.status).toBe('present')
            expect(vm.value?.debtHours).toBe(1.5)
        })

        it('I4b: selectLatestSleepDebt returns the most recent debt', () => {
            const state = {
                ...emptyState('2026-03-10'),
                scores: [
                    makeScores('2026-03-10', { sleepDebtHours: 0.5 }),
                    makeScores('2026-03-14', { sleepDebtHours: 2.0 }),
                ],
            }
            const vm = selectLatestSleepDebt(state)
            expect(vm.status).toBe('present')
            expect(vm.scope).toBe('latest')
            expect(vm.value?.debtHours).toBe(2.0)
        })
    })

    // ── I5: Strain Score scope ───────────────────────────────────────────

    describe('I5: Strain Score — scope integrity', () => {
        it('I5a: selectStrainScoreForDate returns only the selectedDate strain', () => {
            const state = {
                ...emptyState('2026-03-15'),
                scores: [
                    makeScores('2026-03-14', { strainScore: 8.0 }),
                    makeScores('2026-03-15', { strainScore: 12.0 }),
                ],
            }
            const vm = selectStrainScoreForDate(state, '2026-03-15')
            expect(vm.status).toBe('present')
            expect(vm.value).toBe(12.0)
        })

        it('I5b: selectLatestStrainScore returns the most recent strain', () => {
            const state = {
                ...emptyState('2026-03-13'),
                scores: [
                    makeScores('2026-03-13', { strainScore: 3.0 }),
                    makeScores('2026-03-15', { strainScore: 15.0 }),
                ],
            }
            const vm = selectLatestStrainScore(state)
            expect(vm.status).toBe('present')
            expect(vm.scope).toBe('latest')
            expect(vm.value).toBe(15.0)
        })
    })

    // ── I6: Vitals scope ─────────────────────────────────────────────────

    describe('I6: Vitals — scope integrity', () => {
        it('I6a: selectVitalsForDate returns only the selectedDate vitals', () => {
            const state = {
                ...emptyState('2026-03-15'),
                vitals: [
                    { id: 1, timestamp: '2026-03-14T08:00:00Z', hrv: 50, rhr: 60, spo2: 98, skinTempDelta: 0, respiratoryRate: 14 },
                    { id: 2, timestamp: '2026-03-15T08:00:00Z', hrv: 55, rhr: 58, spo2: 97, skinTempDelta: 0.1, respiratoryRate: 14 },
                ],
            }
            const vm = selectVitalsForDate(state, '2026-03-15')
            expect(vm.status).toBe('present')
            expect(vm.value?.hrv).toBe(55)
        })

        it('I6b: selectLatestVitals returns the most recent vitals', () => {
            const state = {
                ...emptyState('2026-03-10'),
                vitals: [
                    { id: 1, timestamp: '2026-03-10T08:00:00Z', hrv: 45, rhr: 62, spo2: 96, skinTempDelta: 0, respiratoryRate: 15 },
                    { id: 2, timestamp: '2026-03-15T08:00:00Z', hrv: 60, rhr: 55, spo2: 99, skinTempDelta: 0, respiratoryRate: 13 },
                ],
            }
            const vm = selectLatestVitals(state)
            expect(vm.status).toBe('present')
            expect(vm.scope).toBe('latest')
            expect(vm.value?.hrv).toBe(60)
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// I7. SCOPE BUG REPRODUCTIONS — Verify Old Bugs Are Fixed
// ═══════════════════════════════════════════════════════════════════════════

describe('Scope Bug Reproductions', () => {
    // Bug B3: Biological Age Scope Mismatch — was using latest instead of selectedDate
    it('I7a: B3 FIX — Biological Age for selectedDate does NOT return latest data', () => {
        // Simulate: user navigates to a past date, but biological age showed latest
        const state = {
            ...emptyState('2026-03-10'), // User selected March 10
            scores: [
                makeScores('2026-03-10', { displayAge: 32, bioAgeConfidence: 0.7 }), // Past date
                makeScores('2026-03-15', { displayAge: 28, bioAgeConfidence: 0.85 }), // Latest
            ],
        }
        // For selectedDate scope, should return March 10 data, not March 15
        const vm = selectBiologicalAgeForDate(state, '2026-03-10')
        expect(vm.status).toBe('present')
        expect(vm.value?.displayAge).toBe(32)
        expect(vm.scope).toBe('selectedDate')
    })

    // Bug B4: ExportTools Bypasses Provenance — verify selectors provide provenance
    it('I7b: Selectors provide provenanceSummary on present view models', () => {
        const state = {
            ...emptyState('2026-03-15'),
            scores: [makeScores('2026-03-15')],
        }
        const vm = selectScoresForDate(state, '2026-03-15')
        expect(vm.status).toBe('present')
        expect(vm.provenanceSummary).toBeTruthy()
        expect(typeof vm.provenanceSummary).toBe('string')
        expect(vm.provenanceSummary.length).toBeGreaterThan(0)
    })

    // Bug B10: Recency Fallback — selectors must not silently expand scope
    it('I7c: B10 FIX — Missing selectedDate data shows empty state, not recency fallback', () => {
        const state = {
            ...emptyState('2026-03-15'),
            scores: [
                makeScores('2026-03-10', { recoveryScore: 60 }), // Only older data
                makeScores('2026-03-05', { recoveryScore: 50 }),
            ],
        }
        const vm = selectRecoveryScoreForDate(state, '2026-03-15')
        // Must NOT fall back silently to March 10
        expect(vm.status).toBe('missing')
        expect(vm.scope).toBe('selectedDate')
        expect(vm.emptyStateReason).toBeTruthy()
    })
})
