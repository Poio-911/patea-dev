'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Logo } from '@/components/logo';
import { LogOut, Sun, LayoutDashboard, Home, UserCog, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ThemeBackground } from '@/components/theme-background';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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
  const [isGameTheme, setIsGameTheme] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const userRole = user?.role || 'player';
  const roleLabel: Record<'player' | 'organizer' | 'admin', string> = {
    player: 'Jugador',
    organizer: 'Organizador',
    admin: 'Admin',
  };
  
  React.useEffect(() => {
    setMounted(true);
    setIsGameTheme(document.documentElement.classList.contains('game'));
  }, []);

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
          <div className="mr-4 flex items-center gap-3 cursor-pointer transition-colors hover:text-primary" onClick={() => router.push('/organizer')}>
            <Logo showWordmark={true} />
            <span className="text-[10px] uppercase tracking-widest font-black text-primary/80 border border-primary/20 rounded-full px-2 py-1 hidden sm:inline-flex">
              Organizer
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5">
            <Button
              variant={pathname === '/organizer' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push('/organizer')}
            >
              <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
              Panel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push('/dashboard')}
            >
              <Home className="mr-2 h-3.5 w-3.5" />
              App Principal
            </Button>
            <Button
              variant={pathname.startsWith('/organizer/profile') ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push('/organizer/profile')}
            >
              <UserCog className="mr-2 h-3.5 w-3.5" />
              Perfil
            </Button>
          </div>

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Abrir navegación organizer">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <div className="mt-8 space-y-2">
                  <Button
                    variant={pathname === '/organizer' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => router.push('/organizer')}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Panel
                  </Button>
                  <Button
                    variant={pathname.startsWith('/organizer/profile') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => router.push('/organizer/profile')}
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    Perfil
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => router.push('/dashboard')}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    App Principal
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                <Button
                  variant={isGameTheme ? 'ghost' : 'secondary'}
                    size="sm"
                    className={cn(
                        "h-8 text-xs font-medium",
                    !isGameTheme && "bg-background shadow-sm"
                    )}
                  onClick={() => { setTheme('light'); setIsGameTheme(false); }}
                >
                    <Sun className="mr-2 h-3 w-3" />
                    Claro
                </Button>
                <Button
                  variant={isGameTheme ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                        "h-8 text-xs font-medium",
                    isGameTheme && "bg-background shadow-sm"
                    )}
                  onClick={() => { setTheme('game'); setIsGameTheme(true); }}
                >
                    <span className="mr-2 text-xs">🎮</span>
                    Game
                </Button>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <Badge variant="outline" className="uppercase tracking-widest text-[10px] font-black border-primary/20 text-primary/90 bg-primary/5">
                  {roleLabel[userRole as 'player' | 'organizer' | 'admin']}
                </Badge>
                <span className="text-sm font-medium text-muted-foreground">
                  {user?.displayName || 'Sin nombre'}
                </span>
              </div>
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
