'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users, Bell, Search, Swords, Trophy } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { CompetitionCard } from '@/components/competition-card';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { Match, GroupTeam, Invitation, TeamAvailabilityPost } from '@/lib/types';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

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

  // Query for friendly matches - filtrar por jugadores en lugar de groupId
  const friendlyMatchesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'matches'),
      where('type', '==', 'intergroup_friendly'),
      where('playerUids', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);

  const { data: friendlyMatches, loading: matchesLoading } = useCollection<Match>(friendlyMatchesQuery);

  // Query for team availability posts
  const postsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'teamAvailabilityPosts'),
      where('createdBy', '==', user.uid)
    );
  }, [firestore, user?.uid]);

  const { data: posts, loading: postsLoading } = useCollection<TeamAvailabilityPost>(postsQuery);

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

  const pendingChallengesCount = invitations?.length || 0;
  const activePostsCount = posts?.length || 0;
  const matchesCount = friendlyMatches?.length || 0;
  const myTeamsCount = teams?.filter(t => t.createdBy === user.uid).length || 0;

  const loading = teamsLoading || invitationsLoading || matchesLoading || postsLoading;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Gestioná partidos amistosos, ligas y copas con tus equipos"
      >
        <InvitationsSheet />
      </PageHeader>

      {/* Overview Section */}
      {!loading && (
        <div className="rounded-lg bg-muted/50 p-6 mb-2">
          <h3 className="text-lg font-semibold mb-4">Resumen</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-destructive">{pendingChallengesCount}</p>
              <p className="text-sm text-muted-foreground">Desafíos Pendientes</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{activePostsCount}</p>
              <p className="text-sm text-muted-foreground">Postulaciones Activas</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{myTeamsCount}</p>
              <p className="text-sm text-muted-foreground">Mis Equipos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-chart-2">{matchesCount}</p>
              <p className="text-sm text-muted-foreground">Partidos Jugados</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Main Navigation Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CompetitionCard
            title="Desafíos Recibidos"
            description="Gestioná los desafíos que reciben tus equipos y aceptá o rechazá invitaciones"
            icon={Bell}
            href="/competitions/challenges"
            variant="challenges"
            count={pendingChallengesCount}
            stats={[
              { label: 'Pendientes', value: pendingChallengesCount },
              { label: 'Equipos', value: myTeamsCount },
            ]}
          />

          <CompetitionCard
            title="Mis Equipos"
            description="Postulá tus equipos para partidos amistosos y gestioná su disponibilidad"
            icon={Users}
            href="/competitions/my-teams"
            variant="teams"
            count={activePostsCount}
            stats={[
              { label: 'Postulaciones', value: activePostsCount },
              { label: 'Equipos', value: myTeamsCount },
            ]}
          />

          <CompetitionCard
            title="Buscar Partidos"
            description="Encontrá equipos disponibles para jugar partidos amistosos en tu zona"
            icon={Search}
            href="/competitions/search"
            variant="search"
            stats={[
              { label: 'Mis Equipos', value: myTeamsCount },
              { label: 'Disponibles', value: '...' },
            ]}
          />

          <CompetitionCard
            title="Historial"
            description="Revisá todos los partidos amistosos jugados y sus resultados"
            icon={Swords}
            href="/competitions/history"
            variant="history"
            count={matchesCount}
            stats={[
              { label: 'Partidos', value: matchesCount },
              { label: 'Equipos', value: myTeamsCount },
            ]}
          />
        </div>
      )}
    </div>
  );
}
