'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, PlayCircle, Loader2, Star, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Match, Player } from '@/lib/types';
import { NextMatchCard } from '@/components/next-match-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlayerPositionBadge } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { useMatchPresence } from '@/hooks/useMatchPresence';

import { Crown } from 'lucide-react';

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: 'easeOut',
        },
    },
};

const listVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

interface ResumenTabProps {
    nextMatch: Match | null;
    liveMatches: Match[];
    liveLoading: boolean;
    top5Players: Player[];
    playerStats: {
        totalMatches: number;
        totalGoals: number;
    };
    onOpenLiveMatch: (match: Match) => void;
}

function LiveMatchRow({ match, onOpen }: { match: Match; onOpen: () => void }) {
    const { count } = useMatchPresence({ matchId: match.id, track: false, staleMs: 5 * 60 * 1000 });
    const isHalfTime = match.liveStatus === 'half_time';

    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 gap-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative flex shrink-0 h-2.5 w-2.5">
                    {!isHalfTime && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                    <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isHalfTime ? "bg-amber-500" : "bg-green-500")}></span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-sm">{match.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{match.teams?.[0]?.name} vs {match.teams?.[1]?.name}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn("text-[10px] px-1.5 h-5 hidden sm:inline-flex border-opacity-50", isHalfTime ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : "text-green-500 border-green-500/30 bg-green-500/10")}>
                    {isHalfTime ? 'Entretiempo' : 'En juego'}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 h-5 sm:hidden border-opacity-50", isHalfTime ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : "text-green-500 border-green-500/30 bg-green-500/10")}>
                    {isHalfTime ? 'ET' : 'Vivo'}
                </Badge>
                <Button size="sm" className="h-7 px-3 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0" onClick={onOpen}>Abrir</Button>
                {count > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-background px-1.5 py-0.5 rounded-full border border-border/50"><Eye className="h-3 w-3" />{count}</div>
                )}
            </div>
        </div>
    );
}

export function ResumenTab({ nextMatch, liveMatches, liveLoading, top5Players, playerStats, onOpenLiveMatch }: ResumenTabProps) {
    return (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            <motion.div
                className="lg:col-span-2 space-y-4 sm:space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                {nextMatch && (
                    <motion.div variants={cardVariants} className="space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                            <Calendar className="h-4 w-4 text-primary" />
                            Próximo Partido
                        </h3>
                        <NextMatchCard match={nextMatch} />
                    </motion.div>
                )}

                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader className="pb-3 px-4 pt-4 sm:px-6 sm:pt-6">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <PlayCircle className="h-5 w-5 text-primary" />
                                Partidos en Vivo
                            </CardTitle>
                            <CardDescription>Partidos de tu grupo que están en curso.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-3">
                            {liveLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
                            ) : liveMatches.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No hay partidos en vivo ahora.</p>
                            ) : (
                                liveMatches.map((m) => (
                                    <LiveMatchRow key={m.id} match={m} onOpen={() => onOpenLiveMatch(m)} />
                                ))
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={cardVariants} className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                        Mis Estadísticas
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 -z-10"></div>

                        <div className="flex flex-col items-center p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                            <p className="text-4xl font-black text-foreground drop-shadow-sm tracking-tighter mb-1 relative z-10">{playerStats.totalMatches}</p>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-semibold relative z-10">Partidos</p>
                        </div>

                        <div className="flex flex-col items-center p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-xl relative overflow-hidden">
                            <div className="absolute bottom-0 left-0 w-16 h-16 bg-blue-500/10 rounded-full blur-2xl -ml-8 -mb-8"></div>
                            <p className="text-4xl font-black text-foreground drop-shadow-sm tracking-tighter mb-1 relative z-10">{playerStats.totalGoals}</p>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-semibold relative z-10">Goles</p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            <motion.div
                className="lg:col-span-1 space-y-4 sm:space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader className="pb-3 px-4 pt-4 sm:px-6 sm:pt-6">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Star className="h-5 w-5 text-primary" />
                                Los Cracks del Grupo
                                <Badge variant="outline" className="text-xs font-normal ml-auto">Por OVR</Badge>
                            </CardTitle>
                            <CardDescription>El Top 5 de jugadores por OVR.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-3">
                            <motion.div
                                className="space-y-4"
                                variants={listVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {top5Players && top5Players.length > 0 ? top5Players.map((player: Player, index: number) => {
                                    const isManualPlayer = player.id !== player.ownerUid;

                                    // Podium Logic
                                    const isTop1 = index === 0;
                                    const isTop2 = index === 1;
                                    const isTop3 = index === 2;

                                    let podiumClass = "bg-muted/30 border-transparent text-muted-foreground";
                                    let borderAvatarClass = "border-primary/50";
                                    let rankColorClass = "text-muted-foreground";

                                    if (isTop1) {
                                        podiumClass = "bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20";
                                        borderAvatarClass = "border-amber-400 dark:border-amber-500";
                                        rankColorClass = "text-amber-500 font-black text-lg";
                                    } else if (isTop2) {
                                        podiumClass = "bg-slate-300/10 dark:bg-slate-400/10 border-slate-400/30";
                                        borderAvatarClass = "border-slate-300 dark:border-slate-400";
                                        rankColorClass = "text-slate-500 dark:text-slate-400 font-bold text-lg";
                                    } else if (isTop3) {
                                        podiumClass = "bg-orange-700/10 dark:bg-orange-800/20 border-orange-700/30";
                                        borderAvatarClass = "border-orange-600 dark:border-orange-700";
                                        rankColorClass = "text-orange-600 dark:text-orange-500 font-bold text-lg";
                                    }

                                    return (
                                        <motion.div
                                            key={player.id}
                                            variants={listVariants}
                                            className={cn("flex items-center gap-4 p-3 rounded-xl border transition-all duration-300", podiumClass)}
                                        >
                                            <div className={cn("w-6 flex justify-center", rankColorClass)}>
                                                {isTop1 ? <Crown className="h-5 w-5 animate-pulse" /> : `#${index + 1}`}
                                            </div>
                                            <Avatar className={cn("h-11 w-11 border-2", borderAvatarClass, isManualPlayer && "border-dashed opacity-80")}>
                                                <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                                <AvatarFallback className="bg-background">{player.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className={cn("font-bold truncate", isTop1 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{player.name}</p>
                                                    {isManualPlayer && <Badge variant="secondary" className="text-[9px] px-1 h-4 uppercase font-semibold">Bot</Badge>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <PlayerPositionBadge position={player.position} showIcon={false} size="sm" />
                                                </div>
                                            </div>
                                            <motion.div
                                                className={cn("text-xl font-black pr-1", isTop1 ? "text-amber-500" : "text-primary")}
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: index * 0.1 + 0.2, type: "spring", stiffness: 200 }}
                                            >
                                                {player.ovr}
                                            </motion.div>
                                        </motion.div>
                                    )
                                }) : <p className="text-sm text-muted-foreground text-center py-4">Aún no hay jugadores en este grupo.</p>}
                            </motion.div>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>
        </div>
    );
}
