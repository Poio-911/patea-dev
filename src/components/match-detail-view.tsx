
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Match, Player, UserProfile, PlayerPerformance } from '@/lib/types';
import { doc, getDoc, query, where, collection } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { MatchInfoCard } from './match-details/MatchInfoCard';
import { MatchManagementActions } from './match-details/MatchManagementActions';
import { CompetitionMatchControls } from './match-details/CompetitionMatchControls';
import { useMatchPermissions } from '@/hooks/use-match-permissions';
import { useMatchActions } from '@/hooks/use-match-actions';
import { MatchChatView } from './match-chat-view';
import { MatchTeams } from './match-details/MatchTeams';
import { PlayersConfirmed } from './match-details/PlayersConfirmed';
import { MatchChronicleCard } from './match-chronicle-card';
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
import { logger } from '@/lib/logger';
import { LocationVoting } from './match-details/location-voting';
import { DateVoting } from './match-details/date-voting';

interface MatchDetailViewProps {
  matchId: string;
}

const weatherIcons: Record<string, React.ElementType> = {
  Sun: require('lucide-react').Sun,
  Cloud: require('lucide-react').Cloud,
  Cloudy: require('lucide-react').Cloudy,
  CloudRain: require('lucide-react').CloudRain,
  Wind: require('lucide-react').Wind,
  Zap: require('lucide-react').Zap,
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
    return <div className="text-center p-8"><h2 className="text-xl font-bold">Partido no encontrado</h2></div>;
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
      <div className="relative flex flex-col gap-8 md:p-6 text-foreground">
        {/* Back button rendered by page wrapper; avoid duplication here */}

        <PageHeader title={match.title} className="text-foreground" />

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
          onJoinOrLeave={isCompetitionMatch ? undefined : actions.handleJoinOrLeave}
        />

        {/* Advertencias climáticas */}
        <MatchWeatherAlert match={match} />

        {/* Management Actions - Centralizadas para organizadores */}
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
          />
        )}

        {/* Competition Controls */}
        {isCompetitionMatch && permissions.isOwner && (
          <div className="mt-6">
            <CompetitionMatchControls match={match} />
          </div>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-3 space-y-6">

            {/* Votación de Fecha (Para Partidos en estado Planning) */}
            {(match.status === 'planning' || match.isVotingOpen) && (
              <DateVoting match={match} userId={user?.uid || ''} />
            )}

            {/* Votación de Cancha (Inter-Group) */}
            {match.type === 'intergroup_friendly' && (
              <LocationVoting match={match} userId={user?.uid || ''} />
            )}

            {match.teams && match.teams.length > 0 ? (
              <MatchTeams
                match={match}
                isOwner={permissions.isOwner}
              />
            ) : (
              <PlayersConfirmed match={match} />
            )}

            {/* Live Broadcast Controls for League Matches (parity with cup) */}
            {(['league', 'league_final'].includes(match.type)) && (match.status === 'upcoming' || match.status === 'active') && permissions.isOwner && (
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
                  <MatchTimeline
                    events={match.events || []}
                    currentMinute={match.currentMinute || 0}
                  />
                  <LiveStats
                    match={match}
                  />
                </div>
              </div>
            )}

            {/* Show player search section if match is incomplete AND not competition */}
            {!isCompetitionMatch && (match.players?.length || 0) < match.matchSize && (
              <AvailablePlayersSection
                match={match}
                isOwner={permissions.isOwner}
              />
            )}

            {match.status === 'evaluated' && <MatchChronicleCard match={match} />}

            {/* Physical Metrics Section - Only for players who participated */}
            {userPlayerInMatch && userPlayer && (match.status === 'completed' || match.status === 'evaluated') && (
              <div className="space-y-4">
                {userPerformance ? (
                  <PhysicalMetricsCard performance={userPerformance} />
                ) : (
                  <div>
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat flotante */}
      <MatchChatView match={match} />
    </div>
  );
}
