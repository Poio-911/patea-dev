import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getMessaging, Messaging } from 'firebase/messaging';
import { firebaseConfig } from './config';
import { FirebaseProvider, useFirebase, useFirebaseApp, useAuth, useFirestore } from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';
import { useUser } from './auth/use-user';


export function initializeFirebase() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  // Explicitly set the auth domain to help with auth issues in complex environments
  const auth = getAuth(app, {
    authDomain: firebaseConfig.authDomain,
  });
  const firestore = getFirestore(app);
  let messaging: Messaging | null = null;
  if (typeof window !== 'undefined') {
    messaging = getMessaging(app);
  }
  return { firebaseApp: app, auth, firestore, messaging };
}

export {
  FirebaseProvider,
  FirebaseClientProvider,
  useCollection,
  useDoc,
  useUser,
  useFirebase,
  useFirebaseApp,
  useAuth,
  useFirestore,
};

    
