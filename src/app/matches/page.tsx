'use client';

import { Users2, Calendar, Loader2, Info, Trophy } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, doc, writeBatch } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Match, Player } from '@/lib/types';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { MatchCard } from '@/components/match-card';
import { SportsBroadcastHeader } from '@/components/matches/sports-broadcast-header';
// Removed category pill nav as we focus this page on amistosos
import { QuickTimeFilter, type TimeFilter } from '@/components/matches/quick-time-filter';
import { HeroMatchCard } from '@/components/matches/hero-match-card';
import { PendingFinalizationDialog } from '@/components/matches/pending-finalization-dialog';
import { useToast } from '@/hooks/use-toast';
const listVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

export default function MatchesPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    // This page now focuses only on amistosos (manual, collaborative, by_teams, intergroup_friendly)
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
    const [showPendingDialog, setShowPendingDialog] = useState(false);
    const hasCheckedPending = useRef(false);

    const playersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);
    const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(playersQuery);

    const groupMatchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
    }, [firestore, user?.activeGroupId]);
    const joinedPublicMatchesQuery = useMemo(() => {
        if (!firestore || !user?.uid || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('playerUids', 'array-contains', user.uid),
            where('isPublic', '==', true),
            where('groupId', '!=', user.activeGroupId)
        );
    }, [firestore, user?.uid, user?.activeGroupId]);

    const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);
    const { data: joinedPublicMatches, loading: joinedPublicMatchesLoading } = useCollection<Match>(joinedPublicMatchesQuery);

    const allMatches = useMemo(() => {
        const all = new Map<string, Match>();
        (groupMatches || []).forEach(m => all.set(m.id, m));
        (joinedPublicMatches || []).forEach(m => all.set(m.id, m));
        return Array.from(all.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [groupMatches, joinedPublicMatches]);

    const pendingFinalizationMatches = useMemo(() => {
     if (!user?.uid) return [];
     const now = new Date();
     const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
     const competitionTypes = ['league', 'cup', 'league_final'];
     return allMatches.filter(match => match.ownerUid === user.uid && match.status === 'upcoming' && new Date(match.date) < today && !competitionTypes.includes(match.type));
    }, [allMatches, user?.uid]);

    useEffect(() => {
        if (pendingFinalizationMatches.length > 0 && !hasCheckedPending.current) {
            hasCheckedPending.current = true;
            setShowPendingDialog(true);
        }
    }, [pendingFinalizationMatches.length]);

    const handleFinalizeAllPending = async () => {
        if (!firestore || pendingFinalizationMatches.length === 0) return;
        try {
            const batch = writeBatch(firestore);
            const now = new Date().toISOString();
            for (const match of pendingFinalizationMatches) {
                const matchRef = doc(firestore, 'matches', match.id);
                batch.update(matchRef, { status: 'completed', finalizedAt: now });
            }
            await batch.commit();
            toast({ title: 'Partidos finalizados', description: `Se finalizaron ${pendingFinalizationMatches.length} partido${pendingFinalizationMatches.length !== 1 ? 's' : ''} correctamente.` });
        } catch (error) {
            console.error('Error finalizing matches:', error);
            toast({ title: 'Error', description: 'No se pudieron finalizar los partidos.', variant: 'destructive' });
        }
    };

    const amistososMatches = useMemo(() => {
        return allMatches.filter(m => m.type === 'manual' || m.type === 'collaborative' || m.type === 'by_teams' || m.type === 'intergroup_friendly');
    }, [allMatches]);

    const filteredMatches = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 86400000);
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        switch (timeFilter) {
            case 'today':
                return amistososMatches.filter(m => {
                    const d = new Date(m.date);
                    const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    return matchDay.getTime() === today.getTime();
                });
            case 'tomorrow':
                return amistososMatches.filter(m => {
                    const d = new Date(m.date);
                    const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    return matchDay.getTime() === tomorrow.getTime();
                });
            case 'this_week':
                return amistososMatches.filter(m => {
                    const d = new Date(m.date);
                    return d >= today && d < weekEnd;
                });
            case 'history':
                return amistososMatches.filter(m => new Date(m.date) < now && m.status !== 'upcoming' && m.status !== 'active');
            default:
                return amistososMatches.filter(m => new Date(m.date) >= now || m.status === 'upcoming' || m.status === 'active');
        }
    }, [amistososMatches, timeFilter]);

    const sortedFilteredMatches = useMemo(() => {
        return [...filteredMatches].sort((a, b) => {
            if (timeFilter === 'history') return new Date(b.date).getTime() - new Date(a.date).getTime();
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [filteredMatches, timeFilter]);

    const featuredMatch = useMemo(() => {
        if (timeFilter === 'history') return null;
        const now = new Date();
        const upcomingMatches = amistososMatches
            .filter(m => new Date(m.date) >= now || m.status === 'upcoming' || m.status === 'active')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return upcomingMatches[0] || null;
    }, [amistososMatches, timeFilter]);

    const timeCounts = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 86400000);
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        return {
            today: amistososMatches.filter(m => {
                const d = new Date(m.date);
                const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return matchDay.getTime() === today.getTime();
            }).length,
            tomorrow: amistososMatches.filter(m => {
                const d = new Date(m.date);
                const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return matchDay.getTime() === tomorrow.getTime();
            }).length,
            this_week: amistososMatches.filter(m => {
                const d = new Date(m.date);
                return d >= today && d < weekEnd;
            }).length,
            upcoming: amistososMatches.filter(m => new Date(m.date) >= now || m.status === 'upcoming' || m.status === 'active').length,
            history: amistososMatches.filter(m => new Date(m.date) < now && m.status !== 'upcoming' && m.status !== 'active').length,
        };
    }, [amistososMatches]);

    const loading = userLoading || playersLoading || groupMatchesLoading || joinedPublicMatchesLoading;

    const sortedPlayers = useMemo(() => {
        if (!allGroupPlayers) return [];
        return [...allGroupPlayers].sort((a, b) => b.ovr - a.ovr);
    }, [allGroupPlayers]);

    const gridMatches = useMemo(() => {
        if (!featuredMatch) return sortedFilteredMatches;
        return sortedFilteredMatches.filter(m => m.id !== featuredMatch.id);
    }, [sortedFilteredMatches, featuredMatch]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Cargando partidos...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <FirstTimeInfoDialog
                featureKey="hasSeenMatchesInfo"
                title="Sección de Partidos"
                description="Acá podés crear nuevos partidos y ver todos los partidos de tu grupo, tanto los próximos como el historial. Usá el icono del calendario para una vista mensual."
            />

            <PendingFinalizationDialog
                matches={pendingFinalizationMatches}
                open={showPendingDialog}
                onOpenChange={setShowPendingDialog}
                onFinalizeAll={handleFinalizeAllPending}
            />

            <SportsBroadcastHeader allPlayers={sortedPlayers} disabled={!user?.activeGroupId} />

            {!user?.activeGroupId && (
                <Alert>
                    <Users2 className="h-4 w-4" />
                    <AlertTitle>No hay grupo activo</AlertTitle>
                    <AlertDescription>
                        No tienes un grupo activo seleccionado. Por favor, crea o únete a un grupo para ver los partidos.
                        <Button asChild variant="link" className="p-0 h-auto ml-1">
                            <Link href="/groups">Ir a la página de grupos</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {user?.activeGroupId && (
                <div className="space-y-6">
                    {featuredMatch && timeFilter !== 'history' && (
                        <HeroMatchCard match={featuredMatch} allPlayers={sortedPlayers} variant="compact" />
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Partidos</CardTitle>
                            <CardDescription>Filtrá por categoría y fecha</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <QuickTimeFilter activeFilter={timeFilter} onFilterChange={setTimeFilter} counts={timeCounts} />
                            {gridMatches.length > 0 ? (
                                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={listVariants} initial="hidden" animate="visible" key={`${timeFilter}`}>
                                    {gridMatches.map(match => (
                                        <motion.div key={match.id} variants={itemVariants}>
                                            <MatchCard match={match} allPlayers={sortedPlayers} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted-foreground/20 rounded-xl">
                                    {timeFilter === 'history' ? (
                                        <>
                                            <Info className="h-16 w-16 text-muted-foreground mb-4" />
                                            <h2 className="text-xl font-semibold mb-2">Sin Historial</h2>
                                            <p className="text-muted-foreground mb-6 max-w-md">Cuando los partidos finalicen, aparecerán acá.</p>
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
                                            <h2 className="text-xl font-semibold mb-2">No hay partidos</h2>
                                            <p className="text-muted-foreground mb-6 max-w-md">¡Es hora de organizar el próximo encuentro!</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
