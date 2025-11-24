// @ts-nocheck
// This file is not intended to be modified.
//
// This is your Firebase configuration object. It reads the values from
// environment variables, which are supplied by apphosting.yaml in production
// or your local .env.local file in development.
import { FirebaseOptions } from 'firebase/app';

// Fallback values if environment variables are not set
const FALLBACK_CONFIG = {
  apiKey: "AIzaSyAes7EVn8hQswS8XgvDMJfN6U4IT_ZL_WY",
  authDomain: "mil-disculpis.firebaseapp.com",
  projectId: "mil-disculpis",
  storageBucket: "mil-disculpis.firebasestorage.app",
  messagingSenderId: "5614567933",
  appId: "1:5614567933:web:6d7b7dde5f994c36861994",
  measurementId: "G-56F70EMSVB"
};

export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || FALLBACK_CONFIG.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || FALLBACK_CONFIG.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || FALLBACK_CONFIG.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || FALLBACK_CONFIG.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_CONFIG.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || FALLBACK_CONFIG.appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || FALLBACK_CONFIG.measurementId,
};
