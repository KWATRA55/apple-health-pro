// ── Phase H: "Why Am I Seeing This?" Inspector Hook ─────────────────────────
// Traces any displayed HealthMetricViewModel back to its data sources,
// providing a full provenance chain for developer debugging.

import { useCallback, useState } from 'react'
import type { HealthMetricViewModel } from '../lib/types'
import { getRawSamplesForDate } from '../lib/services/data-inspector'

export function useDataProvenance() {
    const [isLoading, setIsLoading] = useState(false)
    const [provenanceDetail, setProvenanceDetail] = useState<any>(null)

    const traceMetric = useCallback(async (vm: HealthMetricViewModel<any>) => {
        setIsLoading(true)
        try {
            // For any HealthMetricViewModel, trace its provenance
            const detail = {
                selector: vm.scope,
                scope: vm.scope,
                effectiveDate: vm.effectiveDate,
                confidence: vm.confidence,
                provenance: vm.provenanceSummary,
                sourceKind: vm.sourceKind,
                status: vm.status,
                emptyStateReason: vm.emptyStateReason,
                dateWindow: vm.dateWindow,
                algorithmVersion: vm.algorithmVersion,
                inputCoverage: vm.inputCoverage,
                // Fetch raw samples for the effective date as additional context
                rawSamples: vm.effectiveDate ? await getRawSamplesForDate(vm.effectiveDate) : [],
            }
            setProvenanceDetail(detail)
            return detail
        } finally {
            setIsLoading(false)
        }
    }, [])

    return { traceMetric, provenanceDetail, isLoading }
}
