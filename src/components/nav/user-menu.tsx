'use client';

import React from 'react';
import Link from 'next/link';
import {
    LogOut,
    User,
    Users2,
    Sun,
    Moon,
    BellRing
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from "@/components/ui/dropdown-menu";
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

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-full p-0">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border overflow-hidden">
                        <AvatarImage
                            src={user?.photoURL || ''}
                            alt={user?.displayName || 'User'}
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
