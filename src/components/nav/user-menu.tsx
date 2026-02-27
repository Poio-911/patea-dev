'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    LogOut,
    User,
    Users2,
    Sun,
    BellRing,
    Trophy,
    Award,
    Settings,
    Rss,
    ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Player, UserProfile } from '@/lib/types';
import { useTheme } from 'next-themes';

type UserMenuProps = {
    user: UserProfile;
    player: Player | null; // For crop data
    onLogout: () => void;
    onRequestPermission: () => void;
};

export function UserMenu({ user, player, onLogout, onRequestPermission }: UserMenuProps) {
    const { setTheme } = useTheme();
    const router = useRouter();
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-fit sm:h-12 rounded-full p-0 flex items-center gap-1.5 px-1 hover:bg-muted/50 transition-colors focus-visible:ring-0 focus-visible:ring-offset-0">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border overflow-hidden bg-muted flex-shrink-0">
                        {user?.photoURL && (
                            <Image
                                src={user.photoURL}
                                alt={user.displayName || 'User'}
                                width={48} // Use larger size for sm:h-12
                                height={48}
                                className={cn(
                                    "h-full w-full object-cover transition-opacity duration-300",
                                    isLoaded ? "opacity-100" : "opacity-0"
                                )}
                                style={{
                                    objectPosition: `${player?.cropPosition?.x || 50}% ${player?.cropPosition?.y || 50}%`,
                                    transform: `scale(${player?.cropZoom || 1})`,
                                    transformOrigin: 'center center',
                                }}
                                onLoad={() => setIsLoaded(true)}
                                loading="eager" // Header avatar should load fast
                                priority // High priority for LCP
                            />
                        )}
                        {!isLoaded && (
                            <AvatarFallback className="absolute inset-0">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                        )}
                    </Avatar>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
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
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Mi Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/achievements')}>
                    <Award className="mr-2 h-4 w-4" />
                    <span>Logros</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/feed')}>
                    <Rss className="mr-2 h-4 w-4" />
                    <span>Feed</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/rankings')}>
                    <Trophy className="mr-2 h-4 w-4" />
                    <span>Rankings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/groups')}>
                    <Users2 className="mr-2 h-4 w-4" />
                    <span>Gestionar Grupos</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                    <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">Tema</p>
                    <div className="flex gap-2 bg-muted/50 p-1 rounded-lg">
                        <Button
                            variant={typeof document !== 'undefined' && document.documentElement.classList.contains('game') ? 'ghost' : 'secondary'}
                            size="sm"
                            className={cn(
                                "flex-1 h-8 text-xs font-medium",
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
                                "flex-1 h-8 text-xs font-medium",
                                typeof document !== 'undefined' && document.documentElement.classList.contains('game') && "bg-background shadow-sm"
                            )}
                            onClick={() => setTheme("game")}
                        >
                            <span className="mr-2 text-xs">🎮</span>
                            Game
                        </Button>
                    </div>
                </div>
                <DropdownMenuItem onClick={onRequestPermission}>
                    <BellRing className="mr-2 h-4 w-4" />
                    <span>Activar Notificaciones</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar sesión</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
