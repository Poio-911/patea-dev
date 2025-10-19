
'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useFirebaseApp, useUser, useFirestore } from '@/firebase';
import { useToast } from './use-toast';
import { doc, setDoc } from 'firebase/firestore';

export const useFcm = () => {
  const { toast } = useToast();
  const app = useFirebaseApp();
  const { user } = useUser();
  const firestore = useFirestore();

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !app || !user || !firestore) {
      return;
    }
    const messaging = getMessaging(app);

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('Notification permission granted.');
        toast({ title: '¡Notificaciones activadas!', description: 'Recibirás avisos importantes sobre los partidos.' });
        
        // IMPORTANT: You need to replace this with your actual VAPID key from the Firebase console.
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.error("VAPID key is not configured in environment variables.");
            toast({ variant: 'destructive', title: 'Error de Configuración', description: 'Falta la clave de notificaciones del servidor.' });
            return;
        }
        
        const currentToken = await getToken(messaging, { vapidKey });

        if (currentToken) {
          console.log('FCM Token:', currentToken);
          const tokenRef = doc(firestore, `users/${user.uid}/fcmTokens`, currentToken);
          await setDoc(tokenRef, { 
              token: currentToken,
              createdAt: new Date().toISOString() 
          }, { merge: true });

        } else {
          console.log('No registration token available. Request permission to generate one.');
          toast({ variant: 'destructive', title: 'Error de Token', description: 'No se pudo generar el token para notificaciones.' });
        }
      } else {
        console.log('Unable to get permission to notify.');
        toast({ variant: 'destructive', title: 'Permiso denegado', description: 'No se pudieron activar las notificaciones.' });
      }
    } catch (err) {
      console.error('An error occurred while retrieving token. ', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al solicitar el permiso de notificaciones.' });
    }
  };
  
  useEffect(() => {
    if (typeof window === 'undefined' || !app) {
      return;
    }
    const messaging = getMessaging(app);
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      toast({
        title: payload.notification?.title,
        description: payload.notification?.body,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [app, toast]);

  return { requestPermission };
};
