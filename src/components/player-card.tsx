
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
            className="card-container w-full aspect-[3/4.2]"
            onClick={handleCardClick}
            style={{
                '--position-color': colors.main,
                '--position-color-light': colors.light,
                '--position-color-dark': colors.dark,
            } as React.CSSProperties}
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
                        <div className="relative flex-grow flex flex-col justify-between bg-gradient-to-b from-[var(--position-color-dark)] via-background/10 to-background/90 p-3">
                            {/* Top Section */}
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col items-center justify-center h-16 w-16 bg-background/50 backdrop-blur-sm rounded-full border-2 border-[var(--position-color)] shadow-lg">
                                    <span className={cn("text-3xl font-black text-glow", colors.text)}>{player.ovr}</span>
                                </div>
                                <Badge className="bg-background/50 backdrop-blur-sm border-2 border-[var(--position-color)] text-base font-bold shadow-lg">
                                    {player.position}
                                </Badge>
                            </div>

                            {/* Avatar Section */}
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex flex-col items-center justify-center">
                               <Link href={`/players/${player.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
                                <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                                    <AvatarImage src={player.photoUrl} alt={playerName} data-ai-hint="player portrait" style={{ objectFit: 'cover', objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`, transform: `scale(${player.cropZoom || 1})`, transformOrigin: 'center center' }} />
                                    <AvatarFallback className="text-3xl font-black">{playerName.charAt(0)}</AvatarFallback>
                                </Avatar>
                               </Link>
                            </div>

                            {/* Bottom Section */}
                            <div className="relative flex flex-col items-center justify-end h-1/3">
                                <div className={cn("stat-border-glow flex items-center gap-1.5 rounded-full p-2 text-sm font-bold shadow-md bg-background/50 backdrop-blur-sm", colors.text)}>
                                     <PrimaryStatIcon className="h-4 w-4" />
                                     <span>{primaryStat.label}: {primaryStat.value}</span>
                                </div>
                                <div className="absolute bottom-0 w-full bg-[var(--position-color)] p-2 text-center rounded-b-md -mx-3 -mb-3">
                                    <h3 className="text-lg font-bold font-headline truncate text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{playerName}</h3>
                                </div>
                            </div>
                        </div>
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
