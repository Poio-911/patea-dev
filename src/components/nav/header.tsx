'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    const [showMobilePlayerInfo, setShowMobilePlayerInfo] = useState(true);

    useEffect(() => {
        // En mobile: Mostrar por 4s, ocultar por 15s, loop.
        const showDurationMs = 4000;
        const hiddenDurationMs = 15000;

        let timeoutId: NodeJS.Timeout;

        const cycleVisibility = () => {
            setShowMobilePlayerInfo(true);
            timeoutId = setTimeout(() => {
                setShowMobilePlayerInfo(false);
                timeoutId = setTimeout(cycleVisibility, hiddenDurationMs);
            }, showDurationMs);
        };

        // Iniciar el primer cilco de ocultamiento
        timeoutId = setTimeout(() => {
            setShowMobilePlayerInfo(false);
            timeoutId = setTimeout(cycleVisibility, hiddenDurationMs);
        }, showDurationMs);

        return () => clearTimeout(timeoutId);
    }, []);

    return (
        <header className="fixed-header fixed top-0 left-0 right-0 z-20 h-16 shrink-0 border-b bg-card/80 backdrop-blur-lg transition-all">
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
                    {/* Actions: Help + Invitations + Notifications */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <HelpDialog />
                        <InvitationsBell />
                        <NotificationBell />
                    </div>

                    {player && (
                        <div className="flex items-center gap-2 md:gap-3 ml-1 lg:ml-2">
                            {/* Desktop: nombre + posición (oculto en mobile) */}
                            <div className="text-right hidden sm:block shrink-0">
                                <p className="font-bold text-sm truncate max-w-[100px] xl:max-w-[150px]">{player.name}</p>
                                <div className="flex justify-end">
                                    <PlayerPositionBadge position={player.position} size="sm" showIcon={false} showFullName={true} textOnly={true} className="text-[10px]" />
                                </div>
                            </div>

                            {/* Mobile: Animación periódica del nombre + posición */}
                            <AnimatePresence>
                                {showMobilePlayerInfo && (
                                    <motion.div
                                        initial={{ width: 0, opacity: 0, scale: 0.9 }}
                                        animate={{ width: 'auto', opacity: 1, scale: 1 }}
                                        exit={{ width: 0, opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.4, ease: "easeInOut" }}
                                        className="text-right sm:hidden block overflow-hidden whitespace-nowrap origin-right"
                                    >
                                        <div className="pr-1">
                                            <p className="font-bold text-sm truncate max-w-[80px]">{player.name.split(' ')[0]}</p>
                                            <div className="flex justify-end">
                                                <PlayerPositionBadge position={player.position} size="sm" showIcon={false} showFullName={false} textOnly={true} className="text-[10px]" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

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
