'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, TrendingUp, Shield, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { LeagueTeamStats, BracketMatch, LeagueStanding } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MyTeamViewProps {
    teamId: string;
    teamName: string;
    jersey?: any;
    stats?: any; // LeagueStats or CupStats
    nextMatch?: any; // Match object
    recentForm?: ('W' | 'L' | 'D')[];
    competitionType: 'league' | 'cup';
}

export function MyTeamView({
    teamId,
    teamName,
    jersey,
    stats,
    nextMatch,
    recentForm = [],
    competitionType
}: MyTeamViewProps) {

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl overflow-hidden">
                {/* Background Effects */}
                <div className="absolute top-0 right-0 p-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                <div className="relative z-10 p-5 md:p-8">
                    <div className="flex flex-row items-center gap-3 md:gap-6">

                        {/* Jersey Container - Compact Icon size on mobile */}
                        <div className="shrink-0 relative flex items-center justify-center">
                            <div className="w-12 h-12 md:w-32 md:h-32 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]">
                                {jersey ? (
                                    <div className="w-full h-full transform scale-100 origin-center flex items-center justify-center">
                                        <JerseyPreview jersey={jersey} size="lg" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full bg-white/10 rounded-full flex items-center justify-center border-2 border-white/20">
                                        <Shield className="w-6 h-6 md:w-12 md:h-12 opacity-50" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Team Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 md:gap-1">
                            <h2 className="text-lg md:text-5xl font-black tracking-tight leading-none truncate pr-2">
                                {teamName}
                            </h2>

                            <div className="flex flex-wrap items-center gap-2 md:gap-3 text-slate-300">
                                <Badge variant="secondary" className="bg-white/10 text-white border-0 backdrop-blur-sm h-5 md:h-7 px-2 text-[10px] md:text-sm font-semibold shrink-0">
                                    {competitionType === 'league' ? 'LIGA' : 'COPA'}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs md:text-base font-medium shrink-0">
                                    <Users className="w-3 h-3 md:w-4 md:h-4" />
                                    <span>11 Jug.</span>
                                </div>
                            </div>
                        </div>

                        {/* Desktop Stats */}
                        <div className="hidden md:flex gap-4 shrink-0 ml-auto pl-4">
                            <div className="flex flex-col items-center p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 min-w-[80px]">
                                <span className="text-xs uppercase tracking-wider opacity-70">Pos</span>
                                <span className="text-3xl font-bold">#{stats?.position || '-'}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 min-w-[80px]">
                                <span className="text-xs uppercase tracking-wider opacity-70">Pts</span>
                                <span className="text-3xl font-bold text-amber-400">{stats?.points ?? '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Stats Divider line */}
                    <div className="md:hidden w-full h-px bg-white/10 my-4" />

                    {/* Mobile Stats Row */}
                    <div className="flex md:hidden justify-around items-center px-2">
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">Posición</span>
                            <span className="text-2xl font-black tracking-tight">#{stats?.position || '-'}</span>
                        </div>
                        <div className="w-px bg-white/10 h-8" />
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">Puntos</span>
                            <span className="text-2xl font-black tracking-tight text-amber-400">{stats?.points ?? '-'}</span>
                        </div>
                        <div className="w-px bg-white/10 h-8" />
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">Partidos</span>
                            <span className="text-2xl font-black tracking-tight">{stats?.played ?? '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Next Match Card */}
                <div className="md:col-span-2">
                    <Card className="h-full border-0 shadow-lg bg-white/80 dark:bg-card/90 backdrop-blur-md overflow-hidden relative">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Calendar className="w-5 h-5 text-primary" />
                                Próximo Partido
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {nextMatch ? (
                                <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50 gap-4">
                                    <div className="text-center sm:text-left flex-1">
                                        <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                                            Jornada {nextMatch.leagueInfo?.round || '-'}
                                        </p>
                                        <p className="text-xl font-bold leading-tight">
                                            {nextMatch.team1Name} vs {nextMatch.team2Name}
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {nextMatch.date ? new Date(nextMatch.date).toLocaleDateString() : 'Fecha por definir'}
                                        </p>
                                    </div>
                                    <Button size="lg" className="w-full sm:w-auto font-bold shadow-md">
                                        Ir al Partido <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/10 rounded-xl border border-dashed border-border/60">
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                        <CheckCircle2 className="w-6 h-6 text-muted-foreground opacity-50" />
                                    </div>
                                    <h3 className="text-base font-semibold text-foreground">Al día con el calendario</h3>
                                    <p className="text-sm text-muted-foreground max-w-[250px]">
                                        No tenés partidos pendientes programados por ahora.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Form & Stats */}
                <div className="space-y-6">
                    <Card className="border-0 shadow-md bg-white/80 dark:bg-card/90 backdrop-blur-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                Forma Reciente
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2 justify-center">
                                {recentForm.length > 0 ? recentForm.map((result, i) => (
                                    <div key={i} className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 shadow-sm transition-all hover:scale-110 cursor-default",
                                        result === 'W' ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30" :
                                            result === 'D' ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" :
                                                "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                                    )}>
                                        {result}
                                    </div>
                                )) : (
                                    <span className="text-sm text-muted-foreground italic">Temporada recién comienza</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
