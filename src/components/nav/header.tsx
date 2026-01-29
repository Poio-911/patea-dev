'use client';

import React from 'react';
import Link from 'next/link';
import { User as FirebaseUser } from 'firebase/auth';
import type { Player } from '@/lib/types';
import { Logo } from '@/components/logo';
import { NotificationBell } from '@/components/notification-bell';
import { HelpDialog } from '@/components/help-dialog';
import { Separator } from '@/components/ui/separator';
import { PlayerPositionBadge } from '@/components/player-styles';
import { UserMenu } from './user-menu';
import { DesktopNav } from './desktop-nav';

type HeaderProps = {
    user: FirebaseUser;
    player: Player | null;
    onLogout: () => void;
    onRequestPermission: () => void;
};

export function Header({ user, player, onLogout, onRequestPermission }: HeaderProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-20 h-16 shrink-0 border-b bg-card/80 backdrop-blur-lg transition-all">
            <div className="max-w-7xl mx-auto h-full px-2 sm:px-6 flex items-center justify-between">
                {/* Left section: Logo + Desktop Nav */}
                <div className="flex items-center gap-2 md:gap-4 lg:gap-8">
                    <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                        {/* 
                            Optimization: On medium screens (md/lg), show only the icon part of the logo 
                            to make room for the navigation items.
                        */}
                        <Logo className="md:max-lg:w-10 overflow-hidden" showWordmark={true} />
                    </Link>
                    <DesktopNav />
                </div>

                {/* Right section: Actions + User Info */}
                <div className="flex items-center gap-1 sm:gap-3 lg:gap-4">
                    {/* Actions: Help + Bell */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <div className="hidden md:block">
                            <HelpDialog />
                        </div>
                        <NotificationBell />
                    </div>

                    {player && (
                        <div className="flex items-center gap-2 md:gap-3 ml-1 lg:ml-2">
                            {/* Desktop Layout (Hidden on Mobile) */}
                            <div className="text-right hidden sm:block">
                                <p className="font-bold text-sm truncate max-w-[100px] xl:max-w-[150px]">{player.name}</p>
                                <div className="flex justify-end">
                                    <PlayerPositionBadge position={player.position} size="sm" showIcon={false} className="h-4 px-1.5 text-[9px] uppercase tracking-tighter" />
                                </div>
                            </div>

                            {/* Mobile Layout (Visible on Mobile) */}
                            <div className="flex flex-col items-end sm:hidden">
                                <span className="text-[10px] font-bold truncate max-w-[70px] leading-tight text-foreground/80">{player.name}</span>
                                <div className="scale-90 origin-right mt-[1px]">
                                    <PlayerPositionBadge position={player.position} size="sm" showIcon={false} className="h-3.5 px-1 py-0 text-[9px]" />
                                </div>
                            </div>

                            {/* OVR Circle */}
                            <div className="flex items-center justify-center h-8 w-8 md:h-10 md:w-10 text-sm md:text-lg font-bold rounded-full bg-primary/10 border border-primary/20 text-primary shrink-0 transition-transform hover:scale-105">
                                {player.ovr}
                            </div>
                        </div>
                    )}

                    {/* Separator hidden on mobile to save space */}
                    <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block opacity-50" />

                    {/* User Menu (Avatar) */}
                    <UserMenu
                        user={user}
                        player={player}
                        onLogout={onLogout}
                        onRequestPermission={onRequestPermission}
                    />
                </div>
            </div>
        </header>
    );
}
