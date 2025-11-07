
'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { GroupTeam, Player } from '@/lib/types';
import { Loader2, Users } from 'lucide-react';
import { YourTeamsList } from '@/components/competitions/your-teams-list';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InvitationsSheet } from '@/components/invitations-sheet';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const userTeamsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'teams'), where('createdBy', '==', user.uid));
  }, [firestore, user?.uid]);

  const { data: userTeams, loading: teamsLoading } = useCollection<GroupTeam>(userTeamsQuery);

  const groupIds = useMemo(() => {
    if (!userTeams) return [];
    return [...new Set(userTeams.map(team => team.groupId))];
  }, [userTeams]);

  const groupPlayersQuery = useMemo(() => {
    if (!firestore || groupIds.length === 0) return null;
    return query(collection(firestore, 'players'), where('groupId', 'in', groupIds));
  }, [firestore, groupIds]);

  const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);

  const loading = userLoading || teamsLoading || playersLoading;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Desafiá a otros equipos y demostrá quién manda en la cancha."
      >
        <InvitationsSheet />
      </PageHeader>
      
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : userTeams && userTeams.length > 0 ? (
        <YourTeamsList teams={userTeams} players={groupPlayers || []} />
      ) : (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertTitle>No tenés equipos creados</AlertTitle>
          <AlertDescription>
            Para poder desafiar a otros, primero tenés que crear un equipo en la sección de 'Grupos'.
             <Button asChild variant="link" className="p-0 h-auto ml-1">
                <Link href="/groups">Ir a Grupos</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold">Ligas y Copas</h3>
        <p className="text-sm text-muted-foreground mt-2">Próximamente podrás crear y participar en torneos de todos contra todos o eliminación directa.</p>
      </div>
    </div>
  );
}
