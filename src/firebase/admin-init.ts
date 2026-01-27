import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { logger } from '../lib/logger';

// --- Firebase Admin SDK Initialization ---
// This file should only be imported in server-side code (e.g., Server Actions).
// It ensures a single instance of the Firebase Admin app is created.

let adminApp: App | undefined;

function initializeAdminApp(): App {
    if (getApps().some(app => app.name === '[DEFAULT]')) {
        console.log('[Firebase Admin] App already initialized');
        return getApps().find(app => app.name === '[DEFAULT]')!;
    }

    // Explicitly disable emulator to force production connection
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

    console.log('[Firebase Admin] Initializing...');
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
            console.log('[Firebase Admin] Service account parsed. Project ID:', serviceAccountJson.project_id);
            console.log('[Firebase Admin] Storage bucket:', resolvedStorageBucket);

            const app = initializeApp({
                credential: cert(serviceAccountJson as ServiceAccount),
                projectId: resolvedProjectId,
                storageBucket: resolvedStorageBucket,
            });
            console.log('[Firebase Admin] Initialized successfully (explicit credentials)');
            return app;
        }

        // Fallback: initialize using default application credentials (Cloud Functions/Hosting runtime)
        console.log('[Firebase Admin] No service account provided. Initializing with default credentials.');
        const app = initializeApp({
            projectId: resolvedProjectId,
            storageBucket: resolvedStorageBucket,
        });
        console.log('[Firebase Admin] Initialized successfully (default credentials)');
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
        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!storageBucket) {
            throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set.");
        }
        _adminStorage = getStorage(getAdminApp()).bucket(storageBucket);
    }
    return _adminStorage;
}
