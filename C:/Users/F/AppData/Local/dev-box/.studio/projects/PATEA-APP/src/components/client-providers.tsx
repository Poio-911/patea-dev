'use client';

import React from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/index';
import { UserProvider } from '@/firebase/auth/use-user';
import { MainNav } from '@/components/main-nav';
import { usePathname } from 'next/navigation';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';

type FirebaseClientProviderProps = {
  children: React.ReactNode;
};

export function ClientProviders({ children }: FirebaseClientProviderProps) {
    const pathname = usePathname();
    const { firebaseApp, auth, firestore } = initializeFirebase();

    const noNavRoutes = ['/', '/login', '/register', '/forgot-password'];

    if (noNavRoutes.includes(pathname)) {
        return (
             <FirebaseProvider
                firebaseApp={firebaseApp}
                auth={auth}
                firestore={firestore}
            >
                <UserProvider>{children}</UserProvider>
            </FirebaseProvider>
        );
    }

    return (
        <FirebaseProvider
            firebaseApp={firebaseApp}
            auth={auth}
            firestore={firestore}
        >
            <UserProvider>
                <MainNav>{children}</MainNav>
            </UserProvider>
        </FirebaseProvider>
    );
}
