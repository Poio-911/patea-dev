import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// Restored admin initialization (was removed). Many server actions still import adminDb/adminAuth/adminStorage.
// This recreates the previous working behavior while keeping a single cached app instance.

let app: App;

function ensureApp(): App {
	if (getApps().length) {
		return getApps()[0];
	}
	const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
	if (!raw) {
		throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY env var for Firebase Admin initialization');
	}
	const serviceAccount: ServiceAccount = JSON.parse(raw);
	const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'mil-disculpis.appspot.com';
	return initializeApp({ credential: cert(serviceAccount), storageBucket });
}

app = ensureApp();

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app).bucket();

// Helper to produce canonical public URL (v0 endpoint) for objects without requiring makePublic()
export function buildPublicFileURL(objectPath: string) {
	const bucketName = adminStorage.name; // e.g. mil-disculpis.appspot.com
	const encoded = encodeURIComponent(objectPath).replace(/%2F/g, '/');
	return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`;
}
