
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
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutDashboard, LogOut, Settings, Users2, User, BellRing, HelpCircle, CheckCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';
import { MatchIcon } from './icons/match-icon';
import { FindMatchIcon } from './icons/find-match-icon';
import { EvaluationIcon } from './icons/evaluation-icon';
import { NotificationBell } from './notification-bell';
import { useFcm } from '@/hooks/use-fcm';
import { HelpDialog } from './help-dialog';
import { WelcomeDialog } from './welcome-dialog';
import { useToast } from '@/hooks/use-toast';
import { isToday, parseISO } from 'date-fns';


const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/players', label: 'Jugadores', icon: SoccerPlayerIcon },
  { href: '/matches', label: 'Partidos', icon: MatchIcon },
  { href: '/evaluations', label: 'Evaluaciones', icon: EvaluationIcon },
  { href: '/find-match', label: 'Buscar', icon: FindMatchIcon },
];

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};


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
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);
  
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
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <SoccerPlayerIcon className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold font-headline">Pateá</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    {item.label}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Separator className="my-2" />
           <SidebarGroup>
            <SidebarGroupLabel>Mi Grupo</SidebarGroupLabel>
            <GroupSwitcher />
          </SidebarGroup>
        </SidebarFooter>
      </Sidebar>
      <div className="relative flex h-screen w-full flex-col">
          <header className="fixed top-0 left-0 right-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/70 px-4 backdrop-blur-lg sm:px-6 md:peer-data-[state=collapsed]:peer-data-[collapsible=icon]:pl-14 md:pl-72">
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
                              <p className="font-bold text-sm truncate">{player.name}</p>
                          </div>
                          <Badge className={cn("px-2.5 py-1 text-base font-bold", positionBadgeStyles[player.position])}>
                              <span className="font-bold">{player.ovr}</span>
                              <span className="font-medium ml-1.5">{player.position}</span>
                          </Badge>
                      </div>
                  )}
                  
                  <Separator orientation="vertical" className="h-10 mx-1 hidden sm:block" />

                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="relative h-12 w-12 rounded-full">
                              <Avatar className="h-12 w-12 border">
                                  <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} data-ai-hint="user avatar" />
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
                          <div className="p-2">
                              <GroupSwitcher />
                          </div>
                          <DropdownMenuItem asChild>
                              <Link href="/groups">
                                  <Users2 className="mr-2 h-4 w-4" />
                                  <span>Gestionar Grupos</span>
                              </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                              <Link href="/profile">
                                  <User className="mr-2 h-4 w-4" />
                                  <span>Mi Perfil</span>
                              </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={requestPermission}>
                              <BellRing className="mr-2 h-4 w-4" />
                              <span>Activar Notificaciones</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                              <Settings className="mr-2 h-4 w-4" />
                              <span>Ajustes</span>
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

          {availablePlayerData && (
            <div className="fixed top-16 left-0 right-0 z-10 h-8 bg-gradient-to-r from-green-500/80 to-emerald-600/80 text-white flex items-center justify-center shadow-md animate-in fade-in-0 slide-in-from-top-2 duration-500 md:left-72 md:peer-data-[state=collapsed]:peer-data-[collapsible=icon]:left-14">
                <CheckCircle className="mr-2 h-4 w-4" />
                <p className="text-xs font-semibold">Estás visible para otros partidos</p>
            </div>
          )}

          <main className={cn(
            "flex-1 overflow-y-auto p-4 pt-20 pb-20 md:p-6 md:pt-24 md:pb-6 md:pl-72 md:peer-data-[state=collapsed]:peer-data-[collapsible=icon]:pl-14",
            availablePlayerData && "pt-[104px] md:pt-[120px]"
          )}>
            {children}
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
