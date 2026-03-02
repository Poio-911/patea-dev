'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, PlayCircle, Loader2, Star, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Match, Player } from '@/lib/types';
import { NextMatchCard } from '@/components/next-match-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMatchPresence } from '@/hooks/useMatchPresence';
import { PlayerStatsCard } from '@/components/dashboard/player-stats-card';
import { OVRProgressionChart } from '@/components/dashboard/ovr-progression-chart';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AdBanner } from '@/components/ads/ad-banner';
import { SponsorCard, type SponsorCampaign } from '@/components/ads/sponsor-card';

const mockResumenSponsor: SponsorCampaign = {
    id: 'sim_sponsor_2',
    title: 'Alquiler de Canchas - 20% OFF Jueves',
    sponsorName: 'Complejo El Triángulo',
    imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80',
    redirectUrl: '#',
    placement: 'leaderboard'
};

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
    player: Player | null;
    recentMatches: Match[];
    onOpenLiveMatch: (match: Match) => void;
}

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    planning: { label: 'A Confirmar', className: 'bg-primary/5 text-primary border border-primary/20 rounded-full backdrop-blur-sm' },
    upcoming: { label: 'Próximo', className: 'bg-primary/10 text-foreground border border-primary/30 rounded-full backdrop-blur-sm' },
    active: { label: 'Activo', className: 'bg-foreground/10 text-foreground border border-foreground/30 rounded-full backdrop-blur-sm' },
    completed: { label: 'Finalizado', className: 'bg-muted/40 text-muted-foreground border border-muted/50 rounded-full backdrop-blur-sm' },
    evaluated: { label: 'Evaluado', className: 'bg-card/60 text-foreground border border-border rounded-full backdrop-blur-sm' },
};

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

export function ResumenTab({ nextMatch, liveMatches, liveLoading, player, recentMatches, onOpenLiveMatch }: ResumenTabProps) {
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
                        <NextMatchCard matches={nextMatch} />
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

                {player && (
                    <>
                        <motion.div variants={cardVariants} className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                                <Star className="h-4 w-4 text-primary" />
                                Mis Estadísticas
                            </h3>
                            <PlayerStatsCard player={player} />
                        </motion.div>
                        <motion.div variants={cardVariants}>
                            <OVRProgressionChart player={player} />
                        </motion.div>
                    </>
                )}

                {/* Banner Ad Sense Intercalado */}
                <motion.div variants={cardVariants} className="my-4">
                    <AdBanner dataAdSlot="simulated_dashboard_inline" />
                </motion.div>

                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Partidos Anteriores</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {recentMatches && recentMatches.length > 0 ? recentMatches.map(match => {
                                const statusInfo = statusConfig[match.status] || { label: 'Desconocido', className: 'bg-muted text-foreground' };
                                return (
                                    <Link key={match.id} href={`/matches/${match.id}`} className="block">
                                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                            <div>
                                                <p className="font-semibold">{match.title}</p>
                                                <p className="text-sm text-muted-foreground">{format(new Date(match.date), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                                            </div>
                                            <Badge variant="outline" className={cn(statusInfo.className)}>{statusInfo.label}</Badge>
                                        </div>
                                    </Link>
                                )
                            }) : <p className="text-sm text-muted-foreground text-center py-4">Aún no hay partidos jugados en este grupo.</p>}
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>

            {/* Espacio Banner Lateral Patrocinado */}
            <div className="hidden lg:flex lg:col-span-1 flex-col gap-4">
                <div className="sticky top-[100px]">
                    <SponsorCard campaign={mockResumenSponsor} />
                    <div className="mt-4">
                        <AdBanner dataAdSlot="simulated_dashboard_sidebar" className="h-[400px]" dataFullWidthResponsive={false} />
                    </div>
                </div>
            </div>
        </div>
    );
}
