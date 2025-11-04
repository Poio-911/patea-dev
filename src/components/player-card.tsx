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

export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    const playerName = player.name || player.displayName || 'Jugador';
    const stats = [
        { key: 'PAC', value: player.pac },
        { key: 'SHO', value: player.sho },
        { key: 'PAS', value: player.pas },
        { key: 'DRI', value: player.dri },
        { key: 'DEF', value: player.def },
        { key: 'PHY', value: player.phy },
    ];

    return (
        <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-2xl h-full w-full">
            <Card
                className={cn(
                    "relative h-full aspect-[3/4] w-full flex flex-col overflow-hidden rounded-2xl border-2 shadow-lg transition-transform duration-300 hover:-translate-y-1",
                    // Modo Claro
                    "bg-card border-border hover:shadow-xl",
                    // Modo Juego (Oscuro)
                    "dark:bg-gradient-to-b dark:from-[#1a2a6c] dark:to-[#0d1b3a] dark:border-[#2e4fff] dark:hover:shadow-[0_12px_40px_rgba(46,79,255,0.3)]"
                )}
                role="article"
                aria-label={`Jugador ${playerName}, calificación general ${player.ovr}`}
            >
                {/* Vector decorativo */}
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_10%,transparent_90%)] dark:opacity-20 opacity-0 pointer-events-none"></div>

                <CardContent className="relative z-10 flex h-full flex-col justify-between p-2 sm:p-3 text-center">
                    {/* Header */}
                    <div className="flex items-center justify-between text-foreground dark:text-white">
                        <span className="text-primary dark:text-yellow-400 text-xl sm:text-2xl font-black">{player.ovr}</span>
                        <div className="bg-muted dark:bg-white/10 rounded-md px-2 py-0.5 text-xs uppercase">{player.position}</div>
                        <img src="https://flagcdn.com/w20/uy.png" alt="Bandera de Uruguay" className="w-5 h-3 sm:w-6 sm:h-4 object-cover rounded-sm" />
                    </div>

                    {/* Imagen y Nombre */}
                    <div className="flex flex-col items-center gap-1 mt-1">
                        <Avatar className="h-16 w-16 sm:h-24 sm:w-24 rounded-full border-2 sm:border-4 border-border dark:border-[#2e4fff] object-cover shadow-md">
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
                            <AvatarFallback className="text-2xl sm:text-3xl font-black">{playerName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="w-full truncate text-center text-sm sm:text-base font-semibold mt-1 text-foreground dark:text-white">{playerName}</h3>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-1 text-center text-xs">
                        {stats.map(stat => (
                            <div key={stat.key} className="rounded-lg bg-muted dark:bg-white/5 py-0.5 sm:py-1">
                                <p className="text-sm sm:text-base font-bold text-foreground dark:text-white">{stat.value} <span className="text-muted-foreground dark:text-gray-400 text-xs">{attributeDetails[stat.key as AttributeKey].name}</span></p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
});
