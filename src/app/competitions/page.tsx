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
import type { GroupTeam, Invitation } from '@/lib/types';
import { TeamChallengesList } from '@/components/team-challenge-card';
import { MyTeamsAvailability } from '@/components/my-teams-availability';
import { AvailablePostsGrid } from '@/components/available-posts-grid';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

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
  }, [firestore, myTeamIds.join(',')]); // Depend on a stable string representation
  
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
          {/* Desafíos Recibidos */}
          <div>
            <div className="border-l-4 border-l-destructive pl-4 mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <Bell className="h-6 w-6 text-destructive" />
                </div>
                Desafíos Pendientes
              </h2>
            </div>
            {invitationsLoading || teamsLoading ? (
                <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
            ) : myTeams.length > 0 && invitations.length > 0 ? (
                <TeamChallengesList
                    invitations={invitations}
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

          {/* Mis Postulaciones */}
          <div>
            <div className="border-l-4 border-l-primary pl-4 mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                Mis Postulaciones
              </h2>
            </div>
             <MyTeamsAvailability teams={myTeams} userId={user.uid} isActive={true} />
          </div>

          {/* Buscar Rivales */}
          <div>
            <div className="border-l-4 border-l-accent pl-4 mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="rounded-lg bg-accent/10 p-2">
                  <Search className="h-6 w-6 text-accent" />
                </div>
                Buscar Rivales
              </h2>
            </div>
            <AvailablePostsGrid userId={user.uid} userTeams={myTeams} isActive={true} />
          </div>

        </TabsContent>

        <TabsContent value="leagues" className="mt-6">
           <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Ligas Disponibles</h2>
                <Button>Crear Liga</Button>
              </div>
              <Alert>
                <AlertDescription>
                  Actualmente no hay ligas públicas disponibles. ¡Sé el primero en crear una!
                </AlertDescription>
              </Alert>
           </div>
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
  );
}