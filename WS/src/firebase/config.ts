// @ts-nocheck
// This file is not intended to be modified.
//
// This is your Firebase configuration object. You can find this information in your project's settings page on the Firebase console.
// https://console.firebase.google.com/project/_/settings/general/
import { FirebaseOptions } from 'firebase/app';

// Fallback values if environment variables are not set
const FALLBACK_CONFIG = {
  apiKey: "AIzaSyBe_V2v-2p78kHxYd8s8kLz9lC0b2n2H8",
  authDomain: "mil-disculpis.firebaseapp.com",
  projectId: "mil-disculpis",
  storageBucket: "mil-disculpis.appspot.com",
  messagingSenderId: "313938466268",
  appId: "1:313938466268:web:7573436d4f9b3634062a87",
  measurementId: "G-9XG18W93EM"
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
