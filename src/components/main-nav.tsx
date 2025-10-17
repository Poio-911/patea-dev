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
import { SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutDashboard, Users, Calendar, LogOut, Settings, Goal, Users2, User, ShieldQuestion } from 'lucide-react';
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


const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/players', label: 'Jugadores', icon: Users },
  { href: '/matches', label: 'Partidos', icon: Calendar },
  { href: '/evaluations', label: 'Evaluaciones', icon: ShieldQuestion },
  { href: '/groups', label: 'Grupos', icon: Users2 },
];

const positionColors: Record<Player['position'], string> = {
    DEL: 'bg-red-500/80 text-white',
    MED: 'bg-green-500/80 text-white',
    DEF: 'bg-blue-500/80 text-white',
    POR: 'bg-orange-500/80 text-white',
};
const ovrColors: Record<Player['position'], string> = {
    DEL: 'text-red-400',
    MED: 'text-green-400',
    DEF: 'text-blue-400',
    POR: 'text-orange-400',
};


export function MainNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

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
          className="group-data-[variant=sidebar]:bg-sidebar group-data-[variant=sidebar]:text-sidebar-foreground"
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
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
            <SidebarTrigger className="md:hidden"/>
            <div className="flex-1">
                <GroupSwitcher />
            </div>

            {player && (
                <div className="hidden items-center gap-4 md:flex">
                    <div className="text-right">
                        <p className="font-bold text-sm truncate">{player.name}</p>
                        <p className="text-xs text-muted-foreground">Manager</p>
                    </div>
                    <div className={cn("font-bold text-lg", ovrColors[player.position])}>
                        {player.ovr}
                    </div>
                    <Badge className={cn("text-xs", positionColors[player.position])}>{player.position}</Badge>
                </div>
            )}
            
            <Separator orientation="vertical" className="h-8 mx-2 hidden md:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border">
                      <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} data-ai-hint="user avatar" />
                      <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
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
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
