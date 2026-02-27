'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useUser } from '@/firebase';

const STORAGE_KEY = 'pwa_push_dismissed';

/**
 * Subtle banner that appears after 30s of use to ask for push notification permission.
 * Shows once per session; if dismissed, doesn't show again.
 * Only renders when the user is logged in and hasn't granted/denied permission yet.
 *
 * Also silently refreshes the FCM token on mount if permission was already granted,
 * ensuring the token is always up-to-date in Firestore even after reinstalls or token rotation.
 */
export function PushNotificationPrompt() {
    const { user } = useUser();
    const { registerPush } = usePushNotifications();
    const [visible, setVisible] = useState(false);

    // Auto-register silently if permission was already granted (e.g. they accepted before
    // but the token was cleaned up after reinstall, re-login, or token rotation).
    useEffect(() => {
        if (!user) return;
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            registerPush();
        }
    }, [user, registerPush]);

    // Show prompt after 30s if permission hasn't been decided yet
    useEffect(() => {
        if (!user) return;
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'default') return; // already decided
        if (sessionStorage.getItem(STORAGE_KEY)) return; // already dismissed this session

        // Show prompt after 30 seconds — user is engaged
        const timer = setTimeout(() => setVisible(true), 30_000);
        return () => clearTimeout(timer);
    }, [user]);

    const handleAccept = async () => {
        setVisible(false);
        await registerPush();
    };

    const handleDismiss = () => {
        setVisible(false);
        sessionStorage.setItem(STORAGE_KEY, '1');
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 80 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 80 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm"
                >
                    <div className="rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10 p-4 flex items-start gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                            <Bell className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">Activar notificaciones</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Enterate cuando te convoquen a un partido o sea tu turno de evaluar.
                            </p>
                            <div className="flex gap-2 mt-3">
                                <Button size="sm" onClick={handleAccept} className="text-xs h-8">
                                    Activar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-8">
                                    Ahora no
                                </Button>
                            </div>
                        </div>
                        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0 -mt-0.5">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
