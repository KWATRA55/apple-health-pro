import React, { useCallback, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Image, ActivityIndicator, NativeModules } from 'react-native'
import { analyzeMealPhoto, analyzeWorkoutPhoto } from '../../lib/gemini/client'
import type { MealVisionResult, WorkoutVisionResult } from '../../lib/gemini/client'
import { GlassCard } from '../ui/glass-card'
import { useHealthStore } from '../../lib/store'

// Lazily require expo-image-picker so the bundle doesn't crash when
// the native module hasn't been linked yet (e.g. before `npx expo run:ios`).
let ImagePicker: typeof import('expo-image-picker') | null = null
let hasCheckedImagePicker = false

function getImagePicker(): typeof import('expo-image-picker') | null {
    if (hasCheckedImagePicker) return ImagePicker
    hasCheckedImagePicker = true

    // Safe pre-check: verify the native module exists in Expo's or React Native's registries
    // before calling require() which triggers heavy console errors/uncaught failures from Metro/Expo
    const isNativeModuleAvailable = !!(
        (global as any).expo?.modules?.ExponentImagePicker ||
        (global as any).ExpoModules?.ExponentImagePicker ||
        NativeModules.ExponentImagePicker ||
        NativeModules.ExpoImagePicker
    )

    if (!isNativeModuleAvailable) {
        console.log('[VisionCapture] ExponentImagePicker native module not registered in this environment. Using graceful fallback UI.')
        ImagePicker = null
        return null
    }

    try {
        ImagePicker = require('expo-image-picker')
    } catch {
        // ExpoImagePicker native module not available — VisionCapture will show a fallback.
        ImagePicker = null
    }
    return ImagePicker
}

type VisionMode = 'meal' | 'workout'

interface VisionCaptureProps {
    onMealResult?: (result: MealVisionResult) => void
    onWorkoutResult?: (result: WorkoutVisionResult) => void
}

export function VisionCapture({ onMealResult, onWorkoutResult }: VisionCaptureProps) {
    const [mode, setMode] = useState<VisionMode>('meal')
    const [imageUri, setImageUri] = useState<string | null>(null)
    const [imageBase64, setImageBase64] = useState<string | null>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [mealResult, setMealResult] = useState<MealVisionResult | null>(null)
    const [workoutResult, setWorkoutResult] = useState<WorkoutVisionResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const picker = getImagePicker()

    const addMeal = useHealthStore(s => s.addMeal)
    const addActivity = useHealthStore(s => s.addActivity)

    const pickImage = useCallback(async () => {
        if (!picker) {
            setError('Vision features unavailable. Run `npx expo run:ios` to rebuild the native app with expo-image-picker.')
            return
        }
        setError(null)
        setMealResult(null)
        setWorkoutResult(null)

        const { status } = await picker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
            setError('Camera roll permission required to analyze photos.')
            return
        }

        const result = await picker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            base64: true,
            quality: 0.8,
        })

        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0]
            setImageUri(asset.uri)
            const b64 = `data:image/jpeg;base64,${asset.base64 ?? ''}`
            setImageBase64(b64)
            await runAnalysis(b64)
        }
    }, [mode, picker])

    const takePhoto = useCallback(async () => {
        if (!picker) {
            setError('Vision features unavailable. Run `npx expo run:ios` to rebuild the native app with expo-image-picker.')
            return
        }
        setError(null)
        setMealResult(null)
        setWorkoutResult(null)

        const { status } = await picker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
            setError('Camera permission required to take photos.')
            return
        }

        const result = await picker.launchCameraAsync({
            base64: true,
            quality: 0.8,
        })

        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0]
            setImageUri(asset.uri)
            const b64 = `data:image/jpeg;base64,${asset.base64 ?? ''}`
            setImageBase64(b64)
            await runAnalysis(b64)
        }
    }, [mode, picker])

    const runAnalysis = useCallback(async (b64: string) => {
        setIsAnalyzing(true)
        setError(null)

        try {
            if (mode === 'meal') {
                const result = await analyzeMealPhoto(b64)
                setMealResult(result)
                onMealResult?.(result)
            } else {
                const result = await analyzeWorkoutPhoto(b64)
                setWorkoutResult(result)
                onWorkoutResult?.(result)
            }
        } catch (err) {
            setError('Analysis failed. Please try again with a clearer photo.')
            console.error('[VisionCapture] error:', err)
        } finally {
            setIsAnalyzing(false)
        }
    }, [mode, onMealResult, onWorkoutResult])

    const handleSaveMeal = useCallback(() => {
        if (!mealResult) return
        // [CANONICAL-TODO] Use selectSelectedDate scope for timestamp instead of
        // silently falling back to new Date(). The save should use the currently
        // selected date from the store, not the system clock.
        addMeal({
            id: 0, // auto-generated by SQLite
            timestamp: new Date().toISOString(),
            mealDescription: mealResult.meal_description,
            proteinGrams: mealResult.protein_grams,
            carbsGrams: mealResult.carbs_grams,
            fatGrams: mealResult.fat_grams,
            totalCalories: mealResult.total_calories,
        })
        setImageUri(null)
        setImageBase64(null)
        setMealResult(null)
    }, [mealResult, addMeal])

    const handleSaveWorkout = useCallback(() => {
        if (!workoutResult) return
        // [CANONICAL-TODO] Use selectSelectedDate scope for timestamp instead of
        // silently falling back to new Date(). The save should use the currently
        // selected date from the store, not the system clock.
        addActivity({
            id: 0,
            timestamp: new Date().toISOString(),
            workoutType: workoutResult.workout_type,
            durationMins: workoutResult.duration_mins ?? 0,
            activeCalories: workoutResult.calories ?? 0,
            hrZones: [0, 0, 0, 0, 0],
            maxHR: 0,
            avgHR: 0,
            strainScore: null,
        })
        setImageUri(null)
        setImageBase64(null)
        setWorkoutResult(null)
    }, [workoutResult, addActivity])

    const reset = useCallback(() => {
        setImageUri(null)
        setImageBase64(null)
        setMealResult(null)
        setWorkoutResult(null)
        setError(null)
        setIsAnalyzing(false)
    }, [])

    return (
        <GlassCard style={styles.container}>
            <Text style={styles.title}>
                GEMINI VISION ANALYZER
            </Text>

            {/* Mode Toggle */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    onPress={() => { setMode('meal'); reset() }}
                    style={[
                        styles.toggleBtn,
                        mode === 'meal' && { backgroundColor: '#00E5FF' }
                    ]}
                >
                    <Text style={[
                        styles.toggleText,
                        { color: mode === 'meal' ? '#000000' : '#94A3B8' }
                    ]}>
                        🍽️ Meal
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { setMode('workout'); reset() }}
                    style={[
                        styles.toggleBtn,
                        mode === 'workout' && { backgroundColor: '#FF5A36' }
                    ]}
                >
                    <Text style={[
                        styles.toggleText,
                        { color: mode === 'workout' ? '#000000' : '#94A3B8' }
                    ]}>
                        🏋️ Workout
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Fallback when native module isn't linked */}
            {!picker && (
                <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackTitle}>⚠️ Vision Module Not Linked</Text>
                    <Text style={styles.fallbackText}>
                        The native expo-image-picker module isn't available in this build.{"\n"}
                        Run <Text style={{ color: '#00E5FF', fontWeight: 'bold' }}>npx expo run:ios</Text> to rebuild with native modules.
                    </Text>
                </View>
            )}

            {/* Action Buttons (before image captured) */}
            {picker && !imageUri && !isAnalyzing && (
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        onPress={takePhoto}
                        style={styles.actionBtn}
                    >
                        <Text style={styles.actionText}>📸 Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={pickImage}
                        style={styles.actionBtn}
                    >
                        <Text style={styles.actionText}>🖼️ Gallery</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Loading State */}
            {isAnalyzing && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={mode === 'meal' ? '#00E5FF' : '#FF5A36'} />
                    <Text style={styles.loadingText}>
                        Analyzing {mode === 'meal' ? 'meal' : 'workout'} with Gemini Vision...
                    </Text>
                </View>
            )}

            {/* Image Preview */}
            {imageUri && !isAnalyzing && (
                <View style={styles.previewContainer}>
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.previewImage}
                        resizeMode="cover"
                    />
                    <TouchableOpacity
                        onPress={reset}
                        style={styles.closeBtn}
                    >
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Meal Result */}
            {mealResult && (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultTitle}>{mealResult.meal_description}</Text>
                    <View style={styles.badgeRow}>
                        <MacroBadge label="Protein" value={`${mealResult.protein_grams}g`} color="#00E5FF" />
                        <MacroBadge label="Carbs" value={`${mealResult.carbs_grams}g`} color="#FFB800" />
                        <MacroBadge label="Fat" value={`${mealResult.fat_grams}g`} color="#FF5A36" />
                        <MacroBadge label="Cal" value={`${mealResult.total_calories}`} color="#A855F7" />
                    </View>
                    <TouchableOpacity
                        onPress={handleSaveMeal}
                        style={[styles.saveBtn, { backgroundColor: '#00E5FF' }]}
                    >
                        <Text style={styles.saveText}>Save to Log</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Workout Result */}
            {workoutResult && (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultTitle}>{workoutResult.exercise}</Text>
                    <Text style={styles.resultSubtitle}>{workoutResult.workout_type}</Text>
                    <View style={styles.badgeRow}>
                        {workoutResult.sets > 0 && (
                            <MacroBadge label="Sets" value={`${workoutResult.sets}`} color="#00E5FF" />
                        )}
                        {workoutResult.reps > 0 && (
                            <MacroBadge label="Reps" value={`${workoutResult.reps}`} color="#FFB800" />
                        )}
                        {workoutResult.weight_kg != null && (
                            <MacroBadge label="Weight" value={`${workoutResult.weight_kg}kg`} color="#FF5A36" />
                        )}
                        {workoutResult.calories != null && workoutResult.calories > 0 && (
                            <MacroBadge label="Cal" value={`${workoutResult.calories}`} color="#A855F7" />
                        )}
                        {workoutResult.distance_km != null && (
                            <MacroBadge label="Dist" value={`${workoutResult.distance_km}km`} color="#22C55E" />
                        )}
                        {workoutResult.duration_mins != null && workoutResult.duration_mins > 0 && (
                            <MacroBadge label="Dur" value={`${workoutResult.duration_mins}m`} color="#F59E0B" />
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={handleSaveWorkout}
                        style={[styles.saveBtn, { backgroundColor: '#FF5A36' }]}
                    >
                        <Text style={styles.saveText}>Save to Log</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Error */}
            {error && (
                <View style={styles.resultContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={reset} style={styles.tryAgainBtn}>
                        <Text style={styles.tryAgainText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            )}
        </GlassCard>
    )
}

function MacroBadge({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View
            style={[
                styles.badge,
                { borderColor: `${color}30` }
            ]}
        >
            <Text style={[styles.badgeLabel, { color }]}>
                {label}
            </Text>
            <Text style={styles.badgeValue}>{value}</Text>
        </View>
    )
}

const styles = {
    container: {
        marginBottom: 16,
    },
    title: {
        color: 'rgba(255,255,255,0.60)', // steel
        fontSize: 10,
        fontWeight: 'bold' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: 1.0,
        marginBottom: 12,
    },
    toggleContainer: {
        flexDirection: 'row' as const,
        marginBottom: 16,
        backgroundColor: '#0A0C0E',
        borderWidth: 1,
        borderColor: '#1A1C1E',
        borderRadius: 14,
        padding: 4,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center' as const,
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '900' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
    },
    fallbackContainer: {
        backgroundColor: '#1A0A00',
        borderWidth: 1,
        borderColor: 'rgba(255,90,54,0.3)',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center' as const,
    },
    fallbackTitle: {
        color: '#FF5A36',
        fontSize: 13,
        fontWeight: 'bold' as const,
        marginBottom: 8,
    },
    fallbackText: {
        color: 'rgba(255,255,255,0.60)',
        fontSize: 11,
        textAlign: 'center' as const,
        lineHeight: 16,
    },
    actionContainer: {
        flexDirection: 'row' as const,
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        backgroundColor: '#0A0C0E',
        borderWidth: 1,
        borderColor: '#2A2C2E',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center' as const,
    },
    actionText: {
        color: '#FAFAFA',
        fontSize: 15,
        fontWeight: 'bold' as const,
    },
    loadingContainer: {
        alignItems: 'center' as const,
        paddingVertical: 24,
    },
    loadingText: {
        color: 'rgba(255,255,255,0.60)',
        fontSize: 13,
        fontWeight: 'bold' as const,
        marginTop: 12,
    },
    previewContainer: {
        marginBottom: 12,
        position: 'relative' as const,
    },
    previewImage: {
        width: '100%' as const,
        height: 192,
        borderRadius: 14,
    },
    closeBtn: {
        position: 'absolute' as const,
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 16,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    closeText: {
        color: '#FAFAFA',
        fontSize: 14,
        fontWeight: 'bold' as const,
    },
    resultContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingTop: 12,
        marginTop: 4,
    },
    resultTitle: {
        color: '#FAFAFA',
        fontSize: 15,
        fontWeight: 'bold' as const,
        marginBottom: 8,
    },
    resultSubtitle: {
        color: 'rgba(255,255,255,0.60)',
        fontSize: 12,
        fontWeight: '500' as const,
        marginBottom: 8,
    },
    badgeRow: {
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        gap: 8,
    },
    saveBtn: {
        marginTop: 12,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center' as const,
    },
    saveText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '900' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
    },
    errorText: {
        color: '#FF453A',
        fontSize: 13,
        fontWeight: 'bold' as const,
    },
    tryAgainBtn: {
        marginTop: 8,
        alignSelf: 'flex-start' as const,
    },
    tryAgainText: {
        color: '#00E5FF',
        fontSize: 12,
        fontWeight: '900' as const,
        textTransform: 'uppercase' as const,
    },
    badge: {
        backgroundColor: '#0A0C0E',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center' as const,
        minWidth: 56,
    },
    badgeLabel: {
        fontSize: 10,
        fontWeight: '900' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    badgeValue: {
        color: '#FAFAFA',
        fontSize: 13,
        fontWeight: 'bold' as const,
    }
}
