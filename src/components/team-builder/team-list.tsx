'use client';

import { useState, useMemo } from 'react';
import { GroupTeam, Player } from '@/lib/types';
import { CreateTeamDialog } from '../create-team-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Users, ChevronRight, UsersRound } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { JerseyPreview } from './jersey-preview';
import Link from 'next/link';
import { Separator } from '../ui/separator';

interface TeamListProps {
  groupId: string;
  players: Player[];
  currentUserId: string;
  compact?: boolean;
}

export function TeamList({ groupId, players, currentUserId, compact = false }: TeamListProps) {
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

  if (compact) {
    return (
      <div className="space-y-4">
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full" variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Equipo
        </Button>

        {teams && teams.length > 0 ? (
          <div className="space-y-2">
            {teams.map(team => (
              <Link key={team.id} href={`/groups/teams/${team.id}`} className="block group">
                <div className="bg-card rounded-lg border border-border hover:border-primary/50 transition-all duration-300 flex items-center justify-between gap-3 p-3 group-hover:shadow-sm">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 flex-shrink-0 drop-shadow-sm">
                      <JerseyPreview jersey={team.jersey} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-card-foreground group-hover:text-primary transition-colors font-headline tracking-wide">{team.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{team.members.length} MK</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Alert className="text-center py-6 bg-card border border-dashed border-border">
            <UsersRound className="mx-auto h-6 w-6 mb-2 text-muted-foreground" />
            <AlertTitle className="text-sm text-card-foreground">Sin Equipos</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Creá el primer equipo.
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <UsersRound className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Equipos del Grupo</h2>
            <p className="text-sm text-slate-500">
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
            <Link key={team.id} href={`/groups/teams/${team.id}`} className="block group">
              <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-sm">
                <div className="flex flex-row items-center justify-between gap-4 p-4 border-b border-slate-100 bg-slate-50/50 group-hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 flex-shrink-0 drop-shadow-sm transform group-hover:scale-110 transition-transform duration-300">
                      <JerseyPreview jersey={team.jersey} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold truncate font-headline text-slate-800 group-hover:text-primary transition-colors">{team.name}</h3>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                </div>
                <div className="p-4">
                  <div className="text-xs font-medium text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                    <Users className="h-4 w-4 text-primary/70" />
                    <span>{team.members.length} {team.members.length === 1 ? 'Jugador' : 'Jugadores'}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Alert className="text-center py-10 bg-white border border-slate-200">
          <UsersRound className="mx-auto h-8 w-8 mb-2 text-slate-400" />
          <AlertTitle className="text-slate-800">No hay equipos creados</AlertTitle>
          <AlertDescription className="text-slate-500">
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
