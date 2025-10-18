
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutDashboard, LogOut, Settings, Goal, Users2, ShieldQuestion, User, ArrowRight, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { useUser, useAuth, useDoc, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { GroupSwitcher } from './group-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';
import { MatchIcon } from './icons/match-icon';
import { FindMatchIcon } from './icons/find-match-icon';
import { EvaluationIcon } from './icons/evaluation-icon';
import { NotificationBell } from './notification-bell';
import { useFcm } from '@/hooks/use-fcm';


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

  // Initialize FCM logic
  const { requestPermission } = useFcm();

  const playerRef = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'players', user.uid);
  }, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);


  React.useEffect(() => {
    if (!userLoading && !user && pathname !== '/' && pathname !== '/login' && pathname !== '/register') {
      router.push('/login');
    }
  }, [user, userLoading, pathname, router]);

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
    }
  };

  if (pathname === '/' || pathname === '/login' || pathname === '/register') {
    return <>{children}</>;
  }

  const loading = userLoading || playerLoading;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Goal className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return null; // o un esqueleto de carga
  }


  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar
          variant="sidebar"
          collapsible="icon"
          className="hidden md:block"
        >
          <SidebarHeader className="p-4">
             <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Goal className="h-6 w-6" />
                </div>
                <div className="duration-200 group-data-[collapsible=icon]:opacity-0">
                    <h2 className="font-headline text-lg font-semibold">AFM</h2>
                    <p className="text-xs text-sidebar-foreground/70">Fútbol Amateur</p>
                </div>
             </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith('/groups')}
                    tooltip="Grupos"
                  >
                    <Link href="/groups">
                      <Users2 />
                      <span>Grupos</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-2">
            <Separator className="my-2 bg-sidebar-border" />
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Ajustes">
                        <Settings />
                        <span>Ajustes</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Cerrar sesión" onClick={handleLogout}>
                        <LogOut />
                        <span>Cerrar sesión</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="bg-transparent pb-16 md:pb-0">
           <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-lg sm:px-6">
              <div className="flex items-center gap-2">
                <div className="hidden md:block">
                  <SidebarTrigger />
                </div>
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

          <main className="flex-1 p-4 sm:p-6">{children}</main>
          
          {/* Bottom Navigation for Mobile */}
          <nav className="fixed bottom-0 left-0 right-0 z-20 h-16 border-t bg-background/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden">
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

        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
