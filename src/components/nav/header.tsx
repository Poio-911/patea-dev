'use client';

import React from 'react';
import Link from 'next/link';
import type { Player, UserProfile } from '@/lib/types';
import { Logo } from '@/components/logo';
import { NotificationBell } from '@/components/notification-bell';
import { HelpDialog } from '@/components/help-dialog';
import { Separator } from '@/components/ui/separator';
import { PlayerPositionBadge } from '@/components/player-styles';
import { UserMenu } from './user-menu';
import { DesktopNav } from './desktop-nav';
import { InvitationsBell } from './invitations-bell';

type HeaderProps = {
    user: UserProfile;
    player: Player | null;
    onLogout: () => void;
    onRequestPermission: () => void;
};

export function Header({ user, player, onLogout, onRequestPermission }: HeaderProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-card/40 backdrop-blur-xl shadow-sm h-16">
            <div className="max-w-7xl mx-auto h-full px-2 sm:px-6 flex items-center justify-between">
                {/* Left section: Logo + Desktop Nav */}
                <div className="flex items-center gap-2 md:gap-4 lg:gap-8">
                    <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                        <Logo className="shrink-0" showWordmark={true} />
                    </Link>
                    <DesktopNav />
                </div>

                {/* Right section: Actions + User Info */}
                <div className="flex items-center gap-1 sm:gap-3 lg:gap-4">
                    {/* Actions: Help + Invitations + Notifications */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <HelpDialog />
                        <InvitationsBell />
                        <NotificationBell />
                    </div>

                    {player && (
                        <div className="hidden xl:flex items-center gap-2 md:gap-3 ml-1 lg:ml-2">
                            {/* Desktop: nombre + posición (oculto en mobile) */}
                            <div className="text-right hidden sm:block shrink-0">
                                <p className="font-bold text-sm truncate max-w-[100px] xl:max-w-[150px]">{player.name}</p>
                                <div className="flex justify-end">
                                    <PlayerPositionBadge position={player.position} size="sm" showIcon={false} showFullName={true} textOnly={true} className="text-[10px]" />
                                </div>
                            </div>

                            {/* OVR overlaid on desktop only — badge in corner of avatar-equivalent circle */}
                            <div className="relative hidden sm:flex items-center justify-center h-9 w-9 md:h-10 md:w-10 shrink-0">
                                <div className="flex items-center justify-center h-full w-full text-base md:text-lg font-bold rounded-full bg-primary/10 border border-primary/20 text-primary transition-transform hover:scale-105">
                                    {player.ovr}
                                </div>
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
