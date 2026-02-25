'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Persistent top banner shown when the device is offline.
 * Briefly shows a "Conexión restaurada" notice when connectivity is restored.
 */
export function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false);
    const [showRestored, setShowRestored] = useState(false);

    useEffect(() => {
        // Set initial state on mount
        setIsOffline(!navigator.onLine);

        const handleOffline = () => {
            setIsOffline(true);
            setShowRestored(false);
        };

        const handleOnline = () => {
            setIsOffline(false);
            setShowRestored(true);
            // Auto-hide the "restored" banner after 3 seconds
            setTimeout(() => setShowRestored(false), 3000);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const visible = isOffline || showRestored;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key={isOffline ? 'offline' : 'restored'}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed top-0 left-0 right-0 z-[9999] overflow-hidden"
                >
                    <div
                        className={`flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold text-white transition-colors ${isOffline ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                    >
                        {isOffline ? (
                            <>
                                <WifiOff className="h-4 w-4 shrink-0" />
                                <span>Sin conexión — mostrando datos guardados</span>
                            </>
                        ) : (
                            <>
                                <Wifi className="h-4 w-4 shrink-0" />
                                <span>¡Conexión restaurada!</span>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
