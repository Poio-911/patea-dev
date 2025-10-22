
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
        <div>
          <h3 className="text-lg font-semibold">Equipos del Grupo</h3>
          <p className="text-sm text-muted-foreground">
            {teams?.length || 0} equipos creados
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Equipo
        </Button>
      </div>

      {teams && teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            Creá el primer equipo del grupo haciendo clic en "Crear Equipo".
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
