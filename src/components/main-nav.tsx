
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
import { LayoutDashboard, LogOut, Settings, Users2, User } from 'lucide-react';
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
} from "@/components/ui/dropdown-menu"
import type { Player, AvailablePlayer } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { MatchIcon } from '@/components/icons/match-icon';
import { FindMatchIcon } from '@/components/icons/find-match-icon';
import { EvaluationIcon } from '@/components/icons/evaluation-icon';
import { useFcm } from '@/hooks/use-fcm';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { useToast } from '@/hooks/use-toast';
import { isToday, parseISO } from 'date-fns';
import { HeaderActions } from './header-actions';


const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/players', label: 'Jugadores', icon: SoccerPlayerIcon },
  { href: '/matches', label: 'Partidos', icon: MatchIcon },
  { href: '/evaluations', label: 'Evaluaciones', icon: EvaluationIcon },
  { href: '/find-match', label: 'Buscar', icon: FindMatchIcon },
];

export function MainNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
    }
  };

  const loading = userLoading || playerLoading || availablePlayerLoading;

  if (loading || !user) {
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
                  <HeaderActions />
              </div>

              <div className="flex items-center gap-2">
                  {player && (
                      <div className="flex items-center gap-3">
                          <div className="text-right">
                              <p className="font-bold text-sm truncate max-w-[100px] sm:max-w-none">{player.name}</p>
                              <p className="text-xs text-muted-foreground">{player.position}</p>
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
                      {navItems.map((item) => (
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
            <div className="p-4 md:p-6 pb-24">
                {children}
            </div>
          </main>
          
          <nav className="fixed bottom-0 left-0 right-0 z-20 h-16 border-t bg-background/70 backdrop-blur-lg md:hidden">
              <div className="mx-auto grid h-full max-w-lg grid-cols-5 font-medium">
              {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const isMatchIcon = item.href === '/matches';
                  return (
                  <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                      'group inline-flex flex-col items-center justify-center px-1 text-muted-foreground transition-colors hover:text-primary',
                      isActive && 'text-primary'
                      )}
                  >
                      <item.icon className={cn("h-6 w-6", isMatchIcon && "h-7 w-7")} />
                      <span className="text-xs">{item.label}</span>
                  </Link>
                  );
              })}
              </div>
          </nav>
      </div>
    </SidebarProvider>
  );
}
