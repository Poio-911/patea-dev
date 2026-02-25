'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * OfflineBanner
 * Shows a sticky banner at the top of the screen when the user is offline.
 * Briefly shows a "back online" notice when connection is restored.
 */
export function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(true);
    const [showRestored, setShowRestored] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setIsOnline(navigator.onLine);

        const handleOffline = () => {
            setIsOnline(false);
            setShowRestored(false);
        };

        const handleOnline = () => {
            setIsOnline(true);
            setShowRestored(true);
            // Hide the "restored" notice after 3 seconds
            const timer = setTimeout(() => setShowRestored(false), 3000);
            return () => clearTimeout(timer);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!mounted) return null;

    // Fully online and not showing "restored" toast → nothing to render
    if (isOnline && !showRestored) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-all duration-500 ease-in-out',
                isOnline
                    ? 'bg-emerald-500 shadow-[0_2px_12px_rgba(52,211,153,0.4)]'
                    : 'bg-red-600 shadow-[0_2px_12px_rgba(220,38,38,0.5)]'
            )}
        >
            {isOnline ? (
                <>
                    <Wifi className="h-4 w-4" />
                    Conexión restaurada
                </>
            ) : (
                <>
                    <WifiOff className="h-4 w-4" />
                    Sin conexión — Mostrando datos en caché
                </>
            )}
        </div>
    );
}
