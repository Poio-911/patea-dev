'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';

/**
 * Persistent top banner shown when the device is offline.
 * Disappears automatically when connectivity is restored.
 */
export function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const update = () => setIsOffline(!navigator.onLine);
        update(); // Set initial state

        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed top-0 left-0 right-0 z-[9999] overflow-hidden"
                >
                    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white">
                        <WifiOff className="h-4 w-4 shrink-0" />
                        <span>Sin conexión — mostrando datos guardados</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
