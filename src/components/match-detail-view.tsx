
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player, UserProfile } from '@/lib/types';
import { doc, getDoc, query, where, collection } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { MatchInfoCard } from './match-details/MatchInfoCard';
import { MatchManagementActions } from './match-details/MatchManagementActions';
import { useMatchPermissions } from '@/hooks/use-match-permissions';
import { useMatchActions } from '@/hooks/use-match-actions';
import { MatchChatView } from './match-chat-view';
import { MatchTeams } from './match-details/MatchTeams';
import { PlayersConfirmed } from './match-details/PlayersConfirmed';

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
        if (!match) return '';
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

    return (
        <div className="relative isolate">
          <div className="absolute inset-0 -z-10 hidden dark:block">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover saturate-50 brightness-75"
              aria-hidden="true"
              key="light-theme-video"
            >
              <source src="/videos/match-detail-bg.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/50" />
          </div>
    
          <div className="relative flex flex-col gap-8 p-4 md:p-6 text-foreground dark:text-white">
                <div className="flex w-full items-center justify-between gap-4">
                    <Button asChild variant="outline" className="self-start dark:bg-background/20 dark:border-foreground/20 dark:hover:bg-background/40">
                        <Link href="/matches">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a Partidos
                        </Link>
                    </Button>
                </div>
                
                <PageHeader title={match.title} className="dark:text-white" />

                <MatchInfoCard
                    match={match}
                    ownerProfile={ownerProfile}
                    googleMapsUrl={googleMapsUrl}
                    whatsAppShareText={whatsAppShareText}
                    weatherIcon={WeatherIcon ?? undefined}
                    isOwner={permissions.isOwner}
                    isUserInMatch={permissions.isUserInMatch}
                    isMatchFull={match.players.length >= match.matchSize}
                    isJoining={actions.isJoining}
                    onJoinOrLeave={actions.handleJoinOrLeave}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                         {match.teams && match.teams.length > 0 ? (
                           <MatchTeams 
                                match={match}
                                isOwner={permissions.isOwner}
                                onShuffle={actions.handleShuffleTeams}
                                isShuffling={actions.isShuffling}
                           />
                         ) : (
                           <PlayersConfirmed match={match} />
                         )}
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                        {permissions.isOwner && (
                            <MatchManagementActions
                                match={match}
                                allGroupPlayers={allGroupPlayers || []}
                                canFinalize={permissions.canFinalize}
                                canInvite={permissions.canInvite}
                                isFinishing={actions.isFinishing}
                                isDeleting={actions.isDeleting}
                                onFinish={actions.handleFinish}
                                onDelete={actions.handleDelete}
                            />
                        )}
                        <MatchChatView match={match} />
                    </div>
                </div>
            </div>
        </div>
    );
}
