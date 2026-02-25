'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Goal, Star, Loader2, Award, Zap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Match } from '@/lib/types';
import { getMatchResultStatsAction, type PlayerMatchStat, type MatchResultStats } from '@/lib/actions/match-result-actions';

interface MatchResultCardProps {
    match: Match;
}

function StatRow({
    player,
    rank,
    showAssists = false,
}: {
    player: PlayerMatchStat;
    rank: number;
    showAssists?: boolean;
}) {
    const rankColors = ['text-yellow-500', 'text-slate-400', 'text-amber-600'];
    const rankBg = ['bg-yellow-50 border-yellow-200', 'bg-slate-50 border-slate-200', 'bg-orange-50 border-orange-200'];

    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: rank * 0.08 }}
            className={cn(
                'flex items-center gap-3 rounded-xl border p-3',
                rank < 3 ? rankBg[rank] : 'bg-white border-slate-100'
            )}
        >
            <span className={cn('text-lg font-black w-6 text-center', rank < 3 ? rankColors[rank] : 'text-slate-400')}>
                {rank + 1}
            </span>
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                <AvatarImage src={player.photoURL} alt={player.displayName} />
                <AvatarFallback className="text-sm font-bold">{player.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{player.displayName}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{player.position}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                {player.goals > 0 && (
                    <div className="flex items-center gap-1 text-sm font-bold text-emerald-700">
                        <Goal className="h-4 w-4" />
                        {player.goals}
                    </div>
                )}
                {showAssists && player.assists > 0 && (
                    <div className="flex items-center gap-1 text-sm font-bold text-blue-600">
                        <Zap className="h-4 w-4" />
                        {player.assists}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export function MatchResultCard({ match }: MatchResultCardProps) {
    const [stats, setStats] = useState<MatchResultStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setIsLoading(true);
            const res = await getMatchResultStatsAction(match.id);
            if (mounted && res.success && res.stats) {
                setStats(res.stats);
            }
            if (mounted) setIsLoading(false);
        };
        load();
        return () => { mounted = false; };
    }, [match.id]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10 rounded-2xl border bg-white shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!stats) return null;

    const hasStats =
        stats.selfReportedStats.length > 0 || stats.mvpPlayer;

    // Players with goals sorted desc
    const scorers = stats.selfReportedStats.filter(p => p.goals > 0);
    // Players with assists sorted desc
    const assisters = stats.selfReportedStats
        .filter(p => p.assists > 0)
        .sort((a, b) => b.assists - a.assists);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border bg-white shadow-sm overflow-hidden"
        >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 text-white overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(250,204,21,0.15),_transparent_60%)]" />
                <div className="relative flex items-center gap-3">
                    <div className="rounded-xl bg-yellow-400/20 p-2.5">
                        <Trophy className="h-6 w-6 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">Resultado del Partido</h2>
                        <p className="text-sm text-slate-400">Stats reportados por los jugadores</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">

                {/* Final Score (if available from finalScore field or selfEvals team totals) */}
                {(stats.hasFinalScore || (stats.totalTeam1Goals > 0 || stats.totalTeam2Goals > 0)) && match.teams && match.teams.length >= 2 && (
                    <div className="flex items-center justify-center gap-4">
                        <div className="flex-1 text-right">
                            <p className="font-bold text-slate-700 truncate">{match.teams[0]?.name || 'Equipo 1'}</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 shadow-lg">
                            <span className="text-4xl font-black text-white tabular-nums">
                                {stats.finalScore?.team1 ?? stats.totalTeam1Goals}
                            </span>
                            <span className="text-2xl text-slate-500 font-light">-</span>
                            <span className="text-4xl font-black text-white tabular-nums">
                                {stats.finalScore?.team2 ?? stats.totalTeam2Goals}
                            </span>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-bold text-slate-700 truncate">{match.teams[1]?.name || 'Equipo 2'}</p>
                        </div>
                    </div>
                )}

                {/* MVP */}
                {stats.mvpPlayer && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">MVP del Partido</h3>
                        </div>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative flex items-center gap-4 rounded-2xl border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 p-4 shadow-sm overflow-hidden"
                        >
                            {/* Gold glow */}
                            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-yellow-300/30 blur-2xl" />
                            <div className="relative">
                                <Avatar className="h-16 w-16 border-4 border-yellow-400 shadow-lg">
                                    <AvatarImage src={stats.mvpPlayer.photoURL} alt={stats.mvpPlayer.displayName} />
                                    <AvatarFallback className="text-lg font-black bg-yellow-100 text-yellow-700">
                                        {stats.mvpPlayer.displayName.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 rounded-full bg-yellow-400 p-1 shadow">
                                    <Star className="h-3.5 w-3.5 text-white fill-white" />
                                </div>
                            </div>
                            <div className="relative">
                                <p className="text-xl font-black text-slate-900">{stats.mvpPlayer.displayName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-yellow-400 text-yellow-900 border-yellow-500 text-xs font-bold hover:bg-yellow-400">
                                        MVP
                                    </Badge>
                                    <span className="text-xs text-slate-500">
                                        {stats.mvpPlayer.mvpVotes} voto{stats.mvpPlayer.mvpVotes !== 1 ? 's' : ''}
                                    </span>
                                    {stats.mvpPlayer.goals > 0 && (
                                        <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700">
                                            <Goal className="h-3.5 w-3.5" /> {stats.mvpPlayer.goals}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Top Scorers */}
                {scorers.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Goal className="h-4 w-4 text-emerald-600" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Goleadores</h3>
                        </div>
                        <div className="space-y-2">
                            {scorers.map((player, i) => (
                                <StatRow key={player.uid} player={player} rank={i} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Assisters */}
                {assisters.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Zap className="h-4 w-4 text-blue-500" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Asistencias</h3>
                        </div>
                        <div className="space-y-2">
                            {assisters.map((player, i) => (
                                <StatRow key={player.uid} player={player} rank={i} showAssists />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!hasStats && (
                    <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Los jugadores aún no reportaron sus estadísticas.</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
