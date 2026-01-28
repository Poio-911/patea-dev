'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutDashboard, LogOut, Users2, User, BellRing, Moon, Sun, Trophy, ClipboardCheck, X, Search, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useUser, useAuth, useDoc, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { GroupSwitcher } from '@/components/group-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu"
import type { Player, AvailablePlayer } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { PlayerPositionBadge } from '@/components/player-styles';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Logo } from '@/components/logo';
import { MatchIcon } from '@/components/icons/match-icon';
import { EvaluationIcon } from '@/components/icons/evaluation-icon';
import { NotificationBell } from '@/components/notification-bell';
import { useFcm } from '@/hooks/use-fcm';
import { HelpDialog } from '@/components/help-dialog';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { useToast } from '@/hooks/use-toast';
import { isToday, parseISO } from 'date-fns';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';


// NAV FINAL (versión app): 5 items visibles + submenú en Partidos (Partidos + Competiciones)
const baseNavItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/players', label: 'Jugadores', icon: User },
  { href: '/groups', label: 'Grupos', icon: Users2 },
  { href: '/evaluations', label: 'Evaluaciones', icon: ClipboardCheck },
];

const matchesSubmenuItems = [
  { href: '/matches', label: 'Partidos', icon: Trophy },
  { href: '/find-match', label: 'Buscar', icon: Search },
  { href: '/competitions', label: 'Competiciones', icon: Trophy },
];

export function MainNav({ children }: { children: React.ReactNode }) {
  // ... (keep existing hooks)
  const pathname = usePathname() ?? '';
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const [matchesMenuOpen, setMatchesMenuOpen] = React.useState(false);
  const matchesMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = React.useState<'sheet' | 'bar'>(() => {
    if (typeof window === 'undefined') return 'sheet';
    const saved = window.localStorage.getItem('matchesMenuStyle');
    return (saved === 'bar' || saved === 'sheet') ? saved : 'sheet';
  });
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('matchesMenuStyle', menuStyle);
    }
  }, [menuStyle]);
  // Remove EvaluationsIcon alias if no longer needed or update it
  const EvaluationsIcon = baseNavItems[3].icon;

  // ... (keep existing effects and logic)
  const { requestPermission } = useFcm();

  const playerRef = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'players', user.uid);
  }, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const availablePlayerRef = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'availablePlayers', user.uid);
  }, [firestore, user?.uid]);
  const { data: availablePlayerData, loading: availablePlayerLoading } = useDoc<AvailablePlayer>(availablePlayerRef);


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

  // Cierra el submenú al cambiar ruta
  React.useEffect(() => { setMatchesMenuOpen(false); }, [pathname]);
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (matchesMenuOpen && matchesMenuRef.current && !matchesMenuRef.current.contains(e.target as Node)) {
        setMatchesMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [matchesMenuOpen]);

  // Long-press to toggle submenu style (dev-friendly prototype switch)
  const pressTimerRef = React.useRef<number | null>(null);
  const pressStartRef = React.useRef<number>(0);
  const longPressMs = 550;
  const startPress = () => { pressStartRef.current = Date.now(); };
  const endPress = () => {
    if (!pressStartRef.current) return;
    const elapsed = Date.now() - pressStartRef.current;
    pressStartRef.current = 0;
    if (elapsed >= longPressMs) {
      setMenuStyle(prev => {
        const next = prev === 'sheet' ? 'bar' : 'sheet';
        toast({ title: 'Estilo de menú cambiado', description: next === 'sheet' ? 'Bottom Sheet' : 'Barra Compacta' });
        return next;
      });
    }
  };

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

  // For protected pages, check auth and loading states
  const loading = userLoading || playerLoading || availablePlayerLoading;

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full">
      {/* Desktop & Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-lg shadow-sm sm:px-6">
        {/* Left: Logo + Desktop Menu */}
        <div className="flex items-center gap-6">
          {/* Logo (theme-aware) */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo />
          </Link>

          {/* Desktop Horizontal Menu */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/dashboard" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-secondary", pathname.startsWith('/dashboard') && 'bg-secondary text-secondary-foreground')}>
              Panel
            </Link>
            <Link href="/groups" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-secondary", pathname.startsWith('/groups') && 'bg-secondary text-secondary-foreground')}>
              Grupos
            </Link>
            <Link href="/players" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-secondary", pathname.startsWith('/players') && 'bg-secondary text-secondary-foreground')}>
              Jugadores
            </Link>
            <Link href="/matches" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-secondary", pathname.startsWith('/matches') && !pathname.startsWith('/find-match') && 'bg-secondary text-secondary-foreground')}>
              Partidos
            </Link>
            <Link href="/competitions" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-secondary", pathname.startsWith('/competitions') && 'bg-secondary text-secondary-foreground')}>
              Competiciones
            </Link>
            <Link href="/find-match" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-secondary", pathname.startsWith('/find-match') && 'bg-secondary text-secondary-foreground')}>
              Buscar
            </Link>
            <Link href="/evaluations" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-secondary", pathname.startsWith('/evaluations') && 'bg-secondary text-secondary-foreground')}>
              Evaluaciones
            </Link>
          </nav>
        </div>

        {/* Right: Help, Notifications, User */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <HelpDialog />
            </div>
            <NotificationBell />
          </div>

          {player && (
            <div className="flex items-center gap-2 md:gap-3">
              <div className="text-right hidden xs:block">
                <p className="font-bold text-sm truncate max-w-[80px] sm:max-w-none">{player.name}</p>
                <div className="flex justify-end">
                  <PlayerPositionBadge position={player.position} size="sm" showIcon={false} className="h-5 px-1.5 text-[10px]" />
                </div>
              </div>
              {/* Mobile only: Name and Position stacked differently if needed, or just show OVR and rely on dropdown for details? 
                  User said: "SACASTE EL NOMBRE EL OVR Y LA POSICON EN EL HEADER DEBE VERSE SIEMPRE"
                  So we must show them. On very small screens space is tight.
              */}
              <div className="flex flex-col items-end xs:hidden">
                <span className="text-[10px] font-bold truncate max-w-[60px]">{player.name}</span>
                <PlayerPositionBadge position={player.position} size="sm" showIcon={false} className="h-4 px-1 py-0 text-[9px]" />
              </div>

              <div className="flex items-center justify-center h-9 w-9 md:h-10 md:w-10 text-sm md:text-xl font-bold rounded-full bg-primary/10 border-2 border-primary/20 text-primary">
                {player.ovr}
              </div>
            </div>
          )}

          <Separator orientation="vertical" className="h-10 mx-1 hidden sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-12 w-12 rounded-full">
                <Avatar className="h-12 w-12 border overflow-hidden">
                  <AvatarImage
                    src={user?.photoURL || ''}
                    alt={user?.displayName || 'User'}
                    data-ai-hint="user avatar"
                    style={{
                      objectFit: 'cover',
                      objectPosition: `${player?.cropPosition?.x || 50}% ${player?.cropPosition?.y || 50}%`,
                      transform: `scale(${player?.cropZoom || 1})`,
                      transformOrigin: 'center center',
                    }}
                  />
                  <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Mi Perfil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/groups">
                  <Users2 className="mr-2 h-4 w-4" />
                  <span>Gestionar Grupos</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span>Cambiar Tema</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setTheme("light")}>Claro</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("game")}>Game</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("nike")}>Nike</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={requestPermission}>
                <BellRing className="mr-2 h-4 w-4" />
                <span>Activar Notificaciones</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}

      {/* Ajuste: padding inferior para no empujar el menú, y safe-area siempre presente */}
      <main className="h-screen overflow-y-auto pt-16 pb-[env(safe-area-inset-bottom)]">
        <div className="p-4 md:p-6 pb-20">
          {children}
        </div>
      </main>

      {/* Mobile nav: positioned above safe-area to maintain full height for centered icons */}
      <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-[70] h-16 rounded-xl border bg-card/80 backdrop-blur-lg shadow-lg md:hidden">
        <div className="relative mx-auto h-full max-w-lg">
          <div className="grid h-full w-full grid-cols-5 items-center font-medium">
            {baseNavItems.slice(0, 2).map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-foreground', isActive && 'text-foreground font-semibold')}
                >
                  <Icon className={cn('h-5 w-5 transition-all duration-200', isActive && 'scale-110')} />
                  <span className="text-[10px] leading-none">{item.label}</span>
                </Link>
              );
            })}
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => setMatchesMenuOpen(o => !o)}
                onMouseDown={startPress}
                onMouseUp={endPress}
                onTouchStart={startPress}
                onTouchEnd={endPress}
                className={cn('group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-foreground', (pathname.startsWith('/matches') || pathname.startsWith('/competitions') || pathname.startsWith('/find-match')) && 'text-foreground font-semibold')}
                aria-haspopup="true"
                aria-expanded={matchesMenuOpen}
              >
                <Calendar className={cn('h-5 w-5 transition-all duration-200', (pathname.startsWith('/matches') || pathname.startsWith('/competitions') || pathname.startsWith('/find-match')) && 'scale-110')} />
                <span className="text-[10px] leading-none">Partidos</span>
              </button>

              {/* Vibrant submenu with app-matching design */}
              <AnimatePresence>
                {matchesMenuOpen && (
                  <>
                    {/* Subtle backdrop */}
                    {createPortal(
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[60]"
                        onClick={() => setMatchesMenuOpen(false)}
                      />,
                      document.body
                    )}

                    {/* Prototypes: render either Bottom Sheet or Compact Bar */}
                    {menuStyle === 'sheet' && createPortal(
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="fixed inset-x-0 bottom-0 z-[70]"
                      >
                        <div ref={matchesMenuRef} className="rounded-t-2xl bg-background/95 backdrop-blur-xl border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.2)] pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                          <div className="mx-auto h-1.5 w-10 rounded-full bg-muted mb-2" />
                          <div className="px-4 pb-2 space-y-2">
                            <Link href="/matches" onClick={() => setMatchesMenuOpen(false)} className={cn('flex items-center gap-3 p-3 rounded-xl transition hover:bg-secondary/30', pathname.startsWith('/matches') && !pathname.startsWith('/find-match') && 'bg-secondary text-secondary-foreground')}>
                              <div className="w-9 h-9 grid place-items-center rounded-lg bg-secondary/30">
                                <Calendar className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">Partidos</span>
                                <span className="text-[11px] text-muted-foreground">Tus partidos</span>
                              </div>
                            </Link>
                            <Link href="/find-match" onClick={() => setMatchesMenuOpen(false)} className={cn('flex items-center gap-3 p-3 rounded-xl transition hover:bg-secondary/30', pathname.startsWith('/find-match') && 'bg-secondary text-secondary-foreground')}>
                              <div className="w-9 h-9 grid place-items-center rounded-lg bg-secondary/30">
                                <Search className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">Buscar</span>
                                <span className="text-[11px] text-muted-foreground">Encontrar partido</span>
                              </div>
                            </Link>
                            <Link href="/competitions" onClick={() => setMatchesMenuOpen(false)} className={cn('flex items-center gap-3 p-3 rounded-xl transition hover:bg-secondary/30', pathname.startsWith('/competitions') && 'bg-secondary text-secondary-foreground')}>
                              <div className="w-9 h-9 grid place-items-center rounded-lg bg-secondary/30">
                                <Trophy className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">Competiciones</span>
                                <span className="text-[11px] text-muted-foreground">Torneos y ligas</span>
                              </div>
                            </Link>
                          </div>
                        </div>
                      </motion.div>,
                      document.body
                    )}

                    {menuStyle === 'bar' && createPortal(
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom)+8px)] left-1/2 -translate-x-1/2 z-[70]"
                      >
                        <div ref={matchesMenuRef} className="flex items-center gap-2 px-2 py-2 rounded-2xl bg-background/95 backdrop-blur-xl border border-border shadow-2xl">
                          <Link href="/matches" onClick={() => setMatchesMenuOpen(false)} className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm transition', pathname.startsWith('/matches') && !pathname.startsWith('/find-match') ? 'bg-secondary text-secondary-foreground' : 'hover:bg-secondary/30') }>
                            <Calendar className="h-4 w-4" /> <span>Partidos</span>
                          </Link>
                          <Link href="/find-match" onClick={() => setMatchesMenuOpen(false)} className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm transition', pathname.startsWith('/find-match') ? 'bg-secondary text-secondary-foreground' : 'hover:bg-secondary/30') }>
                            <Search className="h-4 w-4" /> <span>Buscar</span>
                          </Link>
                          <Link href="/competitions" onClick={() => setMatchesMenuOpen(false)} className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm transition', pathname.startsWith('/competitions') ? 'bg-secondary text-secondary-foreground' : 'hover:bg-secondary/30') }>
                            <Trophy className="h-4 w-4" /> <span>Competiciones</span>
                          </Link>
                        </div>
                      </motion.div>,
                      document.body
                    )}
                  </>
                )}
              </AnimatePresence>
            </div>
            {baseNavItems.slice(2, 4).map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-foreground', isActive && 'text-foreground font-semibold')}
                >
                  <Icon className={cn('h-5 w-5 transition-all duration-200', isActive && 'scale-110')} />
                  <span className="text-[10px] leading-none">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <WelcomeDialog />
    </div>
  );
}
