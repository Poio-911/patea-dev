'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import type { Match, Player } from '@/lib/types';
import { PlayerStatsCard } from '@/components/dashboard/player-stats-card';
import { OVRProgressionChart } from '@/components/dashboard/ovr-progression-chart';
import { LeaderboardWidget } from '@/components/dashboard/leaderboard-widget';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    planning: { label: 'A Confirmar', className: 'bg-primary/5 text-primary border border-primary/20 rounded-full backdrop-blur-sm' },
    upcoming: { label: 'Próximo', className: 'bg-primary/10 text-foreground border border-primary/30 rounded-full backdrop-blur-sm' },
    active: { label: 'Activo', className: 'bg-foreground/10 text-foreground border border-foreground/30 rounded-full backdrop-blur-sm' },
    completed: { label: 'Finalizado', className: 'bg-muted/40 text-muted-foreground border border-muted/50 rounded-full backdrop-blur-sm' },
    evaluated: { label: 'Evaluado', className: 'bg-card/60 text-foreground border border-border rounded-full backdrop-blur-sm' },
};

interface ProgresoTabProps {
    player: Player | null;
    recentMatches: Match[];
    groupId?: string;
    userId?: string;
}

export function ProgresoTab({ player, recentMatches, groupId, userId }: ProgresoTabProps) {
    return (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            <motion.div
                className="lg:col-span-2 space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                {player && (
                    <>
                        <motion.div variants={cardVariants}>
                            <OVRProgressionChart player={player} />
                        </motion.div>

                        <motion.div variants={cardVariants}>
                            <PlayerStatsCard player={player} />
                        </motion.div>
                    </>
                )}

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

            <motion.div
                className="lg:col-span-1 space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={cardVariants}>
                    <LeaderboardWidget
                        groupId={groupId}
                        category="goals"
                        limit={5}
                        currentUserId={userId}
                    />
                </motion.div>
            </motion.div>
        </div>
    );
}
