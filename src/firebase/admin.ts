
import { initializeApp, getApps, App as AdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';

let adminApp: AdminApp;

const serviceAccountKeyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!getApps().length) {
    if (serviceAccountKeyBase64) {
        try {
            const serviceAccount = JSON.parse(Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf-8'));
            adminApp = initializeApp({
                credential: cert(serviceAccount),
                projectId: projectId,
                storageBucket: storageBucket,
            });
        } catch (error) {
            console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY_BASE64:", error);
            throw new Error("Failed to initialize Firebase Admin SDK. Service account key is malformed.");
        }
    } else {
        // This will only work in environments with Application Default Credentials (like Google Cloud Run/Functions)
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
