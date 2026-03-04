
'use client';

import { PageHeader } from '@/components/page-header';
import { useCompetitionsData } from '@/hooks/use-competitions-data';
import { Trophy, Plus, Loader2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CupCard } from '@/components/competitions/cup-card';
import { CreateCupDialog } from '@/components/competitions/create-cup-dialog';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { BackButton } from '@/components/navigation/back-button';
import { Card } from '@/components/ui/card';

export default function CupsPage() {
    const {
        user,
        loading,
        activeGroupId,
        cups,
        cupsLoading,
        teams
    } = useCompetitionsData();

    const [createOpen, setCreateOpen] = useState(false);

    const activeCups = cups?.filter(c =>
        c.status === 'in_progress' ||
        c.status === 'open_for_applications' ||
        (c.status === 'draft' && c.ownerUid === user?.uid)
    ) || [];
    const completedCups = cups?.filter(c => c.status === 'completed') || [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Copas"
                    description="Torneos de eliminación directa. Ganar o morir."
                    icon={<Trophy className="h-8 w-8 text-amber-500" />}
                />
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="rounded-full bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 px-6 text-white"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Crear Copa
                    </Button>
                    <BackButton href="/competitions" label="Hub" />
                </div>
            </div>

            <div className="space-y-12">
                {/* Active Cups */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-8 w-1 bg-amber-500 rounded-full" />
                        <h2 className="text-2xl font-black tracking-tight">Copas Activas</h2>
                    </div>

                    {cupsLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2].map(i => <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />)}
                        </div>
                    ) : activeCups.length > 0 ? (
                        <motion.div
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {activeCups.map(cup => (
                                <CupCard key={cup.id} cup={cup} />
                            ))}
                        </motion.div>
                    ) : (
                        <Card className="border-dashed border-2 bg-muted/20 p-12 flex flex-col items-center justify-center text-center gap-4 rounded-3xl">
                            <ShieldOff className="h-12 w-12 text-muted-foreground opacity-20" />
                            <div className="max-w-xs">
                                <h3 className="font-bold text-lg">No hay copas activas</h3>
                                <p className="text-sm text-muted-foreground">Organizá un torneo de eliminación directa para definir al campeón.</p>
                            </div>
                        </Card>
                    )}
                </section>

                {/* Completed Cups */}
                {completedCups.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-8 w-1 bg-muted rounded-full" />
                            <h2 className="text-2xl font-black tracking-tight text-muted-foreground">Hall de la Fama</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 grayscale-[0.5] hover:grayscale-0 transition-all">
                            {completedCups.map(cup => (
                                <CupCard key={cup.id} cup={cup} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <CreateCupDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                groupId={activeGroupId || ''}
                userId={user?.uid || ''}
                teams={teams || []}
            />
        </div>
    );
}
