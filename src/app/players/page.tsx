'use client';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { PlayerCard } from '@/components/player-card';
import { AddPlayerDialog } from '@/components/add-player-dialog';
import { collection, query, where, doc } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users2, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Group, Player } from '@/lib/types';

export default function PlayersPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // 1. Get the active group document to know its members
  const groupRef = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return doc(firestore, 'groups', user.activeGroupId);
  }, [firestore, user?.activeGroupId]);
  const { data: activeGroup } = useDoc<Group>(groupRef);
  
  // 2. Get players created manually in the group (owner is the user, but id is not)
  const manualPlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  // 3. Get players that are real users and members of the group
  const memberPlayersQuery = useMemo(() => {
    if (!firestore || !activeGroup || !activeGroup.members || activeGroup.members.length === 0) return null;
    // Firestore 'in' query is limited to 30 elements, which is fine for this app's scale.
    return query(collection(firestore, 'players'), where('__name__', 'in', activeGroup.members.slice(0, 30)));
  }, [firestore, activeGroup]);

  const { data: manualPlayers, loading: manualLoading } = useCollection<Player>(manualPlayersQuery);
  const { data: memberPlayers, loading: membersLoading } = useCollection<Player>(memberPlayersQuery);
  
  const loading = manualLoading || membersLoading;

  // 4. Combine and deduplicate the players
  const players = useMemo(() => {
    const allPlayersMap = new Map<string, Player>();
    
    if (manualPlayers) {
      manualPlayers.forEach(p => allPlayersMap.set(p.id, p));
    }
    if (memberPlayers) {
      memberPlayers.forEach(p => allPlayersMap.set(p.id, p));
    }
    
    return Array.from(allPlayersMap.values()).sort((a, b) => b.ovr - a.ovr);
  }, [manualPlayers, memberPlayers]);


  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Jugadores"
        description="Gestiona la plantilla de tu equipo y las estadísticas de los jugadores."
      >
        <AddPlayerDialog />
      </PageHeader>
       {loading && <p>Cargando jugadores...</p>}

       {!loading && !user?.activeGroupId && (
         <Alert>
            <Users2 className="h-4 w-4" />
            <AlertTitle>No hay grupo activo</AlertTitle>
            <AlertDescription>
                No tienes un grupo activo seleccionado. Por favor, crea o únete a un grupo para ver a tus jugadores.
                <Button asChild variant="link" className="p-0 h-auto ml-1">
                    <Link href="/groups">Ir a la página de grupos</Link>
                </Button>
            </AlertDescription>
         </Alert>
       )}

      {!loading && user?.activeGroupId && players?.length === 0 && (
        <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>No hay jugadores en este grupo</AlertTitle>
            <AlertDescription>
                Aún no has añadido ningún jugador a este grupo. ¡Empieza por añadir el primero!
            </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {players?.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}
