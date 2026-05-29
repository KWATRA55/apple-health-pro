// [CANONICAL] Pure visual component — no health data access.
// Displays animated orb using themes from orbConfig. All health data
// (pillar scores, readiness indicators) must be provided by the parent
// via props, sourced from canonical selectors like selectLatestScores().
import React, { useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, NativeModules, TurboModuleRegistry } from 'react-native'
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    withSpring,
    Easing,
    withSequence,
    cancelAnimation,
    useDerivedValue,
    useAnimatedStyle,
    SharedValue,
} from 'react-native-reanimated'
import { ORB_THEMES, type OrbVariant, type OrbTheme } from './orbConfig'

// ── Lazy-load Skia to survive Expo Go / tunnel (native module may be absent) ─
let SkiaModule: {
    Canvas: React.ComponentType<any>
    Circle: React.ComponentType<any>
    Group: React.ComponentType<any>
    Blur: React.ComponentType<any>
    vec: (x: number, y: number) => { x: number; y: number }
} | null = null

let skiaLoadAttempted = false

function getSkia() {
    if (skiaLoadAttempted) return SkiaModule
    skiaLoadAttempted = true

    // Check if the native RNSkiaModule is registered before attempting to require it.
    // In React Native's New Architecture (JSI), TurboModuleRegistry.getEnforcing() is called
    // at the top-level of @shopify/react-native-skia. Calling require() when the module is
    // missing will trigger a fatal native crash that bypasses JS try-catch.
    const isAvailable =
        (TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function' && !!TurboModuleRegistry.get('RNSkiaModule')) ||
        (NativeModules && !!NativeModules.RNSkiaModule)

    if (!isAvailable) {
        SkiaModule = null
        return null
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('@shopify/react-native-skia')
        if (mod && typeof mod.Canvas !== 'undefined') {
            SkiaModule = mod
        } else {
            SkiaModule = null
        }
    } catch {
        SkiaModule = null
    }
    return SkiaModule
}

// ── Types ────────────────────────────────────────────────────────────

interface Particle2D {
    x: number
    y: number
    size: number
    opacity: number
    isHighlight?: boolean
}

export interface PremiumOrbProps {
    variant: OrbVariant
    /** Main value to display, e.g. "29.4" or "--" */
    primaryValue: string | null
    /** Label shown below the value (e.g. "BIOLOGICAL AGE") */
    primaryLabel?: string
    /** Optional sublabel (e.g. "2.1 years younger") */
    secondaryLabel?: string | null
    /** When true, dim particles and show fallback text */
    isEmpty: boolean
    /** Fallback text when isEmpty is true */
    fallbackText?: string
    /** Tap handler */
    onPress?: () => void
    /** Container width override */
    containerWidth?: number
    /** Container height override */
    containerHeight?: number
    /** Accessibility label */
    accessibilityLabel?: string
}

// ── Particle generators ──────────────────────────────────────────────

function generateRingParticles(
    count: number,
    radius: number,
    radiusJitter: number,
    sizeMin: number,
    sizeMax: number,
    opacityMin: number,
    opacityMax: number,
    highlightRatio: number,
): Particle2D[] {
    return Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2
        const r = radius + (Math.random() - 0.5) * radiusJitter * 2
        const x = Math.cos(angle) * r
        const y = Math.sin(angle) * r
        const size = sizeMin + Math.random() * (sizeMax - sizeMin)
        const opacity = opacityMin + Math.random() * (opacityMax - opacityMin)
        const isHighlight = Math.random() < highlightRatio
        return { x, y, size, opacity, isHighlight }
    })
}

function generateStarfield(
    count: number,
    minRadius: number,
    maxRadius: number,
    w: number,
    h: number,
): Particle2D[] {
    return Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2
        const r = minRadius + Math.random() * (maxRadius - minRadius)
        return {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            size: 0.6 + Math.random() * 1.5,
            opacity: 0.06 + Math.random() * 0.18,
        }
    })
}

// ── Fallback glow orb (pure RN / Reanimated, no Skia) ────────────────

interface FallbackOrbProps {
    theme: OrbTheme
    size: number
    w: number
    h: number
    isEmpty: boolean
    primaryValue: string | null
    primaryLabel?: string
    secondaryLabel?: string | null
    fallbackText?: string
}

interface GlowRingProps {
    scale: number
    breathScale: SharedValue<number>
    breathOpacity: SharedValue<number>
    theme: OrbTheme
    size: number
    isEmpty: boolean
    idx: number
    cx: number
    cy: number
    time: SharedValue<number>
}

function GlowRing({ scale, breathScale, breathOpacity, theme, size, isEmpty, idx, cx, cy, time }: GlowRingProps) {
    const glowSize = size * scale
    const animGlowStyle = useAnimatedStyle(() => {
        const rad = time.value * (Math.PI / 180)
        // Heartbeat micro-pulse: 17 cycles per 25 seconds (~1.47s period)
        const microPulse = 1.0 + Math.sin(rad * 17) * 0.035
        const currentScale = breathScale.value * microPulse

        return {
            opacity: breathOpacity.value * (0.05 - idx * 0.012) * (isEmpty ? 0.2 : 1.0),
            transform: [{ scale: currentScale }],
        }
    })
    return <Animated.View style={[
        animGlowStyle,
        {
            position: 'absolute',
            left: cx - glowSize / 2,
            top: cy - glowSize / 2,
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: theme.glowColor,
        }
    ]} pointerEvents="none" />
}

interface OrbShellProps {
    shell: {
        tiltX: number
        tiltZ: number
        cosZ: number
        sinZ: number
        speed: number
        particles: Array<{ x: number; y: number; z: number; size: number; opacity: number; color: string; }>
    }
    rotation: SharedValue<number>
    parallaxX: SharedValue<number>
    parallaxY: SharedValue<number>
    isEmpty: boolean
    size: number
    cx: number
    cy: number
}

function OrbShell({ shell, rotation, parallaxX, parallaxY, isEmpty, size, cx, cy }: OrbShellProps) {
    const cosY = useDerivedValue(() => Math.cos((rotation.value * shell.speed + parallaxY.value) * (Math.PI / 180)))
    const sinY = useDerivedValue(() => Math.sin((rotation.value * shell.speed + parallaxY.value) * (Math.PI / 180)))
    const cosX = useDerivedValue(() => Math.cos((shell.tiltX + parallaxX.value) * (Math.PI / 180)))
    const sinX = useDerivedValue(() => Math.sin((shell.tiltX + parallaxX.value) * (Math.PI / 180)))

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {shell.particles.map((p, pIdx) => (
                <OrbParticle
                    key={`p-${pIdx}`}
                    p={p}
                    cosY={cosY}
                    sinY={sinY}
                    cosX={cosX}
                    sinX={sinX}
                    cosZ={shell.cosZ}
                    sinZ={shell.sinZ}
                    size={size}
                    isEmpty={isEmpty}
                    cx={cx}
                    cy={cy}
                />
            ))}
        </View>
    )
}

interface OrbParticleProps {
    p: {
        x: number
        y: number
        z: number
        size: number
        opacity: number
        color: string
    }
    cosY: Readonly<{ value: number }>
    sinY: Readonly<{ value: number }>
    cosX: Readonly<{ value: number }>
    sinX: Readonly<{ value: number }>
    cosZ: number
    sinZ: number
    size: number
    isEmpty: boolean
    cx: number
    cy: number
}

function OrbParticle({ p, cosY, sinY, cosX, sinX, cosZ, sinZ, size, isEmpty, cx, cy }: OrbParticleProps) {
    const animatedStyle = useAnimatedStyle(() => {
        const px = p.x
        const py = p.y
        const pz = p.z

        // Rotate around Y-axis
        const cY = cosY.value
        const sY = sinY.value
        const x1 = px * cY + pz * sY
        const y1 = py
        const z1 = -px * sY + pz * cY

        // Rotate around X-axis
        const cX = cosX.value
        const sX = sinX.value
        const x2 = x1
        const y2 = y1 * cX - z1 * sX
        const z2 = y1 * sX + z1 * cX

        // Rotate around Z-axis (using precomputed static cosZ/sinZ)
        const x3 = x2 * cosZ - y2 * sinZ
        const y3 = x2 * sinZ + y2 * cosZ
        const z3 = z2

        // 3D perspective projection onto 2D screen
        const cameraDistance = size * 1.5
        const scaleFactor = cameraDistance / (cameraDistance - z3)
        const projX = x3 * scaleFactor
        const projY = y3 * scaleFactor

        // Depth-based scaling and opacity
        const depthScale = scaleFactor
        const depthOpacity = 0.4 + 0.6 * ((z3 + size / 2) / size)

        return {
            transform: [
                { translateX: cx + projX - p.size / 2 },
                { translateY: cy + projY - p.size / 2 },
                { scale: depthScale },
            ] as any,
            opacity: p.opacity * depthOpacity * (isEmpty ? 0.25 : 1),
        }
    })

    return (
        <Animated.View
            style={[
                animatedStyle,
                {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    backgroundColor: p.color,
                }
            ]}
            pointerEvents="none"
        />
    )
}

interface OrbStarProps {
    star: {
        x: number
        y: number
        size: number
        baseOpacity: number
        twinkleSpeed: number
        twinklePhase: number
        zIndex: number
    }
    cx: number
    cy: number
    isEmpty: boolean
}

function OrbStar({ star, cx, cy, isEmpty }: OrbStarProps) {
    return (
        <View
            style={{
                position: 'absolute',
                left: cx + star.x - star.size / 2,
                top: cy + star.y - star.size / 2,
                width: star.size,
                height: star.size,
                borderRadius: star.size / 2,
                backgroundColor: '#FFFFFF',
                opacity: star.baseOpacity * (isEmpty ? 0.3 : 1),
            }}
            pointerEvents="none"
        />
    )
}

function FallbackOrb({
    theme,
    size,
    w,
    h,
    isEmpty,
    primaryValue,
    primaryLabel,
    secondaryLabel,
    fallbackText,
}: FallbackOrbProps) {
    const breathScale = useSharedValue(1)
    const breathOpacity = useSharedValue(0.45)
    // "rotation" acts as the global "time" shared value driving both rotation, drift, and twinkle
    const rotation = useSharedValue(0)

    // Parallax tilts derived from user touches (max ±8 degrees)
    const parallaxX = useSharedValue(0)
    const parallaxY = useSharedValue(0)

    const cx = w / 2
    const cy = h / 2

    useEffect(() => {
        breathScale.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.92, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        )
        breathOpacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.3, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        )
        rotation.value = withRepeat(
            withTiming(360, { duration: 25000, easing: Easing.linear }),
            -1,
            false,
        )
        return () => {
            cancelAnimation(breathScale)
            cancelAnimation(breathOpacity)
            cancelAnimation(rotation)
            cancelAnimation(parallaxX)
            cancelAnimation(parallaxY)
        }
    }, [])

    const handleTouchMove = (event: any) => {
        const { locationX, locationY } = event.nativeEvent
        const offsetX = (locationX - cx) / cx
        const offsetY = (locationY - cy) / cy

        const clampedX = Math.max(-1, Math.min(1, offsetX))
        const clampedY = Math.max(-1, Math.min(1, offsetY))

        // Rotate X tilts backward/forward on vertical touch, Rotate Y tilts left/right on horizontal touch
        parallaxX.value = withTiming(-clampedY * 8, { duration: 150, easing: Easing.out(Easing.quad) })
        parallaxY.value = withTiming(clampedX * 8, { duration: 150, easing: Easing.out(Easing.quad) })
    }

    const handleTouchEnd = () => {
        // Return to center smoothly with a spring physics dampening
        parallaxX.value = withSpring(0, { damping: 15 })
        parallaxY.value = withSpring(0, { damping: 15 })
    }

    // Background stars: 40 particles distributed in a 3D spherical shell (radius 0.6x to 1.8x)
    const backgroundStars = useMemo(() => {
        return Array.from({ length: 40 }, () => {
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            const minR = (size / 2) * 0.6
            const maxR = (size / 2) * 1.8
            const r = minR + Math.random() * (maxR - minR)

            const x = r * Math.sin(phi) * Math.cos(theta)
            const y = r * Math.sin(phi) * Math.sin(theta)
            const z = r * Math.cos(phi)

            const pSize = 0.6 + Math.random() * 1.4
            const baseOpacity = 0.06 + Math.random() * 0.18

            // Twinkle parameters
            const twinkleSpeed = 8 + Math.floor(Math.random() * 8) // Integer cycles per 25s for loop alignment
            const twinklePhase = Math.random() * Math.PI * 2

            // Precompute 3D perspective projection for static stars
            const cameraDistance = size * 1.5
            const scaleFactor = cameraDistance / (cameraDistance - z)
            const projX = x * scaleFactor
            const projY = y * scaleFactor
            const projSize = pSize * scaleFactor
            const projZIndex = Math.round(z + size)
            const depthOpacity = 0.4 + 0.6 * ((z + size / 2) / size)

            return {
                x: projX,
                y: projY,
                size: projSize,
                baseOpacity: baseOpacity * depthOpacity,
                twinkleSpeed,
                twinklePhase,
                zIndex: projZIndex
            }
        })
    }, [size])

    // exactly 3 spherical shells: Outer, Middle, and Inner Highlight
    const shells = useMemo(() => {
        const shellConfigs = [
            // Outer shell: ~30 particles, radius 0.95x, slow counter-rotation, dim, tiny size
            {
                radScale: 0.95,
                speed: -0.6,
                count: 30,
                opacityMin: 0.2,
                opacityMax: 0.4,
                sizeMin: 1.0,
                sizeMax: 2.0,
                tiltX: 30,
                tiltZ: 15,
                isHighlight: false,
            },
            // Middle shell: ~24 particles, radius 0.82x, main rotation, bright, medium size
            {
                radScale: 0.82,
                speed: 1.0,
                count: 24,
                opacityMin: 0.5,
                opacityMax: 0.9,
                sizeMin: 2.0,
                sizeMax: 3.0,
                tiltX: -45,
                tiltZ: -30,
                isHighlight: false,
            },
            // Inner highlight shell: ~12 particles, radius 0.68x, faster rotation, high opacity, larger size
            {
                radScale: 0.68,
                speed: 1.6,
                count: 12,
                opacityMin: 0.8,
                opacityMax: 1.0,
                sizeMin: 3.0,
                sizeMax: 5.0,
                tiltX: 60,
                tiltZ: 45,
                isHighlight: true,
            },
        ]

        return shellConfigs.map((config) => {
            const cosZ = Math.cos(config.tiltZ * Math.PI / 180)
            const sinZ = Math.sin(config.tiltZ * Math.PI / 180)

            const particles = Array.from({ length: config.count }, (_, i) => {
                const theta = Math.random() * Math.PI * 2
                const phi = Math.acos(2 * Math.random() - 1)
                const r = (size / 2) * config.radScale * (0.92 + Math.random() * 0.16)

                // 3D Cartesian coordinates
                const x = r * Math.sin(phi) * Math.cos(theta)
                const y = r * Math.sin(phi) * Math.sin(theta)
                const z = r * Math.cos(phi)

                const pSize = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin)
                const opacity = config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin)

                let color = theme.particleColor
                if (config.isHighlight) {
                    const rand = Math.random()
                    if (rand < 0.35) {
                        color = '#FFFFFF' // Sparkle highlights
                    } else if (rand < 0.70) {
                        color = theme.secondaryParticleColor
                    }
                } else {
                    if (Math.random() < 0.25) {
                        color = theme.secondaryParticleColor
                    }
                }

                return { x, y, z, size: pSize, opacity, color }
            })
            return { ...config, cosZ, sinZ, particles }
        })
    }, [size, theme.particleColor, theme.secondaryParticleColor])

    return (
        <View
            onTouchStart={handleTouchMove}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                width: w, height: h,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'transparent',
            }}
        >
            {/* Background Halo / Starfield Dust (Spherical) */}
            {backgroundStars.map((star, idx) => (
                <OrbStar
                    key={`bg-star-${idx}`}
                    star={star}
                    cx={cx}
                    cy={cy}
                    isEmpty={isEmpty}
                />
            ))}

            {/* Ambient Background Radial Glow Layers (Double breath heartbeat) */}
            {[1.5, 1.2, 0.9, 0.6].map((scale, idx) => (
                <GlowRing
                    key={`ambient-glow-${idx}`}
                    scale={scale}
                    breathScale={breathScale}
                    breathOpacity={breathOpacity}
                    theme={theme}
                    size={size}
                    isEmpty={isEmpty}
                    idx={idx}
                    cx={cx}
                    cy={cy}
                    time={rotation}
                />
            ))}

            {/* Central Solid Spherical Body */}
            <Animated.View style={[
                {
                    width: size * 0.82,
                    height: size * 0.82,
                    borderRadius: (size * 0.82) / 2,
                    backgroundColor: '#020504',
                    position: 'absolute' as const,
                    left: cx - (size * 0.82) / 2,
                    top: cy - (size * 0.82) / 2,
                    borderWidth: 1,
                    borderColor: `${theme.particleColor}15`,
                    shadowColor: theme.glowColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isEmpty ? 0.15 : 0.45,
                    shadowRadius: 28,
                },
                useAnimatedStyle(() => {
                    return {
                        transform: [{ scale: breathScale.value }],
                    }
                })
            ]} />

            {/* 3D Rotating Particle Shells */}
            {shells.map((shell, idx) => (
                <OrbShell
                    key={`shell-${idx}`}
                    shell={shell}
                    rotation={rotation}
                    parallaxX={parallaxX}
                    parallaxY={parallaxY}
                    isEmpty={isEmpty}
                    size={size}
                    cx={cx}
                    cy={cy}
                />
            ))}

            {/* Text overlay for fallback */}
            <View style={{
                position: 'absolute',
                left: 16,
                right: 16,
                top: cy - 70,
                height: 140,
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 9999,
                elevation: 9999,
            }}>
                <Text
                    style={{
                        fontWeight: '900',
                        letterSpacing: -2,
                        fontSize: primaryValue && primaryValue.length > 4 ? 36 : 48,
                        color: isEmpty ? 'rgba(255,255,255,0.25)' : '#FFFFFF',
                        textShadowColor: 'rgba(255,255,255,0.30)',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: 16,
                        textAlign: 'center',
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    {primaryValue ?? '--'}
                </Text>
                {(primaryLabel || fallbackText) && (
                    <Text style={styles.label}>
                        {isEmpty && fallbackText ? fallbackText : primaryLabel}
                    </Text>
                )}
                {secondaryLabel && !isEmpty && (
                    <Text style={styles.sublabel}>{secondaryLabel}</Text>
                )}
            </View>
        </View>
    )
}

// ── Component ────────────────────────────────────────────────────────

export const PremiumOrb = React.memo(function PremiumOrb({
    variant,
    primaryValue,
    primaryLabel,
    secondaryLabel,
    isEmpty,
    fallbackText,
    onPress,
    containerWidth,
    containerHeight,
    accessibilityLabel,
}: PremiumOrbProps) {
    const theme = ORB_THEMES[variant]
    const { width: screenW } = useWindowDimensions()
    const w = containerWidth ?? Math.min(screenW - 48, 390)
    const h = containerHeight ?? 300
    const cx = w / 2
    const cy = h / 2
    const orbR = theme.orbRadius

    // ── Precompute particle layers (static geometry) ─────────────────
    const layer1 = useMemo(
        () => generateRingParticles(theme.layer1Count, orbR, orbR * 0.12, 1.8, 4.5, 0.12, 0.55, 0.15),
        [theme.layer1Count, orbR],
    )
    const layer2 = useMemo(
        () => generateRingParticles(theme.layer2Count, orbR * 0.78, orbR * 0.10, 2.5, 6.0, 0.25, 0.75, 0.25),
        [theme.layer2Count, orbR],
    )
    const layer3 = useMemo(
        () => generateRingParticles(theme.layer3Count, orbR * 0.55, orbR * 0.18, 3.5, 8.0, 0.40, 0.95, 0.35),
        [theme.layer3Count, orbR],
    )
    const stars = useMemo(
        () => generateStarfield(250, orbR * 1.5, orbR * 4.5, w, h),
        [orbR, w, h],
    )

    // ── Animation values ─────────────────────────────────────────────
    const rotOuter = useSharedValue(0)
    const rotMid = useSharedValue(0)
    const rotInner = useSharedValue(0)
    const breathScale = useSharedValue(1)
    const breathOpacity = useSharedValue(0.55)
    const dimFactor = useSharedValue(isEmpty ? 0.28 : 1.0)
    const starfieldOpacity = useSharedValue(isEmpty ? 0.3 : 1.0)

    useEffect(() => {
        dimFactor.value = withTiming(isEmpty ? 0.28 : 1.0, {
            duration: 800,
            easing: Easing.out(Easing.cubic),
        })
        starfieldOpacity.value = withTiming(isEmpty ? 0.3 : 1.0, {
            duration: 800,
            easing: Easing.out(Easing.cubic),
        })
    }, [isEmpty])

    useEffect(() => {
        const speed = isEmpty ? 0.25 : 1.0

        rotOuter.value = withRepeat(
            withTiming(360 * speed, { duration: 22000 / speed, easing: Easing.linear }),
            -1,
            false,
        )
        rotMid.value = withRepeat(
            withTiming(-360 * speed, { duration: 15000 / speed, easing: Easing.linear }),
            -1,
            false,
        )
        rotInner.value = withRepeat(
            withTiming(360 * speed, { duration: 9000 / speed, easing: Easing.linear }),
            -1,
            false,
        )
        breathScale.value = withRepeat(
            withSequence(
                withTiming(1.07, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.93, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        )
        breathOpacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.4, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        )

        return () => {
            cancelAnimation(rotOuter)
            cancelAnimation(rotMid)
            cancelAnimation(rotInner)
            cancelAnimation(breathScale)
            cancelAnimation(breathOpacity)
        }
    }, [isEmpty])

    // Derived values for Skia — all safe top-level hook calls
    const outerTransform = useDerivedValue(() => [{ rotate: (rotOuter.value * Math.PI) / 180 }])
    const midTransform = useDerivedValue(() => [{ rotate: (rotMid.value * Math.PI) / 180 }])
    const innerTransform = useDerivedValue(() => [{ rotate: (rotInner.value * Math.PI) / 180 }])

    const glowRadiusVal = useDerivedValue(
        () => orbR * 1.25 * breathScale.value * (isEmpty ? 0.6 : 1),
    )
    const glowOpacityVal = useDerivedValue(
        () => breathOpacity.value * (isEmpty ? 0.25 : 1),
    )

    // ── Check Skia availability once at top ──────────────────────────
    const skia = getSkia()
    const hasSkia = !!skia && typeof skia.Canvas !== 'undefined'

    return (
        <View style={[styles.container, { width: w, height: h }]}>
            {onPress ? (
                <TouchableOpacity
                    onPress={onPress}
                    activeOpacity={0.92}
                    accessibilityLabel={accessibilityLabel ?? `${variant} health orb`}
                    accessibilityRole="button"
                    style={{ width: w, height: h }}
                >
                    {hasSkia ? (
                        <OrbCanvas
                            w={w}
                            h={h}
                            cx={cx}
                            cy={cy}
                            orbR={orbR}
                            theme={theme}
                            stars={stars}
                            layer1={layer1}
                            layer2={layer2}
                            layer3={layer3}
                            outerTransform={outerTransform}
                            midTransform={midTransform}
                            innerTransform={innerTransform}
                            glowRadiusVal={glowRadiusVal}
                            glowOpacityVal={glowOpacityVal}
                            dimFactor={dimFactor}
                            starfieldOpacity={starfieldOpacity}
                            skia={skia!}
                        />
                    ) : (
                        <View style={StyleSheet.absoluteFill}>
                            <FallbackOrb
                                theme={theme}
                                size={orbR * 2}
                                w={w}
                                h={h}
                                isEmpty={isEmpty}
                                primaryValue={primaryValue}
                                primaryLabel={primaryLabel}
                                secondaryLabel={secondaryLabel}
                                fallbackText={fallbackText}
                            />
                        </View>
                    )}
                </TouchableOpacity>
            ) : (
                <>
                    {hasSkia ? (
                        <OrbCanvas
                            w={w}
                            h={h}
                            cx={cx}
                            cy={cy}
                            orbR={orbR}
                            theme={theme}
                            stars={stars}
                            layer1={layer1}
                            layer2={layer2}
                            layer3={layer3}
                            outerTransform={outerTransform}
                            midTransform={midTransform}
                            innerTransform={innerTransform}
                            glowRadiusVal={glowRadiusVal}
                            glowOpacityVal={glowOpacityVal}
                            dimFactor={dimFactor}
                            starfieldOpacity={starfieldOpacity}
                            skia={skia!}
                        />
                    ) : (
                        <View style={StyleSheet.absoluteFill}>
                            <FallbackOrb
                                theme={theme}
                                size={orbR * 2}
                                w={w}
                                h={h}
                                isEmpty={isEmpty}
                                primaryValue={primaryValue}
                                primaryLabel={primaryLabel}
                                secondaryLabel={secondaryLabel}
                                fallbackText={fallbackText}
                            />
                        </View>
                    )}
                    {hasSkia ? null : null}
                </>
            )}
            {/* Always show text overlay when Skia drives the orb; FallbackOrb has built-in text */}
            {hasSkia && (
                <OrbTextOverlay
                    w={w}
                    h={h}
                    isEmpty={isEmpty}
                    primaryValue={primaryValue}
                    primaryLabel={primaryLabel}
                    secondaryLabel={secondaryLabel}
                    fallbackText={fallbackText}
                />
            )}
        </View>
    )
})

// ── Canvas sub-component (only rendered when Skia is available) ──────

interface OrbCanvasProps {
    w: number
    h: number
    cx: number
    cy: number
    orbR: number
    theme: OrbTheme
    stars: Particle2D[]
    layer1: Particle2D[]
    layer2: Particle2D[]
    layer3: Particle2D[]
    outerTransform: Readonly<{ value: { rotate: number }[] }>
    midTransform: Readonly<{ value: { rotate: number }[] }>
    innerTransform: Readonly<{ value: { rotate: number }[] }>
    glowRadiusVal: Readonly<{ value: number }>
    glowOpacityVal: Readonly<{ value: number }>
    dimFactor: { value: number }
    starfieldOpacity: { value: number }
    skia: NonNullable<ReturnType<typeof getSkia>>
}

function OrbCanvas({
    w,
    h,
    cx,
    cy,
    orbR,
    theme,
    stars,
    layer1,
    layer2,
    layer3,
    outerTransform,
    midTransform,
    innerTransform,
    glowRadiusVal,
    glowOpacityVal,
    dimFactor,
    starfieldOpacity,
    skia,
}: OrbCanvasProps) {
    const { Canvas, Circle, Group, Blur, vec } = skia

    return (
        <Canvas style={StyleSheet.absoluteFill}>
            {/* Dark fill */}
            <Circle cx={cx} cy={cy} r={Math.max(w, h)} color={theme.backgroundColor} />

            {/* Starfield — rendered flat with global dim */}
            <Group opacity={starfieldOpacity}>
                {stars.map((s, i) => (
                    <Circle
                        key={`star-${i}`}
                        cx={cx + s.x}
                        cy={cy + s.y}
                        r={s.size}
                        color="rgba(136,153,170,0.5)"
                        opacity={s.opacity}
                    />
                ))}
            </Group>

            {/* Ambient background glow */}
            <Circle cx={cx} cy={cy} r={orbR * 1.55} color={theme.ambientGlowColor}>
                <Blur blur={28} />
            </Circle>

            {/* Outer glow ring (breathing) */}
            <Circle cx={cx} cy={cy} r={glowRadiusVal} color={theme.glowColor} opacity={glowOpacityVal}>
                <Blur blur={18} />
            </Circle>

            {/* Layer 1: Outer shell, slow CW rotation */}
            <Group opacity={dimFactor} transform={outerTransform} origin={vec(cx, cy)}>
                {layer1.map((p, i) => (
                    <Circle
                        key={`l1-${i}`}
                        cx={cx + p.x}
                        cy={cy + p.y}
                        r={p.size}
                        color={p.isHighlight ? theme.secondaryParticleColor : theme.particleColor}
                        opacity={p.opacity}
                    />
                ))}
            </Group>

            {/* Layer 2: Mid shell, medium CCW rotation */}
            <Group opacity={dimFactor} transform={midTransform} origin={vec(cx, cy)}>
                {layer2.map((p, i) => (
                    <Circle
                        key={`l2-${i}`}
                        cx={cx + p.x}
                        cy={cy + p.y}
                        r={p.size}
                        color={p.isHighlight ? theme.secondaryParticleColor : theme.particleColor}
                        opacity={p.opacity * 0.85}
                    />
                ))}
            </Group>

            {/* Layer 3: Inner core, fast CW rotation */}
            <Group opacity={dimFactor} transform={innerTransform} origin={vec(cx, cy)}>
                {layer3.map((p, i) => (
                    <Circle
                        key={`l3-${i}`}
                        cx={cx + p.x}
                        cy={cy + p.y}
                        r={p.size}
                        color={p.isHighlight ? theme.secondaryParticleColor : theme.particleColor}
                        opacity={p.opacity}
                    />
                ))}
            </Group>

            {/* Core highlight */}
            <Circle cx={cx} cy={cy} r={orbR * 0.15} color={theme.secondaryParticleColor}>
                <Blur blur={6} />
            </Circle>
        </Canvas>
    )
}

// ── Text overlay sub-component (only used when Skia is driving) ──────

interface OrbTextOverlayProps {
    w: number
    h: number
    isEmpty: boolean
    primaryValue: string | null
    primaryLabel?: string
    secondaryLabel?: string | null
    fallbackText?: string
}

function OrbTextOverlay({
    w,
    h,
    isEmpty,
    primaryValue,
    primaryLabel,
    secondaryLabel,
    fallbackText,
}: OrbTextOverlayProps) {
    return (
        <View
            style={[StyleSheet.absoluteFill, styles.textOverlay]}
            pointerEvents="none"
        >
            <Text
                style={[
                    styles.primaryValue,
                    { color: isEmpty ? 'rgba(255,255,255,0.25)' : '#FFFFFF' },
                    { fontSize: primaryValue && primaryValue.length > 4 ? 36 : 48 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
            >
                {primaryValue ?? '--'}
            </Text>

            {(primaryLabel || fallbackText) && (
                <Text style={styles.label}>
                    {isEmpty && fallbackText ? fallbackText : primaryLabel}
                </Text>
            )}

            {secondaryLabel && !isEmpty && (
                <Text style={styles.sublabel}>{secondaryLabel}</Text>
            )}
        </View>
    )
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
    },
    textOverlay: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    primaryValue: {
        fontWeight: '900',
        letterSpacing: -2,
        textShadowColor: 'rgba(255,255,255,0.30)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 16,
        textAlign: 'center',
    },
    label: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginTop: 6,
        textAlign: 'center',
    },
    sublabel: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.3,
        marginTop: 8,
        textAlign: 'center',
    },
})
