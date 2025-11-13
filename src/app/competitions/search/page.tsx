'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { AvailablePostsGrid } from '@/components/available-posts-grid';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { GroupTeam } from '@/lib/types';

export default function SearchPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  // Query for user's teams
  const teamsQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'teams'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: teams } = useCollection<GroupTeam>(teamsQuery);

  // Show auth/group errors immediately
  if (userLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Iniciá sesión para buscar partidos.
        </AlertDescription>
      </Alert>
    );
  }

  if (!user.activeGroupId) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Creá o unite a un grupo para buscar partidos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Buscar Partidos"
          description="Encontrá equipos disponibles para jugar partidos amistosos"
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
        <div className="border-l-4 border-l-accent pl-4 mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2">
              <Search className="h-6 w-6 text-accent" />
            </div>
            Equipos Disponibles
          </h2>
        </div>
        {teams ? (
          <AvailablePostsGrid userId={user.uid} userTeams={teams} isActive={true} />
        ) : (
          <Alert>
            <AlertDescription>
              Cargando equipos disponibles...
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
