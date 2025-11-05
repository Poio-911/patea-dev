
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Player, AttributeKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { usePointerLight } from '@/hooks/usePointerLight';

type PlayerCardProps = {
  player: Player & { displayName?: string };
};

const attributeDetails: Record<AttributeKey, { name: string }> = {
    PAC: { name: 'RIT' },
    SHO: { name: 'TIR' },
    PAS: { name: 'PAS' },
    DRI: { name: 'REG' },
    DEF: { name: 'DEF' },
    PHY: { name: 'FIS' },
};

// Use theme token classes so colors adapt between :root (light) and .game
const positionTextColors: Record<Player['position'], string> = {
        POR: 'text-accent-foreground',
        DEF: 'text-chart-4',
        MED: 'text-chart-2',
        DEL: 'text-destructive',
};

const positionBorderColors: Record<Player['position'], string> = {
    POR: 'border-accent/40',
    DEF: 'border-chart-4/40',
    MED: 'border-chart-2/40',
    DEL: 'border-destructive/40',
};

export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    const playerName = player.name || player.displayName || 'Jugador';
    
    const stats = React.useMemo(() => [
        { key: 'PAC', value: player.pac },
        { key: 'SHO', value: player.sho },
        { key: 'PAS', value: player.pas },
        { key: 'DRI', value: player.dri },
        { key: 'DEF', value: player.def },
        { key: 'PHY', value: player.phy },
    ] as const, [player]);

    const highestStat = React.useMemo(() => {
        return stats.reduce((max, stat) => stat.value > max.value ? stat : max, stats[0]);
    }, [stats]);

    const lightRef = usePointerLight<HTMLDivElement>();
    return (
        <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl h-full w-full" aria-label={`Ver perfil de ${playerName}`}>
            <Card
                ref={lightRef as any}
                className={cn(
                    "player-card relative h-full flex flex-col overflow-hidden rounded-xl transition-shadow",
                    "bg-card border-border"
                )}
            >
                <CardContent className="relative flex h-full flex-col p-4 pt-3">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-col items-center gap-1 translate-y-1">
                            <div className="ovr-ring flex h-12 w-12 items-center justify-center rounded-full">
                                <span className="text-2xl font-black font-numeric tracking-tight text-card-foreground">{player.ovr}</span>
                            </div>
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide", positionTextColors[player.position])}>{player.position}</span>
                        </div>
                        <Avatar className={cn("avatar-frame h-16 w-16 rounded-full border object-cover -mt-1", positionBorderColors[player.position])}>
                            <AvatarImage
                                src={player.photoUrl}
                                alt={playerName}
                                style={{
                                    objectFit: 'cover',
                                    objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`,
                                    transform: `scale(${player.cropZoom || 1})`,
                                    transformOrigin: 'center center'
                                }}
                            />
                            <AvatarFallback className="text-3xl font-black text-card-foreground/80">{playerName.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </div>
                    <h3 className="player-name text-center text-sm font-semibold font-headline tracking-wide mb-2 truncate text-foreground">{playerName}</h3>
                    <div className="grid grid-cols-3 gap-1 mt-auto">
                        {stats.map(stat => (
                            <div
                                key={stat.key}
                                className={cn("stat-tile rounded-[6px] px-1.5 py-1 text-center", stat.key === highestStat.key && "primary")}
                            >
                                <p className="text-xs font-bold font-numeric leading-tight text-foreground">
                                    {stat.value}
                                </p>
                                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
                                    {attributeDetails[stat.key].name}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
});
