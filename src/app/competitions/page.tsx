
'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Swords, Trophy, Calendar, Bell, Search, Award } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { collection, query, where, collectionGroup, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { Match, GroupTeam, Invitation } from '@/lib/types';
import { MyTeamsAvailability } from '@/components/my-teams-availability';
import { AvailablePostsGrid } from '@/components/available-posts-grid';
import { TeamChallengesList } from '@/components/team-challenge-card';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('challenges');

  // Query for user's teams
  const teamsQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'teams'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);

  // Optimized invitations loading with parallel queries
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !teams || !user) {
      setInvitationsLoading(false);
      return;
    }

    const userTeamIds = teams.filter(t => t.createdBy === user.uid).map(t => t.id);
    if (userTeamIds.length === 0) {
      setInvitations([]);
      setInvitationsLoading(false);
      return;
    }

    setInvitationsLoading(true);

    // Parallel queries for each team (no waterfall!)
    const fetchInvitations = async () => {
      try {
        const allInvitations = await Promise.all(
          userTeamIds.map(async (teamId) => {
            const q = query(
              collection(firestore, 'teams', teamId, 'invitations'),
              where('type', '==', 'team_challenge'),
              where('status', '==', 'pending')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
          })
        );

        setInvitations(allInvitations.flat());
      } catch (error) {
        console.error('Error fetching invitations:', error);
        setInvitations([]);
      } finally {
        setInvitationsLoading(false);
      }
    };

    fetchInvitations();
  }, [firestore, teams, user]);

  const refetchInvitations = async () => {
    if (!firestore || !teams || !user) return;

    const userTeamIds = teams.filter(t => t.createdBy === user.uid).map(t => t.id);
    if (userTeamIds.length === 0) return;

    const allInvitations = await Promise.all(
      userTeamIds.map(async (teamId) => {
        const q = query(
          collection(firestore, 'teams', teamId, 'invitations'),
          where('type', '==', 'team_challenge'),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
      })
    );

    setInvitations(allInvitations.flat());
  };

  // Query for friendly matches
  const friendlyMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('type', '==', 'intergroup_friendly'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: friendlyMatches, loading: matchesLoading } = useCollection<Match>(friendlyMatchesQuery);

  // Show auth/group errors immediately
  if (userLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
        <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Iniciar Sesión</AlertTitle>
            <AlertDescription>
                Iniciá sesión para ver y gestionar los desafíos de tus equipos.
            </AlertDescription>
        </Alert>
    );
  }

  if (!user.activeGroupId) {
    return (
        <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Sin Grupo Activo</AlertTitle>
            <AlertDescription>
                Creá o unite a un grupo para acceder a las competiciones.
            </AlertDescription>
        </Alert>
    );
  }

  const pendingChallenges = invitations?.filter(inv => inv.status === 'pending') || [];
  const userTeam = teams?.find(t => t.createdBy === user.uid);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Gestioná partidos amistosos, ligas y copas con tus equipos"
      >
        <InvitationsSheet />
      </PageHeader>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Desafíos Recibidos */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors relative"
          onClick={() => setActiveTab('challenges')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Desafíos Recibidos</CardTitle>
              </div>
              {invitationsLoading ? (
                <Skeleton className="h-5 w-6 ml-auto" />
              ) : pendingChallenges.length > 0 ? (
                <Badge variant="destructive" className="ml-auto">
                  {pendingChallenges.length}
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              Gestioná los desafíos que otros equipos te enviaron
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Postular Mis Equipos */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setActiveTab('my-teams')}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Postular Equipos</CardTitle>
            </div>
            <CardDescription>
              Publicá cuando tu equipo está disponible para jugar
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Buscar Partidos */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setActiveTab('search')}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Buscar Partidos</CardTitle>
            </div>
            <CardDescription>
              Encontrá equipos disponibles y aceptá sus postulaciones
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Ligas (Placeholder) */}
        <Card className="opacity-60 cursor-not-allowed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Ligas</CardTitle>
              <Badge variant="secondary" className="ml-auto">Próximamente</Badge>
            </div>
            <CardDescription>
              Participá en ligas de todos contra todos
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Copas (Placeholder) */}
        <Card className="opacity-60 cursor-not-allowed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Copas</CardTitle>
              <Badge variant="secondary" className="ml-auto">Próximamente</Badge>
            </div>
            <CardDescription>
              Competí en torneos de eliminación directa
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Historial */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setActiveTab('history')}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Historial</CardTitle>
            </div>
            <CardDescription>
              Revisá tus partidos amistosos jugados
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="challenges" className="relative">
            Desafíos
            {pendingChallenges.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {pendingChallenges.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-teams">Mis Equipos</TabsTrigger>
          <TabsTrigger value="search">Buscar</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        {/* Desafíos Recibidos Tab */}
        <TabsContent value="challenges" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Desafíos Recibidos
            </h2>
            {invitationsLoading || teamsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : userTeam && invitations ? (
              <TeamChallengesList
                invitations={invitations}
                teamId={userTeam.id}
                userId={user.uid}
                onUpdate={refetchInvitations}
              />
            ) : (
              <Alert>
                <AlertDescription>
                  No tenés equipos creados. Creá un equipo para recibir desafíos.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        {/* Postular Equipos Tab */}
        <TabsContent value="my-teams" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Postular Mis Equipos
            </h2>
            {teamsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-3 w-16 mt-2" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : teams ? (
              <MyTeamsAvailability teams={teams} userId={user.uid} isActive={activeTab === 'my-teams'} />
            ) : (
              <Alert>
                <AlertDescription>
                  No hay equipos disponibles.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        {/* Buscar Partidos Tab */}
        <TabsContent value="search" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Buscar Partidos
            </h2>
            {teams ? (
              <AvailablePostsGrid userId={user.uid} userTeams={teams} isActive={activeTab === 'search'} />
            ) : (
              <Alert>
                <AlertDescription>
                  Cargando equipos disponibles...
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        {/* Historial Tab */}
        <TabsContent value="history" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Swords className="h-6 w-6 text-primary" />
              Historial de Amistosos
            </h2>
            {matchesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : friendlyMatches && friendlyMatches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {friendlyMatches.map(match => (
                  <FriendlyMatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No hay partidos amistosos registrados todavía.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
