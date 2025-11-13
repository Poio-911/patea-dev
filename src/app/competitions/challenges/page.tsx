
'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Bell, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { TeamChallengesList } from '@/components/team-challenge-card';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { GroupTeam, Invitation } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChallengesPage() {
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
    fetchInvitations();
  }, [fetchInvitations]);

  if (userLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Iniciá sesión para ver los desafíos de tus equipos.
        </AlertDescription>
      </Alert>
    );
  }

  if (!user.activeGroupId) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Creá o unite a un grupo para acceder a los desafíos.
        </AlertDescription>
      </Alert>
    );
  }

  const userTeam = teams?.find(t => t.createdBy === user.uid);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
      <PageHeader
        title="Desafíos Recibidos"
        description="Gestioná los desafíos que reciben tus equipos"
      >
        <InvitationsSheet />
      </PageHeader>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/competitions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
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
        {invitationsLoading || teamsLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
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
              No tenés equipos creados. Creá un equipo para recibir desafíos.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
