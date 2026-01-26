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
import { CategoryPillNav, type MatchCategory } from '@/components/matches/category-pill-nav';
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
    const [activeCategory, setActiveCategory] = useState<MatchCategory>('amistosos');
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

    const categorizedMatches = useMemo(() => {
        const amistosos = allMatches.filter(m => m.type === 'manual' || m.type === 'collaborative' || m.type === 'by_teams' || m.type === 'intergroup_friendly');
        const allLeagueMatches = allMatches.filter(m => m.type === 'league' || m.type === 'league_final');
        const matchesByLeague = allLeagueMatches.reduce((acc, match) => {
            const leagueId = match.leagueInfo?.leagueId || 'unknown';
            if (!acc[leagueId]) acc[leagueId] = [];
            acc[leagueId].push(match);
            return acc;
        }, {} as Record<string, Match[]>);
        const focusedLeagueMatches: Match[] = [];
        Object.values(matchesByLeague).forEach(leagueMatches => {
            const matchesByRound = leagueMatches.reduce((acc, match) => {
                const round = match.leagueInfo?.round || 0;
                if (!acc[round]) acc[round] = [];
                acc[round].push(match);
                return acc;
            }, {} as Record<number, Match[]>);
            const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);
            if (rounds.length <= 2) {
                focusedLeagueMatches.push(...leagueMatches);
            } else {
                const currentRound = rounds.find(round => {
                    const roundMatches = matchesByRound[round];
                    const allCompleted = roundMatches.every(m => m.status === 'completed' || m.status === 'evaluated');
                    const nextRound = rounds[rounds.indexOf(round) + 1];
                    if (!nextRound) return false;
                    const nextRoundMatches = matchesByRound[nextRound];
                    const anyNextStarted = nextRoundMatches.some(m => m.status !== 'upcoming');
                    return allCompleted && anyNextStarted;
                }) || rounds[0];
                const currentIndex = rounds.indexOf(currentRound);
                const nextRound = rounds[currentIndex + 1];
                if (nextRound) {
                    focusedLeagueMatches.push(...matchesByRound[currentRound], ...matchesByRound[nextRound]);
                } else {
                    const roundsToShow = rounds.slice(-2);
                    roundsToShow.forEach(r => focusedLeagueMatches.push(...matchesByRound[r]));
                }
            }
        });
        const copas = allMatches.filter(m => m.type === 'cup');
        return { amistosos, ligas: focusedLeagueMatches, copas };
    }, [allMatches]);

    const categoryMatches = categorizedMatches[activeCategory];

    const filteredMatches = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 86400000);
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        switch (timeFilter) {
            case 'today':
                return categoryMatches.filter(m => {
                    const d = new Date(m.date);
                    const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    return matchDay.getTime() === today.getTime();
                });
            case 'tomorrow':
                return categoryMatches.filter(m => {
                    const d = new Date(m.date);
                    const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    return matchDay.getTime() === tomorrow.getTime();
                });
            case 'this_week':
                return categoryMatches.filter(m => {
                    const d = new Date(m.date);
                    return d >= today && d < weekEnd;
                });
            case 'history':
                return categoryMatches.filter(m => new Date(m.date) < now && m.status !== 'upcoming' && m.status !== 'active');
            default:
                return categoryMatches.filter(m => new Date(m.date) >= now || m.status === 'upcoming' || m.status === 'active');
        }
    }, [categoryMatches, timeFilter]);

    const sortedFilteredMatches = useMemo(() => {
        return [...filteredMatches].sort((a, b) => {
            if (timeFilter === 'history') return new Date(b.date).getTime() - new Date(a.date).getTime();
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [filteredMatches, timeFilter]);

    const featuredMatch = useMemo(() => {
        if (timeFilter === 'history') return null;
        const now = new Date();
        const upcomingMatches = categoryMatches
            .filter(m => new Date(m.date) >= now || m.status === 'upcoming' || m.status === 'active')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return upcomingMatches[0] || null;
    }, [categoryMatches, timeFilter]);

    const timeCounts = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 86400000);
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        return {
            today: categoryMatches.filter(m => {
                const d = new Date(m.date);
                const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return matchDay.getTime() === today.getTime();
            }).length,
            tomorrow: categoryMatches.filter(m => {
                const d = new Date(m.date);
                const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return matchDay.getTime() === tomorrow.getTime();
            }).length,
            this_week: categoryMatches.filter(m => {
                const d = new Date(m.date);
                return d >= today && d < weekEnd;
            }).length,
            upcoming: categoryMatches.filter(m => new Date(m.date) >= now || m.status === 'upcoming' || m.status === 'active').length,
            history: categoryMatches.filter(m => new Date(m.date) < now && m.status !== 'upcoming' && m.status !== 'active').length,
        };
    }, [categoryMatches]);

    const loading = userLoading || playersLoading || groupMatchesLoading || joinedPublicMatchesLoading;

    const sortedPlayers = useMemo(() => {
        if (!allGroupPlayers) return [];
        return [...allGroupPlayers].sort((a, b) => b.ovr - a.ovr);
    }, [allGroupPlayers]);

    const categories = useMemo(() => [
        { id: 'amistosos' as const, label: 'Amistosos', count: categorizedMatches.amistosos.length },
        { id: 'ligas' as const, label: 'Ligas', count: categorizedMatches.ligas.length },
        { id: 'copas' as const, label: 'Copas', count: categorizedMatches.copas.length },
    ], [categorizedMatches]);

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
                        <HeroMatchCard match={featuredMatch} allPlayers={sortedPlayers} />
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Partidos</CardTitle>
                            <CardDescription>Filtrá por categoría y fecha</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <CategoryPillNav categories={categories} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
                            <QuickTimeFilter activeFilter={timeFilter} onFilterChange={setTimeFilter} counts={timeCounts} />
                            {gridMatches.length > 0 ? (
                                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={listVariants} initial="hidden" animate="visible" key={`${activeCategory}-${timeFilter}`}>
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
                                            <p className="text-muted-foreground mb-6 max-w-md">
                                                {activeCategory === 'amistosos' && '¡Es hora de organizar el próximo encuentro!'}
                                                {activeCategory === 'ligas' && 'No participas en ninguna liga actualmente. Ve a Competiciones para unirte.'}
                                                {activeCategory === 'copas' && 'No hay copas en curso. Ve a Competiciones para crear una.'}
                                            </p>
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
