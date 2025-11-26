
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
import { logger } from '@/lib/logger';

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

  const googleMapsUrl = match ? `https://www.google.com/maps/search/?api=1&query_place_id=${match.location.placeId}` : '';

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

  // Use simplified view for cup matches
  if (match.type === 'cup' && match.leagueInfo?.leagueId && user?.uid) {
    return <CupMatchView match={match} cupId={match.leagueInfo.leagueId} userId={user.uid} />;
  }

  return (
    <div className="relative isolate">
      <div className="relative flex flex-col gap-8 md:p-6 text-foreground dark:text-white">
        <div className="flex w-full items-center justify-between gap-4">
          <Button asChild variant="outline" className="self-start dark:bg-background/20 dark:border-foreground/20 dark:hover:bg-background/40">
            <Link href="/matches">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Partidos
            </Link>
          </Button>
        </div>

        <PageHeader title={match.title} className="dark:text-white px-4 md:px-0" />

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

        {/* Competition Controls */}
        {isCompetitionMatch && permissions.isOwner && (
          <div className="px-4 md:px-0 mt-6">
            <CompetitionMatchControls match={match} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 md:px-0 mt-6">
          <div className="lg:col-span-3 space-y-6">
            {match.teams && match.teams.length > 0 ? (
              <MatchTeams
                match={match}
                isOwner={permissions.isOwner}
                onShuffle={isCompetitionMatch ? undefined : actions.handleShuffleTeams}
                isShuffling={actions.isShuffling}
              />
            ) : (
              <PlayersConfirmed match={match} />
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
                  <div className="flex flex-col gap-4 p-6 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Métricas Físicas</h3>
                      <p className="text-sm text-muted-foreground">
                        Vinculá tus datos de actividad física para obtener pequeños bonus en tus atributos PAC y PHY.
                        Es completamente opcional y no afecta tu evaluación principal.
                      </p>
                    </div>
                    <ImportActivityDialog
                      matchId={matchId}
                      playerId={userPlayer.id}
                      matchDate={new Date(match.date)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {permissions.isOwner && (
            <div className="lg:col-span-3">
              <MatchManagementActions
                match={match}
                allGroupPlayers={allGroupPlayers || []}
                canFinalize={permissions.canFinalize}
                isFinishing={actions.isFinishing}
                isDeleting={actions.isDeleting}
                onFinish={actions.handleFinish}
                onDelete={actions.handleDelete}
                isCompetitionMatch={isCompetitionMatch}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chat flotante */}
      <MatchChatView match={match} />
    </div>
  );
}
