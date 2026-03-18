'use client';

import { Users2, Calendar, Loader2, Info } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Match, Player, MatchFilters as MatchFiltersType, MatchesViewMode } from '@/lib/types';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { PageHeader } from '@/components/page-header';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MatchCard } from '@/components/match-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { CompactMatchCard } from '@/components/compact-match-card';
import { QuickTimeFilter, type TimeFilter } from '@/components/matches/quick-time-filter';
import { MatchFilters } from '@/components/matches/match-filters';
import { ViewModeToggle } from '@/components/matches/view-mode-toggle';
import { NextMatchCard } from '@/components/next-match-card';
import { PendingFinalizationDialog } from '@/components/matches/pending-finalization-dialog';
import { AddMatchDialog } from '@/components/add-match-dialog';
import { useToast } from '@/hooks/use-toast';
import { updateUserPreferencesAction, getUserPreferencesAction } from '@/lib/actions/server-actions';
import { finalizePendingMatchesAction } from '@/lib/actions/match-actions';
import { isErrorResponse } from '@/lib/errors';
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger,
} from "@/components/ui/responsive-popover";
import { UserCheck, Shirt, Globe, HelpCircle, Users, Trophy, ChevronDown } from 'lucide-react';

const LIST_VARIANTS = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

const ITEM_VARIANTS = {
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

    const [isCompetitionOpen, setIsCompetitionOpen] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem('matchesCompetitionOpen');
        if (saved !== null) setIsCompetitionOpen(saved !== 'false');
    }, []);

    const toggleCompetition = () => {
        setIsCompetitionOpen(prev => {
            const next = !prev;
            localStorage.setItem('matchesCompetitionOpen', String(next));
            return next;
        });
    };

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

    const groupMatchesQuery1 = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('groupId', '==', user.activeGroupId),
            orderBy('date', 'desc'),
            limit(50)
        );
    }, [firestore, user?.activeGroupId]);

    const groupMatchesQuery2 = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('participantGroupIds', 'array-contains', user.activeGroupId),
            orderBy('date', 'desc'),
            limit(50)
        );
    }, [firestore, user?.activeGroupId]);

    const { data: groupMatchesRaw1, loading: g1Loading } = useCollection<Match>(groupMatchesQuery1);
    const { data: groupMatchesRaw2, loading: g2Loading } = useCollection<Match>(groupMatchesQuery2);
    const joinedMatchesQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'matches'),
            where('playerUids', 'array-contains', user.uid)
        );
    }, [firestore, user?.uid]);

    const { data: joinedMatches, loading: joinedMatchesLoading } = useCollection<Match>(joinedMatchesQuery);

    const groupMatches = useMemo(() => {
        const combined = [...(groupMatchesRaw1 || []), ...(groupMatchesRaw2 || [])];
        const unique = new Map<string, Match>();
        combined.forEach(m => unique.set(m.id, m));
        return Array.from(unique.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [groupMatchesRaw1, groupMatchesRaw2]);

    const groupMatchesLoading = g1Loading || g2Loading;

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
        if (pendingFinalizationMatches.length === 0) return;
        try {
            const result = await finalizePendingMatchesAction(pendingFinalizationMatches.map((match) => match.id));
            if (isErrorResponse(result)) {
                throw new Error(result.error || 'No se pudieron finalizar los partidos.');
            }
            if (!result.success) {
                throw new Error('No se pudieron finalizar los partidos.');
            }
            const finalizedCount = result.finalizedCount || 0;
            toast({ title: 'Partidos finalizados', description: `Se finalizaron ${finalizedCount} partido${finalizedCount !== 1 ? 's' : ''} correctamente.` });
        } catch (error) {
            console.error('Error finalizing matches:', error);
            toast({ title: 'Error', description: 'No se pudieron finalizar los partidos.', variant: 'destructive' });
        }
    };

    const amistososMatches = useMemo(() => {
        return allMatches.filter(m => m.type === 'manual' || m.type === 'collaborative' || m.type === 'by_teams' || m.type === 'intergroup_friendly');
    }, [allMatches]);

    const competitionMatches = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        const comp = allMatches.filter(m => m.type === 'league' || m.type === 'cup' || m.type === 'league_final');

        if (timeFilter === 'history') {
            return comp.filter(m => {
                const d = new Date(m.date);
                const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return day < today && (m.status === 'completed' || m.status === 'evaluated');
            }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        // For upcoming / this_week: show only the next match per competition
        const candidates = comp.filter(m => {
            const d = new Date(m.date);
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            if (timeFilter === 'this_week') return day >= today && day < weekEnd;
            return day >= today || m.status === 'active';
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const nextByCompetition: Record<string, Match> = {};
        for (const m of candidates) {
            const compId = m.leagueInfo?.leagueId ?? m.leagueInfo?.cupId ?? m.id;
            if (!nextByCompetition[compId]) nextByCompetition[compId] = m;
        }
        return Object.values(nextByCompetition);
    }, [allMatches, timeFilter]);

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
                // Show all matches with date >= today OR status active OR status planning (no confirmed date yet)
                return matches.filter(m => {
                    if (m.status === 'planning') return true;
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
        const upcomingMatches = allMatches
            .filter(m => {
                const matchTs = getTs(m);
                return (m.status === 'active') || (m.status === 'upcoming' && matchTs >= now.getTime());
            })
            .sort((a, b) => getTs(a) - getTs(b));
        return upcomingMatches[0] || null;
    }, [allMatches, timeFilter]);

    const timeCounts = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        return {
            upcoming: amistososMatches.filter(m => {
                if (m.status === 'planning') return true;
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
            <div className="flex flex-col gap-6">
                <div className="flex items-start gap-3">
                    <Skeleton className="w-1 h-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                </div>
                <Skeleton className="h-[280px] w-full rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="rounded-xl overflow-hidden space-y-3 p-4 border border-border/40 bg-card/50">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-[120px] w-full rounded-lg" />
                            <Skeleton className="h-9 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
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
                        <div className="flex items-center gap-2">
                            <ResponsivePopover>
                                <ResponsivePopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-muted-foreground hover:text-foreground">
                                        <HelpCircle className="h-4 w-4" />
                                        <span className="hidden xs:inline">Tipos de partido</span>
                                    </Button>
                                </ResponsivePopoverTrigger>
                                <ResponsivePopoverContent className="w-80 p-0" align="end">
                                    <div className="p-4 border-b bg-muted/50">
                                        <h3 className="font-bold">Tipos de Amistosos</h3>
                                        <p className="text-xs text-muted-foreground">Elegí el formato que mejor se adapte</p>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="p-1.5 bg-blue-500/10 rounded-md">
                                                    <UserCheck className="h-4 w-4 text-blue-500" />
                                                </div>
                                                <span className="font-semibold text-sm">Manual</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                                                El organizador invita y asigna directamente a cada jugador. Ideal para listas ya confirmadas.
                                            </p>
                                        </div>

                                        <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="p-1.5 bg-green-500/10 rounded-md">
                                                    <Users className="h-4 w-4 text-green-500" />
                                                </div>
                                                <span className="font-semibold text-sm">Colaborativo</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                                                Inscripción abierta al grupo. Podés hacerlo **Público** para que aparezca en el Mercado de Fichajes.
                                            </p>
                                        </div>

                                        <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="p-1.5 bg-orange-500/10 rounded-md">
                                                    <Shirt className="h-4 w-4 text-orange-500" />
                                                </div>
                                                <span className="font-semibold text-sm">Por Equipos</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                                                Enfrentá a dos de tus equipos del Locker Room. Las plantillas se cargan automáticamente.
                                            </p>
                                        </div>

                                        <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="p-1.5 bg-purple-500/10 rounded-md">
                                                    <Globe className="h-4 w-4 text-purple-500" />
                                                </div>
                                                <span className="font-semibold text-sm">Intergrupal</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                                                Desafiá a otro grupo de la comunidad. Medí el nivel de tu club contra otros barrios.
                                            </p>
                                        </div>
                                    </div>
                                </ResponsivePopoverContent>
                            </ResponsivePopover>
                            <AddMatchDialog allPlayers={sortedPlayers} disabled={!user?.activeGroupId} />
                        </div>
                    </PageHeader>

                    {/* Featured Match - Full width header */}
                    {allMatches.length > 0 && timeFilter !== 'history' && (
                        <NextMatchCard
                            matches={allMatches.filter(m => {
                                const d = new Date(m.date);
                                const clean = (m.time || '').replace(' hs', '').replace('hs', '').trim();
                                const [hh, mm = '0'] = clean.split(':');
                                d.setHours(parseInt(hh || '0', 10) || 0, parseInt(mm || '0', 10) || 0, 0, 0);
                                return (m.status === 'active') || (m.status === 'upcoming' && d.getTime() >= new Date().getTime());
                            }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
                            allPlayers={sortedPlayers}
                        />
                    )}

                    {/* Matches List */}
                    <div className="space-y-6">
                        <QuickTimeFilter activeFilter={timeFilter} onFilterChange={setTimeFilter} counts={timeCounts} />

                        {/* Filters and View Mode Toggle */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <MatchFilters filters={matchFilters} onFiltersChange={handleFiltersChange} />
                            <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
                        </div>

                        {competitionMatches.length > 0 && (
                            <div className="space-y-3">
                                <button
                                    onClick={toggleCompetition}
                                    className="w-full flex items-center justify-between gap-2 group"
                                >
                                    <p className="text-[10px] font-bold sport-text tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
                                        <Trophy className="w-3 h-3" />
                                        COMPETENCIAS
                                        {!isCompetitionOpen && (
                                            <span className="ml-1 text-[9px] bg-muted px-1.5 py-0.5 rounded-full">
                                                {competitionMatches.length}
                                            </span>
                                        )}
                                    </p>
                                    <ChevronDown className={cn(
                                        "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                                        !isCompetitionOpen && "-rotate-90"
                                    )} />
                                </button>

                                <AnimatePresence initial={false}>
                                    {isCompetitionOpen && (
                                        <motion.div
                                            key="competition-content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            {viewMode === 'grid' ? (
                                                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={LIST_VARIANTS} initial="hidden" animate="visible" key={`comp-grid-${timeFilter}`}>
                                                    {competitionMatches.map(m => (
                                                        <motion.div key={m.id} variants={ITEM_VARIANTS}>
                                                            <MatchCard match={m} allPlayers={sortedPlayers} />
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            ) : (
                                                <motion.div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3" variants={LIST_VARIANTS} initial="hidden" animate="visible" key={`comp-compact-${timeFilter}`}>
                                                    {competitionMatches.map(m => (
                                                        <motion.div key={m.id} variants={ITEM_VARIANTS}>
                                                            <CompactMatchCard match={m} />
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {gridMatches.length > 0 ? (
                            viewMode === 'grid' ? (
                                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={LIST_VARIANTS} initial="hidden" animate="visible" key={`grid-${timeFilter}`}>
                                    {gridMatches.map(match => (
                                        <motion.div key={match.id} variants={ITEM_VARIANTS}>
                                            <MatchCard match={match} allPlayers={sortedPlayers} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3" variants={LIST_VARIANTS} initial="hidden" animate="visible" key={`compact-${timeFilter}`}>
                                    {gridMatches.map(match => (
                                        <motion.div key={match.id} variants={ITEM_VARIANTS}>
                                            <CompactMatchCard match={match} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )
                        ) : (
                            timeFilter === 'history' ? (
                                <EmptyState
                                    icon={<Info className="h-14 w-14" />}
                                    title="Sin Historial"
                                    description="Cuando los partidos finalicen, aparecerán acá."
                                />
                            ) : (
                                <EmptyState
                                    icon={<Calendar className="h-14 w-14" />}
                                    title="No hay partidos"
                                    description="¡Es hora de organizar el próximo encuentro!"
                                />
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
