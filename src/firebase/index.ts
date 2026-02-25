import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { FirebaseProvider, useFirebase, useFirebaseApp, useAuth, useFirestore } from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';
import { useUser } from './auth/use-user';


export function initializeFirebase() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  // Enable offline persistence for Firestore (client-side only, once per app instance)
  if (typeof window !== 'undefined' && !getApps().length) {
    enableMultiTabIndexedDbPersistence(firestore).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open — only one tab can have persistence at a time
        console.warn('[Firestore] Offline persistence unavailable: multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firestore] Offline persistence not supported in this browser.');
      }
    });
  }
  return { firebaseApp: app, auth, firestore };
}

// Initialize and export instances for direct use
const { auth, firestore: db } = initializeFirebase();

export {
  auth,
  db,
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
