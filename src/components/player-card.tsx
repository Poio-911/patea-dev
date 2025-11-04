
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Wind, Crosshair, BrainCircuit, WandSparkles, Shield, Dumbbell, LucideIcon } from 'lucide-react';
import type { Player, AttributeKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { motion } from 'framer-motion';

type PlayerCardProps = {
  player: Player & { displayName?: string };
};

const attributeDetails: Record<AttributeKey, { name: string; icon: LucideIcon; }> = {
    PAC: { name: 'Ritmo', icon: Wind },
    SHO: { name: 'Tiro', icon: Crosshair },
    PAS: { name: 'Pase', icon: BrainCircuit },
    DRI: { name: 'Regate', icon: WandSparkles },
    DEF: { name: 'Defensa', icon: Shield },
    PHY: { name: 'Físico', icon: Dumbbell },
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
    const [isFlipped, setIsFlipped] = useState(false);
    const playerName = player.name || player.displayName || 'Jugador';

    const stats = useMemo(() => [
        { subject: 'RIT', value: player.pac, key: 'PAC' as AttributeKey },
        { subject: 'TIR', value: player.sho, key: 'SHO' as AttributeKey },
        { subject: 'PAS', value: player.pas, key: 'PAS' as AttributeKey },
        { subject: 'REG', value: player.dri, key: 'DRI' as AttributeKey },
        { subject: 'DEF', value: player.def, key: 'DEF' as AttributeKey },
        { subject: 'FIS', value: player.phy, key: 'PHY' as AttributeKey },
    ], [player]);

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('a')) {
            return;
        }
        e.preventDefault();
        setIsFlipped(!isFlipped);
    };

    return (
        <div
            className="card-container aspect-[3/4.2] w-full"
            onClick={handleCardClick}
        >
            <motion.div
                className="card-inner h-full"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
            >
                {/* Anverso de la Tarjeta */}
                <CardFace>
                    <Card
                        className="h-full flex flex-col overflow-hidden bg-card text-card-foreground shadow-lg border-2 border-border group cursor-pointer transition-all duration-300 hover:shadow-primary/20 hover:border-primary/30"
                        role="article"
                        aria-label={`Jugador ${playerName}, calificación general ${player.ovr}`}
                    >
                       <div className={cn("animated-background absolute inset-0 z-0 opacity-20 dark:opacity-10")} style={{
                           "--gradient-start": `hsl(var(--${player.position.toLowerCase()}))`,
                           "--gradient-end": `hsl(var(--background))`,
                       } as React.CSSProperties}
                       />
                       <CardContent className="relative z-10 flex-grow flex flex-col p-3 justify-between">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center justify-center h-12 w-12 text-2xl font-black rounded-full border-2 border-border shadow-md bg-background">
                                  <span className={getOvrColorClasses(player.ovr)}>{player.ovr}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center text-center -mt-8">
                               <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
                                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                                    <AvatarImage src={player.photoUrl} alt={playerName} data-ai-hint="player portrait" style={{ objectFit: 'cover', objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`, transform: `scale(${player.cropZoom || 1})`, transformOrigin: 'center center' }} />
                                    <AvatarFallback className="text-3xl font-black">{playerName.charAt(0)}</AvatarFallback>
                                </Avatar>
                               </Link>
                                <h3 className="text-lg font-bold font-headline mt-2 truncate w-full px-2">{playerName}</h3>
                                <Badge variant="outline" className="mt-1">{player.position}</Badge>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">{player.stats.goals || 0} goles en {player.stats.matchesPlayed || 0} partidos</p>
                            </div>
                        </CardContent>
                    </Card>
                </CardFace>

                {/* Reverso de la Tarjeta */}
                <CardFace className="card-back">
                    <Card className="h-full flex flex-col overflow-hidden bg-card text-card-foreground shadow-lg border-2 border-border cursor-pointer">
                        <div className="flex-grow flex flex-col p-4 justify-center gap-4">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {stats.map(stat => {
                                    return (
                                        <div key={stat.key} className="flex flex-col items-center justify-center gap-0 rounded-lg bg-muted/50 p-2 text-center">
                                            <span className="text-xs font-semibold text-muted-foreground">{attributeDetails[stat.key].name}</span>
                                            <span className="text-3xl font-black">{stat.value}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </Card>
                </CardFace>
            </motion.div>
        </div>
    );
});
