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

const positionColors: Record<Player['position'], { main: string; light: string; dark: string; text: string }> = {
  POR: { main: 'hsl(45, 90%, 55%)', light: 'hsl(45, 90%, 65%)', dark: 'hsl(45, 100%, 25%)', text: 'text-yellow-400' },
  DEF: { main: 'hsl(142, 76%, 36%)', light: 'hsl(142, 76%, 46%)', dark: 'hsl(142, 86%, 16%)', text: 'text-green-400' },
  MED: { main: 'hsl(217, 91%, 60%)', light: 'hsl(217, 91%, 70%)', dark: 'hsl(217, 91%, 30%)', text: 'text-blue-400' },
  DEL: { main: 'hsl(0, 84%, 60%)', light: 'hsl(0, 84%, 70%)', dark: 'hsl(0, 84%, 30%)', text: 'text-red-400' },
};

const getStatColor = (value: number) => {
    if (value >= 85) return 'bg-yellow-400';
    if (value >= 75) return 'bg-green-400';
    if (value >= 60) return 'bg-blue-400';
    return 'bg-red-400';
};

const getOvrColorClasses = (ovr: number): string => {
    if (ovr >= 85) return 'text-amber-500'; // Gold
    if (ovr >= 75) return 'text-slate-400'; // Silver
    return 'text-amber-700'; // Bronze
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
    const colors = positionColors[player.position];
    
    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, a')) {
            return;
        }
        setIsFlipped(!isFlipped);
    }
    
    return (
        <div 
            className="card-container aspect-[3/4.2] w-full"
            onClick={handleCardClick}
            style={{
                '--position-color': colors.main,
                '--position-color-light': colors.light,
            } as React.CSSProperties}
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
                       <div 
                         className="animated-background absolute inset-0 z-0 opacity-20 dark:opacity-10"
                         style={{ backgroundImage: `radial-gradient(circle at 25% 25%, var(--position-color) 0%, transparent 50%), radial-gradient(circle at 75% 75%, var(--position-color-light) 0%, transparent 50%)` }}
                       />
                       <CardContent className="relative z-10 flex-grow flex flex-col p-3 justify-between">
                            <div className="flex justify-between items-start">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-background shadow-md">
                                  <span className={cn("text-xl font-black", getOvrColorClasses(player.ovr))}>{player.ovr}</span>
                                </div>
                                <div className="stat-border-glow flex items-center gap-1.5 rounded-full p-1.5 shadow-md border-2 border-border bg-background">
                                  <PrimaryStatIcon className={cn("h-4 w-4", colors.text)} />
                                  <span className={cn("font-bold text-sm", colors.text)}>{primaryStat.value}</span>
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
                                <Badge variant="outline" className="text-xs bg-background shadow-sm border-border">{player.position}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">{player.stats.goals || 0} goles en {player.stats.matchesPlayed || 0} partidos</p>
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
