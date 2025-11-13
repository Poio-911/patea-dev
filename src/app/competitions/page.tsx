
'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Bell, Search, Swords, Trophy } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { Match, GroupTeam, Invitation, TeamAvailabilityPost } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamChallengesList } from '@/components/team-challenge-card';
import { MyTeamsAvailability } from '@/components/my-teams-availability';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('friendly');

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

  const fetchInvitations = useMemo(() => async () => {
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
  }, [firestore, teams, user]);

  useEffect(() => {
    if (activeTab === 'friendly') {
        fetchInvitations();
    }
  }, [activeTab, fetchInvitations]);


  const loading = userLoading || teamsLoading || invitationsLoading;

  if (loading) {
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

  const userTeam = teams?.find(t => t.createdBy === user.uid);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Gestioná partidos amistosos, ligas y copas con tus equipos"
      >
        <InvitationsSheet />
      </PageHeader>

      <Tabs defaultValue="friendly" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friendly">Amistosos</TabsTrigger>
          <TabsTrigger value="leagues" disabled>Ligas (Próximamente)</TabsTrigger>
          <TabsTrigger value="cups" disabled>Copas (Próximamente)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="friendly" className="mt-6 space-y-8">
            <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild className="w-full sm:w-auto">
                    <Link href="/competitions/search"><Search className="mr-2 h-4 w-4"/>Buscar Rivales</Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="/competitions/history"><Swords className="mr-2 h-4 w-4"/>Ver Historial</Link>
                </Button>
            </div>
        
            <div>
              <div className="border-l-4 border-l-destructive pl-4 mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <div className="rounded-lg bg-destructive/10 p-2">
                    <Bell className="h-6 w-6 text-destructive" />
                  </div>
                  Desafíos Pendientes
                </h2>
              </div>
              {invitationsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : userTeam && invitations ? (
                <TeamChallengesList
                  invitations={invitations}
                  teamId={userTeam.id}
                  userId={user.uid}
                  onUpdate={fetchInvitations}
                />
              ) : (
                <Alert>
                  <AlertDescription>
                    No tenés equipos creados para recibir desafíos, o no hay desafíos pendientes.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <div>
                 <div className="border-l-4 border-l-primary pl-4 mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        Mis Postulaciones
                    </h2>
                </div>
                {teams && (
                    <MyTeamsAvailability teams={teams} userId={user.uid} isActive={activeTab === 'friendly'} />
                )}
            </div>
        </TabsContent>

        <TabsContent value="leagues">
           <div className="text-center py-16">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Ligas y Torneos</h3>
              <p className="mt-2 text-sm text-muted-foreground">Próximamente podrás crear y participar en ligas personalizadas.</p>
           </div>
        </TabsContent>
        <TabsContent value="cups">
            <div className="text-center py-16">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Copas de Eliminación</h3>
                <p className="mt-2 text-sm text-muted-foreground">Próximamente podrás armar copas de eliminación directa.</p>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
