
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Player, AttributeKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
    
    const stats = [
        { key: 'PAC', value: player.pac },
        { key: 'SHO', value: player.sho },
        { key: 'PAS', value: player.pas },
        { key: 'DRI', value: player.dri },
        { key: 'DEF', value: player.def },
        { key: 'PHY', value: player.phy },
    ] as const;

    const highestStat = React.useMemo(() => {
        return stats.reduce((max, stat) => stat.value > max.value ? stat : max);
    }, [stats]);

    return (
        <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-2xl h-full w-full" aria-label={`Ver perfil de ${playerName}`}>
            <Card
                className={cn(
                    "relative h-full w-full flex flex-col overflow-hidden rounded-2xl border-2 shadow-lg transition-transform duration-300 hover:-translate-y-1",
                    // Modo Claro
                    "bg-card border-border hover:shadow-xl",
                    // Modo Juego (Oscuro)
                    "dark:bg-gradient-to-b dark:from-[#1a2a6c] dark:to-[#0d1b3a] dark:border-[#2e4fff] dark:hover:shadow-[0_12px_40px_rgba(46,79,255,0.3)]"
                )}
            >
                {/* Vector decorativo */}
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_10%,transparent_90%)] dark:opacity-20 opacity-0 pointer-events-none"></div>

                <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center text-foreground dark:text-white">
                    {/* Header */}
                     <div className="flex items-start justify-between">
                         <div className="flex flex-col items-center text-left">
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
                        <Avatar className={cn("h-20 w-20 sm:h-24 sm:w-24 rounded-full border-4 object-cover shadow-md bg-muted dark:bg-slate-800", positionBorderColors[player.position])}>
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
                        <h3 className="w-full truncate text-center text-base font-semibold mt-1">{playerName}</h3>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-1 text-center text-xs">
                        {stats.map(stat => (
                            <div 
                                key={stat.key} 
                                className={cn(
                                    "rounded-lg bg-muted dark:bg-white/5 py-1 transition-all border-2",
                                    stat.key === highestStat.key ? "border-yellow-400/50 dark:border-yellow-400/50" : "border-transparent"
                                )}
                            >
                                <p className="text-base font-bold text-foreground dark:text-white">
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
