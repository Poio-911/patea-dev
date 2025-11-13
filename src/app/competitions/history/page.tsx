'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Swords } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { Match } from '@/lib/types';

export default function HistoryPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  // Query for friendly matches - filtrar por jugadores en lugar de groupId
  // Esto permite ver partidos intergrupales para ambos equipos participantes
  const friendlyMatchesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'matches'),
      where('type', '==', 'intergroup_friendly'),
      where('playerUids', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);

  const { data: friendlyMatches, loading: matchesLoading } = useCollection<Match>(friendlyMatchesQuery);

  // Show auth/group errors immediately
  if (userLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Iniciá sesión para ver el historial de partidos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Historial de Amistosos"
          description="Revisá todos los partidos amistosos jugados"
        >
          <InvitationsSheet />
        </PageHeader>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/competitions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>

      <div>
        <div className="border-l-4 border-l-chart-2 pl-4 mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="rounded-lg bg-chart-2/10 p-2">
              <Swords className="h-6 w-6 text-chart-2" />
            </div>
            Partidos Jugados
          </h2>
        </div>
        {matchesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : friendlyMatches && friendlyMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {friendlyMatches.map(match => (
              <FriendlyMatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              No hay partidos amistosos registrados todavía.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
