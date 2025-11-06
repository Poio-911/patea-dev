'use client';

import { useState, useMemo } from 'react';
import { GroupTeam, Player } from '@/lib/types';
import { CreateTeamDialog } from '../create-team-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Users, ChevronRight } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, deleteDoc, doc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { TeamsIcon } from '../icons/teams-icon';
import { JerseyPreview } from './jersey-preview';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TeamListProps {
  groupId: string;
  players: Player[];
  currentUserId: string;
}

export function TeamList({ groupId, players, currentUserId }: TeamListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const teamsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'teams'), where('groupId', '==', groupId));
  }, [firestore, groupId]);

  const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);

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
        <div className="space-y-2">
          {teams.map(team => (
            <Link key={team.id} href={`/groups/teams/${team.id}`} className="block">
                <div className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-12 h-12 flex-shrink-0">
                        <JerseyPreview jersey={team.jersey} size="sm" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold">{team.name}</p>
                        <p className="text-sm text-muted-foreground">{team.members.length} jugadores</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
            </Link>
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
