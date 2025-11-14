
'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Bell, Search, Swords, Trophy, History } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { GroupTeam, Invitation, League } from '@/lib/types';
import { TeamChallengesList } from '@/components/team-challenge-card';
import { MyTeamsAvailability } from '@/components/my-teams-availability';
import { AvailablePostsGrid } from '@/components/available-posts-grid';
import { CreateLeagueDialog } from '@/components/competitions/create-league-dialog';
import { LeagueCard } from '@/components/leagues/LeagueCard';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [createLeagueOpen, setCreateLeagueOpen] = useState(false);

  const teamsQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'teams'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);
  const myTeams = useMemo(() => teams?.filter(t => t.createdBy === user?.uid) || [], [teams, user]);
  const myTeamIds = useMemo(() => myTeams.map(t => t.id), [myTeams]);
  
  const leaguesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
        collection(firestore, 'leagues'),
        where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: leagues, loading: leaguesLoading } = useCollection<League>(leaguesQuery);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  const fetchInvitations = useMemo(() => async () => {
    if (!firestore || myTeamIds.length === 0) {
      setInvitations([]);
      setInvitationsLoading(false);
      return;
    }
    setInvitationsLoading(true);
    try {
      const allInvitations = await Promise.all(
        myTeamIds.map(async (teamId) => {
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
  }, [firestore, myTeamIds.join(',')]);
  
  useEffect(() => {
    if (myTeamIds.length > 0) {
      fetchInvitations();
    } else if (!teamsLoading) {
      setInvitationsLoading(false);
    }
  }, [myTeamIds, teamsLoading, fetchInvitations]);

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

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Competiciones"
          description="Gestioná partidos amistosos, ligas y copas con tus equipos"
        >
          <InvitationsSheet />
        </PageHeader>

        <Tabs defaultValue="friendly" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friendly">Amistosos</TabsTrigger>
            <TabsTrigger value="leagues">Ligas</TabsTrigger>
            <TabsTrigger value="cups">Copas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="friendly" className="mt-6 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Desafíos Pendientes</h2>
                <Button variant="link" size="sm" asChild>
                  <Link href="/competitions/challenges">Ver Todos</Link>
                </Button>
              </div>
              {invitationsLoading || teamsLoading ? (
                  <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
              ) : myTeams.length > 0 && invitations.length > 0 ? (
                  <TeamChallengesList
                      invitations={invitations.slice(0, 2)}
                      teamId={myTeams[0].id} 
                      userId={user.uid}
                      onUpdate={fetchInvitations}
                  />
              ) : (
                  <Alert>
                      <AlertDescription>
                          {myTeams.length === 0 ? "Primero debés crear un equipo para poder recibir desafíos." : "No tenés desafíos pendientes en este momento."}
                      </AlertDescription>
                  </Alert>
              )}
            </div>
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Postulaciones Activas</h2>
                 <Button variant="link" size="sm" asChild>
                  <Link href="/competitions/my-teams">Gestionar</Link>
                </Button>
              </div>
              <MyTeamsAvailability teams={myTeams} userId={user.uid} isActive={true} />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Buscar Rivales</h2>
                 <Button variant="link" size="sm" asChild>
                  <Link href="/competitions/search">Buscar</Link>
                </Button>
              </div>
               <AvailablePostsGrid userId={user.uid} userTeams={teams || []} isActive={true} />
            </div>
          </TabsContent>

          <TabsContent value="leagues" className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Ligas</h2>
                <Button onClick={() => setCreateLeagueOpen(true)}>Crear Liga</Button>
            </div>

            {leaguesLoading ? (
                 <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
            ) : leagues && leagues.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leagues.map(league => (
                      <LeagueCard key={league.id} league={league} />
                    ))}
                </div>
            ) : (
                <Alert>
                    <AlertDescription>
                        Aún no hay ligas creadas en este grupo. ¡Sé el primero en organizar una!
                    </AlertDescription>
                </Alert>
            )}
          </TabsContent>
          <TabsContent value="cups" className="mt-6">
              <div className="text-center py-16 border-2 border-dashed rounded-xl">
                  <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Copas de Eliminación</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Próximamente podrás armar copas de eliminación directa.</p>
              </div>
          </TabsContent>
        </Tabs>
      </div>
      <CreateLeagueDialog
        open={createLeagueOpen}
        onOpenChange={setCreateLeagueOpen}
        groupId={user.activeGroupId}
        userId={user.uid}
        teams={teams || []}
      />
    </>
  );
}
