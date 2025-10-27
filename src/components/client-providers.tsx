'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/index';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { UserProvider } from '@/firebase/auth/use-user';
import { MainNav } from '@/components/main-nav';
import { useJsApiLoader, GoogleMapProvider } from '@react-google-maps/api';
import { libraries } from '@/lib/google-maps';

type FirebaseClientProviderProps = {
  children: React.ReactNode;
};

export function ClientProviders({ children }: FirebaseClientProviderProps) {
  const [firebaseInstances, setFirebaseInstances] = useState<{
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  const loaderOptions = useMemo(() => ({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  }), []);

  const { isLoaded, loadError } = useJsApiLoader(loaderOptions);

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebaseInstances(instances);
  }, []);

  if (!firebaseInstances || !isLoaded) {
    return null; // Or a loading spinner
  }
  
  if (loadError) {
    console.error("Google Maps API failed to load: ", loadError);
    // You can render a fallback UI here
  }


  return (
    <FirebaseProvider
      firebaseApp={firebaseInstances.firebaseApp}
      auth={firebaseInstances.auth}
      firestore={firebaseInstances.firestore}
    >
      <UserProvider>
       <MainNav>{children}</MainNav>
      </UserProvider>
    </FirebaseProvider>
  );
}
