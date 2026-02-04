
'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Bell, Search, Swords, Trophy, History, Shield, Globe } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { GroupTeam, Invitation, League, Cup } from '@/lib/types';
import { TeamChallengesList } from '@/components/team-challenge-card';
import { MyTeamsAvailability } from '@/components/my-teams-availability';
import { AvailablePostsGrid } from '@/components/available-posts-grid';
import { CreateLeagueDialog } from '@/components/competitions/create-league-dialog';
import { CreateCupDialog } from '@/components/competitions/create-cup-dialog';
import { LeagueCard } from '@/components/leagues/LeagueCard';
import { CupCard } from '@/components/competitions/cup-card';
import { PublicCompetitionsBrowser } from '@/components/competitions/public-competitions-browser';
import { SectionBanner } from '@/components/competitions/section-banner';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { CompetitionCard } from '@/components/competitions/CompetitionCard';


export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [createLeagueOpen, setCreateLeagueOpen] = useState(false);
  const [createCupOpen, setCreateCupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'friendly' | 'leagues' | 'cups' | 'public'>('friendly');


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

  const cupsQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'cups'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: cups, loading: cupsLoading } = useCollection<Cup>(cupsQuery);

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
      {/* Video Background for Light Theme */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30"
        style={{ display: 'var(--video-display, none)' }}
      >
        <source src="/videos/competitions1080.mp4" type="video/mp4" media="(min-width: 1920px)" />
        <source src="/videos/competitions720.mp4" type="video/mp4" />
      </video>

      {/* White overlay for video */}
      <div
        className="fixed inset-0 -z-10 bg-white/80"
        style={{ display: 'var(--video-display, none)' }}
      />

      <div className="flex flex-col gap-8">
        <PageHeader
          title="Competiciones"
          description="Gestioná partidos amistosos, ligas y copas con tus equipos"
        >
          <InvitationsSheet />
        </PageHeader>

        {/* Competition Portal - Hero Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <CompetitionCard
            type="friendly"
            title="Amistosos"
            icon={Swords}
            notificationCount={invitations.length}
            stats={[
              { label: 'Desafíos pendientes', value: invitations.length },
              { label: 'Equipos activos', value: myTeams.length },
            ]}
            onClick={() => setActiveTab('friendly')}
          />

          <CompetitionCard
            type="league"
            title="Ligas"
            icon={Shield}
            stats={[
              { label: 'Ligas activas', value: leagues?.filter(l => l.status === 'in_progress').length || 0 },
              { label: 'Total ligas', value: leagues?.length || 0 },
            ]}
            onClick={() => setActiveTab('leagues')}
          />

          <CompetitionCard
            type="cup"
            title="Copas"
            icon={Trophy}
            stats={[
              { label: 'Copas activas', value: cups?.filter(c => c.status === 'in_progress').length || 0 },
              { label: 'Total copas', value: cups?.length || 0 },
            ]}
            onClick={() => setActiveTab('cups')}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          {/* Tabs navigation hidden - using hero cards instead */}
          <div className="hidden">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50">
              <TabsTrigger
                value="friendly"
                className="gap-1.5 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Swords className="h-4 w-4 fifa-friendly-icon" />
                <span className="text-xs sm:text-sm">Amistosos</span>
                {invitations.length > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-success-foreground">
                    {invitations.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="leagues"
                className="gap-1.5 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Shield className="h-4 w-4 fifa-league-icon" />
                <span className="text-xs sm:text-sm">Ligas</span>
              </TabsTrigger>
              <TabsTrigger
                value="cups"
                className="gap-1.5 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Trophy className="h-4 w-4 fifa-cup-icon" />
                <span className="text-xs sm:text-sm">Copas</span>
              </TabsTrigger>
              <TabsTrigger
                value="public"
                className="gap-1.5 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Globe className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Públicas</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="friendly" className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Challenges & Status (8 cols) */}
              <div className="lg:col-span-8 space-y-6">

                {/* Active Challenges */}
                <Card className="border-0 bg-white/80 dark:bg-card/50 backdrop-blur-md shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Swords className="h-5 w-5 text-emerald-600" />
                      Desafíos Pendientes
                    </CardTitle>
                    <Link href="/competitions/challenges">
                      <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                        Ver Todos <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {invitationsLoading || teamsLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                    ) : myTeams.length > 0 && invitations.length > 0 ? (
                      <TeamChallengesList
                        invitations={invitations.slice(0, 3)}
                        teamId={myTeams[0].id}
                        userId={user.uid}
                        onUpdate={fetchInvitations}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                        <Swords className="h-10 w-10 mb-3 opacity-20" />
                        <p>{myTeams.length === 0 ? "Creá un equipo para recibir desafíos" : "No hay desafíos pendientes"}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* My Availability */}
                <Card className="border-0 bg-white/80 dark:bg-card/50 backdrop-blur-md shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl font-bold">Postulaciones Activas</CardTitle>
                    <Link href="/competitions/my-teams">
                      <Button variant="ghost" size="sm">Gestionar</Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <MyTeamsAvailability teams={myTeams} userId={user.uid} isActive={true} />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Search (4 cols) */}
              <div className="lg:col-span-4">
                <Card className="border-0 bg-white/80 dark:bg-card/50 backdrop-blur-md shadow-sm h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Buscar Rivales
                    </CardTitle>
                    <CardDescription>Encontrá equipos buscando partido</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AvailablePostsGrid userId={user.uid} userTeams={teams || []} isActive={true} />
                    <div className="mt-4 pt-4 border-t border-border/50 text-center">
                      <Link href="/competitions/search">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20">
                          Búsqueda Avanzada
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leagues" className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3 text-foreground/90">
                  <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  Torneos de Liga
                </h2>
                <p className="text-muted-foreground mt-1">Competí en formato todos contra todos</p>
              </div>
              <Button
                onClick={() => setCreateLeagueOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-full px-6 transition-all hover:scale-105"
              >
                + Crear Liga
              </Button>
            </div>

            {leaguesLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-10 w-10 animate-spin text-blue-500" /></div>
            ) : leagues && leagues.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leagues.map(league => (
                  <LeagueCard key={league.id} league={league} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 bg-white/50 dark:bg-card/50 backdrop-blur-sm p-12 flex flex-col items-center justify-center text-center gap-4">
                <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <Shield className="h-12 w-12" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-bold">No hay ligas activas</h3>
                  <p className="text-muted-foreground">Creá tu primera liga para empezar a competir con otros equipos de tu grupo.</p>
                </div>
                <Button
                  onClick={() => setCreateLeagueOpen(true)}
                  variant="outline"
                  className="mt-4 border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/50"
                >
                  Crear Primera Liga
                </Button>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="cups" className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3 text-foreground/90">
                  <Trophy className="h-8 w-8 text-amber-500" />
                  Torneos de Copa
                </h2>
                <p className="text-muted-foreground mt-1">Competí en formato eliminación directa</p>
              </div>
              <Button
                onClick={() => setCreateCupOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30 rounded-full px-6 transition-all hover:scale-105"
              >
                + Crear Copa
              </Button>
            </div>

            {cupsLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-10 w-10 animate-spin text-amber-500" /></div>
            ) : cups && cups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cups.map(cup => (
                  <CupCard key={cup.id} cup={cup} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 bg-white/50 dark:bg-card/50 backdrop-blur-sm p-12 flex flex-col items-center justify-center text-center gap-4">
                <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500">
                  <Trophy className="h-12 w-12" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-bold">No hay copas activas</h3>
                  <p className="text-muted-foreground">Organizá un torneo de eliminación directa para definir al campeón definitivo.</p>
                </div>
                <Button
                  onClick={() => setCreateCupOpen(true)}
                  variant="outline"
                  className="mt-4 border-amber-200 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/50"
                >
                  Crear Primera Copa
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="public" className="mt-6 space-y-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">Competiciones Públicas</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Explorá y postulate a ligas y copas abiertas de otros grupos
                </p>
              </div>
              <PublicCompetitionsBrowser userId={user.uid} userTeams={myTeams} />
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
      <CreateCupDialog
        open={createCupOpen}
        onOpenChange={setCreateCupOpen}
        groupId={user.activeGroupId}
        userId={user.uid}
        teams={teams || []}
      />
    </>
  );
}
