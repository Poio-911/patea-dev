'use client';

import { Users2, Calendar, Loader2, Info } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, doc, writeBatch } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Match, Player, MatchFilters as MatchFiltersType, MatchesViewMode } from '@/lib/types';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { PageHeader } from '@/components/page-header';
import { motion } from 'framer-motion';
import { MatchCard } from '@/components/match-card';
import { CompactMatchCard } from '@/components/compact-match-card';
import { QuickTimeFilter, type TimeFilter } from '@/components/matches/quick-time-filter';
import { MatchFilters } from '@/components/matches/match-filters';
import { ViewModeToggle } from '@/components/matches/view-mode-toggle';
import { NextMatchCard } from '@/components/next-match-card';
import { PendingFinalizationDialog } from '@/components/matches/pending-finalization-dialog';
import { AddMatchDialog } from '@/components/add-match-dialog';
import { useToast } from '@/hooks/use-toast';
import { updateUserPreferencesAction, getUserPreferencesAction } from '@/lib/actions/server-actions';

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

const DEFAULT_FILTERS: MatchFiltersType = { types: [], statuses: [], onlyMine: false };

export default function MatchesPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // View mode and filters state
    const [viewMode, setViewMode] = useState<MatchesViewMode>('grid');
    const [matchFilters, setMatchFilters] = useState<MatchFiltersType>(DEFAULT_FILTERS);
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // This page now focuses only on amistosos (manual, collaborative, by_teams, intergroup_friendly)
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
    const [showPendingDialog, setShowPendingDialog] = useState(false);
    const hasCheckedPending = useRef(false);

    // Load user preferences on mount
    useEffect(() => {
        async function loadPreferences() {
            if (!user?.uid) return;
            try {
                const result = await getUserPreferencesAction(user.uid);
                if (result.success && result.preferences) {
                    if (result.preferences.matchesViewMode) {
                        setViewMode(result.preferences.matchesViewMode);
                    }
                    if (result.preferences.matchFilters) {
                        setMatchFilters({
                            types: result.preferences.matchFilters.types as MatchFiltersType['types'] || [],
                            statuses: result.preferences.matchFilters.statuses as MatchFiltersType['statuses'] || [],
                            onlyMine: result.preferences.matchFilters.onlyMine || false,
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading preferences:', error);
            } finally {
                setPreferencesLoaded(true);
            }
        }
        loadPreferences();
    }, [user?.uid]);

    // Persist preferences with debounce
    const persistPreferences = useCallback((newViewMode: MatchesViewMode, newFilters: MatchFiltersType) => {
        if (!user?.uid || !preferencesLoaded) return;

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
            try {
                await updateUserPreferencesAction(user.uid, {
                    matchesViewMode: newViewMode,
                    matchFilters: {
                        types: newFilters.types || [],
                        statuses: newFilters.statuses || [],
                        onlyMine: newFilters.onlyMine || false,
                    },
                });
            } catch (error) {
                console.error('Error saving preferences:', error);
            }
        }, 500);
    }, [user?.uid, preferencesLoaded]);

    const handleViewModeChange = useCallback((mode: MatchesViewMode) => {
        setViewMode(mode);
        persistPreferences(mode, matchFilters);
    }, [matchFilters, persistPreferences]);

    const handleFiltersChange = useCallback((filters: MatchFiltersType) => {
        setMatchFilters(filters);
        persistPreferences(viewMode, filters);
    }, [viewMode, persistPreferences]);

    const playersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);
    const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(playersQuery);

    const groupMatchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
    }, [firestore, user?.activeGroupId]);
    const joinedMatchesQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'matches'),
            where('playerUids', 'array-contains', user.uid)
        );
    }, [firestore, user?.uid]);

    const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);

    const { data: joinedMatches, loading: joinedMatchesLoading } = useCollection<Match>(joinedMatchesQuery);

    const allMatches = useMemo(() => {
        const all = new Map<string, Match>();
        (groupMatches || []).forEach(m => all.set(m.id, m));
        (joinedMatches || []).forEach(m => all.set(m.id, m));
        return Array.from(all.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [groupMatches, joinedMatches]);

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
        const weekEnd = new Date(today.getTime() + 7 * 86400000);

        // Start with all amistosos
        let matches = amistososMatches;

        // Apply type filter
        if (matchFilters.types && matchFilters.types.length > 0) {
            matches = matches.filter(m => matchFilters.types!.includes(m.type));
        }

        // Apply status filter
        if (matchFilters.statuses && matchFilters.statuses.length > 0) {
            matches = matches.filter(m => matchFilters.statuses!.includes(m.status));
        }

        // Apply "only mine" filter
        if (matchFilters.onlyMine && user?.uid) {
            matches = matches.filter(m => m.ownerUid === user.uid);
        }

        // Apply time filter
        switch (timeFilter) {
            case 'upcoming':
                // Show all matches with date >= today OR status active
                return matches.filter(m => {
                    const matchDate = new Date(m.date);
                    const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                    return matchDay >= today || m.status === 'active';
                });
            case 'this_week':
                return matches.filter(m => {
                    const d = new Date(m.date);
                    const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    return matchDay >= today && matchDay < weekEnd;
                });
            case 'history':
                // Show matches with date < today AND status completed or evaluated
                return matches.filter(m => {
                    const matchDate = new Date(m.date);
                    const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                    return matchDay < today && (m.status === 'completed' || m.status === 'evaluated');
                });
            default:
                return matches;
        }
    }, [amistososMatches, timeFilter, matchFilters, user?.uid]);

    const sortedFilteredMatches = useMemo(() => {
        return [...filteredMatches].sort((a, b) => {
            if (timeFilter === 'history') return new Date(b.date).getTime() - new Date(a.date).getTime();
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [filteredMatches, timeFilter]);

    const featuredMatch = useMemo(() => {
        if (timeFilter === 'history') return null;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const getTs = (m: Match) => {
            const d = new Date(m.date);
            const clean = (m.time || '').replace(' hs', '').replace('hs', '').trim();
            const [hh, mm = '0'] = clean.split(':');
            d.setHours(parseInt(hh || '0', 10) || 0, parseInt(mm || '0', 10) || 0, 0, 0);
            return d.getTime();
        };
        const upcomingMatches = amistososMatches
            .filter(m => {
                const matchDate = new Date(m.date);
                const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                return matchDay >= today || m.status === 'active';
            })
            .sort((a, b) => getTs(a) - getTs(b));
        return upcomingMatches[0] || null;
    }, [amistososMatches, timeFilter]);

    const timeCounts = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        return {
            upcoming: amistososMatches.filter(m => {
                const matchDate = new Date(m.date);
                const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                return matchDay >= today || m.status === 'active';
            }).length,
            this_week: amistososMatches.filter(m => {
                const d = new Date(m.date);
                const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return matchDay >= today && matchDay < weekEnd;
            }).length,
            history: amistososMatches.filter(m => {
                const matchDate = new Date(m.date);
                const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                return matchDay < today && (m.status === 'completed' || m.status === 'evaluated');
            }).length,
        };
    }, [amistososMatches]);

    const loading = userLoading || playersLoading || groupMatchesLoading || joinedMatchesLoading;

    const sortedPlayers = useMemo(() => {
        if (!allGroupPlayers) return [];
        return [...allGroupPlayers].sort((a, b) => b.ovr - a.ovr);
    }, [allGroupPlayers]);

    // No excluir el featuredMatch - se muestra en ambos lugares
    const gridMatches = sortedFilteredMatches;

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
                    {/* Page Header */}
                    <PageHeader title="Partidos" description="Organizá y gestioná todos tus partidos">
                        <AddMatchDialog allPlayers={sortedPlayers} disabled={!user?.activeGroupId} />
                    </PageHeader>

                    {/* Featured Match - Full width header */}
                    {featuredMatch && timeFilter !== 'history' && (
                        <NextMatchCard match={featuredMatch} variant="compact" />
                    )}

                    {/* Matches List */}
                    <div className="space-y-6">
                        <QuickTimeFilter activeFilter={timeFilter} onFilterChange={setTimeFilter} counts={timeCounts} />

                        {/* Filters and View Mode Toggle */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <MatchFilters filters={matchFilters} onFiltersChange={handleFiltersChange} />
                            <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
                        </div>

                        {gridMatches.length > 0 ? (
                            viewMode === 'grid' ? (
                                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={listVariants} initial="hidden" animate="visible" key={`grid-${timeFilter}`}>
                                    {gridMatches.map(match => (
                                        <motion.div key={match.id} variants={itemVariants}>
                                            <MatchCard match={match} allPlayers={sortedPlayers} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3" variants={listVariants} initial="hidden" animate="visible" key={`compact-${timeFilter}`}>
                                    {gridMatches.map(match => (
                                        <motion.div key={match.id} variants={itemVariants}>
                                            <CompactMatchCard match={match} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )
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
                    </div>
                </div>
            )}
        </div>
    );
}
