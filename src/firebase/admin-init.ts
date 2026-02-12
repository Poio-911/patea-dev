import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { logger } from '../lib/logger';

// --- Firebase Admin SDK Initialization ---
// This file should only be imported in server-side code (e.g., Server Actions).
// It ensures a single instance of the Firebase Admin app is created.

let adminApp: App | undefined;

function initializeAdminApp(): App {
    if (getApps().some(app => app.name === '[DEFAULT]')) {

        return getApps().find(app => app.name === '[DEFAULT]')!;
    }

    // Explicitly disable emulator to force production connection
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;


    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const storageBucketEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const firebaseConfigEnv = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : undefined as any;

    const resolvedProjectId = firebaseConfigEnv?.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mil-disculpis';
    const resolvedStorageBucket = storageBucketEnv || firebaseConfigEnv?.storageBucket;

    if (!resolvedStorageBucket) {
        throw new Error("Storage bucket not configured. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET or ensure FIREBASE_CONFIG.storageBucket is present.");
    }

    try {
        if (rawServiceAccount) {
            const serviceAccountJson = JSON.parse(rawServiceAccount);


            const app = initializeApp({
                credential: cert(serviceAccountJson as ServiceAccount),
                projectId: resolvedProjectId,
                storageBucket: resolvedStorageBucket,
            });

            return app;
        }

        // Fallback: initialize using default application credentials (Cloud Functions/Hosting runtime)

        const app = initializeApp({
            projectId: resolvedProjectId,
            storageBucket: resolvedStorageBucket,
        });

        return app;

    } catch (e: any) {
        console.error('[Firebase Admin] Initialization failed:', e);
        logger.error('Failed to initialize Firebase Admin SDK.', e);
        throw new Error('Could not initialize Firebase Admin SDK.');
    }
}

function getAdminApp(): App {
    if (!adminApp) {
        adminApp = initializeAdminApp();
    }
    return adminApp;
}

// Memoization for lazy initialization
let _adminDb: ReturnType<typeof getFirestore> | undefined;
let _adminAuth: ReturnType<typeof getAuth> | undefined;
let _adminStorage: ReturnType<ReturnType<typeof getStorage>['bucket']> | undefined;
let _adminMessaging: Messaging | undefined;

export function getAdminDb() {
    if (!_adminDb) {
        _adminDb = getFirestore(getAdminApp());
    }
    return _adminDb;
}

export function getAdminAuth() {
    if (!_adminAuth) {
        _adminAuth = getAuth(getAdminApp());
    }
    return _adminAuth;
}

export function getAdminStorage() {
    if (!_adminStorage) {
        const app = getAdminApp();
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        // Explicitly pass the bucket name to avoid defaulting issues
        _adminStorage = getStorage(app).bucket(bucketName);
    }
    return _adminStorage;
}

export function getAdminMessaging() {
    if (!_adminMessaging) {
        _adminMessaging = getMessaging(getAdminApp());
    }
    return _adminMessaging;
}
