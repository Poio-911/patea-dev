'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type PlayerCardProps = {
  player: Player & { displayName?: string };
};

export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    const playerName = player.name || player.displayName || 'Jugador';

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
                        "dark:bg-[#080D2B] dark:border-primary/30 dark:shadow-primary/20"
                    )}
                    role="article"
                    aria-label={`Jugador ${playerName}, calificación general ${player.ovr}`}
                >
                    {/* Borde dorado en modo juego */}
                    <div className="absolute inset-0 z-10 rounded-2xl border-2 border-transparent dark:border-primary/50 pointer-events-none"></div>

                    <CardContent className="relative z-20 flex-grow flex flex-col p-2 text-center justify-between text-card-foreground dark:text-white">
                        
                        {/* SECCIÓN SUPERIOR: OVR y Posición */}
                        <div className="flex flex-col items-center pt-2">
                            <span className="text-3xl font-black dark:text-yellow-300">{player.ovr}</span>
                            <span className="text-xs font-semibold text-muted-foreground dark:text-yellow-300/80 -mt-1">{player.position}</span>
                        </div>

                        {/* FOTO y NOMBRE */}
                        <div className="flex flex-col items-center gap-2">
                            <Avatar className="h-24 w-24 border-4 border-background dark:border-[#0d1a4a]">
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
                            <h3 className="text-base font-bold font-headline truncate w-full px-1 dark:text-white">{playerName}</h3>
                        </div>

                        {/* Espaciador para empujar el nombre hacia arriba */}
                        <div className="pb-1"></div>

                    </CardContent>
                </Card>
            </motion.div>
        </Link>
    );
});
