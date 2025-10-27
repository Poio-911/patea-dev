import { initializeApp, getApps, App as AdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';

let adminApp: AdminApp;

// Lee las variables de entorno proporcionadas por Next.js
// Next.js automáticamente hace que las variables en .env estén disponibles en process.env en el servidor.
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!getApps().length) {
    if (serviceAccountKey) {
        try {
            // Parsea directamente el JSON de la variable de entorno
            const serviceAccount = JSON.parse(serviceAccountKey);
            adminApp = initializeApp({
                credential: cert(serviceAccount),
                projectId: projectId,
                storageBucket: storageBucket,
            });
        } catch (error) {
            console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error);
            throw new Error("Failed to initialize Firebase Admin SDK. Service account key is malformed.");
        }
    } else {
        // Fallback para entornos de Google Cloud con credenciales por defecto (Application Default Credentials)
        console.warn("Firebase Admin SDK is initializing without an explicit service account. This is expected in a Google Cloud environment.");
        adminApp = initializeApp({
            projectId: projectId,
            storageBucket: storageBucket,
        });
    }
} else {
  adminApp = getApps()[0];
}

const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const adminStorage = getAdminStorage(adminApp).bucket();

export { adminApp, adminDb, adminAuth, adminStorage };
