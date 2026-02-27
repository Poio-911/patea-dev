'use client';

import React, { useState, useEffect } from 'react';
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
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { UpdateNotification } from '@/components/pwa/update-notification';
import { PushNotificationPrompt } from '@/components/pwa/push-notification-prompt';
import { OfflineBanner } from '@/components/pwa/offline-banner';


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
      }).catch(() => { });
    }
  }, []);

  // Clear PWA badge counter whenever the user focuses the app
  useEffect(() => {
    const clearBadge = () => {
      if ('clearAppBadge' in navigator) {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => { });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') clearBadge();
    };

    window.addEventListener('focus', clearBadge);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    clearBadge(); // also clear on first mount

    return () => {
      window.removeEventListener('focus', clearBadge);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Dynamic theme-color meta tag — keeps Android status/nav bar in sync
  useEffect(() => {
    const updateThemeColor = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
        document.documentElement.classList.contains('game');
      const color = isDark ? '#0f172a' : '#3B82F6';
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = color;
    };
    updateThemeColor();
    // Observe class/attribute changes on <html>
    const observer = new MutationObserver(updateThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  // No Google Maps loading; avoid related errors entirely.

  // Wait for Firebase to initialize before rendering anything
  if (!firebaseInstances) {
    return (
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
  }

  // Once Firebase is ready, mount providers ONCE and never unmount them
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
          <AchievementToastProvider>
            <MainNav>{children}</MainNav>
            <InstallPrompt />
            <UpdateNotification />
            <PushNotificationPrompt />
            <OfflineBanner />
          </AchievementToastProvider>
        </UserProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
