'use client';

import { useCallback } from 'react';

/**
 * Returns a `vibrate(pattern)` helper that triggers haptic feedback
 * on Android (via navigator.vibrate) and silently does nothing on
 * iOS or desktop (which don't support it).
 *
 * Usage:
 *   const { tap, success, error } = useHaptics();
 *   <button onClick={() => { tap(); doSomething(); }}>...</button>
 */
export function useHaptics() {
    const vibrate = useCallback((pattern: number | number[]) => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch {
                // silently ignore — not critical
            }
        }
    }, []);

    /** Single soft tap — for nav items, toggles */
    const tap = useCallback(() => vibrate(30), [vibrate]);

    /** Double pulse — for confirming a save / submit */
    const success = useCallback(() => vibrate([40, 30, 40]), [vibrate]);

    /** Error / warning pulse */
    const error = useCallback(() => vibrate([80, 40, 80]), [vibrate]);

    return { tap, success, error, vibrate };
}
