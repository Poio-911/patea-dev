
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

const attributeDetails: Record<AttributeKey, { name: string; }> = {
    PAC: { name: 'RIT' }, // Adjusted to RIT as per user's locale preference
    SHO: { name: 'TIR' },
    PAS: { name: 'PAS' },
    DRI: { name: 'REG' },
    DEF: { name: 'DEF' },
    PHY: { name: 'FIS' },
};

export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    const playerName = player.name || player.displayName || 'Jugador';

    const stats = React.useMemo(() => [
        { key: 'PAC' as AttributeKey, value: player.pac },
        { key: 'SHO' as AttributeKey, value: player.sho },
        { key: 'PAS' as AttributeKey, value: player.pas },
        { key: 'DRI' as AttributeKey, value: player.dri },
        { key: 'DEF' as AttributeKey, value: player.def },
        { key: 'PHY' as AttributeKey, value: player.phy },
    ], [player]);

    return (
        <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-2xl h-full w-full">
            <motion.div 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.98 }}
                className="h-full"
            >
                <Card
                    className={cn(
                        "relative h-full aspect-[3/4.2] w-full flex flex-col overflow-hidden shadow-lg border-border group cursor-pointer transition-all duration-300 rounded-2xl",
                        "dark:bg-[#0d1a4a] dark:border-primary/30 dark:shadow-primary/20"
                    )}
                    role="article"
                    aria-label={`Jugador ${playerName}, calificación general ${player.ovr}`}
                >
                    {/* Fondo con gradiente y efecto de juego */}
                    <div className="absolute inset-0 z-0 dark:bg-gradient-to-br dark:from-primary/10 dark:via-transparent dark:to-transparent dark:opacity-50 game-card-background"></div>
                    
                    {/* Borde dorado en modo juego */}
                    <div className="absolute inset-0 z-10 rounded-2xl border-2 border-transparent dark:border-primary/50 pointer-events-none"></div>

                    <CardContent className="relative z-20 flex-grow flex flex-col p-2 sm:p-3 text-center justify-between text-card-foreground dark:text-white">
                        
                        {/* SECCIÓN SUPERIOR: OVR, POSICIÓN, FOTO */}
                        <div className="relative flex flex-col items-center">
                            {/* OVR y Posición */}
                            <div className="flex flex-col items-center">
                                <span className="text-3xl sm:text-4xl font-black text-glow dark:text-yellow-300">{player.ovr}</span>
                                <span className="text-sm font-semibold text-muted-foreground dark:text-yellow-300/80 -mt-1">{player.position}</span>
                            </div>

                            {/* Foto */}
                            <div className="absolute top-10 sm:top-12">
                                <Avatar className="h-28 w-28 sm:h-32 sm:w-32">
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
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            {/* Nombre del jugador */}
                            <h3 className="text-lg sm:text-xl font-bold font-headline mt-28 sm:mt-32 truncate w-full px-1 text-glow dark:text-white">{playerName}</h3>

                            {/* SECCIÓN INFERIOR: Atributos en 2 columnas */}
                            <div className="w-full mt-2 px-1">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:text-base">
                                    {stats.map(stat => (
                                        <div key={stat.key} className="flex items-baseline justify-center gap-2">
                                            <span className="font-black dark:text-yellow-300/90">{stat.value}</span>
                                            <span className="font-semibold text-muted-foreground dark:text-yellow-300/70">{attributeDetails[stat.key].name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </Link>
    );
});
