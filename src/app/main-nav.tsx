'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutDashboard, LogOut, Users2, User, BellRing, Moon, Sun, Trophy, ClipboardCheck, X, Search } from 'lucide-react';
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
  const pathname = usePathname();
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const [matchesMenuOpen, setMatchesMenuOpen] = React.useState(false);
  const matchesMenuRef = React.useRef<HTMLDivElement | null>(null);
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
      <header className="fixed top-0 left-0 right-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/70 px-4 backdrop-blur-lg sm:px-6">
        {/* Left: Logo + Desktop Menu */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <SoccerPlayerIcon className="h-8 w-8 text-primary" />
            <span className="hidden sm:block text-xl font-bold font-headline">Pateá</span>
          </Link>

          {/* Desktop Horizontal Menu */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/dashboard" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-accent", pathname.startsWith('/dashboard') && 'bg-accent text-accent-foreground')}>
              Panel
            </Link>
            <Link href="/groups" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-accent", pathname.startsWith('/groups') && 'bg-accent text-accent-foreground')}>
              Grupos
            </Link>
            <Link href="/players" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-accent", pathname.startsWith('/players') && 'bg-accent text-accent-foreground')}>
              Jugadores
            </Link>
            <Link href="/matches" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-accent", pathname.startsWith('/matches') && !pathname.startsWith('/find-match') && 'bg-accent text-accent-foreground')}>
              Partidos
            </Link>
            <Link href="/competitions" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-accent", pathname.startsWith('/competitions') && 'bg-accent text-accent-foreground')}>
              Competiciones
            </Link>
            <Link href="/find-match" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-accent", pathname.startsWith('/find-match') && 'bg-accent text-accent-foreground')}>
              Buscar
            </Link>
            <Link href="/evaluations" className={cn("px-3 py-2 text-sm font-medium rounded-md transition hover:bg-accent", pathname.startsWith('/evaluations') && 'bg-accent text-accent-foreground')}>
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
      <main className="h-screen overflow-y-auto pt-16">
        <div className="p-4 md:p-6 pb-24">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-4 left-4 right-4 z-30 h-16 rounded-xl border bg-background/70 backdrop-blur-lg shadow-lg md:hidden">
        <div className="relative mx-auto h-full max-w-lg">
          <div className="grid h-full w-full grid-cols-5 font-medium">
            {baseNavItems.slice(0, 2).map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-primary', isActive && 'text-primary font-semibold')}
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
                className={cn('group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-primary', (pathname.startsWith('/matches') || pathname.startsWith('/competitions') || pathname.startsWith('/find-match')) && 'text-primary font-semibold')}
                aria-haspopup="true"
                aria-expanded={matchesMenuOpen}
              >
                <Trophy className={cn('h-5 w-5 transition-all duration-200', (pathname.startsWith('/matches') || pathname.startsWith('/competitions') || pathname.startsWith('/find-match')) && 'scale-110')} />
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
                        className="fixed inset-0 z-40"
                        onClick={() => setMatchesMenuOpen(false)}
                      />,
                      document.body
                    )}

                    {/* Premium menu with vibrant colors - also portalled for proper z-index */}
                    {createPortal(
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
                      >
                        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl min-w-[180px]">
                          {/* Partidos - Blue theme */}
                          <Link
                            href="/matches"
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                              pathname.startsWith('/matches') && !pathname.startsWith('/find-match')
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-gradient-to-r from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200 hover:shadow-md text-blue-900'
                            )}
                            onClick={() => setMatchesMenuOpen(false)}
                          >
                            <div className={cn(
                              'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200',
                              pathname.startsWith('/matches') && !pathname.startsWith('/find-match')
                                ? 'bg-white/20'
                                : 'bg-blue-500/15'
                            )}>
                              <Trophy className={cn(
                                'h-5 w-5',
                                pathname.startsWith('/matches') && !pathname.startsWith('/find-match')
                                  ? 'text-white'
                                  : 'text-blue-600'
                              )} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">Partidos</span>
                              <span className={cn(
                                'text-[10px]',
                                pathname.startsWith('/matches') && !pathname.startsWith('/find-match')
                                  ? 'text-white/70'
                                  : 'text-blue-600/70'
                              )}>Tus partidos</span>
                            </div>
                          </Link>

                          {/* Buscar - Amber theme */}
                          <Link
                            href="/find-match"
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                              pathname.startsWith('/find-match')
                                ? 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/30'
                                : 'bg-gradient-to-r from-amber-50 to-yellow-100/50 hover:from-amber-100 hover:to-yellow-200 hover:shadow-md text-amber-900'
                            )}
                            onClick={() => setMatchesMenuOpen(false)}
                          >
                            <div className={cn(
                              'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200',
                              pathname.startsWith('/find-match')
                                ? 'bg-white/20'
                                : 'bg-amber-500/15'
                            )}>
                              <Search className={cn(
                                'h-5 w-5',
                                pathname.startsWith('/find-match')
                                  ? 'text-amber-950'
                                  : 'text-amber-600'
                              )} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">Buscar</span>
                              <span className={cn(
                                'text-[10px]',
                                pathname.startsWith('/find-match')
                                  ? 'text-amber-950/70'
                                  : 'text-amber-600/70'
                              )}>Encontrar partido</span>
                            </div>
                          </Link>

                          {/* Competiciones - Green theme */}
                          <Link
                            href="/competitions"
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                              pathname.startsWith('/competitions')
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-gradient-to-r from-emerald-50 to-green-100/50 hover:from-emerald-100 hover:to-green-200 hover:shadow-md text-emerald-900'
                            )}
                            onClick={() => setMatchesMenuOpen(false)}
                          >
                            <div className={cn(
                              'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200',
                              pathname.startsWith('/competitions')
                                ? 'bg-white/20'
                                : 'bg-emerald-500/15'
                            )}>
                              <Trophy className={cn(
                                'h-5 w-5',
                                pathname.startsWith('/competitions')
                                  ? 'text-white'
                                  : 'text-emerald-600'
                              )} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">Competiciones</span>
                              <span className={cn(
                                'text-[10px]',
                                pathname.startsWith('/competitions')
                                  ? 'text-white/70'
                                  : 'text-emerald-600/70'
                              )}>Torneos y ligas</span>
                            </div>
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
                  className={cn('group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-primary', isActive && 'text-primary font-semibold')}
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
