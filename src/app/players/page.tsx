
'use client';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { } from '@/components/ui/card';
import { PlayerCard } from '@/components/player-card';
import { AddPlayerDialog } from '@/components/add-player-dialog';
import { collection, query, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users2, Users, Loader2, Filter } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Player, UserProfile } from '@/lib/types';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { PlayerFiltersComponent, type PlayerFilters } from '@/components/players/player-filters';

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function PlayersPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [filters, setFilters] = useState<PlayerFilters>({
    positions: [],
    ovrRange: [40, 99],
  });

  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  const { data: players, loading: playersLoading } = useCollection<Player>(playersQuery);

  // Query users in the active group to get their photoURL as fallback
  const usersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'users'), where('groups', 'array-contains', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  const { data: groupUsers, loading: usersLoading } = useCollection<UserProfile>(usersQuery);

  const loading = userLoading || playersLoading || usersLoading;

  const sortedPlayers = useMemo(() => {
    if (!players) return [];
    return [...players]
      .map(player => {
        // If player has no photoUrl but has ownerUid, try to get it from users collection
        // Note: PlayerPhoto component uses photoUrl (camelCase), users have photoURL (uppercase)
        if (!(player as any).photoUrl && player.ownerUid) {
          const userDoc = groupUsers?.find(u => u.uid === player.ownerUid);
          if (userDoc?.photoURL) {
            return { ...player, photoUrl: userDoc.photoURL };
          }
        }
        return player;
      })
      .sort((a, b) => b.ovr - a.ovr);
  }, [players, groupUsers]);

  // Apply filters
  const filteredPlayers = useMemo(() => {
    let result = sortedPlayers;

    // Filter by position
    if (filters.positions && filters.positions.length > 0) {
      result = result.filter(player => filters.positions!.includes(player.position));
    }

    // Filter by OVR range
    if (filters.ovrRange) {
      result = result.filter(player =>
        player.ovr >= filters.ovrRange![0] && player.ovr <= filters.ovrRange![1]
      );
    }

    return result;
  }, [sortedPlayers, filters]);


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

      <div className="flex items-center justify-between gap-4">
        <AttributesHelpDialog>
          <Button variant="link" className="p-0 h-auto self-start">¿Qué significan los atributos?</Button>
        </AttributesHelpDialog>

        <PlayerFiltersComponent filters={filters} onFiltersChange={setFilters} />
      </div>

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

      {!loading && user?.activeGroupId && sortedPlayers?.length > 0 && filteredPlayers.length === 0 && (
        <Alert>
          <Filter className="h-4 w-4" />
          <AlertTitle>No hay jugadores que coincidan con los filtros</AlertTitle>
          <AlertDescription>
            Intentá ajustar los filtros para ver más resultados.
          </AlertDescription>
        </Alert>
      )}

      {filteredPlayers && filteredPlayers.length > 0 && (
        <>
          <div className="text-sm text-muted-foreground">
            Mostrando {filteredPlayers.length} de {sortedPlayers.length} jugadores
          </div>
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPlayers.map((player, index) => (
              <PlayerCard key={player.id} player={player} index={index} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
