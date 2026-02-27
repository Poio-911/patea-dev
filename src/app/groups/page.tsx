'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc
} from 'firebase/firestore';
import type { Player, Match, Group } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Users2, PlusCircle, LogIn, Shield, Newspaper, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamList } from '@/components/team-builder/team-list';
import { GroupStatsCards } from '@/components/groups/group-stats-cards';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { CreateGroupDialog, JoinGroupDialog } from '@/components/groups/group-dialogs';
import { useToast } from '@/hooks/use-toast';
import { GroupSummaryCard } from '@/components/group-summary-card';
import { GroupHeroCard } from '@/components/groups/group-hero-card';
import { UserGroupsList } from '@/components/groups/user-groups-list';

export default function GroupsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);

  // Queries
  const groupPlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);

  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), where('status', 'in', ['upcoming', 'planning']), orderBy('date', 'asc'), limit(5));
  }, [firestore, user?.activeGroupId]);
  const { data: upcomingMatches, loading: matchesLoading } = useCollection<Match>(groupMatchesQuery);

  const friendlyMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('type', '==', 'intergroup_friendly'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);
  const { data: friendlyMatches, loading: friendlyMatchesLoading } = useCollection<Match>(friendlyMatchesQuery);

  const activeGroupRef = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return doc(firestore, 'groups', user.activeGroupId);
  }, [firestore, user?.activeGroupId]);
  const { data: activeGroup, loading: groupLoading } = useDoc<Group>(activeGroupRef);

  // New query to check if user has ANY groups even if activeGroupId is null
  const userGroupsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('members', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: allUserGroups, loading: allGroupsLoading } = useCollection<Group>(userGroupsQuery);

  const loading = userLoading || playersLoading || matchesLoading || friendlyMatchesLoading || groupLoading || allGroupsLoading;

  return (
    <div className="flex flex-col gap-6">
      <FirstTimeInfoDialog
        featureKey="hasSeenGroupsInfoV2"
        title="¡Bienvenid@ a tus Grupos!"
        description="Esta es tu central de operaciones. Desde aquí podés cambiar tu grupo activo, crear nuevos o unirte a otros. Debajo verás toda la info del grupo que tengas seleccionado, ¡incluyendo los equipos que podés crear!"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Mis Grupos" />
        <div className="flex items-center gap-2">
          <Button onClick={() => setJoinGroupOpen(true)} variant="outline">
            <LogIn className="mr-2 h-4 w-4" />
            Unirse a Grupo
          </Button>
          <Button onClick={() => setCreateGroupOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Grupo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : !user?.activeGroupId || !activeGroup ? (
        <div className="space-y-6">
          <Alert className="bg-primary/5 border-primary/20">
            <Users2 className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-bold">No tenés un grupo seleccionado</AlertTitle>
            <AlertDescription>
              {allUserGroups && allUserGroups.length > 0
                ? "Seleccioná uno de tus grupos debajo para empezar a operar."
                : "Creá un grupo o unite a uno mediante un código para empezar."}
            </AlertDescription>
          </Alert>

          {allUserGroups && allUserGroups.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold font-headline uppercase tracking-tight flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Tus Grupos Disponibles
              </h3>
              <UserGroupsList />
            </div>
          ) : (
            <Card className="border-dashed py-10 flex flex-col items-center justify-center gap-4">
              <Users2 className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="font-bold text-lg">Bandeja de Grupos Vacía</p>
                <p className="text-sm text-muted-foreground">Todavía no formas parte de ningún grupo de fútbol.</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setJoinGroupOpen(true)} variant="outline">Unirse a uno</Button>
                <Button onClick={() => setCreateGroupOpen(true)}>Crear el mío</Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <GroupHeroCard group={activeGroup} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna 1: Estadísticas */}
            <div className="lg:col-span-1 space-y-6">
              <GroupStatsCards players={groupPlayers || []} />
            </div>

            {/* Columna 2: Equipos */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="flex items-center gap-2 font-headline text-lg uppercase tracking-wide text-primary font-bold">
                <Shield className="h-5 w-5" />
                Equipos
              </h3>
              <Card className="border-border shadow-sm bg-card text-card-foreground">
                <CardContent className="p-4 pt-4">
                  <TeamList groupId={user.activeGroupId} players={groupPlayers || []} currentUserId={user.uid} compact={true} />
                </CardContent>
              </Card>
            </div>

            {/* Columna 3: Próximos Partidos */}
            <div className="lg:col-span-1 space-y-6">
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-headline text-lg uppercase tracking-wide text-primary font-bold">
                  <Newspaper className="h-5 w-5" />
                  Próximos Partidos
                </h3>
                <Card className="border-border shadow-sm bg-card text-card-foreground">
                  <CardContent className="p-4">
                    <UpcomingMatchesFeed matches={upcomingMatches || []} compact={true} />
                  </CardContent>
                </Card>
              </div>

              {friendlyMatches && friendlyMatches.length > 0 && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-headline text-lg uppercase tracking-wide text-primary font-bold">
                    Partidos Amistosos
                  </h3>
                  <div className="space-y-4">
                    {friendlyMatches.map(match => (
                      <FriendlyMatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <GroupSummaryCard groupId={user.activeGroupId} />
          </div>
        </div>
      )}

      {/* Diálogos */}
      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <div />
      </CreateGroupDialog>
      <JoinGroupDialog open={joinGroupOpen} onOpenChange={setJoinGroupOpen}>
        <div />
      </JoinGroupDialog>
    </div>
  );
}
