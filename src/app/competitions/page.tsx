
'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Swords } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { Match } from '@/lib/types';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  // Query for friendly matches where user's group is involved
  const friendlyMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('type', '==', 'intergroup_friendly'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: friendlyMatches, loading: matchesLoading } = useCollection<Match>(friendlyMatchesQuery);

  if (userLoading || matchesLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
        <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Sección en desarrollo</AlertTitle>
            <AlertDescription>
                Inicia sesión para ver y gestionar los desafíos de tus equipos.
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Buscá rivales para tus equipos y gestioná tus partidos amistosos"
      >
        <InvitationsSheet />
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ver equipos disponibles */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/competitions/available-teams">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Equipos Disponibles
              </CardTitle>
              <CardDescription>
                Explorá equipos que están buscando rivales y desafialos a un partido amistoso
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        {/* Gestionar mis equipos */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/groups">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Mis Equipos
              </CardTitle>
              <CardDescription>
                Postulá tus equipos para que otros puedan desafiarte
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      {/* Partidos Amistosos */}
      {friendlyMatches && friendlyMatches.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" />
            Partidos Amistosos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {friendlyMatches.map(match => (
              <FriendlyMatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold">Próximamente: Ligas y Copas</h3>
        <p className="text-sm text-muted-foreground mt-2">
            Pronto vas a poder crear y participar en ligas y torneos con tus equipos.
        </p>
      </div>
    </div>
  );
}
