
'use client';

import { useState, useMemo } from 'react';
import { GroupTeam, Player } from '@/lib/types';
import { TeamCard } from './team-card';
import { CreateTeamDialog } from '../create-team-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, deleteDoc, doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { TeamsIcon } from '../icons/teams-icon';

interface TeamListProps {
  groupId: string;
  players: Player[];
  currentUserId: string;
}

export function TeamList({ groupId, players, currentUserId }: TeamListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const teamsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'teams'), where('groupId', '==', groupId));
  }, [firestore, groupId]);

  const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);

  const handleDeleteTeam = async (teamId: string) => {
    if (!firestore) return;
    setIsDeleting(true);

    try {
      await deleteDoc(doc(firestore, 'teams', teamId));
      toast({
        title: 'Equipo eliminado',
        description: 'El equipo ha sido eliminado exitosamente.',
      });
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el equipo.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditTeam = (team: GroupTeam) => {
    // TODO: Implementar dialog de edición
    toast({
      title: 'Próximamente',
      description: 'La funcionalidad de editar equipos estará disponible pronto.',
    });
  };

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <TeamsIcon className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Equipos del Grupo</h2>
            <p className="text-sm text-muted-foreground">
              {teams?.length || 0} equipos creados
            </p>
          </div>
        </div>
      </div>

      {teams && teams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              players={players}
              isOwner={team.createdBy === currentUserId}
              onEdit={handleEditTeam}
              onDelete={handleDeleteTeam}
            />
          ))}
        </div>
      ) : (
        <Alert>
          <AlertTitle>No hay equipos creados</AlertTitle>
          <AlertDescription>
            Creá el primer equipo del grupo. Podrás usarlos para armar partidos y llevar estadísticas.
          </AlertDescription>
        </Alert>
      )}

      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        groupId={groupId}
        players={players || []}
        currentUserId={currentUserId}
      />
    </div>
  );
}
