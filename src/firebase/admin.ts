
import { initializeApp, getApps, App as AdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import 'dotenv/config';

let adminApp: AdminApp;

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 
    ? JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString())
    : undefined;

if (!getApps().length) {
    if (serviceAccountKey) {
        adminApp = initializeApp({
            credential: cert(serviceAccountKey),
            storageBucket: 'mil-disculpis.appspot.com', 
        });
    } else {
        adminApp = initializeApp({
            storageBucket: 'mil-disculpis.appspot.com',
        });
        console.warn("Firebase Admin SDK initialized without explicit service account. This will only work in cloud environments with Application Default Credentials.");
    }
} else {
  adminApp = getApps()[0];
}

const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const adminStorage = getAdminStorage(adminApp).bucket();

export { adminApp, adminDb, adminAuth, adminStorage };
