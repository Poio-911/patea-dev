
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

  useEffect(() => {
    if (typeof window === 'undefined' || !app || !user || !firestore) {
      return;
    }
    
    const messaging = getMessaging(app);

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
          console.log('Notification permission granted.');
          
          const currentToken = await getToken(messaging, {
            vapidKey: 'YOUR_VAPID_KEY_HERE_FROM_FIREBASE_CONSOLE', // TODO: Replace with your VAPID key
          });

          if (currentToken) {
            console.log('FCM Token:', currentToken);
            // Save the token to Firestore
            const tokenRef = doc(firestore, `users/${user.uid}/fcmTokens`, currentToken);
            await setDoc(tokenRef, { 
                token: currentToken,
                createdAt: new Date().toISOString() 
            }, { merge: true });

          } else {
            console.log('No registration token available. Request permission to generate one.');
          }
        } else {
          console.log('Unable to get permission to notify.');
        }
      } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
      }
    };

    requestPermission();

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
  }, [app, user, firestore, toast]);

  return null;
};

    