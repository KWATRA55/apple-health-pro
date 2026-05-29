import React, { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { useHealthStore } from '../../src/lib/store'
// [CANONICAL] Scope-explicit data access for Edit Profile
import { selectLatestScores, selectLatestWeight } from '../../src/lib/canonical-selectors'

// ── STITCH Design Tokens (canonical source) ───────────────────────────
import { colors as _S } from '../../src/theme/stitch-tokens'
import { EliteCard } from '../../src/components/ui/v3'

const S = {
    ..._S,
    accentCyan: _S.pillarLongevity,
    accentTeal: _S.pillarReadiness,
    accentPurple: _S.pillarResilience,
    surfaceContainer: _S.surfaceContainer,
    primaryFixedDim: _S.primaryFixedDim,
    secondaryFixedDim: _S.secondaryFixedDim,
    error: _S.errorDisplay,
    warning: _S.warning,
    success: _S.success,
}

// ── Glass Card wrapper (V3 canonical) ──────────────────────────────────
const GlassCard = EliteCard

// ── Glass Input ────────────────────────────────────────────────────────
function GlassInput({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    readonly = false,
    suffix,
}: {
    label: string
    value: string
    onChangeText?: (text: string) => void
    placeholder?: string
    keyboardType?: 'default' | 'numeric' | 'decimal-pad'
    readonly?: boolean
    suffix?: string
}) {
    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={{
                color: S.onSurfaceVariant,
                fontSize: 10,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
            }}>
                {label}
            </Text>
            <View style={{
                borderBottomWidth: 1,
                borderBottomColor: readonly ? 'rgba(122,215,198,0.30)' : S.borderStrong,
                flexDirection: 'row',
                alignItems: 'center',
            }}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={S.dimText}
                    editable={!readonly}
                    keyboardType={keyboardType}
                    style={{
                        flex: 1,
                        color: readonly ? S.primaryFixedDim : S.onSurface,
                        fontSize: 16,
                        paddingVertical: 10,
                        fontFamily: readonly ? undefined : undefined,
                    }}
                />
                {suffix && (
                    <Text style={{ color: S.dimText, fontSize: 14, marginLeft: 4 }}>
                        {suffix}
                    </Text>
                )}
                {readonly && (
                    <Text style={{ color: S.dimText, fontSize: 14 }}>🔒</Text>
                )}
            </View>
        </View>
    )
}

// ── Section Header ─────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
    return (
        <Text style={{
            color: 'rgba(255,255,255,0.30)',
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 16,
        }}>
            {label}
        </Text>
    )
}

// ── Menu Row ───────────────────────────────────────────────────────────
function MenuRow({
    icon,
    label,
    onPress,
    right,
}: {
    icon: string
    label: string
    onPress?: () => void
    right?: React.ReactNode
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                paddingHorizontal: 4,
                borderBottomWidth: 0.5,
                borderBottomColor: S.border,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
                <Text style={{ color: S.onSurface, fontSize: 15, fontWeight: '500' }}>
                    {label}
                </Text>
            </View>
            {right || <Text style={{ color: S.dimText, fontSize: 16 }}>›</Text>}
        </TouchableOpacity>
    )
}

// ── Main Screen ────────────────────────────────────────────────────────
export default function EditProfileScreen() {
    const store = useHealthStore()
    const { latestScores } = store
    // [CANONICAL] Scope-explicit data access for Edit Profile
    const canonicalScores = selectLatestScores(store)
    const canonicalWeight = selectLatestWeight(store)
    const biologicalAge = canonicalScores?.value?.biologicalAge ?? null

    const [name, setName] = useState('Shashwat')
    const [specialization, setSpecialization] = useState('Endurance & Longevity')
    const [location, setLocation] = useState('Toronto, ON')
    const [height, setHeight] = useState('175')
    const [weight, setWeight] = useState('70')
    const [strainTarget, setStrainTarget] = useState('14.5')
    const [bedtime, setBedtime] = useState('22:30')
    const [healthKitSynced, setHealthKitSynced] = useState(true)

    const handleSave = () => {
        // In a full implementation, persist to store / AsyncStorage
        Alert.alert('Profile Saved', 'Your profile has been updated.')
        router.back()
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: S.bg }} edges={['top']}>
            <Stack.Screen
                options={{
                    headerShown: false,
                }}
            />

            {/* Fixed Header */}
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    backgroundColor: 'rgba(18,18,20,0.60)',
                    borderBottomWidth: 0.5,
                    borderBottomColor: S.border,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: S.glass,
                    }}
                >
                    <Text style={{ color: S.onSurfaceVariant, fontSize: 20 }}>←</Text>
                </TouchableOpacity>
                <Text style={{ color: S.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>
                    Edit Profile
                </Text>
                <TouchableOpacity
                    onPress={handleSave}
                    style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 16,
                        backgroundColor: 'rgba(122,215,198,0.12)',
                        borderWidth: 0.5,
                        borderColor: 'rgba(122,215,198,0.25)',
                    }}
                >
                    <Text style={{
                        color: S.primaryFixedDim,
                        fontSize: 12,
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                    }}>
                        Save
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 }}
            >
                {/* ── Avatar ─────────────────────────────────────────────────── */}
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <View style={{ position: 'relative' }}>
                        <View
                            style={{
                                width: 96,
                                height: 96,
                                borderRadius: 48,
                                backgroundColor: S.surfaceContainer,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.15)',
                            }}
                        >
                            <Text style={{ color: S.primaryFixedDim, fontSize: 32, fontWeight: '900' }}>SH</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={{ marginTop: 12 }}>
                        <Text style={{
                            color: S.primaryFixedDim,
                            fontSize: 12,
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            Edit Photo
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── Personal Identity ──────────────────────────────────────── */}
                <GlassCard style={{ padding: 24, marginBottom: 16 }}>
                    <SectionHeader label="Personal Identity" />
                    <GlassInput
                        label="Full Name"
                        value={name}
                        onChangeText={setName}
                    />
                    <GlassInput
                        label="Specialization"
                        value={specialization}
                        onChangeText={setSpecialization}
                    />
                    <GlassInput
                        label="Location"
                        value={location}
                        onChangeText={setLocation}
                    />
                </GlassCard>

                {/* ── Clinical Biometrics ────────────────────────────────────── */}
                <GlassCard style={{ padding: 24, marginBottom: 16 }}>
                    <SectionHeader label="Clinical Biometrics" />
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <GlassInput
                                label="Height (cm)"
                                value={height}
                                onChangeText={setHeight}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <GlassInput
                                label="Weight (kg)"
                                value={weight}
                                onChangeText={setWeight}
                                keyboardType="decimal-pad"
                            />
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <GlassInput
                                label="Biological Age"
                                value={biologicalAge != null ? String(biologicalAge) : '--'}
                                readonly
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <GlassInput
                                label="Gender"
                                value="Male"
                            />
                        </View>
                    </View>
                </GlassCard>

                {/* ── Optimization Goals ─────────────────────────────────────── */}
                <GlassCard style={{ padding: 24, marginBottom: 16 }}>
                    <SectionHeader label="Optimization Goals" />

                    {/* Strain Target Slider */}
                    <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ color: S.onSurfaceVariant, fontSize: 12, fontWeight: '600' }}>
                                Daily Strain Target
                            </Text>
                            <Text style={{ color: S.primaryFixedDim, fontSize: 16, fontWeight: '800' }}>
                                {strainTarget}
                            </Text>
                        </View>
                        {/* Simple bar-based slider */}
                        <View
                            style={{
                                height: 4,
                                backgroundColor: 'rgba(255,255,255,0.10)',
                                borderRadius: 2,
                                marginBottom: 8,
                            }}
                        >
                            <View
                                style={{
                                    height: 4,
                                    width: `${((parseFloat(strainTarget) - 10) / 11) * 100}%`,
                                    backgroundColor: S.primaryFixedDim,
                                    borderRadius: 2,
                                    shadowColor: S.primaryFixedDim,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 4,
                                }}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: S.dimText, fontSize: 10 }}>Recovery</Text>
                            <Text style={{ color: S.dimText, fontSize: 10 }}>Peak Output</Text>
                        </View>

                        {/* Quick preset buttons */}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            {[12, 14.5, 17, 20].map(v => (
                                <TouchableOpacity
                                    key={v}
                                    onPress={() => setStrainTarget(String(v))}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        backgroundColor: parseFloat(strainTarget) === v ? 'rgba(122,215,198,0.15)' : S.glass,
                                        borderWidth: 0.5,
                                        borderColor: parseFloat(strainTarget) === v ? 'rgba(122,215,198,0.30)' : S.border,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{
                                        color: parseFloat(strainTarget) === v ? S.primaryFixedDim : S.dimText,
                                        fontSize: 13,
                                        fontWeight: '700',
                                    }}>
                                        {v}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Bedtime Preference */}
                    <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ color: S.onSurfaceVariant, fontSize: 12, fontWeight: '600' }}>
                                Bedtime Preference
                            </Text>
                            <Text style={{ color: S.primaryFixedDim, fontSize: 16, fontWeight: '800' }}>
                                {bedtime}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {['21:30', '22:00', '22:30', '23:00', '23:30'].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setBedtime(t)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        backgroundColor: bedtime === t ? 'rgba(200,194,233,0.15)' : S.glass,
                                        borderWidth: 0.5,
                                        borderColor: bedtime === t ? 'rgba(200,194,233,0.30)' : S.border,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{
                                        color: bedtime === t ? S.secondaryFixedDim : S.dimText,
                                        fontSize: 12,
                                        fontWeight: '700',
                                    }}>
                                        {t}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </GlassCard>

                {/* ── Account & Sync ─────────────────────────────────────────── */}
                <GlassCard style={{ overflow: 'hidden', marginBottom: 16 }}>
                    <MenuRow
                        icon="❤️"
                        label="Sync HealthKit"
                        right={
                            <View
                                style={{
                                    width: 44,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: healthKitSynced ? 'rgba(122,215,198,0.20)' : 'rgba(255,255,255,0.08)',
                                    justifyContent: 'center',
                                    paddingHorizontal: 2,
                                }}
                            >
                                <View
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        backgroundColor: healthKitSynced ? S.primaryFixedDim : S.dimText,
                                        alignSelf: healthKitSynced ? 'flex-end' : 'flex-start',
                                        ...(healthKitSynced && {
                                            shadowColor: S.primaryFixedDim,
                                            shadowOffset: { width: 0, height: 0 },
                                            shadowOpacity: 0.6,
                                            shadowRadius: 4,
                                        }),
                                    }}
                                />
                            </View>
                        }
                    />
                    <MenuRow icon="🛡️" label="Privacy Settings" />
                    <MenuRow icon="📥" label="Export Data (CSV)" />
                </GlassCard>

                {/* [CANONICAL] Data provenance & scope declaration for Edit Profile */}
                <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
                        data scope · provenance
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                        {([
                            { label: 'scores', vm: canonicalScores },
                            { label: 'weight', vm: canonicalWeight },
                        ] as const).map(({ label, vm }) => {
                            const isPresent = vm.status === 'present'
                            return (
                                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isPresent ? '#30D158' : 'rgba(255,255,255,0.15)' }} />
                                    <Text style={{ fontSize: 7, color: isPresent ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.15)', fontWeight: '600' }}>
                                        {label} ({vm.scope})
                                    </Text>
                                </View>
                            )
                        })}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}
