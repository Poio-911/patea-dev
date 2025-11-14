'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { League, Match, GroupTeam } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LeagueHeader } from '@/components/leagues/LeagueHeader';
import { LeagueStandingsTable } from '@/components/leagues/LeagueStandingsTable';
import { LeagueFixture } from '@/components/leagues/LeagueFixture';
import { MatchScheduleDialog } from '@/components/leagues/MatchScheduleDialog';
import { calculateLeagueStandings, getCurrentRound } from '@/lib/utils/league-standings';
import { updateLeagueStatusAction, deleteLeagueAction } from '@/lib/actions/server-actions';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LeagueTab = 'standings' | 'fixture' | 'teams';

export default function LeagueDetailPage() {
  const { id: leagueId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<LeagueTab>('standings');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch league data
  const leagueRef = useMemo(() => {
    if (!firestore || !leagueId) return null;
    return doc(firestore, 'leagues', leagueId as string);
  }, [firestore, leagueId]);

  const { data: league, loading: leagueLoading } = useDoc<League>(leagueRef);

  // Fetch matches
  const matchesQuery = useMemo(() => {
    if (!firestore || !leagueId) return null;
    return query(
      collection(firestore, 'matches'),
      where('leagueInfo.leagueId', '==', leagueId),
      orderBy('leagueInfo.round', 'asc'),
      orderBy('date', 'asc')
    );
  }, [firestore, leagueId]);

  const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

  // Fetch teams
  const teamsQuery = useMemo(() => {
    if (!firestore || !league?.teams || league.teams.length === 0) return null;
    return query(
      collection(firestore, 'teams'),
      where('__name__', 'in', league.teams.slice(0, 10)) // Firestore limit
    );
  }, [firestore, league?.teams]);

  const { data: teams } = useCollection<GroupTeam>(teamsQuery);

  // Calculate standings
  const standings = useMemo(() => {
    if (!matches || !teams) return [];
    const completedMatches = matches.filter(m => m.status === 'completed' || m.status === 'evaluated');
    return calculateLeagueStandings(
      completedMatches,
      teams.map(t => ({ id: t.id, name: t.name, jersey: t.jersey }))
    );
  }, [matches, teams]);

  // Get current round
  const currentRound = useMemo(() => {
    if (!matches) return 1;
    return getCurrentRound(matches);
  }, [matches]);

  const isOwner = user?.uid === league?.ownerUid;

  const handleStartLeague = async () => {
    if (!league) return;

    setIsUpdatingStatus(true);
    try {
      const result = await updateLeagueStatusAction(league.id, 'in_progress');
      if (result.success) {
        toast({
          title: 'Liga iniciada',
          description: 'La liga ha sido iniciada correctamente.',
        });
        setShowStartDialog(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo iniciar la liga.',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCompleteLeague = async () => {
    if (!league) return;

    setIsUpdatingStatus(true);
    try {
      const result = await updateLeagueStatusAction(league.id, 'completed');
      if (result.success) {
        toast({
          title: 'Liga finalizada',
          description: 'La liga ha sido finalizada correctamente.',
        });
        setShowCompleteDialog(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo finalizar la liga.',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!league) return;

    setIsUpdatingStatus(true);
    try {
      const result = await deleteLeagueAction(league.id);
      if (result.success) {
        toast({
          title: 'Liga eliminada',
          description: 'La liga y todos sus partidos han sido eliminados.',
        });
        router.push('/competitions?tab=leagues');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar la liga.',
      });
      setShowDeleteDialog(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleEditMatch = (matchId: string) => {
    const match = matches?.find(m => m.id === matchId);
    if (match) {
      setEditingMatch(match);
    }
  };

  if (leagueLoading || matchesLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!league) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold">Liga no encontrada</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/competitions">Volver a Competiciones</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LeagueHeader
        league={league}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOwner={isOwner}
        onStartLeague={() => setShowStartDialog(true)}
        onCompleteLeague={() => setShowCompleteDialog(true)}
        onDeleteLeague={() => setShowDeleteDialog(true)}
      />

      {/* Tab Content */}
      {activeTab === 'standings' && (
        <LeagueStandingsTable standings={standings} />
      )}

      {activeTab === 'fixture' && matches && league && (
        <LeagueFixture
          matches={matches}
          currentRound={currentRound}
          isOwner={isOwner}
          leagueId={league.id}
          onEditMatch={handleEditMatch}
        />
      )}

      {activeTab === 'teams' && teams && (
        <Card>
          <CardHeader>
            <CardTitle>Equipos Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <JerseyPreview jersey={team.jersey} size="sm" />
                    <div>
                      <p className="font-semibold">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.players?.length || 0} jugadores
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match Schedule Dialog */}
      <MatchScheduleDialog
        match={editingMatch}
        open={!!editingMatch}
        onOpenChange={(open) => !open && setEditingMatch(null)}
      />

      {/* Start League Dialog */}
      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Iniciar la liga?</AlertDialogTitle>
            <AlertDialogDescription>
              Al iniciar la liga, los equipos podrán comenzar a jugar los partidos programados.
              Asegúrate de que todas las fechas estén correctamente configuradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartLeague} disabled={isUpdatingStatus}>
              {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Liga
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete League Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar la liga?</AlertDialogTitle>
            <AlertDialogDescription>
              Al finalizar la liga, se marcará como completada y no se podrán realizar más cambios.
              Verifica que todos los partidos hayan sido jugados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteLeague} disabled={isUpdatingStatus}>
              {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalizar Liga
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete League Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la liga?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la liga y todos los partidos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLeague}
              disabled={isUpdatingStatus}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar Liga
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
