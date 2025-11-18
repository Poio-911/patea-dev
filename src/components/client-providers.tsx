'use client';

import React, { useState, useEffect } from 'react';
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
import { InstallPrompt } from './pwa/install-prompt';
import { UpdateNotification } from './pwa/update-notification';

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

  // Determina si el código se está ejecutando en el servidor
  const isServer = typeof window === 'undefined';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
    // No cargamos el script en el servidor
    preventGoogleFontsLoading: isServer,
  });

  useEffect(() => {
    // Solo inicializar Firebase en el cliente
    if (!isServer) {
      const instances = initializeFirebase();
      setFirebaseInstances(instances);
    }
  }, [isServer]);

  if (loadError) {
    console.error("Google Maps API failed to load: ", loadError);
  }

  // ✅ CORRECCIÓN: Si estamos en el servidor, o si los proveedores del cliente no están listos,
  // mostramos la pantalla de carga. Esto evita que los hooks que usan `useContext`
  // fallen durante el build del servidor (prerendering).
  if (isServer || !firebaseInstances) {
    return <LoadingScreen />;
  }

  // Una vez que estamos en el cliente y todo está cargado, montamos los proveedores.
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
           {!isLoaded ? (
            <LoadingScreen />
          ) : (
            <MainNav>{children}</MainNav>
          )}
          <InstallPrompt />
          <UpdateNotification />
        </UserProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
