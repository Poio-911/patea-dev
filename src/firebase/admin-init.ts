
/**
 * @fileOverview This file contains the server-side initialization for the Firebase Admin SDK.
 * It ensures the SDK is initialized only once (singleton pattern).
 * This should only be imported in server-side code ('use server' files).
 */

import { initializeApp, getApps, App as AdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { config } from 'dotenv';
import { logger } from '@/lib/logger';

// Load environment variables from .env file
config({ path: './.env' });

let adminApp: AdminApp;

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

// Correct Storage Bucket Name
const STORAGE_BUCKET = 'mil-disculpis.appspot.com';

if (!getApps().length) {
    if (serviceAccountKey) {
        try {
            const serviceAccount = JSON.parse(serviceAccountKey);
            adminApp = initializeApp({
                credential: cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mil-disculpis',
                storageBucket: STORAGE_BUCKET,
            });
        } catch (error) {
            logger.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error);
            throw new Error("Failed to initialize Firebase Admin SDK. Service account key is malformed.");
        }
    } else {
        // This path is for environments like Google Cloud Run where the SDK can auto-initialize.
        logger.warn("FIREBASE_SERVICE_ACCOUNT_KEY not found. Attempting to auto-initialize Admin SDK.");
        adminApp = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mil-disculpis',
            storageBucket: STORAGE_BUCKET,
        });
    }
} else {
  adminApp = getApps()[0];
}

export const adminDb = getAdminFirestore(adminApp);
export const adminAuth = getAdminAuth(adminApp);
export const adminStorage = getAdminStorage(adminApp).bucket();
