import { useMemo } from 'react'
import { useHealthStore, computeSynthesis, computeTrendReportSelector } from '../lib/store'
import { localDateString } from '../lib/healthkit'
import { hasValidBioAge, hasValidPace } from '../lib/utils/longevity-guards'
import { safeBiologicalAge, safePaceOfAging } from '../lib/utils/display-helpers'
import type {
    VitalsRecord,
    SleepRecord,
    ActivityRecord,
    DailyScores,
    MobilityRecord,
    EnvironmentalRecord,
    CardioMetabolicRecord,
    RunningDynamics,
    SynthesisOutput,
    TrendReport,
    CnsStressScore,
    InjuryRisk,
} from '../lib/types'

export interface SelectedDateHealthState {
    // ── Date metadata ──────────────────────────────────────────────
    dateStr: string
    selectedDateObj: Date
    isToday: boolean
    displayDate: string
    fullDateStr: string
    dayOfWeek: string

    // ── Selected-date scoped data ──────────────────────────────────
    currentScores: DailyScores | null
    currentVitals: VitalsRecord | null
    currentSleep: SleepRecord | null
    currentActivities: ActivityRecord[]
    currentDynamics: RunningDynamics | null
    currentMobility: MobilityRecord | null
    currentEnvironmental: EnvironmentalRecord | null
    currentCardio: CardioMetabolicRecord | null

    // ── Derived biometrics ─────────────────────────────────────────
    chronologicalAge: number
    isAgeConfigured: boolean
    displayBioAge: { value: number; isStale: boolean } | null
    displayPace: number | null
    rhrBaseline: number

    // ── Longevity fallback detection ───────────────────────────────
    isLongevityFallback: boolean
    biologicalAge: number | null
    paceOfAging: number | null
    bioAgeFromScores: number | null
    paceFromScores: number | null

    // ── Synthesis & trend ──────────────────────────────────────────
    synthesis: SynthesisOutput | null
    trendReport: TrendReport | null

    // ── Canonical risk scores (derived from synthesis) ──────────────
    injuryRisk: InjuryRisk | null
    cnsStressScore: CnsStressScore | null

    // ── Convenience ────────────────────────────────────────────────
    shiftDate: (days: number) => void
}

/**
 * Single selected-date selector hook.
 *
 * Derives ALL date-scoped biometric state once from `selectedDate` in the
 * Zustand store.  Home, Health, and Coach tabs now consume this hook instead
 * of independently re-deriving the same fields.
 *
 * Risk scores (`cnsStressScore`, `injuryRisk`) are derived from the canonical
 * `synthesis` object (which includes fallback computation), falling back to
 * the raw store value only when synthesis is null.
 */
export function useSelectedDateHealthState(): SelectedDateHealthState {
    const state = useHealthStore()
    const {
        selectedDate,
        setSelectedDate,
        scores,
        vitals,
        sleep,
        activities,
        runningDynamics,
        mobility,
        environmental,
        cardioMetabolic,
        profileAge,
        injuryRisk,
        cnsStressScore,
    } = state

    // ── Date helpers ───────────────────────────────────────────────
    const selectedDateObj = useMemo(
        () => new Date(selectedDate + 'T00:00:00'),
        [selectedDate],
    )
    const dateStr = localDateString(selectedDateObj)
    const isToday = localDateString(new Date()) === dateStr
    const displayDate = isToday
        ? 'Today'
        : selectedDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const fullDateStr = selectedDateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
    const dayOfWeek = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' })

    // ── Selected-date data lookups ────────────────────────────────
    const currentScores = useMemo(
        () => scores.find(s => s.date === dateStr) ?? null,
        [scores, dateStr],
    )
    const currentVitals = useMemo(
        () => vitals.find(v => v.timestamp.startsWith(dateStr)) ?? null,
        [vitals, dateStr],
    )
    const currentSleep = useMemo(
        () => sleep.find(s => s.date === dateStr) ?? null,
        [sleep, dateStr],
    )
    const currentActivities = useMemo(
        () => activities.filter(a => a.timestamp.startsWith(dateStr)),
        [activities, dateStr],
    )
    const currentDynamics = useMemo(
        () => runningDynamics.find(r => r.timestamp.startsWith(dateStr)) ?? null,
        [runningDynamics, dateStr],
    )
    const currentMobility = useMemo(
        () => mobility.find(m => m.date === dateStr) ?? null,
        [mobility, dateStr],
    )
    const currentEnvironmental = useMemo(
        () => environmental.find(e => e.date === dateStr) ?? null,
        [environmental, dateStr],
    )
    const currentCardio = useMemo(
        () => cardioMetabolic.find(c => c.date === dateStr) ?? null,
        [cardioMetabolic, dateStr],
    )

    // ── Derived biometrics ─────────────────────────────────────────
    const chronologicalAge = profileAge ?? 25
    const isAgeConfigured = profileAge != null

    const displayPace = useMemo(() => {
        const pace = currentScores?.paceOfAging
        if (hasValidPace(pace, currentScores?.bioAgeConfidence)) return pace!
        return null
    }, [currentScores])

    const displayBioAge = useMemo(() => {
        // Prefer displayAge (integer for UI); fall back to biologicalAge for backwards compat
        const bioAge = currentScores?.displayAge ?? currentScores?.biologicalAge
        const chronoAge = profileAge ?? 25
        if (hasValidBioAge(bioAge, chronoAge, currentScores?.bioAgeConfidence)) {
            return { value: Math.round(bioAge!), isStale: false }
        }
        return null
    }, [currentScores, profileAge])

    // ── Longevity fallback detection ───────────────────────────────
    const bioAgeFromScores = safeBiologicalAge(currentScores?.biologicalAge, chronologicalAge)
    const paceFromScores = safePaceOfAging(currentScores?.paceOfAging)
    const confidenceHome = currentScores?.bioAgeConfidence
    const isLongevityFallback =
        bioAgeFromScores == null ||
        paceFromScores == null ||
        (confidenceHome != null && confidenceHome <= 0) ||
        (bioAgeFromScores === chronologicalAge && (confidenceHome == null || confidenceHome < 0.3))
    const biologicalAge = isLongevityFallback ? null : (bioAgeFromScores ?? chronologicalAge)
    const paceOfAging = isLongevityFallback ? null : (paceFromScores ?? 1.0)

    // ── RHR baseline (across all vitals, not date-scoped) ──────────
    const rhrBaseline = useMemo(() => {
        const rhrValues = vitals.filter(v => v.rhr > 0).map(v => v.rhr)
        return rhrValues.length > 0
            ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length
            : 0
    }, [vitals])

    // ── Synthesis & trend (one derivation for all consumers) ───────
    const synthesis = useMemo(
        () => computeSynthesis(useHealthStore.getState(), dateStr),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            dateStr, scores, vitals, sleep, mobility, environmental,
            cardioMetabolic, runningDynamics, injuryRisk, cnsStressScore,
        ],
    )

    const trendReport = useMemo(
        () => computeTrendReportSelector(useHealthStore.getState()),
        [vitals, sleep, activities, scores, mobility, environmental, cardioMetabolic],
    )

    // ── Canonical risk scores (synthesis-derived, fallback to raw store) ──
    const canonicalCnsStress = useMemo(
        () => synthesis?.cnsStressScore ?? cnsStressScore,
        [synthesis, cnsStressScore],
    )
    const canonicalInjuryRisk = useMemo(
        () => synthesis?.injuryRisk ?? injuryRisk,
        [synthesis, injuryRisk],
    )

    // ── Date navigation ────────────────────────────────────────────
    const shiftDate = (days: number) => {
        const nextDate = new Date(selectedDateObj)
        nextDate.setDate(nextDate.getDate() + days)
        setSelectedDate(localDateString(nextDate))
    }

    return {
        dateStr,
        selectedDateObj,
        isToday,
        displayDate,
        fullDateStr,
        dayOfWeek,

        currentScores,
        currentVitals,
        currentSleep,
        currentActivities,
        currentDynamics,
        currentMobility,
        currentEnvironmental,
        currentCardio,

        chronologicalAge,
        isAgeConfigured,
        displayBioAge,
        displayPace,
        rhrBaseline,

        isLongevityFallback,
        biologicalAge,
        paceOfAging,
        bioAgeFromScores,
        paceFromScores,

        synthesis,
        trendReport,
        injuryRisk: canonicalInjuryRisk,
        cnsStressScore: canonicalCnsStress,

        shiftDate,
    }
}
