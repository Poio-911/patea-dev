
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { Player, AttributeKey, PlayerPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlayerOvr, getPositionBadgeClasses, AttributesGrid, PlayerPhoto, positionConfig } from '@/components/player-styles';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Eye, ArrowRight } from 'lucide-react';


type PlayerCardProps = {
    player: Player & { displayName?: string };
};

const getOvrLevel = (ovr: number) => {
    if (ovr >= 86) return 'elite';
    if (ovr >= 76) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
};

const auraClasses: Record<string, string> = {
    bronze: 'aura-bronze',
    silver: 'aura-silver',
    gold: 'aura-gold',
    elite: 'aura-elite',
};


export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
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

    return (
        <Link href={`/players/${player.id}`} className="h-full w-full group block">
            <Card
                className={cn(
                    "player-card relative h-full flex flex-col overflow-hidden rounded-2xl shadow-lg",
                    "game:bg-card game:border-border bg-card",
                    // Hover effects for desktop
                    "transition-all duration-300 ease-out",
                    "hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1",
                    "hover:border-primary/50",
                    // Active/touch effects for mobile
                    "active:scale-[0.98] active:shadow-md",
                    // Cursor
                    "cursor-pointer"
                )}
            >
                <div className={cn("absolute inset-0 z-0", selectedAuraClass)} />

                {/* Click indicator - shows on hover (desktop) and always visible on mobile */}
                <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 md:opacity-0 transition-opacity duration-300">
                    <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground rounded-full p-1.5 shadow-lg">
                        <Eye className="h-3.5 w-3.5" />
                    </div>
                </div>

                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 z-[1] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                </div>

                <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center">
                    <div className="absolute -bottom-2 -right-2 h-2/5 w-2/5 text-muted-foreground/5 game:text-primary/5 transition-all duration-300 group-hover:text-primary/10">
                        {PositionIcon && <PositionIcon className="w-full h-full" />}
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-start justify-between mb-2">
                            <Badge className={cn('font-headline uppercase font-bold', getPositionBadgeClasses(player.position))}>{player.position}</Badge>
                            <PlayerOvr value={player.ovr} />
                        </div>
                        <div className="flex flex-col items-center gap-2 mb-2">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        aria-label="Ver foto jugador"
                                        className="cursor-pointer"
                                        onClick={(e) => e.preventDefault()}
                                    >
                                        <PlayerPhoto player={player} />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none">
                                    <img src={player.photoUrl} alt={player.name} className="w-full h-auto rounded-lg" />
                                </DialogContent>
                            </Dialog>
                            <h3 className="w-full truncate text-center text-sm font-semibold group-hover:text-primary transition-colors">{playerName}</h3>
                        </div>
                        <AttributesGrid player={player} />
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
});
