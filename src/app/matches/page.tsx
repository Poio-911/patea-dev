
'use client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Users2, Calendar, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Match, Player, Group } from '@/lib/types';
import { MatchCard } from '@/components/match-card';

export default function MatchesPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const groupRef = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return doc(firestore, 'groups', user.activeGroupId);
      }, [firestore, user?.activeGroupId]);
    const { data: activeGroup } = useDoc<Group>(groupRef);

    // Query for manually created players in the group
    const manualPlayersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);

    // Query for registered users who are members of the group
    const memberPlayersQuery = useMemo(() => {
        if (!firestore || !activeGroup || !activeGroup.members || activeGroup.members.length === 0) return null;
        return query(collection(firestore, 'players'), where('__name__', 'in', activeGroup.members.slice(0, 30)));
    }, [firestore, activeGroup]);

    const { data: manualPlayers, loading: manualLoading } = useCollection<Player>(manualPlayersQuery);
    const { data: memberPlayers, loading: membersLoading } = useCollection<Player>(memberPlayersQuery);
    
    // Combine and deduplicate players
    const allGroupPlayers = useMemo(() => {
        const allPlayersMap = new Map<string, Player>();
        
        if (manualPlayers) {
            manualPlayers.forEach(p => allPlayersMap.set(p.id, p));
        }
        if (memberPlayers) {
            memberPlayers.forEach(p => allPlayersMap.set(p.id, p));
        }
        
        return Array.from(allPlayersMap.values()).sort((a, b) => b.ovr - a.ovr);
    }, [manualPlayers, memberPlayers]);


    const matchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) {
            return null;
        }
        return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
    }, [firestore, user?.activeGroupId]);
    
    const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

    const loading = userLoading || manualLoading || membersLoading || matchesLoading;

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
            <PageHeader
                title="Partidos"
                description="Programa, visualiza y gestiona todos tus partidos."
            >
                <AddMatchDialog allPlayers={allGroupPlayers} disabled={!user?.activeGroupId} />
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

            {user?.activeGroupId && matches && matches.length === 0 && !loading && (
                 <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12">
                    <Calendar className="h-12 w-12 text-muted-foreground/50" />
                    <h2 className="mt-4 text-xl font-semibold">No hay partidos programados</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Este grupo todavía no tiene partidos. ¡Programa el primero para empezar!
                    </p>
                </div>
            )}

            {user?.activeGroupId && matches && matches.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map((match) => (
                        <MatchCard key={match.id} match={match} allPlayers={allGroupPlayers} />
                    ))}
                </div>
            )}
        </div>
    );
}
