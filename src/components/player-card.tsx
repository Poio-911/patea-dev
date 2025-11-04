
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MoreVertical, Star, Wind, Crosshair, BrainCircuit, WandSparkles, Shield, Dumbbell, LucideIcon } from 'lucide-react';
import type { Player, AttributeKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { motion } from 'framer-motion';
import { Progress } from './ui/progress';

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

const positionColors: Record<Player['position'], string> = {
  POR: 'text-yellow-400 border-yellow-400 bg-yellow-950',
  DEF: 'text-green-400 border-green-400 bg-green-950',
  MED: 'text-blue-400 border-blue-400 bg-blue-950',
  DEL: 'text-red-400 border-red-400 bg-red-950',
};

const getStatColor = (value: number) => {
    if (value >= 85) return 'bg-yellow-400';
    if (value >= 75) return 'bg-green-400';
    if (value >= 60) return 'bg-blue-400';
    return 'bg-red-400';
};

const CardFace = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "absolute inset-0 w-full h-full backface-hidden",
            className
        )}
        {...props}
    />
);

export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const playerName = player.name || player.displayName || 'Jugador';
    
    const stats = useMemo(() => [
        { label: 'RIT', value: player.pac, key: 'PAC' as AttributeKey },
        { label: 'TIR', value: player.sho, key: 'SHO' as AttributeKey },
        { label: 'PAS', value: player.pas, key: 'PAS' as AttributeKey },
        { label: 'REG', value: player.dri, key: 'DRI' as AttributeKey },
        { label: 'DEF', value: player.def, key: 'DEF' as AttributeKey },
        { label: 'FIS', value: player.phy, key: 'PHY' as AttributeKey },
    ], [player]);

    const primaryStat = useMemo(() => {
        return stats.reduce((max, stat) => (stat.value > max.value ? stat : max), stats[0]);
    }, [stats]);
    
    const PrimaryStatIcon = attributeDetails[primaryStat.key].icon;
    const positionClass = positionColors[player.position];
    
    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, a')) {
            return;
        }
        setIsFlipped(!isFlipped);
    }
    
    return (
        <div 
            className="card-container w-full aspect-[3/4]"
            onClick={handleCardClick}
        >
            <motion.div
                className="card-inner h-full w-full"
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
                         <CardContent className="flex-grow flex flex-col p-3 justify-between">
                            <div className="flex justify-between items-start">
                                <Badge className={cn("flex items-center gap-1.5 shadow-md", positionClass)}>
                                    <span className="text-lg font-black">{player.ovr}</span>
                                    <span className="font-semibold text-xs">{player.position}</span>
                                </Badge>
                                <div className={cn("stat-border-glow flex items-center gap-1.5 rounded-full p-1.5 shadow-md", positionClass)}>
                                    <PrimaryStatIcon className="h-4 w-4" />
                                    <span className="font-bold text-sm">{primaryStat.value}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                               <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
                                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                                    <AvatarImage src={player.photoUrl} alt={playerName} data-ai-hint="player portrait" style={{ objectFit: 'cover', objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`, transform: `scale(${player.cropZoom || 1})`, transformOrigin: 'center center' }} />
                                    <AvatarFallback className="text-3xl font-black">{playerName.charAt(0)}</AvatarFallback>
                                </Avatar>
                               </Link>
                            </div>
                             <div className="text-center">
                                <h3 className="text-base font-bold font-headline truncate">{playerName}</h3>
                                <p className="text-xs text-muted-foreground">{player.stats.goals} goles en {player.stats.matchesPlayed} partidos</p>
                            </div>
                        </CardContent>
                    </Card>
                </CardFace>

                {/* Reverso de la Tarjeta */}
                <CardFace className="card-back">
                    <Card className="h-full flex flex-col overflow-hidden bg-card text-card-foreground shadow-lg border-2 border-border cursor-pointer">
                        <CardContent className="flex-grow flex flex-col p-3 justify-center gap-2">
                             <h4 className="text-center font-bold font-headline mb-1">{playerName}</h4>
                             {stats.map(stat => (
                                <div key={stat.key} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs font-semibold">
                                        <span className="text-muted-foreground">{attributeDetails[stat.key as AttributeKey].name}</span>
                                        <span>{stat.value}</span>
                                    </div>
                                    <Progress value={stat.value} indicatorClassName={getStatColor(stat.value)} />
                                </div>
                             ))}
                        </CardContent>
                    </Card>
                </CardFace>
            </motion.div>
        </div>
    );
});
