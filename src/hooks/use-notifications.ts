'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { useFirebaseApp } from '@/firebase';
import { useUser } from '@/firebase';
import { saveFCMTokenAction, removeFCMTokenAction } from '@/lib/actions/notification-actions';
import { logger } from '@/lib/logger';

// VAPID key from Firebase Console > Project Settings > Cloud Messaging
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  'BKW3qYRW72BtPqyI1oC3IEzafEAx4CXg7ooux7-v3zzn9Hxsgxnk4k1hnIZ9Jb_tEWJn3CU5ncRF4gP3OlwMfKA';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export function useNotifications() {
  const app = useFirebaseApp();
  const { user } = useUser();
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMessagingSupported, setIsMessagingSupported] = useState(false);

  // Check if messaging is supported
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isSupported();
      setIsMessagingSupported(supported);

      if (!supported) {
        setPermission('unsupported');
        logger.warn('Firebase Messaging is not supported in this browser');
      }
    };

    checkSupport();
  }, []);

  // Initialize permission state
  useEffect(() => {
    if (!isMessagingSupported || typeof window === 'undefined') return;

    if ('Notification' in window) {
      setPermission(Notification.permission as NotificationPermissionStatus);
    }
  }, [isMessagingSupported]);

  /**
   * Request notification permission and get FCM token
   */
  const requestPermission = useCallback(async () => {
    if (!isMessagingSupported) {
      setError('Las notificaciones no están disponibles en este navegador');
      return false;
    }

    if (!user) {
      setError('Debes iniciar sesión para habilitar notificaciones');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermission(permission as NotificationPermissionStatus);

      if (permission !== 'granted') {
        setError('Permiso de notificaciones denegado');
        setIsLoading(false);
        return false;
      }

      // Get FCM token
      const messaging = getMessaging(app!);
      let currentToken;
      try {
        currentToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
        });
      } catch (tokenError: any) {
        if (tokenError.message?.includes('applicationServerKey')) {
          setError('La clave VAPID no es válida. Verificá la configuración en Firebase Console.');
        } else {
          throw tokenError;
        }
        setIsLoading(false);
        return false;
      }

      if (currentToken) {
        setToken(currentToken);

        // Save token to Firestore
        const result = await saveFCMTokenAction(user.uid, currentToken);

        if (!result.success) {
          throw new Error(result.error || 'Error al guardar el token');
        }

        logger.info('FCM token obtained and saved', { userId: user.uid });

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
          logger.info('Foreground message received', payload);

          // Show notification
          if (payload.notification) {
            new Notification(payload.notification.title || 'Nueva notificación', {
              body: payload.notification.body,
              icon: payload.notification.image || '/icons/icon-192x192.png',
              badge: '/icons/icon-48-48.png',
            });
          }
        });

        setIsLoading(false);
        return true;
      } else {
        setError('No se pudo obtener el token de notificaciones');
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      logger.error('Error requesting notification permission', err);
      setError(err.message || 'Error al configurar notificaciones');
      setIsLoading(false);
      return false;
    }
  }, [app, user, isMessagingSupported]);

  /**
   * Revoke notification permission (remove token)
   */
  const revokePermission = useCallback(async () => {
    if (!user || !token) return;

    setIsLoading(true);

    try {
      await removeFCMTokenAction(user.uid, token);
      setToken(null);
      logger.info('FCM token revoked', { userId: user.uid });
    } catch (err: any) {
      logger.error('Error revoking FCM token', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  return {
    permission,
    token,
    isLoading,
    error,
    isSupported: isMessagingSupported,
    requestPermission,
    revokePermission,
  };
}
