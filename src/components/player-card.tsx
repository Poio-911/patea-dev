
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Player, AttributeKey } from '@/lib/types';
import { cn } from '@/lib/utils';

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

const positionTextColors: Record<Player['position'], string> = {
  POR: 'text-yellow-600 dark:text-yellow-400',
  DEF: 'text-green-600 dark:text-green-400',
  MED: 'text-blue-600 dark:text-blue-400',
  DEL: 'text-red-600 dark:text-red-400',
};

const positionBorderColors: Record<Player['position'], string> = {
  POR: 'border-yellow-400',
  DEF: 'border-green-400',
  MED: 'border-blue-400',
  DEL: 'border-red-400',
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

    return (
        <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-2xl h-full w-full" aria-label={`Ver perfil de ${playerName}`}>
            <Card
                className={cn(
                    "relative h-full flex flex-col overflow-hidden rounded-2xl shadow-lg",
                    "dark:bg-card dark:border-border",
                    "shimmer-bg shimmer-effect" // Aplicado solo en modo claro
                )}
            >
                <div className={cn("position-watermark", `position-watermark-${player.position}`)}></div>
                <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center">
                    {/* Header */}
                     <div className="flex items-start justify-between">
                         <div className="flex flex-col items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-white/10 shadow-md">
                                <span className="text-2xl font-black text-slate-900 dark:text-yellow-400">{player.ovr}</span>
                            </div>
                            <span className={cn("mt-1 text-sm font-bold uppercase", positionTextColors[player.position])}>
                                {player.position}
                            </span>
                        </div>
                    </div>

                    {/* Imagen y Nombre */}
                    <div className="flex flex-col items-center gap-1 my-2">
                        <Avatar className={cn("h-24 w-24 rounded-full border-4 object-cover shadow-md bg-muted", positionBorderColors[player.position])}>
                            <AvatarImage 
                                src={player.photoUrl} 
                                alt={playerName} 
                                data-ai-hint="player portrait" 
                                style={{ 
                                    objectFit: 'cover', 
                                    objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`, 
                                    transform: `scale(${player.cropZoom || 1})`, 
                                    transformOrigin: 'center center' 
                                }} 
                            />
                            <AvatarFallback className="text-3xl font-black">{playerName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="w-full truncate text-center text-base font-semibold mt-1 dark:text-white">{playerName}</h3>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-1 text-center text-xs">
                        {stats.map(stat => (
                            <div 
                                key={stat.key} 
                                className={cn(
                                    "rounded-lg py-1 border-2",
                                    "bg-black/5 dark:bg-white/5",
                                    stat.key === highestStat.key ? "border-yellow-400/50 dark:border-yellow-400/50" : "border-transparent"
                                )}
                            >
                                <p className="text-base font-bold text-slate-800 dark:text-white">
                                    {stat.value} 
                                    <span className="ml-1 text-gray-500 dark:text-gray-400 text-xs font-semibold">
                                        {attributeDetails[stat.key].name}
                                    </span>
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
});
