/**
 * Simple in-memory rate limiter using a sliding window counter.
 * Suitable for single-instance Next.js deployments (App Hosting, single pod).
 *
 * For multi-pod deployments, replace this with Upstash Redis Ratelimit or similar.
 * Usage:
 *   const { allowed, remaining } = rateLimiter.check('user-id-or-ip', 10, 60_000);
 *   if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

type Window = {
    count: number;
    resetAt: number;
};

const store = new Map<string, Window>();

// Periodically clean up expired keys to prevent memory leaks
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, win] of store.entries()) {
            if (win.resetAt < now) store.delete(key);
        }
    }, 60_000);
}

export const rateLimiter = {
    /**
     * @param key       Unique identifier (e.g. user ID, IP)
     * @param maxReqs   Max requests allowed per window
     * @param windowMs  Window duration in milliseconds (default: 60s)
     */
    check(key: string, maxReqs: number, windowMs = 60_000): { allowed: boolean; remaining: number; resetAt: number } {
        const now = Date.now();
        const existing = store.get(key);

        if (!existing || existing.resetAt < now) {
            // Start fresh window
            const win: Window = { count: 1, resetAt: now + windowMs };
            store.set(key, win);
            return { allowed: true, remaining: maxReqs - 1, resetAt: win.resetAt };
        }

        existing.count += 1;
        const remaining = Math.max(0, maxReqs - existing.count);
        return {
            allowed: existing.count <= maxReqs,
            remaining,
            resetAt: existing.resetAt,
        };
    },
};
