
'use client';

import { useState, useMemo } from 'react';
import { GroupTeam, Player } from '@/lib/types';
import { CreateTeamDialog } from '../create-team-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Users, ChevronRight } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TeamsIcon } from '../icons/teams-icon';
import { JerseyPreview } from './jersey-preview';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';

interface TeamListProps {
  groupId: string;
  players: Player[];
  currentUserId: string;
}

export function TeamList({ groupId, players, currentUserId }: TeamListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <TeamsIcon className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Equipos del Grupo</h2>
            <p className="text-sm text-muted-foreground">
              {teams?.length || 0} equipos creados
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Equipo
        </Button>
      </div>
      
      <Separator />

      {teams && teams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {teams.map(team => (
            <Link key={team.id} href={`/groups/teams/${team.id}`} className="block">
                <Card className="hover:bg-muted/50 transition-colors h-full">
                  <CardHeader className="flex-row items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 flex-shrink-0">
                              <JerseyPreview jersey={team.jersey} size="sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                              <CardTitle className="text-base font-bold truncate">{team.name}</CardTitle>
                          </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{team.members.length} jugadores</span>
                    </div>
                  </CardContent>
                </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Alert className="text-center py-10">
          <TeamsIcon className="mx-auto h-8 w-8 mb-2" />
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
