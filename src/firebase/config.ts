// @ts-nocheck
// This file is not intended to be modified.
//
// This is your Firebase configuration object. It reads the values from
// environment variables, which are supplied by apphosting.yaml in production
// or your local .env.local file in development.
import { FirebaseOptions } from 'firebase/app';

// These variables must be prefixed with NEXT_PUBLIC_ to be available on the client.
export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
