
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

const CardFace = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("absolute inset-0 w-full h-full backface-hidden", className)}
      {...props}
    />
  )
);
CardFace.displayName = 'CardFace';

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
        <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg">
            <Card
                className="h-full aspect-[3/4.2] w-full flex flex-col overflow-hidden bg-card text-card-foreground shadow-lg border-border group cursor-pointer transition-all duration-300 hover:shadow-primary/20 hover:border-primary/30"
                role="article"
                aria-label={`Jugador ${playerName}, calificación general ${player.ovr}`}
            >
                {/* Fondo Animado para Modo Juego (Oscuro) */}
                <div className="dark:absolute dark:inset-0 dark:z-0 dark:bg-gradient-to-br dark:from-primary/10 dark:via-background dark:to-background dark:animate-pulse" />
                
                <CardContent className="relative z-10 flex-grow flex flex-col p-2 sm:p-3 justify-between">
                    {/* Sección Superior: OVR, Posición */}
                    <div className="flex items-start">
                        <div className="flex flex-col items-center">
                            <span className={cn("text-3xl font-black", getOvrColorClasses(player.ovr))}>{player.ovr}</span>
                            <Badge variant="outline" className="text-xs -mt-1">{player.position}</Badge>
                        </div>
                    </div>

                    {/* Sección Central: Imagen y Nombre */}
                    <div className="flex flex-col items-center justify-center text-center -mt-4">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                            <AvatarImage src={player.photoUrl} alt={playerName} data-ai-hint="player portrait" style={{ objectFit: 'cover', objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`, transform: `scale(${player.cropZoom || 1})`, transformOrigin: 'center center' }} />
                            <AvatarFallback className="text-3xl font-black">{playerName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="text-lg font-bold font-headline mt-2 truncate w-full px-2">{playerName}</h3>
                    </div>

                    {/* Sección Inferior: Atributos */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {stats.map(stat => (
                            <div key={stat.key} className="flex justify-between items-baseline">
                                <span className="text-sm font-semibold text-muted-foreground">{attributeDetails[stat.key].name}</span>
                                <span className="text-xl font-black">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
});
