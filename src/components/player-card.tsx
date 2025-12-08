'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { Player, AttributeKey, PlayerPosition, Jersey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlayerOvr, AttributesGrid, PlayerPhoto, positionConfig, PlayerPositionBadge } from '@/components/player-styles';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Eye, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { getAnimationByRarity, getStaggerDelay } from '@/lib/animation-utils';
import { JerseyWatermark } from '@/components/jersey-watermark';
import { getOvrLevel } from '@/lib/player-utils';


type PlayerCardProps = {
    player: Player & { displayName?: string };
    index?: number;
    jersey?: Jersey;
};

const auraClasses: Record<string, string> = {
    bronze: 'aura-bronze',
    silver: 'aura-silver',
    gold: 'aura-gold',
    elite: 'aura-elite',
};


export const PlayerCard = React.memo(function PlayerCard({ player, index = 0, jersey }: PlayerCardProps) {
    const [showDetailsButton, setShowDetailsButton] = useState(false);

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

    const borderGlowClasses: Record<string, string> = {
        bronze: 'border-glow-bronze',
        silver: 'border-glow-silver',
        gold: 'border-glow-gold',
        elite: 'border-glow-elite',
    };

    const handleCardClick = () => {
        setShowDetailsButton(true);
    };

    const handleCardBlur = () => {
        // Hide button when focus is lost (for mobile)
        setShowDetailsButton(false);
    };

    return (
        <AnimatedCardWrapper animation={animationType} delay={staggerDelay} className="h-full w-full">
            <Card
                className={cn(
                    "player-card relative h-full flex flex-col overflow-hidden rounded-2xl shadow-lg",
                    "game:bg-card game:border-border bg-card",
                    // NEW: Holographic effect (only on dark theme)
                    "game:holo-effect",
                    ovrLevel === 'elite' && "game:holo-effect-elite",
                    // NEW: Glowing border by tier (only on dark theme)
                    "game:" + borderGlowClasses[ovrLevel],
                    // Hover effects for desktop
                    "transition-all duration-300 ease-out",
                    "md:hover:shadow-2xl md:hover:scale-[1.02] md:hover:-translate-y-1",
                    "md:hover:border-primary/50",
                    // Active/touch effects for mobile
                    "active:scale-[0.98] active:shadow-md",
                    // Cursor
                    "cursor-pointer"
                )}
                onClick={handleCardClick}
                onMouseLeave={() => setShowDetailsButton(false)}
            >
                <div className={cn("absolute inset-0 z-0", selectedAuraClass)} />

                {/* NEW: Jersey watermark (only on dark theme) */}
                <div className="hidden game:block">
                    <JerseyWatermark jersey={jersey || player.jersey} position="bottom-right" opacity={0.06} />
                </div>

                {/* "Ver detalles" button - shows on click/tap and on hover */}
                <div
                    className={cn(
                        "absolute inset-x-0 bottom-0 z-20 p-3 bg-gradient-to-t from-background/95 via-background/80 to-transparent",
                        "transition-all duration-300 ease-out",
                        showDetailsButton ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
                    )}
                >
                    <Link href={`/players/${player.id}`} className="block">
                        <Button
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                            size="sm"
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                        </Button>
                    </Link>
                </div>

                {/* Eye icon indicator on hover (desktop only) */}
                <div className="absolute top-2 right-2 z-20 opacity-0 md:hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground rounded-full p-1.5 shadow-lg">
                        <Eye className="h-3.5 w-3.5" />
                    </div>
                </div>

                {/* Shimmer effect on hover (desktop only) */}
                <div className="hidden md:block absolute inset-0 z-[1] opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
                </div>

                <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center">
                    <div className="absolute -bottom-2 -right-2 h-2/5 w-2/5 text-muted-foreground/5 game:text-primary/5 transition-all duration-300 hover:text-primary/10">
                        {PositionIcon && <PositionIcon className="w-full h-full" />}
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-start justify-between mb-2">
                            <PlayerPositionBadge position={player.position} />
                            <PlayerOvr value={player.ovr} />
                        </div>
                        <div className="flex flex-col items-center gap-2 mb-2">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        aria-label="Ver foto jugador"
                                        className="cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <PlayerPhoto player={player} />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none">
                                    <img src={player.photoUrl} alt={player.name} className="w-full h-auto rounded-lg" />
                                </DialogContent>
                            </Dialog>
                            <h3 className="w-full truncate text-center text-sm font-semibold transition-colors">{playerName}</h3>
                        </div>
                        <AttributesGrid player={player} />
                    </div>
                </CardContent>
            </Card>
        </AnimatedCardWrapper>
    );
});
