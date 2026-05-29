// [CANONICAL] Export data sourcing now uses canonical selectors for provenance-aware exports.
// Prior to this fix, ExportTools read raw state arrays bypassing all selectors.
// Now uses selectAllTime* selectors that carry provenance metadata and confidence tagging.
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useHealthStore } from '../../lib/store'
import {
    selectAllTimeScoresRange,
    selectAllTimeVitalsRange,
    selectAllTimeActivities,
} from '../../lib/canonical-selectors'
import { shareCsv, shareSummaryText, buildPdfHtml, buildFullCsv } from '../../lib/services/export-tools'

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../theme/stitch-tokens'

const S = {
    ..._S,
    accentCyan: _S.pillarLongevity,
    primaryFixedDim: _S.primaryFixedDim,
    secondaryFixedDim: _S.secondaryFixedDim,
}

// ── GlassPanel → EliteCard (V3 canonical component) ───────────────────
import { EliteCard } from '../ui/v3'
const GlassPanel = EliteCard

// ── Export Row ─────────────────────────────────────────────────────────
function ExportRow({
    label,
    subtext,
    onPress,
    disabled,
    isLoading,
    accent,
}: {
    label: string
    subtext: string
    onPress: () => void
    disabled: boolean
    isLoading: boolean
    accent: string
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: `${accent}10`,
                borderWidth: 0.5,
                borderColor: `${accent}30`,
                opacity: disabled ? 0.5 : 1,
                marginBottom: 8,
            }}
        >
            <View style={{ flex: 1 }}>
                <Text style={{ color: S.onSurface, fontSize: 13, fontWeight: '700', marginBottom: 2 }}>
                    {label}
                </Text>
                <Text style={{ color: S.mutedText, fontSize: 11 }}>
                    {subtext}
                </Text>
            </View>
            {isLoading ? (
                <ActivityIndicator size="small" color={accent} />
            ) : (
                <View style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: `${accent}20`,
                    borderWidth: 0.5,
                    borderColor: `${accent}30`,
                }}>
                    <Text style={{ color: accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {label === 'Sync HealthKit' ? 'SYNC' : label.includes('CSV') ? 'EXPORT' : label.includes('PDF') ? 'PDF' : 'SHARE'}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    )
}

// ── Main Component ─────────────────────────────────────────────────────
export function ExportTools() {
    const state = useHealthStore()
    const [exporting, setExporting] = useState<string | null>(null)

    // [CANONICAL] Use canonical selectors for provenance-aware summary counts
    const allTimeScores = selectAllTimeScoresRange(state)
    const allTimeVitals = selectAllTimeVitalsRange(state)
    const allTimeActivities = selectAllTimeActivities(state)

    const scoresCount = allTimeScores.status !== 'missing' ? state.scores.length : 0
    const vitalsCount = allTimeVitals.status !== 'missing' ? state.vitals.length : 0
    const activitiesCount = allTimeActivities.value?.length ?? 0
    const mealsCount = state.meals.length

    const hasData = scoresCount > 0 || vitalsCount > 0

    const handleExport = async (mode: 'csv' | 'summary' | 'pdf' | 'healthkit') => {
        if (mode === 'healthkit') {
            setExporting(mode)
            try {
                await state.syncHealthKit()
            } catch (error) {
                console.error('HealthKit sync failed:', error)
                Alert.alert('Sync Failed', 'Could not sync with HealthKit.')
            } finally {
                setExporting(null)
            }
            return
        }

        setExporting(mode)
        try {
            switch (mode) {
                case 'csv':
                    await shareCsv(state)
                    break
                case 'summary':
                    await shareSummaryText(state)
                    break
                case 'pdf':
                    try {
                        const Print = require('expo-print')
                        const html = buildPdfHtml(state)
                        const { uri } = await Print.printToFileAsync({ html })
                        const Sharing = require('expo-sharing')
                        const canShare = await Sharing.isAvailableAsync()
                        if (canShare) {
                            await Sharing.shareAsync(uri, {
                                mimeType: 'application/pdf',
                                dialogTitle: 'Export PDF Report',
                                UTI: 'com.adobe.pdf',
                            })
                        } else {
                            Alert.alert('Sharing Unavailable', 'PDF sharing is not available on this device.')
                        }
                    } catch {
                        Alert.alert(
                            'PDF Export Unavailable',
                            'Install expo-print for PDF export:\n\nnpx expo install expo-print expo-sharing',
                            [{ text: 'OK' }],
                        )
                    }
                    break
            }
        } catch (error) {
            console.error('Export failed:', error)
            Alert.alert('Export Failed', 'An error occurred. Please try again.')
        } finally {
            setExporting(null)
        }
    }

    return (
        <GlassPanel style={{ padding: 20 }}>
            <Text style={{
                color: S.onSurfaceVariant,
                fontSize: 10,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 16,
            }}>
                DATA EXPORT
            </Text>

            {!hasData ? (
                <Text style={{ color: S.mutedText, fontSize: 13, marginBottom: 8 }}>
                    Sync HealthKit data to enable export and sharing.
                </Text>
            ) : (
                <View>
                    <ExportRow
                        label="Share Daily Summary"
                        subtext="Quick text summary — HRV, Recovery, Strain, Sleep"
                        onPress={() => handleExport('summary')}
                        disabled={exporting !== null}
                        isLoading={exporting === 'summary'}
                        accent={S.accentCyan}
                    />
                    <ExportRow
                        label="Export Full CSV"
                        subtext="Complete dataset — Vitals, Sleep, Strain, Meals, Mobility"
                        onPress={() => handleExport('csv')}
                        disabled={exporting !== null}
                        isLoading={exporting === 'csv'}
                        accent={S.secondaryFixedDim}
                    />
                    <ExportRow
                        label="PDF Health Report"
                        subtext="Styled report — requires expo-print package"
                        onPress={() => handleExport('pdf')}
                        disabled={exporting !== null}
                        isLoading={exporting === 'pdf'}
                        accent={S.error}
                    />
                </View>
            )}

            {/* Sync HealthKit */}
            <ExportRow
                label="Sync HealthKit"
                subtext="Pull latest Apple Health data"
                onPress={() => handleExport('healthkit')}
                disabled={exporting !== null}
                isLoading={exporting === 'healthkit'}
                accent={S.primaryFixedDim}
            />

            {/* Data Summary */}
            <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: S.border }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: S.dimText, fontSize: 10 }}>Days:</Text>
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 10, fontWeight: '700' }}>
                            {scoresCount}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: S.dimText, fontSize: 10 }}>Vitals:</Text>
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 10, fontWeight: '700' }}>
                            {vitalsCount}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: S.dimText, fontSize: 10 }}>Activities:</Text>
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 10, fontWeight: '700' }}>
                            {activitiesCount}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: S.dimText, fontSize: 10 }}>Meals:</Text>
                        <Text style={{ color: S.onSurfaceVariant, fontSize: 10, fontWeight: '700' }}>
                            {mealsCount}
                        </Text>
                    </View>
                </View>
            </View>
        </GlassPanel>
    )
}
