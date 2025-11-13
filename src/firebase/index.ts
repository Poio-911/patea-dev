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
  // Si por error hay variables de emulador seteadas pero NO queremos emulador, las limpiamos antes de inicializar Firestore.
  if (typeof process !== 'undefined') {
    const useEmulator = process.env.FIREBASE_USE_EMULATOR === 'true';
    if (!useEmulator) {
      const emulatorVars = [
        'FIRESTORE_EMULATOR_HOST',
        'FIREBASE_EMULATOR_HUB',
        'FIREBASE_AUTH_EMULATOR_HOST',
        'FIREBASE_STORAGE_EMULATOR_HOST',
        'FIREBASE_DATABASE_EMULATOR_HOST'
      ];
      for (const v of emulatorVars) {
        if ((process.env as any)[v]) {
          delete (process.env as any)[v];
        }
      }
    }
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
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
