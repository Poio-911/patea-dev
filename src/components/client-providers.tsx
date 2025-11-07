
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
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { ThemeBackground } from './theme-background';

type FirebaseClientProviderProps = {
  children: React.ReactNode;
};

// Componente de Carga Centralizado
const LoadingScreen = () => (
  <ThemeProvider
    attribute="class"
    themes={['light', 'game']}
    defaultTheme="light"
    enableSystem={false}
    disableTransitionOnChange
  >
    <ThemeBackground />
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
    </div>
  </ThemeProvider>
);

export function ClientProviders({ children }: FirebaseClientProviderProps) {
  const [firebaseInstances, setFirebaseInstances] = useState<{
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebaseInstances(instances);
  }, []);

  if (loadError) {
    console.error("Google Maps API failed to load: ", loadError);
  }

  // ✅ CORRECCIÓN CLAVE: No renderizar NADA hasta que Firebase y Google Maps estén listos.
  if (!firebaseInstances || !isLoaded) {
    return <LoadingScreen />;
  }

  // Una vez que Firebase y Maps están listos, montar los proveedores UNA SOLA VEZ.
  // Esta estructura es estable y no se volverá a renderizar, evitando race conditions.
  return (
    <ThemeProvider
      attribute="class"
      themes={['light', 'game']}
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeBackground />
      <FirebaseProvider
        firebaseApp={firebaseInstances.firebaseApp}
        auth={firebaseInstances.auth}
        firestore={firebaseInstances.firestore}
      >
        <UserProvider>
          <MainNav>{children}</MainNav>
        </UserProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
