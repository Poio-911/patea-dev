
'use client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Users2, Calendar, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Match, Player } from '@/lib/types';
import { MatchCard } from '@/components/match-card';

export default function MatchesPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    console.log('[MatchesPage] Render. User loading:', userLoading, 'User:', user?.uid, 'Active Group ID:', user?.activeGroupId);

    const playersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) {
            console.log('[MatchesPage] playersQuery: Not ready. Firestore:', !!firestore, 'Active Group ID:', user?.activeGroupId);
            return null;
        };
        console.log('[MatchesPage] playersQuery: Creating query for group', user.activeGroupId);
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);

    const { data: players, loading: playersLoading } = useCollection<Player>(playersQuery);

    const matchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) {
            console.log('[MatchesPage] matchesQuery: Not ready. Firestore:', !!firestore, 'Active Group ID:', user?.activeGroupId);
            return null;
        }
        console.log('[MatchesPage] matchesQuery: Creating query for group', user.activeGroupId);
        return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
    }, [firestore, user?.activeGroupId]);
    
    const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);
    console.log('[MatchesPage] useCollection(matches) returned. Loading:', matchesLoading, 'Matches count:', matches?.length ?? 0);

    const loading = userLoading || playersLoading || matchesLoading;

    if (loading) {
        console.log('[MatchesPage] Rendering loader...');
        return (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Cargando partidos...</p>
            </div>
        )
    }
    console.log('[MatchesPage] Loading finished. Rendering content.');

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Partidos"
                description="Programa, visualiza y gestiona todos tus partidos."
            >
                <AddMatchDialog allPlayers={players || []} disabled={!user?.activeGroupId} />
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
                        <MatchCard key={match.id} match={match} allPlayers={players || []} />
                    ))}
                </div>
            )}
        </div>
    );
}
