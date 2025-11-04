
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
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
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

const getOvrColorClasses = (ovr: number): { text: string; border: string; bg: string; } => {
    if (ovr >= 85) return { text: 'text-yellow-400', border: 'border-yellow-400', bg: 'bg-yellow-950' };
    if (ovr >= 75) return { text: 'text-slate-300', border: 'border-slate-500', bg: 'bg-slate-800' };
    return { text: 'text-amber-700', border: 'border-amber-800', bg: 'bg-amber-950' };
};

const CardFace = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 w-full h-full backface-hidden",
        className
      )}
      {...props}
    />
  )
);
CardFace.displayName = 'CardFace';

export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const playerName = player.name || player.displayName || 'Jugador';
    
    const stats = useMemo(() => [
        { subject: 'RIT', value: player.pac, fullMark: 100, key: 'PAC' as AttributeKey },
        { subject: 'TIR', value: player.sho, fullMark: 100, key: 'SHO' as AttributeKey },
        { subject: 'PAS', value: player.pas, fullMark: 100, key: 'PAS' as AttributeKey },
        { subject: 'REG', value: player.dri, fullMark: 100, key: 'DRI' as AttributeKey },
        { subject: 'DEF', value: player.def, fullMark: 100, key: 'DEF' as AttributeKey },
        { subject: 'FIS', value: player.phy, fullMark: 100, key: 'PHY' as AttributeKey },
    ], [player]);

    const primaryStat = useMemo(() => {
        return stats.reduce((max, stat) => (stat.value > max.value ? stat : max), stats[0]);
    }, [stats]);
    
    const PrimaryStatIcon = attributeDetails[primaryStat.key].icon;
    const ovrColorClasses = getOvrColorClasses(player.ovr);
    
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
                       <div className="animated-background absolute inset-0 z-0 opacity-20 dark:opacity-10" />
                       <CardContent className="relative z-10 flex-grow flex flex-col p-3 justify-between">
                            <div className="flex justify-between items-start">
                                <div className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/80 flex items-center gap-1.5 shadow-md bg-background")}>
                                  <span className={cn("text-lg font-black", ovrColorClasses.text)}>{player.ovr}</span>
                                </div>
                                <div className="stat-border-glow flex items-center gap-1.5 rounded-full p-1.5 shadow-md bg-background border-2 border-border">
                                  <PrimaryStatIcon className={cn("h-4 w-4", ovrColorClasses.text)} />
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
                                <Badge variant="outline">{player.position}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">{player.stats.goals || 0} goles en {player.stats.matchesPlayed || 0} partidos</p>
                            </div>
                        </CardContent>
                    </Card>
                </CardFace>

                {/* Reverso de la Tarjeta */}
                <CardFace className="card-back">
                    <Card className="h-full flex flex-col overflow-hidden bg-card text-card-foreground shadow-lg border-2 border-border cursor-pointer">
                        <div className="flex-grow flex flex-col p-3 justify-center gap-2" style={{ backgroundImage: 'radial-gradient(hsla(var(--foreground)/.02) 1px, transparent 1px)', backgroundSize: '6px 6px'}}>
                             <h4 className="text-center font-bold font-headline mb-1">{playerName}</h4>
                             <div className="w-full h-32">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats} >
                                        <PolarGrid stroke="hsl(var(--border))" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                                        <Radar name={playerName} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                                    </RadarChart>
                                </ResponsiveContainer>
                             </div>
                             <div className="space-y-1 px-2">
                                {stats.map(stat => (
                                    <div key={stat.key} className="space-y-1">
                                        <div className="flex justify-between items-center text-xs font-semibold">
                                            <span className="text-muted-foreground">{attributeDetails[stat.key].name}</span>
                                            <span className={cn(getOvrColorClasses(stat.value).text, "font-bold")}>{stat.value}</span>
                                        </div>
                                        <Progress value={stat.value} className="h-1" indicatorClassName={cn(getOvrColorClasses(stat.value).bg.replace('bg-',''), 'bg-opacity-100')} />
                                    </div>
                                ))}
                             </div>
                        </div>
                    </Card>
                </CardFace>
            </motion.div>
        </div>
    );
});
