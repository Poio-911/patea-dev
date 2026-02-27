'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { Player, AttributeKey, PlayerPosition, Jersey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlayerOvr, AttributesGrid, PlayerPhoto, positionConfig, PlayerPositionBadge } from '@/components/player-styles';
import { Skeleton } from './ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogTrigger,
    DialogClose,
} from '@/components/ui/dialog';
import { Eye, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { getAnimationByRarity, getStaggerDelay } from '@/lib/animation-utils';
import { getOvrLevel, getOvrColorClass } from '@/lib/player-utils';
import { Sparkles } from 'lucide-react';


type PlayerCardProps = {
    player: Player & { displayName?: string };
    index?: number;
    creatorName?: string;
    jersey?: Jersey;
};

const auraClasses: Record<string, string> = {
    bronze: 'aura-bronze',
    silver: 'aura-silver',
    gold: 'aura-gold',
    elite: 'aura-elite',
};


export const PlayerCard = React.memo(function PlayerCard({ player, index = 0, creatorName, jersey }: PlayerCardProps) {
    if (!player) {
        return (
            <Card className="h-full w-full rounded-2xl">
                <CardContent className="p-3">
                    <Skeleton className="h-full w-full aspect-[2/3]" />
                </CardContent>
            </Card>
        );
    }

    const playerName = player.name || player.displayName || 'Jugador';
    const PositionIcon = positionConfig[player.position].Icon;
    const ovrLevel = getOvrLevel(player.ovr);
    const selectedAuraClass = auraClasses[ovrLevel];
    const animationType = getAnimationByRarity(player.ovr);
    const staggerDelay = getStaggerDelay(index, 3);

    // Calculate intensity for elite cards (0.0 to 1.0) based on OVR 86-99
    const intensity = ovrLevel === 'elite' ? Math.max(0, Math.min(1, (player.ovr - 86) / 13)) : 0;

    const cardStyle = ovrLevel === 'elite' ? {
        '--intensity': intensity.toFixed(2),
        // Animation duration adjusts with intensity: 15s (slow) -> 8s (fast)
        animationDuration: `${15 - (intensity * 7)}s`
    } as React.CSSProperties : undefined;

    return (
        <AnimatedCardWrapper animation={animationType} delay={staggerDelay} className="h-full w-full">
            <Link href={`/players/${player.id}`} className="group block h-full w-full">
                <Card
                    className={cn(
                        "player-card relative h-full flex flex-col overflow-hidden rounded-2xl",
                        "bg-card border-border",
                        // Hover effects for desktop
                        "transition-all duration-300 ease-out",
                        "md:hover:shadow-2xl md:hover:scale-[1.02] md:hover:-translate-y-1.5",
                        "md:hover:border-primary/40",
                        // Active/touch effects for mobile
                        "active:scale-[0.98] active:shadow-md",
                        // Cursor
                        "cursor-pointer"
                    )}
                    style={cardStyle}
                >
                    {/* Holo-effect overlay solo para elite en desktop */}
                    {ovrLevel === 'elite' && (
                        <div className="hidden md:block absolute inset-0 z-10 pointer-events-none holo-effect holo-effect-elite rounded-2xl" />
                    )}
                    <div className={cn("absolute inset-0 z-0", selectedAuraClass)} />

                    {/* Eye icon indicator on hover (desktop only) - more subtle now */}
                    <div className="absolute top-2 right-2 z-20 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="bg-primary/10 backdrop-blur-md text-primary rounded-full p-1.5 border border-primary/20 shadow-sm">
                            <Eye className="h-3.5 w-3.5" />
                        </div>
                    </div>

                    {/* Shimmer effect on hover (desktop only) */}
                    <div className="hidden md:block absolute inset-0 z-[1] opacity-0 hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-foreground/5 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
                    </div>

                    <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center">
                        <div className="absolute -bottom-2 -right-2 h-2/5 w-2/5 text-muted-foreground/5 game:text-primary/5 transition-all duration-300 hover:text-primary/10">
                            {PositionIcon && <PositionIcon className="w-full h-full" />}
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-start justify-between mb-2">
                                <PlayerPositionBadge
                                    position={player.position}
                                    showIcon={false}
                                    textOnly={true}
                                    size="lg"
                                    className="text-sm"
                                />
                                <div className="flex items-center gap-1">
                                    {player.ovr >= 90 && (
                                        <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" fill="currentColor" />
                                    )}
                                    <div className={cn("transition-all", ovrLevel === 'elite' && "scale-110 origin-top-right")}>
                                        <PlayerOvr
                                            value={player.ovr}
                                            context="card"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2 mb-2">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <button
                                            aria-label="Ver foto jugador"
                                            className="cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                            }}
                                        >
                                            <PlayerPhoto player={player} />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none overflow-hidden [&>button]:hidden">
                                        <div className="relative w-full aspect-square">
                                            <DialogClose className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors backdrop-blur-sm">
                                                <X className="h-6 w-6" />
                                                <span className="sr-only">Cerrar</span>
                                            </DialogClose>
                                            <Image
                                                src={(player as any).photoUrl || player.photoURL}
                                                alt={player.name}
                                                fill
                                                className="object-contain rounded-lg"
                                                sizes="(max-width: 768px) 100vw, 400px"
                                            />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <h3 className="w-full truncate text-center text-sm font-semibold transition-colors">{playerName}</h3>
                                {player.id !== player.ownerUid && creatorName && (
                                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/80 mt-0.5 flex items-center justify-center gap-1">
                                        <span className="opacity-50">👤 Creado por</span>
                                        <span className="text-primary/70">{creatorName}</span>
                                    </p>
                                )}
                            </div>
                            <AttributesGrid player={player} />
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </AnimatedCardWrapper>
    );
});
