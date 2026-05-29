/**
 * Aura Kinetic — Canonical Design Tokens
 *
 * Extracted from the 12 Stitch reference screens (Project ID: 10650374066774271530).
 * All 12 screens share identical tokens — this is the single source of truth.
 *
 * Import this file wherever design constants are needed. Do NOT define inline
 * STITCH / S token objects in individual files.
 *
 * Reference screens:
 *  - home-dashboard (d4f1ec71)
 *  - ai-health-assistant (f8f33824)
 *  - health-deep-dive (ebc0bacf)
 *  - athlete-profile (7f4cca9c)
 *  - edit-athlete-profile (bf8eef4b)
 *  - longevity-drilldown (877eea81)
 *  - readiness-drilldown (a91743bd)
 *  - resilience-drilldown (169b37d7)
 *  - monthly-health-report (a1262ee6)
 */

// ── Color Palette ──────────────────────────────────────────────────────────

export const colors = {
    // Background hierarchy (OLED dark)
    bg: '#000000' as const,
    surface: '#131313' as const,
    surfaceDim: '#131313' as const,
    surfaceBright: '#393939' as const,
    surfaceContainerLowest: '#0e0e0e' as const,
    surfaceContainerLow: '#1b1b1b' as const,
    surfaceContainer: '#1f1f1f' as const,
    surfaceContainerHigh: '#2a2a2a' as const,
    surfaceContainerHighest: '#353535' as const,

    // On-surface text
    onSurface: '#e2e2e2' as const,
    onSurfaceVariant: '#bdc9c5' as const,
    onBackground: '#e2e2e2' as const,
    inverseSurface: '#e2e2e2' as const,
    inverseOnSurface: '#303030' as const,

    // Primary (teal/cyan accent — used for readiness)
    primary: '#ffffff' as const,
    onPrimary: '#003730' as const,
    primaryContainer: '#96f3e1' as const,
    onPrimaryContainer: '#007164' as const,
    primaryFixed: '#96f3e1' as const,
    primaryFixedDim: '#7ad7c6' as const,
    onPrimaryFixed: '#00201b' as const,
    onPrimaryFixedVariant: '#005046' as const,
    inversePrimary: '#006b5e' as const,

    // Secondary (purple accent — used for resilience)
    secondary: '#c8c2e9' as const,
    onSecondary: '#302c4b' as const,
    secondaryContainer: '#494566' as const,
    onSecondaryContainer: '#bab4da' as const,
    secondaryFixed: '#e5deff' as const,
    secondaryFixedDim: '#c8c2e9' as const,
    onSecondaryFixed: '#1b1735' as const,
    onSecondaryFixedVariant: '#474363' as const,

    // Tertiary (cyan/blue accent — used for longevity)
    tertiary: '#ffffff' as const,
    onTertiary: '#003546' as const,
    tertiaryContainer: '#bee9ff' as const,
    onTertiaryContainer: '#3f6a7d' as const,
    tertiaryFixed: '#bee9ff' as const,
    tertiaryFixedDim: '#a1cde3' as const,
    onTertiaryFixed: '#001f2a' as const,
    onTertiaryFixedVariant: '#1e4c5f' as const,

    // Error
    error: '#ffb4ab' as const,
    onError: '#690005' as const,
    errorContainer: '#93000a' as const,
    onErrorContainer: '#ffdad6' as const,

    // Outline / border
    outline: '#879390' as const,
    outlineVariant: '#3e4946' as const,
    surfaceTint: '#7ad7c6' as const,
    surfaceVariant: '#353535' as const,

    // ── Semantic / Pillar Colors ──────────────────────────────────────────
    pillarReadiness: '#14B8A6' as const,   // Teal
    pillarResilience: '#A855F7' as const,  // Purple
    pillarLongevity: '#00E5FF' as const,   // Cyan

    // ── Data / Status Colors ──────────────────────────────────────────────
    success: '#30D158' as const,
    warning: '#FFD60A' as const,
    errorDisplay: '#FF453A' as const,

    // ── Glass Panel ───────────────────────────────────────────────────────
    glass: 'rgba(255,255,255,0.04)' as const,
    glassHover: 'rgba(255,255,255,0.06)' as const,
    border: 'rgba(255,255,255,0.08)' as const,
    borderStrong: 'rgba(255,255,255,0.12)' as const,
    borderDim: 'rgba(255,255,255,0.05)' as const,
    borderAccent: 'rgba(255,255,255,0.18)' as const,

    // ── Text Tiers ────────────────────────────────────────────────────────
    dimText: 'rgba(255,255,255,0.40)' as const,
    mutedText: 'rgba(255,255,255,0.55)' as const,
    brandText: 'rgba(255,255,255,0.85)' as const,
} as const

// ── Typography ─────────────────────────────────────────────────────────────

export const typography = {
    displayLg: {
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: '600' as const,
        lineHeight: 1.1,
        letterSpacing: -0.04,
    },
    headlineLg: {
        fontFamily: 'Inter',
        fontSize: 32,
        fontWeight: '600' as const,
        lineHeight: 1.2,
        letterSpacing: -0.02,
    },
    headlineLgMobile: {
        fontFamily: 'Inter',
        fontSize: 28,
        fontWeight: '600' as const,
        lineHeight: 1.2,
    },
    headlineMd: {
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: '500' as const,
        lineHeight: 1.3,
    },
    bodyLg: {
        fontFamily: 'Inter',
        fontSize: 18,
        fontWeight: '400' as const,
        lineHeight: 1.6,
    },
    bodyMd: {
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 1.6,
    },
    bodySm: {
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 1.5,
    },
    metricXl: {
        fontFamily: 'Inter',
        fontSize: 56,
        fontWeight: '700' as const,
        lineHeight: 1,
        letterSpacing: -0.05,
    },
    metricLg: {
        fontFamily: 'Inter',
        fontSize: 40,
        fontWeight: '700' as const,
        lineHeight: 1,
        letterSpacing: -0.04,
    },
    metricMd: {
        fontFamily: 'Inter',
        fontSize: 28,
        fontWeight: '700' as const,
        lineHeight: 1.1,
        letterSpacing: -0.03,
    },
    labelSm: {
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: '500' as const,
        lineHeight: 1.2,
        letterSpacing: 0.05,
    },
    labelXs: {
        fontFamily: 'Inter',
        fontSize: 10,
        fontWeight: '700' as const,
        lineHeight: 1.2,
        letterSpacing: 2.5,
        textTransform: 'uppercase' as const,
    },
} as const

// ── Spacing ────────────────────────────────────────────────────────────────

export const spacing = {
    unit: 4 as const,
    containerPadding: 24 as const,
    stackGap: 16 as const,
    gridGutter: 12 as const,
    sectionGap: 32 as const,
    cardPadding: 20 as const,
    cardPaddingSm: 16 as const,
} as const

// ── Border Radius ──────────────────────────────────────────────────────────

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
} as const

// ── Glass Panel Preset ─────────────────────────────────────────────────────

/** Standard glass panel style — use for all card-like containers */
export const glassPanel = {
    backgroundColor: colors.glass,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
} as const

/** Glass panel with stronger border (elevated / interactive cards) */
export const glassPanelStrong = {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
} as const

// ── Shadow Presets ─────────────────────────────────────────────────────────

export const shadows = {
    glow: (color: string) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 6,
        shadowOpacity: 0.8,
    }),
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        shadowOpacity: 0.4,
        elevation: 4,
    },
} as const

// ── Pillar Config ──────────────────────────────────────────────────────────

export const pillarConfig: Record<
    string,
    { label: string; color: string; icon: string; glowColor: string }
> = {
    readiness: {
        label: 'READY',
        color: colors.pillarReadiness,
        icon: '◉',
        glowColor: colors.primaryFixedDim,
    },
    resilience: {
        label: 'DEFENSE',
        color: colors.pillarResilience,
        icon: '◆',
        glowColor: colors.secondaryFixedDim,
    },
    longevity: {
        label: 'LONGEVITY',
        color: colors.pillarLongevity,
        icon: '●',
        glowColor: colors.tertiaryFixedDim,
    },
} as const

// ── Status Colors ──────────────────────────────────────────────────────────

export const statusColor = {
    green: colors.success,
    amber: colors.warning,
    red: colors.errorDisplay,
    unknown: colors.mutedText,
} as const

export function statusColorFromLevel(
    level: 'green' | 'amber' | 'red' | 'unknown'
): string {
    return statusColor[level]
}

// ── Recovery Zone Colors ───────────────────────────────────────────────────

export function recoveryColor(score: number): string {
    if (score >= 67) return colors.success
    if (score >= 34) return colors.warning
    return colors.errorDisplay
}

export function recoveryBg(score: number): string {
    if (score >= 67) return 'rgba(150,243,225,0.30)'
    if (score >= 34) return 'rgba(190,233,255,0.30)'
    return 'rgba(255,180,171,0.30)'
}

export function recoveryBorder(score: number): string {
    if (score >= 67) return 'rgba(150,243,225,0.55)'
    if (score >= 34) return 'rgba(190,233,255,0.50)'
    return 'rgba(255,180,171,0.50)'
}

// ── Zone Color Helpers ─────────────────────────────────────────────────────

export function zoneColorHex(zone: string): string {
    switch (zone) {
        case 'GREEN': return colors.success
        case 'YELLOW': return colors.warning
        case 'RED': return colors.errorDisplay
        default: return colors.mutedText
    }
}

// ── Type exports ───────────────────────────────────────────────────────────

export type StitchColors = typeof colors
export type StitchTypography = typeof typography
export type StitchSpacing = typeof spacing
export type StitchRadius = typeof radius
