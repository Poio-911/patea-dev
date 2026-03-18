'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { LogOut, Trophy, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ThemeBackground } from '@/components/theme-background';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const { user, loading } = useUser();
  const { setTheme } = useTheme();
  
  React.useEffect(() => {
    // Si la ruta es login, no lo pateamos
    if (pathname === '/organizer/login') {
      if (!loading && user?.role === 'organizer') {
        router.push('/organizer');
      }
      if (!loading && user && user.role !== 'organizer') {
        router.push('/dashboard');
      }
      return;
    }

    // If not loading and no user
    if (!loading && !user) {
      router.push('/organizer/login');
      return;
    }

    // Organizer area is organizer-role only
    if (!loading && user && user.role !== 'organizer') {
      router.push('/dashboard');
    }
  }, [user, loading, router, pathname]);

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      try {
        const { clearSessionCookie } = await import('@/lib/auth-actions');
        await clearSessionCookie();
      } catch (e) {}
      router.push('/login');
    }
  };

  if (loading || (!user && pathname !== '/organizer/login') || (user && pathname !== '/organizer/login' && user.role !== 'organizer')) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  // If we are on the login page, don't show the Header, just the content
  if (pathname === '/organizer/login') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Organizer Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4">
          <div className="mr-4 flex items-center space-x-2 cursor-pointer transition-colors hover:text-primary" onClick={() => router.push('/organizer')}>
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-headline font-black tracking-widest text-lg uppercase hidden sm:inline-block">
              Pateá <span className="text-primary">Organizer</span>
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                <Button
                    variant={typeof document !== 'undefined' && document.documentElement.classList.contains('game') ? 'ghost' : 'secondary'}
                    size="sm"
                    className={cn(
                        "h-8 text-xs font-medium",
                        typeof document !== 'undefined' && !document.documentElement.classList.contains('game') && "bg-background shadow-sm"
                    )}
                    onClick={() => setTheme("light")}
                >
                    <Sun className="mr-2 h-3 w-3" />
                    Claro
                </Button>
                <Button
                    variant={typeof document !== 'undefined' && document.documentElement.classList.contains('game') ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                        "h-8 text-xs font-medium",
                        typeof document !== 'undefined' && document.documentElement.classList.contains('game') && "bg-background shadow-sm"
                    )}
                    onClick={() => setTheme("game")}
                >
                    <span className="mr-2 text-xs">🎮</span>
                    Game
                </Button>
              </div>

              <span className="text-sm font-medium text-muted-foreground hidden md:inline-block">
                {user?.displayName}
              </span>
              <button 
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Cerrar Sesión</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Organizer Content */}
      <main className="flex-1 relative z-10 w-full overflow-hidden">
        <ThemeBackground />
        <div className="container p-4 md:p-6 mx-auto max-w-7xl pt-8 pb-16">
          {children}
        </div>
      </main>
    </div>
  );
}
