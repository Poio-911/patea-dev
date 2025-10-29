import { initializeApp, getApps, App as AdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { config } from 'dotenv';

// Cargar variables de entorno desde .env
config({ path: './.env' });

let adminApp: AdminApp;

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!getApps().length) {
    if (serviceAccountKey) {
        try {
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
