'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/index';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { UserProvider } from '@/firebase/auth/use-user';
import { MainNav } from '@/components/main-nav';
import { ThemeProvider } from 'next-themes';
import { useJsApiLoader } from '@react-google-maps/api';
import { libraries } from '@/lib/google-maps';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';

type FirebaseClientProviderProps = {
  children: React.ReactNode;
};

export function ClientProviders({ children }: FirebaseClientProviderProps) {
  const [firebaseInstances, setFirebaseInstances] = useState<{
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebaseInstances(instances);
  }, []);

  if (loadError) {
    console.error("Google Maps API failed to load: ", loadError);
  }

  // Wait for Firebase to initialize before rendering anything
  if (!firebaseInstances) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
        </div>
      </ThemeProvider>
    );
  }

  // Once Firebase is ready, mount providers ONCE and never unmount them
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <FirebaseProvider
        firebaseApp={firebaseInstances.firebaseApp}
        auth={firebaseInstances.auth}
        firestore={firebaseInstances.firestore}
      >
        <UserProvider>
          {!isLoaded ? (
            <div className="flex h-screen w-full items-center justify-center bg-background">
              <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
            </div>
          ) : (
            <MainNav>{children}</MainNav>
          )}
        </UserProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
