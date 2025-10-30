
'use client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Users2, Calendar, Loader2, Info, LayoutGrid, CalendarDays } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Match, Player } from '@/lib/types';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { MatchCard } from '@/components/match-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchesCalendar } from '@/components/matches-calendar';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";


const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function MatchesPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

    const playersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);

    const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(playersQuery);

    const groupMatchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'), 
            where('groupId', '==', user.activeGroupId), 
            orderBy('date', 'desc')
        );
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
    
    const matches = useMemo(() => {
        const allMatchesMap = new Map<string, Match>();
        
        (groupMatches || []).forEach(match => allMatchesMap.set(match.id, match));
        (joinedPublicMatches || []).forEach(match => allMatchesMap.set(match.id, match));

        return Array.from(allMatchesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [groupMatches, joinedPublicMatches]);
    
    const { upcomingMatches, pastMatches } = useMemo(() => {
        const upcoming: Match[] = [];
        const past: Match[] = [];
        const now = new Date();
        
        matches.forEach(match => {
            const matchDate = new Date(match.date);
            if (matchDate >= now || match.status === 'upcoming' || match.status === 'active') {
                upcoming.push(match);
            } else {
                past.push(match);
            }
        });

        // Sort upcoming matches by date ascending
        upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return { upcomingMatches: upcoming, pastMatches: past };
    }, [matches]);

    const loading = userLoading || playersLoading || groupMatchesLoading || joinedPublicMatchesLoading;
    
    const sortedPlayers = useMemo(() => {
        if (!allGroupPlayers) return [];
        return [...allGroupPlayers].sort((a, b) => b.ovr - a.ovr);
      }, [allGroupPlayers]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Cargando partidos...</p>
            </div>
        )
    }
    
    return (
        <div className="flex flex-col gap-8">
            <FirstTimeInfoDialog
                featureKey="hasSeenMatchesInfo"
                title="Sección de Partidos"
                description="Acá podés crear nuevos partidos y ver todos los partidos de tu grupo, tanto los próximos como el historial. Usá el icono del calendario para una vista mensual."
            />
            <PageHeader
                title="Partidos"
                description="Programa, visualiza y gestiona todos tus partidos."
            >
                <div className="flex items-center gap-2">
                   <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as 'list' | 'calendar')}>
                       <ToggleGroupItem value="list" aria-label="Vista de lista">
                           <LayoutGrid className="h-4 w-4" />
                       </ToggleGroupItem>
                       <ToggleGroupItem value="calendar" aria-label="Vista de calendario">
                           <CalendarDays className="h-4 w-4" />
                       </ToggleGroupItem>
                   </ToggleGroup>
                   <AddMatchDialog allPlayers={sortedPlayers} disabled={!user?.activeGroupId} />
                   <InvitationsSheet />
                </div>
            </PageHeader>

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
                viewMode === 'calendar' ? (
                    <MatchesCalendar matches={matches} allPlayers={sortedPlayers} />
                ) : (
                    <Tabs defaultValue="upcoming" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="upcoming">Próximos</TabsTrigger>
                            <TabsTrigger value="history">Historial</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upcoming" className="mt-6">
                            {upcomingMatches.length > 0 ? (
                                <motion.div 
                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                    variants={listVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {upcomingMatches.map(match => (
                                        <motion.div key={match.id} variants={itemVariants}>
                                            <MatchCard match={match} allPlayers={sortedPlayers} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted-foreground/20 rounded-xl">
                                    <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
                                    <h2 className="text-xl font-semibold mb-2">No hay partidos programados</h2>
                                    <p className="text-muted-foreground mb-6 max-w-md">
                                    ¡Es hora de organizar el próximo encuentro!
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="history" className="mt-6">
                            {pastMatches.length > 0 ? (
                                <motion.div 
                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                    variants={listVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {pastMatches.map(match => (
                                        <motion.div key={match.id} variants={itemVariants}>
                                            <MatchCard match={match} allPlayers={sortedPlayers} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted-foreground/20 rounded-xl">
                                    <Info className="h-16 w-16 text-muted-foreground mb-4" />
                                    <h2 className="text-xl font-semibold mb-2">Sin Historial</h2>
                                    <p className="text-muted-foreground mb-6 max-w-md">
                                        Cuando los partidos finalicen, aparecerán acá.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )
            )}
        </div>
    );
}
