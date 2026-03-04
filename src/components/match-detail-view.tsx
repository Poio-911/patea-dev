
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player, UserProfile, PlayerPerformance } from '@/lib/types';
import { doc, getDoc, query, where, collection } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, AlertCircle, Sun, Cloud, Cloudy, CloudRain, Wind, Zap } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from './ui/button';
import { MatchInfoCard } from './match-details/MatchInfoCard';
import { MatchManagementActions } from './match-details/MatchManagementActions';
import { CompetitionMatchControls } from './match-details/CompetitionMatchControls';
import { useMatchPermissions } from '@/hooks/use-match-permissions';
import { useMatchActions } from '@/hooks/use-match-actions';
import { MatchChatView } from './match-chat-view';
import { MatchTeams } from './match-details/MatchTeams';
import { PlayersConfirmed } from './match-details/PlayersConfirmed';
import { AvailablePlayersSection } from './available-players-section';
import { ImportActivityDialog } from './health/import-activity-dialog';
import { PhysicalMetricsCard } from './health/physical-metrics-card';
import { CupMatchView } from './cup/CupMatchView';
import { LeagueMatchView } from './league/LeagueMatchView';
import { LiveMatchDashboard } from '@/components/match/live-match-dashboard';
import { MatchTimeline } from '@/components/match/match-timeline';
import { LiveStats } from '@/components/match/live-stats';
import { logMatchEventAction, updateLiveStateAction } from '@/lib/actions/server-actions';
import { useToast } from '@/hooks/use-toast';
import { MatchWeatherAlert } from './match-details/MatchWeatherAlert';
import { LocationVoting } from './match-details/location-voting';
import { DateVoting } from './match-details/date-voting';
import { IntegratedMatchStory } from './match-details/IntegratedMatchStory';
import { EditableTeamsDialog } from './editable-teams-dialog';
import { JoinRequestsSection } from './match-details/JoinRequestsSection';

interface MatchDetailViewProps {
  matchId: string;
}

const weatherIcons: Record<string, React.ElementType> = {
  Sun,
  Cloud,
  Cloudy,
  CloudRain,
  Wind,
  Zap,
};


export default function MatchDetailView({ matchId }: MatchDetailViewProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);

  const matchRef = useMemo(() => firestore ? doc(firestore, 'matches', matchId) : null, [firestore, matchId]);
  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  const allGroupPlayersQuery = useMemo(() => {
    if (!firestore || !match?.groupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', match.groupId));
  }, [firestore, match?.groupId]);
  const { data: allGroupPlayers } = useCollection<Player>(allGroupPlayersQuery);

  // Find user's player in this match
  const userPlayerInMatch = useMemo(() => {
    if (!user?.uid || !match?.players) return null;
    return match.players.find(p => p.uid === user.uid);
  }, [user?.uid, match?.players]);

  // Find the full player object (with id) from allGroupPlayers
  const userPlayer = useMemo(() => {
    if (!user?.uid || !allGroupPlayers) return null;
    return allGroupPlayers.find(p => p.ownerUid === user.uid);
  }, [user?.uid, allGroupPlayers]);

  // Fetch performance data for the current user
  const performanceQuery = useMemo(() => {
    if (!firestore || !userPlayerInMatch || !user?.uid) return null;
    return query(
      collection(firestore, 'matches', matchId, 'playerPerformance'),
      where('userId', '==', user.uid)
    );
  }, [firestore, matchId, userPlayerInMatch, user?.uid]);
  const { data: performanceData } = useCollection<PlayerPerformance>(performanceQuery);

  const userPerformance = performanceData && performanceData.length > 0 ? performanceData[0] : null;

  useEffect(() => {
    const fetchOwnerProfile = async () => {
      if (!firestore || !match?.ownerUid || ownerProfile) return;
      const ownerInGroup = allGroupPlayers?.find(p => p.id === match.ownerUid);
      if (ownerInGroup) {
        setOwnerProfile({ displayName: ownerInGroup.name, photoURL: ownerInGroup.photoUrl } as UserProfile);
      } else {
        try {
          const userDocRef = doc(firestore, 'users', match.ownerUid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setOwnerProfile(userDoc.data() as UserProfile);
          } else {
            setOwnerProfile({ displayName: 'Organizador' } as UserProfile);
          }
        } catch {
          setOwnerProfile({ displayName: 'Organizador' } as UserProfile);
        }
      }
    };
    fetchOwnerProfile();
  }, [firestore, match, ownerProfile, allGroupPlayers]);

  // Custom hooks for logic
  const permissions = useMatchPermissions(match, user?.uid);
  const actions = useMatchActions({
    match,
    firestore,
    userId: user?.uid,
    userDisplayName: user?.displayName ?? undefined,
    allGroupPlayers: allGroupPlayers ?? undefined,
    isUserInMatch: permissions.isUserInMatch,
  });

  const googleMapsUrl = match ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}` : '';

  const whatsAppShareText = useMemo(() => {
    if (!match || !match.players) return '';
    const spotsLeft = match.matchSize - match.players.length;
    const matchUrl = typeof window !== 'undefined' ? `${window.location.origin}/matches/${match.id}` : '';
    let message = `¡Hey! Estamos armando un partido: *${match.title}*.\n`;
    message += `Faltan *${spotsLeft}* jugador(es). ¡Sumate acá!\n${matchUrl}`;
    return encodeURIComponent(message);
  }, [match]);

  if (matchLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!match) {
    return (
      <div className="flex justify-center p-8">
        <EmptyState
          icon={<AlertCircle className="w-12 h-12 text-muted-foreground/30" />}
          title="Partido no encontrado"
          description="El partido que buscas no existe o fue eliminado."
          action={{ label: 'Volver a Partidos', href: '/matches' }}
        />
      </div>
    );
  }

  const WeatherIcon = match.weather?.icon ? weatherIcons[match.weather.icon] : null;

  const isCompetitionMatch = ['league', 'cup', 'league_final'].includes(match.type);

  // Use dedicated views for competition matches
  if (match.type === 'cup' && match.leagueInfo?.leagueId && user?.uid) {
    return <CupMatchView match={match} cupId={match.leagueInfo.leagueId} userId={user.uid} />;
  }

  if ((match.type === 'league' || match.type === 'league_final') && match.leagueInfo?.leagueId && user?.uid) {
    return <LeagueMatchView match={match} leagueId={match.leagueInfo.leagueId} userId={user.uid} />;
  }

  return (
    <div className="relative isolate">
      <div className="relative flex flex-col gap-6 md:p-6 text-foreground">

        {/* 1. HERO — siempre full width */}
        <MatchInfoCard
          match={match}
          ownerProfile={ownerProfile}
          googleMapsUrl={googleMapsUrl}
          whatsAppShareText={whatsAppShareText}
          weatherIcon={WeatherIcon ?? undefined}
          isOwner={permissions.isOwner}
          isUserInMatch={permissions.isUserInMatch}
          isMatchFull={(match.players?.length || 0) >= match.matchSize}
          isJoining={actions.isJoining}
          isUserPendingRequest={actions.isUserPendingRequest}
          onJoinOrLeave={isCompetitionMatch ? undefined : actions.handleJoinOrLeave}
        />

        {/* 2. Weather alert — full width, condicional */}
        <MatchWeatherAlert match={match} />

        {/* 3. GRID: Main (3/5) + Sidebar (2/5) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* MAIN (izquierda, 60%) */}
          <div className="lg:col-span-3 space-y-6">
            {match.teams && match.teams.length > 0 ? (
              <MatchTeams match={match} isOwner={permissions.isOwner} />
            ) : (
              <PlayersConfirmed match={match} />
            )}

            {/* Votación de Fecha */}
            {(match.status === 'planning' || match.isVotingOpen) && (
              <DateVoting match={match} userId={user?.uid || ''} />
            )}

            {/* Votación de Cancha (Inter-Group) */}
            {match.type === 'intergroup_friendly' && (
              <LocationVoting match={match} userId={user?.uid || ''} />
            )}

            {/* Available players */}
            {!isCompetitionMatch && (match.players?.length || 0) < match.matchSize && (
              <AvailablePlayersSection match={match} isOwner={permissions.isOwner} />
            )}
          </div>

          {/* SIDEBAR (derecha, 40%) — sticky en desktop */}
          <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-6 lg:self-start">

            {/* Management Actions */}
            {permissions.isOwner && (
              <MatchManagementActions
                match={match}
                allGroupPlayers={allGroupPlayers || []}
                canFinalize={permissions.canFinalize}
                isFinishing={actions.isFinishing}
                isDeleting={actions.isDeleting}
                onFinish={actions.handleFinish}
                onDelete={actions.handleDelete}
                isCompetitionMatch={isCompetitionMatch}
                onShuffle={isCompetitionMatch ? undefined : actions.handleShuffleTeams}
                isShuffling={actions.isShuffling}
                onReschedule={isCompetitionMatch ? undefined : actions.handleReschedule}
                isRescheduling={actions.isRescheduling}
                onChangeLocation={isCompetitionMatch ? undefined : actions.handleChangeLocation}
                isChangingLocation={actions.isChangingLocation}
              />
            )}

            {/* Join requests — visible only for organizer of manual matches */}
            {permissions.isOwner && match.type === 'manual' && match.status === 'upcoming' && (
              <JoinRequestsSection matchId={match.id} />
            )}

            {/* Competition Controls */}
            {isCompetitionMatch && permissions.isOwner && (
              <CompetitionMatchControls match={match} />
            )}

            {/* Alerta de Jugadores Duplicados */}
            {permissions.isOwner && match.type === 'by_teams' && match.teams && match.teams.length === 2 && (() => {
              const team1Uids = new Set(match.teams[0].players?.map(p => p.uid) || []);
              const duplicates = match.teams[1].players?.filter(p => team1Uids.has(p.uid)) || [];
              if (duplicates.length === 0) return null;
              return (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-amber-100 dark:bg-amber-900 rounded-full text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-900 dark:text-amber-100">Jugadores detectados en ambos equipos</h4>
                      <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                        {duplicates.map(p => p.displayName).join(', ')} {duplicates.length === 1 ? 'está participando' : 'están participando'} en los dos equipos.
                        Esto puede generar inconsistencias en las evaluaciones.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" size="sm" className="text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900" onClick={(e) => {
                      const el = e.currentTarget.closest('.bg-amber-50');
                      if (el) (el as HTMLElement).style.display = 'none';
                    }}>
                      Continuar
                    </Button>
                    <EditableTeamsDialog match={match}>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm">
                        Revisar Equipos
                      </Button>
                    </EditableTeamsDialog>
                  </div>
                </div>
              );
            })()}

            {/* Physical Metrics — solo si el usuario participó */}
            {userPlayerInMatch && userPlayer && (match.status === 'completed' || match.status === 'evaluated') && (
              <div className="space-y-4">
                {userPerformance ? (
                  <PhysicalMetricsCard performance={userPerformance} />
                ) : (
                  <div className="rounded-lg border bg-card shadow p-0">
                    <div className="p-6 pb-0">
                      <h3 className="text-lg font-semibold">Métricas Físicas</h3>
                      <p className="text-sm text-muted-foreground">
                        Vinculá tus datos de actividad física para obtener pequeños bonus en tus atributos PAC y PHY.
                        Es completamente opcional y no afecta tu evaluación principal.
                      </p>
                    </div>
                    <div className="p-6">
                      <ImportActivityDialog
                        matchId={matchId}
                        playerId={userPlayer.id}
                        matchDate={new Date(match.date)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <MatchChatView match={match} />
          </div>
        </div>

        {/* === SECCIONES FULL-WIDTH debajo del grid === */}

        {/* Live dashboard (owner + upcoming/active) */}
        {(match.status === 'upcoming' || match.status === 'active') && permissions.isOwner && (
          <div className="space-y-6">
            <LiveMatchDashboard
              match={match}
              isAdmin={permissions.isOwner}
              onEventLogged={async (event) => {
                const result = await logMatchEventAction(match.id, event, user?.uid || '');
                if (!result.success) {
                  toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudo registrar el evento.' });
                } else {
                  toast({ title: 'Evento registrado', description: `${event.type} - ${event.playerName}` });
                }
              }}
              onMatchStatusChange={async (status, minute) => {
                const result = await updateLiveStateAction(match.id, status, minute ?? (match.currentMinute ?? 0), user?.uid || '');
                if (!result.success) {
                  toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudo actualizar el estado.' });
                } else {
                  toast({ title: 'Estado del partido actualizado', description: `Nuevo estado: ${status}` });
                }
              }}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MatchTimeline events={match.events || []} currentMinute={match.currentMinute || 0} />
              <LiveStats match={match} />
            </div>
          </div>
        )}

        {/* Match story (evaluated) */}
        {match.status === 'evaluated' && (
          <IntegratedMatchStory match={match} />
        )}

        {/* Legacy score */}
        {match.status !== 'evaluated' && match.finalScore && (
          <div className="bg-card border shadow-sm rounded-3xl p-6 text-center">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Resultado Final</h3>
            <div className="flex items-center justify-center gap-6">
              <span className="text-xl font-bold">{match.teams?.[0]?.name || 'Equipo 1'}</span>
              <div className="px-6 py-2 bg-foreground text-background rounded-full text-3xl font-black">
                {match.finalScore.team1} - {match.finalScore.team2}
              </div>
              <span className="text-xl font-bold">{match.teams?.[1]?.name || 'Equipo 2'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
