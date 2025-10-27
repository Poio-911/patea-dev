// @ts-nocheck
// This file is not intended to be modified.
//
// This is your Firebase configuration object. You can find this information in your project's settings page on the Firebase console.
// https://console.firebase.google.com/project/_/settings/general/
import { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "mil-disculpis.firebaseapp.com",
  projectId: "mil-disculpis",
  storageBucket: "mil-disculpis.appspot.com",
  messagingSenderId: "5614567933",
  appId: "1:5614567933:web:6d7b7dde5f994c36861994",
  measurementId: "G-56F70EMSVB"
};
