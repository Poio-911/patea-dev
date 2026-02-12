import { getAdminDb } from '@/firebase/admin-init';
import { createHash } from 'crypto';

export interface CacheEntry<T> {
    result: T;
    timestamp: number;
    category: string;
    hitCount: number;
}

export interface CacheConfig {
    ttlHours: number;
    category: string;
}

export interface CacheMetrics {
    hits: number;
    misses: number;
    hitRate: number;
}

/**
 * Generate a deterministic cache key from input data
 */
export function generateCacheKey(input: unknown): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(input));
    return hash.digest('hex');
}

/**
 * Check if a cache entry is still valid based on TTL
 */
export function isValidCache(entry: CacheEntry<unknown>, ttlHours: number): boolean {
    const now = Date.now();
    const ageMs = now - entry.timestamp;
    const ttlMs = ttlHours * 60 * 60 * 1000;
    return ageMs < ttlMs;
}

/**
 * Get cached result or generate new one
 * 
 * @param cacheKey - Unique identifier for this cache entry
 * @param generator - Function that generates the result if not cached
 * @param config - Cache configuration (TTL and category)
 * @returns The cached or freshly generated result
 * 
 * @example
 * ```typescript
 * const analysis = await getCachedOrGenerate(
 *   generateCacheKey({ playerId, matchId }),
 *   () => analyzePlayerPerformance(playerId, matchId),
 *   { ttlHours: 24, category: 'player-analysis' }
 * );
 * ```
 */
export async function getCachedOrGenerate<T>(
    cacheKey: string,
    generator: () => Promise<T>,
    config: CacheConfig
): Promise<T> {
    const db = getAdminDb();
    const cacheRef = db.collection('ai_cache').doc(cacheKey);

    try {
        // Try to get from cache
        const cached = await cacheRef.get();

        if (cached.exists) {
            const entry = cached.data() as CacheEntry<T>;

            if (isValidCache(entry, config.ttlHours)) {
                // Cache hit - increment counter and return
                await cacheRef.set({
                    ...entry,
                    hitCount: (entry.hitCount || 0) + 1
                }, { merge: true });

                console.log(`[AI Cache] HIT for key: ${cacheKey.substring(0, 8)}... (category: ${config.category})`);
                return entry.result;
            } else {
                console.log(`[AI Cache] EXPIRED for key: ${cacheKey.substring(0, 8)}... (category: ${config.category})`);
            }
        }

        // Cache miss - generate new result
        console.log(`[AI Cache] MISS for key: ${cacheKey.substring(0, 8)}... (category: ${config.category})`);
        const result = await generator();

        // Store in cache
        await cacheRef.set({
            result,
            timestamp: Date.now(),
            category: config.category,
            hitCount: 0
        } as CacheEntry<T>);

        return result;
    } catch (error) {
        // If cache fails, fall back to generating
        console.error('[AI Cache] Error accessing cache, falling back to generation:', error);
        return await generator();
    }
}

/**
 * Invalidate a specific cache entry
 */
export async function invalidateCache(cacheKey: string): Promise<void> {
    const db = getAdminDb();
    const cacheRef = db.collection('ai_cache').doc(cacheKey);

    try {
        await cacheRef.set({
            timestamp: 0 // Set to 0 to force expiration
        }, { merge: true });
        console.log(`[AI Cache] Invalidated key: ${cacheKey.substring(0, 8)}...`);
    } catch (error) {
        console.error('[AI Cache] Error invalidating cache:', error);
    }
}

/**
 * Get cache metrics for monitoring
 */
export async function getCacheMetrics(category?: string): Promise<CacheMetrics> {
    // This would require a more complex query to aggregate metrics
    // For now, return placeholder - can be implemented with Cloud Functions
    return {
        hits: 0,
        misses: 0,
        hitRate: 0
    };
}
