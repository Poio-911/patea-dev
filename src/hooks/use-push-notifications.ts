'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, getFirestore } from 'firebase/firestore';
import { useFirebaseApp, useAuth } from '@/firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Hook that requests push notification permission, gets the FCM token
 * and saves it to Firestore at users/{uid}/fcmTokens[].
 * 
 * Safe to call multiple times — deduplicates via a ref.
 */
export function usePushNotifications() {
    const app = useFirebaseApp();
    const auth = useAuth();
    const attempted = useRef(false);

    const registerPush = useCallback(async () => {
        if (attempted.current) return;
        attempted.current = true;

        try {
            const supported = await isSupported();
            if (!supported) return;

            const user = auth?.currentUser;
            if (!user) return;

            if (!VAPID_KEY) {
                console.warn('[Push] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set — skipping FCM token registration.');
                return;
            }

            // Request notification permission if not already granted
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            const messaging = getMessaging(app);
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (!token) return;

            // Save token to Firestore using arrayUnion (idempotent)
            const db = getFirestore(app);
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                fcmTokens: arrayUnion(token),
            });

            console.info('[Push] FCM token registered successfully.');
        } catch (err) {
            // Silently ignore — push is not critical
            console.warn('[Push] Could not register FCM token:', err);
        }
    }, [app, auth]);

    return { registerPush };
}
