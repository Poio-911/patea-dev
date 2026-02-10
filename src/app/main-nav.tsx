'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useUser, useAuth, useDoc, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import type { Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { cn } from '@/lib/utils';
import { useFcm } from '@/hooks/use-fcm';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { useToast } from '@/hooks/use-toast';
import { isToday, parseISO } from 'date-fns';
import { Header } from '@/components/nav/header';
import { MobileNav } from '@/components/nav/mobile-nav';

export function MainNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const { requestPermission } = useFcm();

  const playerRef = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'players', user.uid);
  }, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  // Note: availablePlayer data is fetched in original but not seemingly used for UI?
  // We keep the check to maintain the loading state logic if it was critical.
  // Original: const { data: availablePlayerData, loading: availablePlayerLoading } = useDoc<AvailablePlayer>(availablePlayerRef);

  React.useEffect(() => {
    if (!userLoading && !user && pathname !== '/' && pathname !== '/login' && pathname !== '/register' && pathname !== '/forgot-password') {
      router.push('/login');
    }
  }, [user, userLoading, pathname, router]);

  React.useEffect(() => {
    if (user) {
      const lastLoginStr = localStorage.getItem('lastDailyLogin');
      const today = new Date();

      if (!lastLoginStr || !isToday(parseISO(lastLoginStr))) {
        localStorage.setItem('lastDailyLogin', today.toISOString());
        setTimeout(() => {
          toast({
            title: `👋 ¡Hola de nuevo, ${user.displayName?.split(' ')[0]}!`,
            description: "Recuerda que puedes pulsar el icono de ayuda (?) si tienes dudas.",
            duration: 5000,
          });
        }, 2000);
      }
    }
  }, [user, toast]);

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      try {
        const { clearSessionCookie } = await import('@/lib/auth-actions');
        await clearSessionCookie();
      } catch (e) {
        // Non-blocking if cookie clear fails
      }
      router.push('/');
    }
  };

  // Allow public pages to render without auth check
  const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Loading state
  if (userLoading || playerLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  const isFullscreenLayout = pathname === '/explore';

  return (
    <div className="relative min-h-screen w-full">
      <Header
        user={user}
        player={player || null}
        onLogout={handleLogout}
        onRequestPermission={requestPermission}
      />

      <main className={cn(
        "min-h-screen pt-16 pb-[env(safe-area-inset-bottom)]",
        !isFullscreenLayout && "overflow-y-auto"
      )}>
        <div className={cn(
          "min-h-full",
          !isFullscreenLayout ? "p-4 md:p-6 pb-20" : "p-0"
        )}>
          {children}
        </div>
      </main>

      <MobileNav />

      <WelcomeDialog />
    </div>
  );
}
