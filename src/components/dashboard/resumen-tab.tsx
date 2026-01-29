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
    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border gap-3">
            <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{match.title}</p>
                <p className="text-xs text-muted-foreground truncate">{match.teams?.[0]?.name} vs {match.teams?.[1]?.name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] px-1.5 h-5 hidden sm:inline-flex">{match.liveStatus === 'half_time' ? 'Entretiempo' : 'En juego'}</Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 h-5 sm:hidden">{match.liveStatus === 'half_time' ? 'ET' : 'Vivo'}</Badge>
                <Button size="sm" className="h-7 px-2 text-xs" onClick={onOpen}>Ver</Button>
                {count > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{count}</div>
                )}
            </div>
        </div>
    );
}

export function ResumenTab({ nextMatch, liveMatches, liveLoading, top5Players, playerStats, onOpenLiveMatch }: ResumenTabProps) {
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <motion.div
                className="lg:col-span-2 space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                {nextMatch && (
                    <motion.div variants={cardVariants}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    Próximo Partido
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <NextMatchCard match={nextMatch} />
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PlayCircle className="h-5 w-5 text-primary" />
                                Partidos en Vivo
                            </CardTitle>
                            <CardDescription>Partidos de tu grupo que están en curso.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
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

                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Mis Estadísticas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col items-center p-4 rounded-lg bg-card/80 border border-border">
                                    <p className="text-3xl font-bold text-foreground">{playerStats.totalMatches}</p>
                                    <p className="text-xs text-muted-foreground">Partidos Jugados</p>
                                </div>
                                <div className="flex flex-col items-center p-4 rounded-lg bg-card/80 border border-border">
                                    <p className="text-3xl font-bold text-foreground">{playerStats.totalGoals}</p>
                                    <p className="text-xs text-muted-foreground">Goles</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>

            <motion.div
                className="lg:col-span-1 space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-primary" />
                                Los Cracks del Grupo
                                <Badge variant="outline" className="text-xs font-normal">Por OVR</Badge>
                            </CardTitle>
                            <CardDescription>El Top 5 de jugadores por OVR.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <motion.div
                                className="space-y-4"
                                variants={listVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {top5Players && top5Players.length > 0 ? top5Players.map((player: Player, index: number) => {
                                    const isManualPlayer = player.id !== player.ownerUid;
                                    return (
                                        <motion.div
                                            key={player.id}
                                            variants={listVariants}
                                            className="flex items-center gap-4"
                                        >
                                            <div className="text-muted-foreground font-bold w-4">{index + 1}.</div>
                                            <Avatar className={cn("h-10 w-10 border-2 border-primary/50", isManualPlayer && "border-dashed border-muted-foreground")}>
                                                <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold truncate">{player.name}</p>
                                                    {isManualPlayer && <Badge variant="outline" className="text-xs">Manual</Badge>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <PlayerPositionBadge position={player.position} showIcon={false} size="sm" />
                                                </div>
                                            </div>
                                            <motion.div
                                                className="text-lg font-bold text-primary"
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
