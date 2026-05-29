/**
 * In-Memory Cache Manager
 *
 * Provides a simple TTL-based cache for computed values that are expensive
 * to recalculate on every render (synthesis, trend reports, correlation insights,
 * weekly plans, etc.).
 *
 * Used by selectors and components to avoid re-computation during component
 * re-renders and screen transitions.
 */

interface CacheEntry<T> {
    value: T
    expiresAt: number
    createdAt: number
}

// Default TTLs (in ms)
export const DEFAULT_TTL = {
    SYNTHESIS: 30_000,        // 30s — recompute fairly often
    TREND_REPORT: 120_000,    // 2min
    CORRELATION: 120_000,     // 2min
    WEEKLY_PLAN: 300_000,     // 5min
    BIOMETRICS_CONTEXT: 30_000, // 30s
} as const

class CacheManager {
    private store = new Map<string, CacheEntry<unknown>>()

    /**
     * Get a cached value. Returns the value if it exists and hasn't expired,
     * otherwise returns undefined.
     */
    get<T>(key: string): T | undefined {
        const entry = this.store.get(key)
        if (!entry) return undefined

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key)
            return undefined
        }

        return entry.value as T
    }

    /**
     * Set a cached value with a TTL in milliseconds.
     */
    set<T>(key: string, value: T, ttlMs: number): void {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
            createdAt: Date.now(),
        })
    }

    /**
     * Check if a key exists and is not expired.
     */
    has(key: string): boolean {
        const entry = this.store.get(key)
        if (!entry) return false
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key)
            return false
        }
        return true
    }

    /**
     * Invalidate a specific key or keys matching a prefix.
     */
    invalidate(keyOrPrefix: string): void {
        // Delete exact match
        this.store.delete(keyOrPrefix)

        // Also delete any keys starting with this prefix
        for (const key of this.store.keys()) {
            if (key.startsWith(keyOrPrefix)) {
                this.store.delete(key)
            }
        }
    }

    /**
     * Clear the entire cache.
     */
    clear(): void {
        this.store.clear()
    }

    /**
     * Get cache stats for debugging.
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.store.size,
            keys: Array.from(this.store.keys()),
        }
    }
}

// Singleton instance
export const cache = new CacheManager()

/**
 * Helper: get or compute and cache a value.
 * If the value is in cache and not expired, returns it.
 * Otherwise, calls the compute function, caches the result, and returns it.
 */
export function getOrCompute<T>(
    key: string,
    ttlMs: number,
    compute: () => T,
): T {
    const cached = cache.get<T>(key)
    if (cached !== undefined) return cached

    const value = compute()
    cache.set(key, value, ttlMs)
    return value
}

/**
 * Helper: invalidate all caches related to a specific date.
 * Call this after a sync to ensure computed values reflect fresh data.
 */
export function invalidateDateCaches(dateStr: string): void {
    cache.invalidate(`synthesis:${dateStr}`)
    cache.invalidate(`scores:${dateStr}`)
    cache.invalidate('trend-report')
    cache.invalidate('correlation-insights')
    cache.invalidate('weekly-plan')
    cache.invalidate('biometrics-context')
}

/**
 * Helper: full cache flush after a sync completes.
 */
export function invalidateAllCaches(): void {
    cache.clear()
}
