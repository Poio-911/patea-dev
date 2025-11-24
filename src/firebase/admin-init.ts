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
    if (!rawServiceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
    }

    try {
        const serviceAccountJson = JSON.parse(rawServiceAccount);
        console.log('[Firebase Admin] Service account parsed. Project ID:', serviceAccountJson.project_id);

        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!storageBucket) {
            throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set.");
        }

        console.log('[Firebase Admin] Storage bucket:', storageBucket);

        const app = initializeApp({
            credential: cert(serviceAccountJson as ServiceAccount),
            projectId: 'mil-disculpis', // Explicitly set to force production connection
            storageBucket: storageBucket,
        });

        console.log('[Firebase Admin] Initialized successfully');
        return app;

    } catch (e: any) {
        console.error('[Firebase Admin] Initialization failed:', e);
        logger.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it's a valid JSON string.", e);
        throw new Error("Could not initialize Firebase Admin SDK.");
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
        _adminStorage = getStorage(getAdminApp()).bucket();
    }
    return _adminStorage;
}
