
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player, UserProfile } from '@/lib/types';
import { doc, getDoc, query, where, collection } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, ArrowLeft, Shuffle } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { MatchChatView } from './match-chat-view';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Sun, Cloud, Cloudy, CloudRain, Wind, Zap } from 'lucide-react';
import { MatchChronicleCard } from './match-chronicle-card';
import { MatchTeamsDialog } from './match-teams-dialog';
import { SwapPlayerDialog } from './swap-player-dialog';
import { ShirtIcon } from '@/components/icons/shirt-icon';
import { VestIcon } from '@/components/icons/vest-icon';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { useMatchPermissions } from '@/hooks/use-match-permissions';
import { useMatchActions } from '@/hooks/use-match-actions';
import { MatchInfoCard } from './match-details/MatchInfoCard';
import { MatchManagementActions } from './match-details/MatchManagementActions';


interface MatchDetailViewProps {
  matchId: string;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

const weatherIcons: Record<string, React.ElementType> = {
    Sun, Cloud, Cloudy, CloudRain, Wind, Zap,
};

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

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

    // Use custom hooks for permissions and actions
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
    
    const whatsAppTeamsText = useMemo(() => {
        if (!match || !match.teams || match.teams.length < 2) return '';
        let message = `*Equipos para el partido "${match.title}"*:\n\n`;
        match.teams.forEach(team => {
            message += `*${team.name}*\n`;
            team.players.forEach(p => {
                message += `- ${p.displayName} (OVR ${p.ovr})\n`;
            });
            message += '\n';
        });
        return encodeURIComponent(message);
    }, [match]);

    if (matchLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (!match) {
        return <div className="text-center p-8"><h2 className="text-xl font-bold">Partido no encontrado</h2></div>;
    }

    // Derived values
    const WeatherIcon = match.weather?.icon ? weatherIcons[match.weather.icon] : null;
    const isMatchFull = match.players.length >= match.matchSize;
    const canInvite = permissions.isOwner && match.type !== 'by_teams';
    
    return (
        <div className="relative isolate">
          <div className="absolute inset-0 -z-10 hidden dark:block">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover saturate-50 brightness-75"
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

                {/* Single unified component - eliminates dual theme rendering */}
                <MatchInfoCard
                    match={match}
                    ownerProfile={ownerProfile}
                    googleMapsUrl={googleMapsUrl}
                    whatsAppShareText={whatsAppShareText}
                    weatherIcon={WeatherIcon ?? undefined}
                    isOwner={permissions.isOwner}
                    isUserInMatch={permissions.isUserInMatch}
                    isMatchFull={isMatchFull}
                    isJoining={actions.isJoining}
                    onJoinOrLeave={actions.handleJoinOrLeave}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="dark:bg-background/20 border-foreground/10 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle>Equipos ({match.players.length} / {match.matchSize})</CardTitle>
                                 <div className="pt-2">
                                    {permissions.isOwner && match.teams && match.teams.length > 0 && match.status === 'upcoming' && (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button variant="outline" size="sm" onClick={actions.handleShuffleTeams} disabled={actions.isShuffling} className="dark:bg-background/20 dark:border-foreground/20 dark:hover:bg-background/40">{actions.isShuffling && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Shuffle className="mr-2 h-4 w-4"/>Volver a Sortear</Button>
                                            <Button variant="outline" size="sm" asChild className="dark:bg-background/20 dark:border-foreground/20 dark:hover:bg-background/40"><a href={`https://wa.me/?text=${whatsAppTeamsText}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="mr-2 h-4 w-4"/>Compartir Equipos</a></Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                             <CardContent>
                                 {match.teams && match.teams.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {match.teams.map(team => {
                                          const TeamIcon = team.name.toLowerCase().includes("chaleco") ? VestIcon : ShirtIcon;
                                          return (
                                            <Card key={team.name} className="dark:bg-background/20 border-foreground/10">
                                                <CardHeader className="flex flex-row items-center justify-between">
                                                    <CardTitle className="flex items-center gap-2"><TeamIcon className="h-5 w-5" />{team.name}</CardTitle>
                                                    <Badge variant="secondary">OVR {team.averageOVR.toFixed(1)}</Badge>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-1">
                                                        {team.players.map(player => (
                                                            <div key={player.uid} className="flex items-center justify-between p-2 border-b last:border-b-0 border-foreground/10">
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar className="h-9 w-9"><AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoUrl} alt={player.displayName} /><AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback></Avatar>
                                                                    <div className="flex-1"><p className="font-semibold text-sm">{player.displayName}</p></div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {permissions.isOwner && match.status === 'upcoming' && (
                                                                        <SwapPlayerDialog match={match} playerToSwap={player}>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7"><Shuffle className="h-4 w-4" /></Button>
                                                                        </SwapPlayerDialog>
                                                                    )}
                                                                    <Badge variant="outline" className={cn("text-xs dark:bg-background/20 dark:border-foreground/20", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>{player.position}</Badge>
                                                                    <Badge variant="secondary" className="text-xs w-10 justify-center">{player.ovr}</Badge>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )})}
                                    </div>
                                 ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {match.players.map((player, idx) => (
                                            <div key={`${player.uid}-${idx}`} className="flex flex-col items-center text-center p-3 gap-2 border border-foreground/10 rounded-lg dark:bg-background/20">
                                                <Avatar className="h-16 w-16"><AvatarImage src={player.photoUrl} alt={player.displayName} /><AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback></Avatar>
                                                <div>
                                                    <p className="font-bold text-sm truncate w-24">{player.displayName}</p>
                                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                                        <Badge variant="outline" className={cn("text-xs dark:bg-background/20 dark:border-foreground/20", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>{player.position}</Badge>
                                                        <Badge variant="secondary">{player.ovr}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                 )}
                            </CardContent>
                        </Card>
                        <MatchChronicleCard match={match} />
                    </div>
                    <div className="space-y-6">
                        {permissions.isOwner && (
                            <MatchManagementActions
                                match={match}
                                allGroupPlayers={allGroupPlayers || []}
                                canFinalize={permissions.canFinalize}
                                canInvite={canInvite}
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
