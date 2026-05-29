// ── Phase H: Debug / Data Quality Inspector Screen ──────────────────────────
// Developer-accessible debug screen for forensic inspection of the health data
// pipeline. Provides tabs for quality summary, sync runs, raw data browsing,
// orphaned records, duplicate detection, and safe database reset.

import { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View, TextInput, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import {
    getDataQualitySummary,
    getSyncRuns,
    getRawSamplesForDate,
    getNormalizedRecordsForDate,
    getDerivedOutputsForDate,
    getOrphanedRecords,
    getDuplicateRecords,
} from '../../src/lib/services/data-inspector'
import { localDateString } from '../../src/lib/healthkit'
import {
    getResetSummary,
    safeResetAndRecompute,
    type ResetSummary,
    type ResetResult,
} from '../../src/lib/services/db-reset'

type Tab = 'quality' | 'sync' | 'raw' | 'orphaned' | 'duplicates' | 'reset'

export default function DebugScreen() {
    const [activeTab, setActiveTab] = useState<Tab>('quality')
    const [qualityData, setQualityData] = useState<any>(null)
    const [syncRuns, setSyncRuns] = useState<any[]>([])
    const [expandedSyncRun, setExpandedSyncRun] = useState<number | null>(null)
    const [rawDate, setRawDate] = useState(localDateString())
    const [rawSamples, setRawSamples] = useState<any[]>([])
    const [normalizedRecords, setNormalizedRecords] = useState<any>(null)
    const [derivedOutputs, setDerivedOutputs] = useState<any[]>([])
    const [orphanedData, setOrphanedData] = useState<any[]>([])
    const [duplicateData, setDuplicateData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // ── Reset tab state ──────────────────────────────────────────────────────
    const [resetSummary, setResetSummary] = useState<ResetSummary | null>(null)
    const [resetResult, setResetResult] = useState<ResetResult | null>(null)
    const [resetPhase, setResetPhase] = useState<string>('')
    const [resetDetail, setResetDetail] = useState<string>('')
    const [hardConfirmStep, setHardConfirmStep] = useState<number>(0)

    useEffect(() => {
        loadData()
    }, [activeTab])

    async function loadData() {
        setLoading(true)
        try {
            switch (activeTab) {
                case 'quality':
                    setQualityData(await getDataQualitySummary())
                    break
                case 'sync':
                    setSyncRuns(await getSyncRuns(undefined, 50))
                    break
                case 'raw':
                    loadRawDate()
                    break
                case 'orphaned':
                    setOrphanedData(await getOrphanedRecords())
                    break
                case 'duplicates':
                    setDuplicateData(await getDuplicateRecords())
                    break
                case 'reset':
                    setResetSummary(await getResetSummary())
                    break
            }
        } catch (e) {
            console.error('[Debug] loadData error:', e)
        } finally {
            setLoading(false)
        }
    }

    async function loadRawDate() {
        try {
            const [samples, norm, derived] = await Promise.all([
                getRawSamplesForDate(rawDate),
                getNormalizedRecordsForDate(rawDate),
                getDerivedOutputsForDate(rawDate),
            ])
            setRawSamples(samples)
            setNormalizedRecords(norm)
            setDerivedOutputs(derived)
        } catch (e) {
            console.error('[Debug] loadRawDate error:', e)
        }
    }

    // ── Reset handlers ───────────────────────────────────────────────────────

    async function handleSoftReset() {
        Alert.alert(
            'Soft Reset — Clear Derived Data',
            'This will:\n• Backup the database\n• Clear daily_scores & derived_outputs\n• Recompute all scores from raw data\n\nRaw tables (vitals, sleep, activities, etc.) will NOT be touched.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Proceed',
                    style: 'destructive',
                    onPress: async () => {
                        setResetPhase('')
                        setResetDetail('')
                        setResetResult(null)
                        setLoading(true)
                        try {
                            const result = await safeResetAndRecompute({
                                hard: false,
                                onProgress: (phase, detail) => {
                                    setResetPhase(phase)
                                    setResetDetail(detail ?? '')
                                },
                            })
                            setResetResult(result)
                            setResetSummary(await getResetSummary())
                        } catch (e) {
                            console.error('[Debug] soft reset error:', e)
                        } finally {
                            setLoading(false)
                        }
                    },
                },
            ]
        )
    }

    async function handleHardReset() {
        if (hardConfirmStep === 0) {
            setHardConfirmStep(1)
            Alert.alert(
                '⚠️ HARD RESET — Step 1 of 2',
                'This will clear ALL tables:\n• Raw data (vitals, sleep, activities, etc.)\n• Sync runs & metadata\n• Provenance logs\n• Derived scores & outputs\n\nA backup will be made first.\n\nThis is IRREVERSIBLE for data not re-synced from HealthKit.',
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => setHardConfirmStep(0) },
                    {
                        text: 'I understand — Continue',
                        style: 'destructive',
                        onPress: () => {
                            setHardConfirmStep(2)
                            Alert.alert(
                                '⚠️⚠️ HARD RESET — FINAL CONFIRMATION',
                                'This is your last chance to cancel.\n\nAfter this, the database will be wiped clean and you will need to re-sync from HealthKit.',
                                [
                                    { text: 'Cancel', style: 'cancel', onPress: () => setHardConfirmStep(0) },
                                    {
                                        text: 'DO IT — Wipe Everything',
                                        style: 'destructive',
                                        onPress: executeHardReset,
                                    },
                                ]
                            )
                        },
                    },
                ]
            )
        }
    }

    async function executeHardReset() {
        setHardConfirmStep(0)
        setResetPhase('')
        setResetDetail('')
        setResetResult(null)
        setLoading(true)
        try {
            const result = await safeResetAndRecompute({
                hard: true,
                onProgress: (phase, detail) => {
                    setResetPhase(phase)
                    setResetDetail(detail ?? '')
                },
            })
            setResetResult(result)
            setResetSummary(await getResetSummary())
        } catch (e) {
            console.error('[Debug] hard reset error:', e)
        } finally {
            setLoading(false)
        }
    }

    const tabs: Tab[] = ['quality', 'sync', 'raw', 'orphaned', 'duplicates', 'reset']

    return (
        <SafeAreaView style={ss.container}>
            <Stack.Screen options={{ title: 'Debug / Data Inspector', headerShown: true }} />

            {/* Tab Bar */}
            <ScrollView horizontal style={ss.tabBar} showsHorizontalScrollIndicator={false}>
                {tabs.map(tab => (
                    <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[ss.tab, activeTab === tab && ss.tabActive]}>
                        <Text style={[ss.tabText, activeTab === tab && ss.tabTextActive]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {loading && <Text style={ss.loading}>Loading...</Text>}

            <ScrollView style={ss.content} contentContainerStyle={ss.contentInner}>
                {activeTab === 'quality' && qualityData && <QualityTab data={qualityData} />}
                {activeTab === 'sync' && <SyncRunsTab runs={syncRuns} expanded={expandedSyncRun} onToggle={setExpandedSyncRun} />}
                {activeTab === 'raw' && (
                    <RawDataTab
                        date={rawDate}
                        onDateChange={setRawDate}
                        onRefresh={loadRawDate}
                        rawSamples={rawSamples}
                        normalized={normalizedRecords}
                        derived={derivedOutputs}
                    />
                )}
                {activeTab === 'orphaned' && <OrphanedTab data={orphanedData} />}
                {activeTab === 'duplicates' && <DuplicatesTab data={duplicateData} />}
                {activeTab === 'reset' && (
                    <ResetTab
                        summary={resetSummary}
                        result={resetResult}
                        phase={resetPhase}
                        detail={resetDetail}
                        hardConfirmStep={hardConfirmStep}
                        onSoftReset={handleSoftReset}
                        onHardReset={handleHardReset}
                        onRefresh={() => {
                            setResetResult(null)
                            loadData()
                        }}
                    />
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

// ── Quality Tab ───────────────────────────────────────────────────────────────

function QualityTab({ data }: { data: any }) {
    if (!data) return <Text style={ss.empty}>No quality data available.</Text>

    const provPct = data.provenance.totalRecords > 0
        ? ((data.provenance.recordsWithProvenance / data.provenance.totalRecords) * 100).toFixed(1)
        : '0.0'

    return (
        <View>
            <Text style={ss.sectionTitle}>📊 Data Quality Summary</Text>

            <Text style={ss.subTitle}>Raw Samples</Text>
            <Text style={ss.row}>Total: {data.rawSamples.total}</Text>
            {Object.entries(data.rawSamples.byDomain as Record<string, number>).map(([domain, count]) => (
                <Text key={domain} style={ss.row}>  {domain}: {count}</Text>
            ))}

            <Text style={ss.subTitle}>Normalized Records</Text>
            <Text style={ss.row}>Vitals: {data.normalized.vitals}</Text>
            <Text style={ss.row}>Sleep: {data.normalized.sleep}</Text>
            <Text style={ss.row}>Scores: {data.normalized.scores}</Text>
            <Text style={ss.row}>Activities: {data.normalized.activities}</Text>
            <Text style={ss.row}>Mobility: {data.normalized.mobility}</Text>
            <Text style={ss.row}>Environmental: {data.normalized.environmental}</Text>
            <Text style={ss.row}>Cardio Metabolic: {data.normalized.cardioMetabolic}</Text>
            <Text style={ss.row}>Running Dynamics: {data.normalized.runningDynamics}</Text>
            <Text style={ss.row}>Weight: {data.normalized.weight}</Text>

            <Text style={ss.subTitle}>Derived Outputs</Text>
            <Text style={ss.row}>Total: {data.derived.total}</Text>
            {Object.entries(data.derived.byType as Record<string, number>).map(([type, count]) => (
                <Text key={type} style={ss.row}>  {type}: {count}</Text>
            ))}

            <Text style={ss.subTitle}>Sync Runs</Text>
            <Text style={ss.row}>Total: {data.syncRuns.total}</Text>
            <Text style={ss.row}>Completed: {data.syncRuns.completed} | Failed: {data.syncRuns.failed} | Partial: {data.syncRuns.partial}</Text>

            <Text style={ss.subTitle}>Provenance Coverage</Text>
            <Text style={ss.row}>With provenance: {data.provenance.recordsWithProvenance}</Text>
            <Text style={ss.row}>Without provenance: {data.provenance.recordsWithoutProvenance}</Text>
            <Text style={ss.row}>Total records: {data.provenance.totalRecords}</Text>
            <Text style={[ss.row, { fontWeight: '700' }]}>Coverage: {provPct}%</Text>

            <Text style={ss.subTitle}>Sync Coverage</Text>
            <Text style={ss.row}>Earliest date: {data.syncCoverage.earliestDate}</Text>
            <Text style={ss.row}>Latest date: {data.syncCoverage.latestDate}</Text>
            <Text style={ss.row}>Days with data: {data.syncCoverage.totalDays}</Text>

            {data.duplicates.length > 0 && (
                <>
                    <Text style={ss.subTitle}>Duplicates Detected</Text>
                    {data.duplicates.map((d: { table: string; count: number }) => (
                        <Text key={d.table} style={ss.row}>{d.table}: {d.count} duplicates</Text>
                    ))}
                </>
            )}
        </View>
    )
}

// ── Sync Runs Tab ─────────────────────────────────────────────────────────────

function SyncRunsTab({
    runs,
    expanded,
    onToggle,
}: {
    runs: any[]
    expanded: number | null
    onToggle: (id: number | null) => void
}) {
    if (runs.length === 0) return <Text style={ss.empty}>No sync runs found.</Text>

    return (
        <View>
            <Text style={ss.sectionTitle}>🔄 Sync Runs ({runs.length})</Text>
            {runs.map(run => (
                <TouchableOpacity
                    key={run.id}
                    style={ss.card}
                    onPress={() => onToggle(expanded === run.id ? null : run.id)}
                    activeOpacity={0.7}
                >
                    <View style={ss.cardHeader}>
                        <Text style={ss.cardTitle}>Run #{run.id}</Text>
                        <Text style={[ss.badge, statusBadgeStyle(run.status)]}>{run.status}</Text>
                    </View>
                    <Text style={ss.row}>Started: {run.started_at}</Text>
                    {run.completed_at && <Text style={ss.row}>Completed: {run.completed_at}</Text>}
                    <Text style={ss.row}>
                        Window: {run.date_window_start ?? 'N/A'} → {run.date_window_end ?? 'N/A'}
                    </Text>

                    {expanded === run.id && (
                        <View style={ss.expanded}>
                            <Text style={ss.row}>Total returned: {run.total_samples_returned}</Text>
                            <Text style={ss.row}>Inserted: {run.inserted_count} | Deduped: {run.deduped_count}</Text>
                            <Text style={ss.row}>Updated: {run.updated_count} | Deleted: {run.deleted_count}</Text>
                            <Text style={ss.row}>Errors: {run.error_count}</Text>
                            <Text style={ss.row}>Permission: {run.permission_state ?? 'N/A'}</Text>
                            {run.parsing_errors_json && (
                                <Text style={ss.row}>Parse errors: {run.parsing_errors_json}</Text>
                            )}
                            {run.recomputations_triggered && (
                                <Text style={ss.row}>Recomputations: {run.recomputations_triggered}</Text>
                            )}
                            {run.notes && <Text style={ss.row}>Notes: {run.notes}</Text>}
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    )
}

function statusBadgeStyle(status: string) {
    switch (status) {
        case 'completed': return { color: '#22c55e' }
        case 'failed': return { color: '#ef4444' }
        case 'partial': return { color: '#f59e0b' }
        default: return { color: '#94a3b8' }
    }
}

// ── Raw Data Tab ──────────────────────────────────────────────────────────────

function RawDataTab({
    date,
    onDateChange,
    onRefresh,
    rawSamples,
    normalized,
    derived,
}: {
    date: string
    onDateChange: (d: string) => void
    onRefresh: () => void
    rawSamples: any[]
    normalized: any
    derived: any[]
}) {
    return (
        <View>
            <Text style={ss.sectionTitle}>🔍 Raw Data Browser</Text>

            <View style={ss.dateRow}>
                <TextInput
                    style={ss.dateInput}
                    value={date}
                    onChangeText={onDateChange}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748b"
                />
                <TouchableOpacity style={ss.refreshBtn} onPress={onRefresh}>
                    <Text style={ss.refreshBtnText}>Load</Text>
                </TouchableOpacity>
            </View>

            {/* Raw Samples */}
            <Text style={ss.subTitle}>Raw Health Samples ({rawSamples.length})</Text>
            {rawSamples.length === 0 ? (
                <Text style={ss.empty}>No raw samples for this date.</Text>
            ) : (
                rawSamples.map(s => (
                    <View key={s.id} style={ss.sampleRow}>
                        <Text style={ss.sampleText}>
                            [{s.domain}] {s.metric_name}: {s.value ?? 'null'} {s.unit ?? ''}
                        </Text>
                        <Text style={ss.sampleMeta}>
                            src: {s.source_type} | status: {s.status} | sync_run: {s.sync_run_id ?? 'N/A'}
                        </Text>
                    </View>
                ))
            )}

            {/* Normalized Records */}
            {normalized && (
                <>
                    <Text style={ss.subTitle}>Normalized Records</Text>
                    {Object.entries(normalized).map(([key, val]) => {
                        if (val === null) return null
                        if (Array.isArray(val) && val.length === 0) return null
                        return (
                            <View key={key} style={ss.sampleRow}>
                                <Text style={ss.sampleText}>{key}:</Text>
                                <Text style={ss.sampleMeta}>{truncate(JSON.stringify(val), 300)}</Text>
                            </View>
                        )
                    })}
                </>
            )}

            {/* Derived Outputs */}
            <Text style={ss.subTitle}>Derived Outputs ({derived.length})</Text>
            {derived.length === 0 ? (
                <Text style={ss.empty}>No derived outputs for this date.</Text>
            ) : (
                derived.map(d => (
                    <View key={d.id} style={ss.sampleRow}>
                        <Text style={ss.sampleText}>
                            [{d.output_type}] {d.algorithm_name} v{d.algorithm_version}
                        </Text>
                        <Text style={ss.sampleMeta}>
                            status: {d.status} | confidence: {d.confidence ?? 'N/A'} | sync_run: {d.sync_run_id ?? 'N/A'}
                        </Text>
                    </View>
                ))
            )}
        </View>
    )
}

// ── Orphaned Records Tab ──────────────────────────────────────────────────────

function OrphanedTab({ data }: { data: any[] }) {
    if (data.length === 0) return <Text style={ss.empty}>No orphaned records found.</Text>

    return (
        <View>
            <Text style={ss.sectionTitle}>👻 Orphaned Records (Missing Provenance)</Text>
            {data.map(table => (
                <View key={table.table} style={ss.card}>
                    <Text style={ss.cardTitle}>
                        {table.table}: {table.count} orphaned
                    </Text>
                    {table.records.slice(0, 5).map((r: any, i: number) => (
                        <View key={i} style={ss.sampleRow}>
                            <Text style={ss.sampleMeta}>{truncate(JSON.stringify(r), 200)}</Text>
                        </View>
                    ))}
                    {table.count > 5 && (
                        <Text style={ss.row}>... and {table.count - 5} more</Text>
                    )}
                </View>
            ))}
        </View>
    )
}

// ── Duplicates Tab ────────────────────────────────────────────────────────────

function DuplicatesTab({ data }: { data: any[] }) {
    const hasDupes = data.some((t: any) => t.count > 0)
    if (!hasDupes) return <Text style={ss.empty}>No duplicate records found.</Text>

    return (
        <View>
            <Text style={ss.sectionTitle}>📋 Potential Duplicates</Text>
            {data.filter((t: any) => t.count > 0).map((table: any) => (
                <View key={table.table} style={ss.card}>
                    <Text style={ss.cardTitle}>
                        {table.table}: {table.count} duplicates
                    </Text>
                    {table.examples.slice(0, 5).map((r: any, i: number) => (
                        <View key={i} style={ss.sampleRow}>
                            <Text style={ss.sampleMeta}>{truncate(JSON.stringify(r), 200)}</Text>
                        </View>
                    ))}
                    {table.examples.length > 5 && (
                        <Text style={ss.row}>... and {table.examples.length - 5} more examples</Text>
                    )}
                </View>
            ))}
        </View>
    )
}

// ── Reset Tab ──────────────────────────────────────────────────────────────────

function ResetTab({
    summary,
    result,
    phase,
    detail,
    onSoftReset,
    onHardReset,
    onRefresh,
}: {
    summary: ResetSummary | null
    result: ResetResult | null
    phase: string
    detail: string
    hardConfirmStep: number
    onSoftReset: () => void
    onHardReset: () => void
    onRefresh: () => void
}) {
    return (
        <View>
            <Text style={ss.sectionTitle}>🔄 Database Reset & Recompute</Text>

            {/* ── Current State Summary ──────────────────────────────────── */}
            {summary && !result && (
                <View style={ss.card}>
                    <Text style={ss.cardTitle}>Current Database State</Text>
                    <Text style={ss.row}>Daily Scores: {summary.totalDailyScores}</Text>
                    <Text style={ss.row}>Derived Outputs: {summary.totalDerivedOutputs}</Text>
                    <Text style={ss.row}>Distinct Dates with Data: {summary.distinctDatesWithData}</Text>
                    {summary.oldestDate && (
                        <Text style={ss.row}>Range: {summary.oldestDate} → {summary.newestDate}</Text>
                    )}
                    <Text style={[ss.subTitle, { marginTop: 10 }]}>Raw Table Counts</Text>
                    {Object.entries(summary.rawTableCounts).map(([table, count]) => (
                        <Text key={table} style={ss.row}>  {table}: {count}</Text>
                    ))}
                </View>
            )}

            {/* ── Progress ───────────────────────────────────────────────── */}
            {phase && (
                <View style={[ss.card, { backgroundColor: '#1a2a1a' }]}>
                    <Text style={[ss.cardTitle, { color: '#4ade80' }]}>
                        {phaseLabel(phase)}
                    </Text>
                    {detail ? <Text style={ss.row}>{detail}</Text> : null}
                </View>
            )}

            {/* ── Result Summary ─────────────────────────────────────────── */}
            {result && (
                <View style={[ss.card, result.success ? { backgroundColor: '#1a2a1a' } : { backgroundColor: '#2a1a1a' }]}>
                    <Text style={[ss.cardTitle, result.success ? { color: '#4ade80' } : { color: '#f87171' }]}>
                        {result.success ? '✓ Reset Complete' : '✗ Reset Completed with Errors'}
                    </Text>
                    {result.backupPath && <Text style={ss.row}>Backup: {result.backupPath}</Text>}
                    <Text style={ss.row}>Derived rows cleared: {result.clearedDerivedCount}</Text>
                    {result.clearedHardResetCount > 0 && (
                        <Text style={[ss.row, { color: '#f87171' }]}>Hard reset rows cleared: {result.clearedHardResetCount}</Text>
                    )}
                    <Text style={ss.row}>Dates recomputed: {result.totalDatesRecomputed}</Text>
                    {result.datesWithErrors.length > 0 && (
                        <Text style={[ss.row, { color: '#f87171' }]}>
                            Errors: {result.datesWithErrors.join(', ')}
                        </Text>
                    )}
                    {result.errors.length > 0 && (
                        <Text style={[ss.row, { color: '#f87171' }]}>
                            Fatal errors: {result.errors.join(', ')}
                        </Text>
                    )}

                    {/* Verification details */}
                    {result.verification && (
                        <>
                            <Text style={[ss.subTitle, { marginTop: 10 }]}>Verification</Text>
                            <Text style={ss.row}>
                                Before: {result.verification.beforeReset.dailyScores} scores, {result.verification.beforeReset.derivedOutputs} derived
                            </Text>
                            <Text style={ss.row}>
                                After: {result.verification.afterRecompute.dailyScores} scores, {result.verification.afterRecompute.derivedOutputs} derived
                            </Text>
                            <Text style={ss.row}>Dates with scores: {result.verification.afterRecompute.datesWithScores}</Text>
                            {result.verification.afterRecompute.datesMissingScores.length > 0 && (
                                <Text style={[ss.row, { color: '#f59e0b' }]}>
                                    Missing scores: {result.verification.afterRecompute.datesMissingScores.length} date(s)
                                </Text>
                            )}
                        </>
                    )}
                </View>
            )}

            {/* ── Action Buttons ─────────────────────────────────────────── */}
            <View style={{ marginTop: 16 }}>

                {/* Soft Reset */}
                <TouchableOpacity
                    style={[ss.actionBtn, { backgroundColor: '#2563eb' }]}
                    onPress={onSoftReset}
                    disabled={!!phase && phase !== 'complete'}
                >
                    <Text style={ss.actionBtnText}>Soft Reset</Text>
                </TouchableOpacity>
                <Text style={[ss.row, { marginBottom: 12, marginTop: 4 }]}>
                    Clear derived scores & recompute. Raw data is preserved.
                </Text>

                {/* Hard Reset */}
                <TouchableOpacity
                    style={[ss.actionBtn, { backgroundColor: '#dc2626' }]}
                    onPress={onHardReset}
                    disabled={!!phase && phase !== 'complete'}
                >
                    <Text style={ss.actionBtnText}>Hard Reset</Text>
                </TouchableOpacity>
                <Text style={[ss.row, { marginBottom: 12, marginTop: 4, color: '#f87171' }]}>
                    ⚠️ Clears ALL tables. Double-confirmation required. Backup made first.
                </Text>

                {/* Refresh Summary */}
                <TouchableOpacity
                    style={[ss.actionBtn, { backgroundColor: '#475569' }]}
                    onPress={onRefresh}
                >
                    <Text style={ss.actionBtnText}>Refresh Summary</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

function phaseLabel(phase: string): string {
    switch (phase) {
        case 'preflight': return '📋 Preflight — Capturing state...'
        case 'backup': return '💾 Backup — Copying database...'
        case 'clear': return '🧹 Clear — Removing derived data...'
        case 'recompute': return '⚙️  Recompute — Processing all dates...'
        case 'verify': return '✅ Verify — Checking results...'
        case 'complete': return '🏁 Complete'
        default: return `⚡ ${phase}`
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
    if (str.length <= max) return str
    return str.slice(0, max) + '…'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    tab: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 6,
    },
    tabActive: {
        backgroundColor: '#1e3a5f',
    },
    tabText: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#e2e8f0',
        fontWeight: '700',
    },
    loading: {
        color: '#f59e0b',
        padding: 8,
        fontSize: 12,
    },
    content: { flex: 1 },
    contentInner: { padding: 16, paddingBottom: 40 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#e2e8f0',
        marginBottom: 12,
    },
    subTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#38bdf8',
        marginTop: 16,
        marginBottom: 6,
    },
    row: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 2,
        fontFamily: 'monospace',
    },
    empty: {
        color: '#64748b',
        fontSize: 13,
        fontStyle: 'italic',
        marginTop: 8,
    },
    card: {
        backgroundColor: '#1e293b',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#e2e8f0',
    },
    badge: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    expanded: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dateInput: {
        flex: 1,
        backgroundColor: '#1e293b',
        color: '#e2e8f0',
        padding: 10,
        borderRadius: 8,
        fontSize: 14,
        fontFamily: 'monospace',
        marginRight: 8,
    },
    refreshBtn: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    refreshBtnText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 13,
    },
    sampleRow: {
        backgroundColor: '#1e293b',
        padding: 8,
        borderRadius: 6,
        marginBottom: 4,
    },
    sampleText: {
        color: '#cbd5e1',
        fontSize: 12,
        fontFamily: 'monospace',
    },
    sampleMeta: {
        color: '#64748b',
        fontSize: 10,
        fontFamily: 'monospace',
        marginTop: 2,
    },
    actionBtn: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center' as const,
        marginBottom: 4,
    },
    actionBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 15,
    },
})
