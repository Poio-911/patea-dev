'use client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Users2, Calendar } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Match, Player } from '@/lib/types';
import { MatchCard } from '@/components/match-card';

export default function MatchesPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const playersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);

    const { data: players, loading: playersLoading } = useCollection<Player>(playersQuery);

    const matchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
    }, [firestore, user?.activeGroupId]);

    const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

    const loading = playersLoading || matchesLoading;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Partidos"
        description="Programa, visualiza y gestiona todos tus partidos."
      >
        <AddMatchDialog allPlayers={players || []} disabled={!user?.activeGroupId} />
      </PageHeader>

      {loading && <p>Cargando partidos...</p>}

      {!loading && !user?.activeGroupId && (
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

      {!loading && user?.activeGroupId && matches && matches.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12">
                <Calendar className="h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-xl font-semibold">No hay partidos programados</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Este grupo todavía no tiene partidos. ¡Programa el primero para empezar!
                </p>
            </div>
      )}

      {!loading && matches && matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
                <MatchCard key={match.id} match={match} allPlayers={players || []} />
            ))}
        </div>
      )}
    </div>
  );
}
