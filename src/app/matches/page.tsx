
'use client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Users2, Calendar, Loader2, Info } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Match, Player } from '@/lib/types';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { MatchesCalendar } from '@/components/matches-calendar';

export default function MatchesPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

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
    
    // Query for public matches where the user is a player, but are NOT from the current active group.
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
    
    // Merge matches from the active group with any public matches the user has joined.
    const matches = useMemo(() => {
        const allMatchesMap = new Map<string, Match>();
        
        (groupMatches || []).forEach(match => allMatchesMap.set(match.id, match));
        (joinedPublicMatches || []).forEach(match => allMatchesMap.set(match.id, match));

        return Array.from(allMatchesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [groupMatches, joinedPublicMatches]);

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
                description="Acá podés crear nuevos partidos y ver todos los partidos de tu grupo en un calendario interactivo. ¡Hacé clic en un día para ver los detalles!"
            />
            <PageHeader
                title="Partidos"
                description="Programa, visualiza y gestiona todos tus partidos."
            >
                <div className="flex items-center gap-2">
                   <AddMatchDialog allPlayers={sortedPlayers} disabled={!user?.activeGroupId} />
                   <InvitationsSheet />
                </div>
            </PageHeader>

            {!user?.activeGroupId ? (
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
            ) : (
                <MatchesCalendar matches={matches || []} allPlayers={sortedPlayers || []} />
            )}
        </div>
    );
}
