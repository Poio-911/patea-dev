
'use client';

import { PageHeader } from '@/components/page-header';
import { useCompetitionsData } from '@/hooks/use-competitions-data';
import { Shield, Plus, Loader2, Trophy, Ghost } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeagueCard } from '@/components/leagues/LeagueCard';
import { CreateLeagueDialog } from '@/components/competitions/create-league-dialog';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackButton } from '@/components/navigation/back-button';
import { Card } from '@/components/ui/card';

export default function LeaguesPage() {
    const {
        user,
        loading,
        activeGroupId,
        leagues,
        leaguesLoading,
        teams
    } = useCompetitionsData();

    const [createOpen, setCreateOpen] = useState(false);

    const activeLeagues = leagues?.filter(l =>
        l.status === 'in_progress' ||
        l.status === 'open_for_applications' ||
        (l.status === 'draft' && l.ownerUid === user?.uid)
    ) || [];
    const completedLeagues = leagues?.filter(l => l.status === 'completed') || [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                    <PageHeader
                        title="Ligas"
                        description="Torneos todos contra todos. La regularidad manda."
                        icon={<Shield className="h-8 w-8 text-blue-500" />}
                    />
                    <BackButton href="/competitions" label="Hub" className="shrink-0 mt-1" />
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="w-full sm:w-auto rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 sm:px-6"
                >
                    <Plus className="mr-2 h-4 w-4" /> Crear Liga
                </Button>
            </div>

            <div className="space-y-12">
                {/* Active Leagues Section */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-8 w-1 bg-blue-500 rounded-full" />
                        <h2 className="text-2xl font-black tracking-tight">Ligas en Curso</h2>
                    </div>

                    {leaguesLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />)}
                        </div>
                    ) : activeLeagues.length > 0 ? (
                        <motion.div
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {activeLeagues.map(league => (
                                <LeagueCard key={league.id} league={league} />
                            ))}
                        </motion.div>
                    ) : (
                        <Card className="border-dashed border-2 bg-muted/20 p-12 flex flex-col items-center justify-center text-center gap-4 rounded-3xl">
                            <Shield className="h-12 w-12 text-muted-foreground opacity-20" />
                            <div className="max-w-xs">
                                <h3 className="font-bold text-lg">No hay ligas activas</h3>
                                <p className="text-sm text-muted-foreground">Organizá un torneo y empezá a sumar puntos.</p>
                            </div>
                        </Card>
                    )}
                </section>

                {/* Completed Leagues */}
                {completedLeagues.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-8 w-1 bg-muted rounded-full" />
                            <h2 className="text-2xl font-black tracking-tight text-muted-foreground">Historial de Ligas</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 grayscale-[0.5] hover:grayscale-0 transition-all">
                            {completedLeagues.map(league => (
                                <LeagueCard key={league.id} league={league} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <CreateLeagueDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                groupId={activeGroupId || ''}
                userId={user?.uid || ''}
                teams={teams || []}
            />
        </div>
    );
}
