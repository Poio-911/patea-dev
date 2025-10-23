
'use client';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { PlayerCard } from '@/components/player-card';
import { AddPlayerDialog } from '@/components/add-player-dialog';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users2, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Player } from '@/lib/types';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';

export default function PlayersPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  // Optimized Query: Fetch all players belonging to the active group in one go.
  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  const { data: players, loading: playersLoading } = useCollection<Player>(playersQuery);

  const loading = userLoading || playersLoading;
  
  const sortedPlayers = useMemo(() => {
    if (!players) return [];
    return [...players].sort((a, b) => b.ovr - a.ovr);
  }, [players]);


  return (
    <div className="flex flex-col gap-8">
      <FirstTimeInfoDialog
        featureKey="hasSeenPlayersInfo"
        title="Sección de Plantel"
        description="Aquí podés ver a tod@s l@s integrantes de tu grupo activo, con sus estadísticas y OVR. Podés agregar jugador@s 'manuales' para quienes no usan la app y hacer clic en una carta para ver su progreso."
      />
      <PageHeader
        title="Plantel"
        description="Gestioná la plantilla de tu equipo y las estadísticas de los jugadores."
      >
        <AddPlayerDialog />
      </PageHeader>

      <AttributesHelpDialog>
          <Button variant="link" className="p-0 h-auto self-start">¿Qué significan los atributos?</Button>
      </AttributesHelpDialog>

       {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando jugadores...</p>
          </div>
       )}

       {!loading && !user?.activeGroupId && (
         <Alert>
            <Users2 className="h-4 w-4" />
            <AlertTitle>No hay grupo activo</AlertTitle>
            <AlertDescription>
                No tenés un grupo activo seleccionado. Por favor, creá o unite a un grupo para ver a tus jugadores.
                <Button asChild variant="link" className="p-0 h-auto ml-1">
                    <Link href="/groups">Ir a la página de grupos</Link>
                </Button>
            </AlertDescription>
         </Alert>
       )}

      {!loading && user?.activeGroupId && sortedPlayers?.length === 0 && (
        <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>No hay jugadores en este grupo</AlertTitle>
            <AlertDescription>
                Todavía no agregaste ningún jugador a este grupo. ¡Empezá por sumar al primero!
            </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sortedPlayers?.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}
