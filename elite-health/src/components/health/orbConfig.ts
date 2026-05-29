/**
 * orbConfig.ts — Per-variant theme tokens for PremiumOrb
 *
 * Each variant maps to a specific surface in the app:
 *  - home-longevity:    Home tab hero orb (cyan-teal)
 *  - health-readiness:  Health > Readiness sub-tab (cool blue)
 *  - health-resilience: Health > Resilience sub-tab (warm amber)
 *  - health-longevity:  Health > Longevity sub-tab (emerald green)
 */

export type OrbVariant =
    | 'home-longevity'
    | 'health-readiness'
    | 'health-resilience'
    | 'health-longevity'

export interface OrbTheme {
    /** Primary particle fill color (hex) */
    particleColor: string
    /** Secondary/highlight particle fill color (hex) */
    secondaryParticleColor: string
    /** Glow tint for the ambient background sprite */
    glowColor: string
    /** Very low opacity ambient background */
    ambientGlowColor: string
    /** Solid background behind the orb */
    backgroundColor: string
    /** Uppercase label shown below the primary value */
    label: string
    /** Number of particles in the dense outer shell */
    layer1Count: number
    /** Number of particles in the mid-depth highlight shell */
    layer2Count: number
    /** Number of sparse inner/outer particles */
    layer3Count: number
    /** Radius of the orb in logical pixels */
    orbRadius: number
    /** Camera Z distance for perspective projection */
    cameraDistance: number
}

export const ORB_THEMES: Record<OrbVariant, OrbTheme> = {
    'home-longevity': {
        particleColor: '#00E5FF',
        secondaryParticleColor: '#7AF0FF',
        glowColor: 'rgba(0, 229, 255, 0.45)',
        ambientGlowColor: 'rgba(0, 229, 255, 0.08)',
        backgroundColor: '#030504',
        label: 'BIOLOGICAL AGE',
        layer1Count: 1600,
        layer2Count: 600,
        layer3Count: 250,
        orbRadius: 135,
        cameraDistance: 520,
    },
    'health-readiness': {
        particleColor: '#4A9EFF',
        secondaryParticleColor: '#88CCFF',
        glowColor: 'rgba(74, 158, 255, 0.40)',
        ambientGlowColor: 'rgba(74, 158, 255, 0.07)',
        backgroundColor: '#030504',
        label: 'READINESS',
        layer1Count: 1300,
        layer2Count: 450,
        layer3Count: 180,
        orbRadius: 110,
        cameraDistance: 460,
    },
    'health-resilience': {
        particleColor: '#FFB347',
        secondaryParticleColor: '#FFD580',
        glowColor: 'rgba(255, 179, 71, 0.40)',
        ambientGlowColor: 'rgba(255, 179, 71, 0.07)',
        backgroundColor: '#030504',
        label: 'RESILIENCE',
        layer1Count: 1300,
        layer2Count: 450,
        layer3Count: 180,
        orbRadius: 110,
        cameraDistance: 460,
    },
    'health-longevity': {
        particleColor: '#00E976',
        secondaryParticleColor: '#00FFC8',
        glowColor: 'rgba(0, 233, 118, 0.50)',
        ambientGlowColor: 'rgba(0, 233, 118, 0.10)',
        backgroundColor: '#030504',
        label: 'BIOLOGICAL AGE',
        layer1Count: 1800,
        layer2Count: 700,
        layer3Count: 300,
        orbRadius: 120,
        cameraDistance: 490,
    },
}
