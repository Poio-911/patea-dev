import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { FirebaseProvider, useFirebase, useFirebaseApp, useAuth, useFirestore } from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';
import { useUser } from './auth/use-user';


/**
 * App Check: atestigua que la petición viene de esta web y no de un script con
 * la API key copiada. Es lo que hace que tener la key en el cliente sea seguro.
 *
 * Sólo en el navegador: en el servidor (SSR/Server Actions) no corre, y ahí
 * tampoco hace falta porque el Admin SDK no pasa por App Check.
 *
 * Estado (2026-09-03): el proveedor está configurado en los 3 apps web del
 * proyecto y el enforcement está en UNENFORCED (modo monitoreo) para todos los
 * servicios. Antes de pasar a ENFORCED hay que mirar en la consola que el
 * tráfico verificado sea el esperado — con esto desplegado, debería serlo.
 */
function initializeAppCheckIfBrowser(app: FirebaseApp) {
  if (typeof window === 'undefined') return;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    console.warn('[AppCheck] NEXT_PUBLIC_RECAPTCHA_SITE_KEY no está definida — se omite.');
    return;
  }

  // En desarrollo, un token de depuración evita tener que pasar por
  // reCAPTCHA en localhost. Se registra en Firebase Console → App Check.
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN) {
    (globalThis as unknown as Record<string, string>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Que App Check no arranque no debe impedir usar la app mientras el
    // enforcement esté en modo monitoreo.
    console.warn('[AppCheck] No se pudo inicializar:', err);
  }
}

export function initializeFirebase() {
  const isFirstInit = !getApps().length;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  if (isFirstInit) {
    initializeAppCheckIfBrowser(app);
  }

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
