'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/index';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { UserProvider } from '@/firebase/auth/use-user';
import { MainNav } from '@/app/main-nav';
import { ThemeProvider } from 'next-themes';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { ThemeBackground } from '@/components/theme-background';
import { AchievementToastProvider } from '@/components/achievement-toast';
import { HelpChatFab } from '@/components/help-chat-fab';

type FirebaseClientProviderProps = {
  children: React.ReactNode;
};

export function ClientProviders({ children }: FirebaseClientProviderProps) {
  const [firebaseInstances, setFirebaseInstances] = useState<{
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  // Google Maps loader removed; we rely on OSM endpoints instead.

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebaseInstances(instances);
  }, []);

  // In development, ensure any previously registered service workers are unregistered
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      }).catch(() => {});
    }
  }, []);

  // No Google Maps loading; avoid related errors entirely.

  // Wait for Firebase to initialize before rendering anything
  if (!firebaseInstances) {
    return (
      <ThemeProvider
        attribute="class"
        themes={['light', 'game', 'nike']}
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
  }

  // Once Firebase is ready, mount providers ONCE and never unmount them
  return (
    <ThemeProvider
      attribute="class"
      themes={['light', 'game', 'nike']}
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
          <AchievementToastProvider>
            <MainNav>{children}</MainNav>
            <HelpChatFab />
          </AchievementToastProvider>
        </UserProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
