'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutDashboard, LogOut, Users2, User, BellRing, Sun, Gamepad2, UserCircle, Trophy, ClipboardCheck, X, CalendarDays, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useUser, useAuth, useDoc, useFirestore, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { GroupSwitcher } from '@/components/group-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import type { Player, PlayerPosition, EvaluationAssignment } from '@/lib/types';
import { doc, collectionGroup, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
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
  { href: '/groups', label: 'Grupos', icon: Users2 },
  { href: '/players', label: 'Jugadores', icon: UserCircle },
  { href: '/evaluations', label: 'Evaluar', icon: ClipboardCheck },
];

const positionBadgeStyles: Record<PlayerPosition, string> = {
  POR: 'text-orange-600 game:text-orange-400',
  DEF: 'text-green-600 game:text-green-400',
  MED: 'text-blue-600 game:text-blue-400',
  DEL: 'text-red-600 game:text-red-400',
};


export function MainNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { setTheme, theme } = useTheme();
  const [matchesMenuOpen, setMatchesMenuOpen] = React.useState(false);
  const matchesMenuRef = React.useRef<HTMLDivElement | null>(null);

  const { requestPermission } = useFcm();

  const playerRef = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'players', user.uid);
  }, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);
  
  const pendingEvaluationsQuery = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'assignments'),
      where('evaluatorId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [firestore, user?.uid]);
  
  const { data: pendingEvaluations } = useCollection<EvaluationAssignment>(pendingEvaluationsQuery);
  const pendingEvaluationsCount = pendingEvaluations?.length || 0;

  // Declarar variables que se usarán en los useEffect
  const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  const loading = userLoading || playerLoading;

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

  // Cerrar submenú al navegar de ruta
  React.useEffect(() => {
    setMatchesMenuOpen(false);
  }, [pathname]);

  // Cerrar al hacer click fuera (mobile overlay principalmente)
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (matchesMenuOpen && matchesMenuRef.current && !matchesMenuRef.current.contains(e.target as Node)) {
        setMatchesMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [matchesMenuOpen]);

  // Manejar redirección a login cuando no hay usuario (solo en páginas protegidas)
  React.useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      router.push('/login');
    }
  }, [loading, user, isPublicPage, router]);

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
    }
  };

  // Si es una página pública, renderizarla directamente sin verificar autenticación.
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Para páginas protegidas, verificar la carga y el usuario.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }
  
  if (!user) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
          <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
        </div>
    );
  }
  
  return (
    <SidebarProvider>
      <WelcomeDialog />
      <div className="relative h-screen w-full">
          <header className="fixed top-0 left-0 right-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/70 px-4 backdrop-blur-lg sm:px-6 md:left-[var(--sidebar-width)] md:data-[state=collapsed]:left-[var(--sidebar-width-icon)] transition-all duration-300 ease-in-out">
              <div className="flex items-center gap-2">
                  <div className="hidden md:block">
                      <SidebarTrigger />
                  </div>
                  <HelpDialog />
                  <NotificationBell />
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                  {player && (
                      <div className="flex items-center gap-3">
                          <div className="text-right">
                              <p className="font-bold text-sm truncate max-w-[100px] sm:max-w-none">{player.name}</p>
                              <p className={cn("text-xs font-semibold", positionBadgeStyles[player.position])}>{player.position}</p>
                          </div>
                           <div className="flex items-center justify-center h-10 w-10 text-xl font-bold rounded-full bg-primary/10 border-2 border-primary/20 text-primary">
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
                      <DropdownMenuContent className="w-72" align="end" forceMount>
                          <DropdownMenuLabel className="font-normal">
                              <div className="flex flex-col space-y-1">
                                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                                  <p className="text-xs leading-none text-muted-foreground">
                                      {user.email}
                                  </p>
                              </div>
                          </DropdownMenuLabel>
                          
                          <DropdownMenuSeparator />

                          <DropdownMenuGroup>
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
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
                          </DropdownMenuGroup>
                          
                          <DropdownMenuSeparator />

                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Grupo Activo</DropdownMenuLabel>
                            <div className="px-2">
                                <GroupSwitcher />
                            </div>
                          </DropdownMenuGroup>

                          <DropdownMenuSeparator />
                          
                          <DropdownMenuGroup>
                               <DropdownMenuLabel>Apariencia</DropdownMenuLabel>
                                <div className="grid grid-cols-2 gap-2 px-2 py-1">
                                    <Button
                                        variant={theme === 'light' ? 'secondary' : 'outline'}
                                        size="sm"
                                        className="h-auto py-2"
                                        onClick={() => setTheme('light')}
                                    >
                                        <Sun className="mr-2 h-4 w-4" />
                                        Claro
                                    </Button>
                                    <Button
                                        variant={theme === 'game' ? 'secondary' : 'outline'}
                                        size="sm"
                                        className="h-auto py-2"
                                        onClick={() => setTheme('game')}
                                    >
                                        <Gamepad2 className="mr-2 h-4 w-4" />
                                        Juego
                                    </Button>
                                </div>
                          </DropdownMenuGroup>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem onClick={requestPermission}>
                              <BellRing className="mr-2 h-4 w-4" />
                              <span>Activar Notificaciones</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleLogout}>
                              <LogOut className="mr-2 h-4 w-4" />
                              <span>Cerrar sesión</span>
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
              </div>
          </header>

          <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-3">
                    <SoccerPlayerIcon className="h-8 w-8 text-primary" />
                    <span className="text-xl font-bold font-headline">Pateá</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <SidebarGroup>
                      <SidebarGroupLabel>Menú</SidebarGroupLabel>
                      {baseNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <Link href={item.href}>
                            <SidebarMenuButton
                              isActive={pathname.startsWith(item.href)}
                              tooltip={item.label}
                            >
                              <item.icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </Link>
                        </SidebarMenuItem>
                      ))}
                      <SidebarMenuItem>
                        <SidebarMenuButton
                           isActive={pathname.startsWith('/matches') || pathname.startsWith('/competitions')}
                           tooltip="Partidos & Competiciones"
                        >
                            <Trophy/>
                            <div className="flex flex-col items-start w-full">
                                <span>Competición</span>
                                <div className="flex gap-2 mt-1">
                                    <Button size="sm" variant={pathname.startsWith('/matches') ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs" asChild><Link href="/matches">Partidos</Link></Button>
                                    <Button size="sm" variant={pathname.startsWith('/competitions') ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs" asChild><Link href="/competitions">Torneos</Link></Button>
                                </div>
                            </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarGroup>
                </SidebarMenu>
                 <div className="mt-auto">
                    <Separator className="my-2" />
                    <SidebarGroup>
                        <SidebarGroupLabel>Mi Grupo</SidebarGroupLabel>
                        <GroupSwitcher />
                    </SidebarGroup>
                </div>
            </SidebarContent>
          </Sidebar>

          <main className={cn(
              "h-screen overflow-y-auto pt-16 md:pl-[var(--sidebar-width)] transition-[padding] duration-300 ease-in-out",
              "group-data-[state=collapsed]/sidebar-wrapper:md:pl-[var(--sidebar-width-icon)]"
          )}>
            <div className="p-4 md:p-6 pb-24 md:pb-6">
                {children}
            </div>
          </main>
          
          <nav className="fixed bottom-4 left-4 right-4 z-30 h-16 rounded-xl border bg-background/70 shadow-lg backdrop-blur-lg md:hidden">
            <div className="relative mx-auto h-full max-w-lg">
                <div className="grid h-full w-full grid-cols-5 font-medium">
                    {baseNavItems.map((item) => {
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn('group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-primary', isActive && 'text-primary font-semibold')}
                        >
                          <item.icon className={cn('h-5 w-5 transition-all duration-200', isActive && 'scale-110')} />
                          <span className="text-[10px] leading-none">{item.label}</span>
                        </Link>
                      );
                    })}
                    <div ref={matchesMenuRef} className="relative flex items-center justify-center">
                        <button
                        type="button"
                        onClick={() => setMatchesMenuOpen((o) => !o)}
                        className={cn('group relative inline-flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-primary', (pathname.startsWith('/matches') || pathname.startsWith('/competitions')) && 'text-primary font-semibold')}
                        aria-haspopup="true"
                        aria-expanded={matchesMenuOpen}
                        >
                            <Trophy className={cn('h-5 w-5 transition-all duration-200', (pathname.startsWith('/matches') || pathname.startsWith('/competitions')) && 'scale-110')} />
                            <span className="text-[10px] leading-none">Partidos</span>
                        </button>
                    </div>
                </div>
                 <AnimatePresence>
                    {matchesMenuOpen && (
                        <motion.div
                            initial="closed"
                            animate="open"
                            exit="closed"
                            variants={{
                                open: { transition: { staggerChildren: 0.1 } },
                                closed: { transition: { staggerChildren: 0.1, staggerDirection: -1 } }
                            }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex items-center justify-center gap-4"
                        >
                             <motion.div variants={{ closed: { y: 20, opacity: 0 }, open: { y: 0, opacity: 1 } }}>
                                <Link href="/matches" onClick={() => setMatchesMenuOpen(false)}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30">
                                            <CalendarDays className="h-6 w-6" />
                                        </div>
                                        <span className="text-xs font-semibold">Partidos</span>
                                    </div>
                                </Link>
                             </motion.div>
                             <motion.div variants={{ closed: { y: 20, opacity: 0 }, open: { y: 0, opacity: 1 } }}>
                                <Link href="/competitions" onClick={() => setMatchesMenuOpen(false)}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30">
                                            <Trophy className="h-6 w-6" />
                                        </div>
                                        <span className="text-xs font-semibold">Torneos</span>
                                    </div>
                                </Link>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
          </nav>
      </div>
    </SidebarProvider>
  );
}