'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from './ui/badge';
import type { Player, AttributeKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type PlayerCardProps = {
  player: Player & { displayName?: string };
};

const attributeDetails: Record<AttributeKey, { name: string; }> = {
    PAC: { name: 'RIT' },
    SHO: { name: 'TIR' },
    PAS: { name: 'PAS' },
    DRI: { name: 'REG' },
    DEF: { name: 'DEF' },
    PHY: { name: 'FIS' },
};

const getOvrColorClasses = (ovr: number): string => {
    if (ovr >= 85) return 'text-yellow-400';
    if (ovr >= 75) return 'text-slate-300';
    return 'text-amber-700';
};

export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    const playerName = player.name || player.displayName || 'Jugador';

    const stats = React.useMemo(() => [
        { subject: 'RIT', value: player.pac, key: 'PAC' as AttributeKey },
        { subject: 'TIR', value: player.sho, key: 'SHO' as AttributeKey },
        { subject: 'PAS', value: player.pas, key: 'PAS' as AttributeKey },
        { subject: 'REG', value: player.dri, key: 'DRI' as AttributeKey },
        { subject: 'DEF', value: player.def, key: 'DEF' as AttributeKey },
        { subject: 'FIS', value: player.phy, key: 'PHY' as AttributeKey },
    ], [player]);

    return (
        <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-2xl h-full">
            <Card
                className="relative h-full aspect-[3/4.2] w-full flex flex-col overflow-hidden bg-card text-card-foreground shadow-lg border-border group cursor-pointer transition-all duration-300 hover:shadow-primary/20 hover:border-primary/30 rounded-2xl"
                role="article"
                aria-label={`Jugador ${playerName}, calificación general ${player.ovr}`}
            >
                <CardContent className="relative z-10 flex-grow flex flex-col p-2 sm:p-3 justify-between">
                    {/* Sección Superior: OVR, Posición, Foto */}
                    <div className="flex flex-col items-center pt-2">
                         <Avatar className="h-28 w-28 sm:h-32 sm:w-32 border-4 border-background shadow-lg dark:border-card">
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
                        <div className="text-center -mt-4">
                            <h3 className="text-xl font-bold font-headline mt-2 truncate w-full px-2">{playerName}</h3>
                             <div className="flex items-center justify-center gap-2">
                                <Badge variant="secondary" className="text-base font-bold dark:bg-black/30 dark:text-white/90">
                                    {player.ovr}
                                </Badge>
                                <Badge variant="outline" className="text-base dark:bg-black/30 dark:text-white/90 dark:border-white/20">
                                    {player.position}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Sección Inferior: Atributos */}
                    <div className="grid grid-cols-3 gap-x-2 gap-y-1 sm:gap-x-4">
                        {stats.map(stat => (
                            <div key={stat.key} className="flex justify-center items-baseline gap-2">
                                <span className="text-xs sm:text-sm font-semibold text-muted-foreground">{attributeDetails[stat.key].name}</span>
                                <span className="text-base sm:text-xl font-black">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
});
