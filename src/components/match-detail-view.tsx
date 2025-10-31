
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, UserProfile, Invitation, Jersey } from '@/lib/types';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, User, CheckCircle, Shuffle, Trash2, UserPlus, LogOut, MessageCircle, MoreVertical, Share2, ClipboardCopy, Edit, Users2 } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { MatchChatView } from './match-chat-view';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from './ui/separator';
import { generateTeamsAction } from '@/lib/actions/server-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { InvitePlayerDialog } from './invite-player-dialog';
import { WhatsAppIcon } from './icons/whatsapp-icon';
import { MatchChronicleCard } from './match-chronicle-card';
import { Sun, Cloud, Cloudy, CloudRain, Wind, Zap } from 'lucide-react';
import { MatchTeamsDialog } from './match-teams-dialog';
import { logger } from '@/lib/logger';
import { SwapPlayerDialog } from './swap-player-dialog';
import { ShirtIcon } from './icons/shirt-icon';
import { VestIcon } from './icons/vest-icon';

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

const isRealUser = (player: Player) => player.id === player.ownerUid;

export default function MatchDetailView({ matchId }: MatchDetailViewProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isFinishing, setIsFinishing] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isShuffling, setIsShuffling] = useState(false);
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
            if (firestore && match?.ownerUid && !ownerProfile) {
                const userDocRef = doc(firestore, 'users', match.ownerUid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setOwnerProfile(userDoc.data() as UserProfile);
                } else {
                    setOwnerProfile({ displayName: 'Organizador' } as UserProfile);
                }
            }
        };
        fetchOwnerProfile();
    }, [firestore, match, ownerProfile]);

    const isOwner = user?.uid === match?.ownerUid;

    const isUserInMatch = useMemo(() => {
        if (!user || !match) return false;
        return match.playerUids.includes(user.uid);
    }, [match, user]);

    const googleMapsUrl = match ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}` : '';
    
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

    const generateEvaluationAssignments = (match: Match, allPlayers: Player[]): Omit<EvaluationAssignment, 'id'>[] => {
        const assignments: Omit<EvaluationAssignment, 'id'>[] = [];
        const matchPlayers = allPlayers.filter(p => match.playerUids.includes(p.id));
        const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);
        realPlayerUids.forEach(evaluatorId => {
            if (!match.teams) return;
            const team = match.teams.find(t => t.players.some(p => p.uid === evaluatorId));
            if (!team) return;
            const teammates = team.players.filter(p => p.uid !== evaluatorId && realPlayerUids.includes(p.uid));
            const shuffledTeammates = teammates.sort(() => 0.5 - Math.random());
            const maxAssignments = Math.min(2, teammates.length);
            const playersToEvaluate = shuffledTeammates.slice(0, maxAssignments);
            playersToEvaluate.forEach(subject => {
                assignments.push({
                    matchId: match.id,
                    evaluatorId: evaluatorId,
                    subjectId: subject.uid,
                    status: 'pending',
                });
            });
        });
        return assignments;
    };

    const handleFinishMatch = async () => {
        if (!firestore || !user || !match || !allGroupPlayers) return;
        setIsFinishing(true);
        const batch = writeBatch(firestore);
        const matchRef = doc(firestore, 'matches', match.id);
        try {
            const freshMatchSnap = await getDoc(matchRef);
            if (!freshMatchSnap.exists()) throw new Error("El partido ya no existe.");
            const freshMatch = { id: freshMatchSnap.id, ...freshMatchSnap.data() } as Match;
            let finalTeams = freshMatch.teams;
            let matchUpdateData: any = { status: 'completed' };
            if (!finalTeams || finalTeams.length === 0) {
                 const playerIdsInMatch = freshMatch.playerUids;
                 if (playerIdsInMatch.length >= freshMatch.matchSize) {
                    const playersToBalance = allGroupPlayers.filter(p => playerIdsInMatch.includes(p.id));
                    const teamGenerationResult = await generateTeamsAction(playersToBalance);
                    if ('error' in teamGenerationResult) throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
                    if (!teamGenerationResult.teams) throw new Error('La respuesta de la IA no contiene equipos.');
                    finalTeams = teamGenerationResult.teams as any;
                    matchUpdateData.teams = finalTeams;
                 }
            }
            batch.update(matchRef, matchUpdateData);
            if (finalTeams && finalTeams.length > 0) {
                 const assignments = generateEvaluationAssignments({ ...freshMatch, teams: finalTeams }, allGroupPlayers);
                assignments.forEach(assignment => {
                    const assignmentRef = doc(collection(firestore, `matches/${freshMatch.id}/assignments`));
                    batch.set(assignmentRef, assignment);
                    const notificationRef = doc(collection(firestore, `users/${assignment.evaluatorId}/notifications`));
                    const notification: Omit<Notification, 'id'> = {
                        type: 'evaluation_pending',
                        title: '¡Evaluación pendiente!',
                        message: `Es hora de evaluar a tus compañeros del partido "${freshMatch.title}".`,
                        link: `/evaluations/${freshMatch.id}`,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                    };
                    batch.set(notificationRef, notification);
                });
            }
           
            await batch.commit();
            toast({ title: 'Partido Finalizado', description: `Ahora los jugadores pueden realizar las evaluaciones.` });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo finalizar el partido.' });
        } finally {
            setIsFinishing(false);
        }
    };
    
    const handleJoinOrLeaveMatch = async () => {
        if (!firestore || !user || !match) return;
        setIsJoining(true);
        
        const batch = writeBatch(firestore);
        const matchRef = doc(firestore, 'matches', match.id);

        try {
            if(isUserInMatch) {
                const playerToRemove = match.players.find(p => p.uid === user.uid);
                if (playerToRemove) {
                    batch.update(matchRef, {
                        players: arrayRemove(playerToRemove),
                        playerUids: arrayRemove(user.uid)
                    });
                }
                toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${match.title}".` });
            } else {
                if (match.players.length >= match.matchSize) {
                    toast({ variant: 'destructive', title: 'Partido Lleno', description: 'No quedan plazas disponibles en este partido.' });
                    setIsJoining(false);
                    return;
                }
                
                const playerProfileRef = doc(firestore, 'players', user.uid);
                const playerSnap = await getDoc(playerProfileRef);

                if (!playerSnap.exists()) {
                    toast({ variant: 'destructive', title: 'Error', description: 'No se encontró tu perfil de jugador.' });
                    setIsJoining(false);
                    return;
                }
                
                const playerProfile = playerSnap.data() as Player;

                const playerPayload = { 
                    uid: user.uid,
                    displayName: playerProfile.name,
                    ovr: playerProfile.ovr,
                    position: playerProfile.position,
                    photoUrl: playerProfile.photoUrl || ''
                };
                
                batch.update(matchRef, {
                    players: arrayUnion(playerPayload),
                    playerUids: arrayUnion(user.uid)
                });
                
                if (match.ownerUid !== user.uid) {
                    const notificationRef = doc(collection(firestore, `users/${match.ownerUid}/notifications`));
                    const notification: Omit<Notification, 'id'> = {
                        type: 'new_joiner',
                        title: '¡Nuevo Jugador!',
                        message: `${user.displayName} se ha apuntado a tu partido "${match.title}".`,
                        link: `/matches`,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                    };
                    batch.set(notificationRef, notification);
                }

                toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${match.title}".` });
            }
            await batch.commit();
        } catch (error) {
            console.error("Error joining/leaving match: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la operación.' });
        } finally {
            setIsJoining(false);
        }
    }
    
    const handleDeleteMatch = async () => {
        if (!firestore || !match) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'matches', match.id));
            toast({ title: "Partido Eliminado", description: "El partido ha sido eliminado con éxito." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el partido." });
        } finally {
            setIsDeleting(false);
        }
    };
    
    const handleShuffleTeams = async () => {
        if (!firestore || !match || !allGroupPlayers) return;
        setIsShuffling(true);

        try {
            const playersToBalance = allGroupPlayers.filter(p => match.playerUids.includes(p.id));
            const teamGenerationResult = await generateTeamsAction(playersToBalance);

            if ('error' in teamGenerationResult) throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
            if (!teamGenerationResult.teams) throw new Error('La respuesta de la IA no contiene equipos.');

            await updateDoc(doc(firestore, 'matches', match.id), {
                teams: teamGenerationResult.teams
            });

            toast({ title: "¡Equipos Sorteados!", description: "La IA ha generado nuevas formaciones." });

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron volver a sortear los equipos."});
        } finally {
            setIsShuffling(false);
        }
    };

    if (matchLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (!match) {
        return <div className="text-center p-8"><h2 className="text-xl font-bold">Partido no encontrado</h2></div>;
    }

    const WeatherIcon = match.weather?.icon ? weatherIcons[match.weather.icon] : null;
    const isMatchFull = match.players.length >= match.matchSize;
    const canFinalize = isOwner && match.status === 'upcoming' && isMatchFull;
    const canInvite = isOwner && match.type !== 'by_teams';
    
    return (
        <div className="relative isolate min-h-screen">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 -z-10 h-full w-full object-cover dark:saturate-50 dark:brightness-75 light:grayscale light:brightness-[1.5] light:contrast-50"
          >
            <source src="/videos/match-detail-bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 -z-10 dark:bg-black/50 light:bg-white/60" />
    
          <div className="relative flex flex-col gap-8 p-4 md:p-6 text-foreground">
                <div className="flex w-full items-start justify-between gap-4">
                    <Button asChild variant="outline" className="self-start bg-background/20 border-foreground/20 hover:bg-background/40">
                        <Link href="/matches">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a Partidos
                        </Link>
                    </Button>
                </div>
                
                <PageHeader title="Detalles del Partido" description={match.title} />

                <Card className="bg-background/20 border-foreground/10 backdrop-blur-sm">
                    <CardContent className="pt-6 space-y-4">
                         <div className="flex flex-col sm:flex-row gap-4 justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-lg">
                                    <Calendar className="h-5 w-5 text-primary"/>
                                    <span className="font-bold">{format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</span>
                                </div>
                                {ownerProfile && (
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={ownerProfile.photoURL || ''} alt={ownerProfile.displayName || ''} />
                                            <AvatarFallback>{ownerProfile.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="text-sm text-foreground/80">Organizado por {ownerProfile.displayName}</p>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3 text-left sm:text-right">
                               <div className="flex items-center gap-3 text-lg justify-start sm:justify-end">
                                    <Clock className="h-5 w-5 text-primary"/>
                                    <span className="font-bold">{match.time} hs</span>
                                    {WeatherIcon && match.weather && (
                                        <span className="flex items-center gap-1.5 text-sm text-foreground/80">
                                            <WeatherIcon className="h-4 w-4 text-blue-400" />
                                            <span>({match.weather.temperature}°C)</span>
                                        </span>
                                    )}
                                </div>
                                <Badge variant="outline" className="capitalize text-sm bg-background/20 border-foreground/20">{match.type === 'by_teams' ? 'Por Equipos' : match.type}</Badge>
                            </div>
                        </div>
                         <Separator className="bg-foreground/20"/>
                         <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0"/>
                                <div>
                                    <p className="font-bold">{match.location.name}</p>
                                    <p className="text-sm text-foreground/80">{match.location.address}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button asChild variant="secondary" size="sm">
                                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">Ir a la cancha</a>
                                </Button>
                                 {isOwner && match.status === 'upcoming' && (
                                    <Button variant="outline" size="sm" asChild className="bg-background/20 border-foreground/20 hover:bg-background/40 text-foreground">
                                        <a href={`https://wa.me/?text=${whatsAppShareText}`} target="_blank" rel="noopener noreferrer">
                                            <WhatsAppIcon className="mr-2 h-4 w-4"/>
                                            Compartir Partido
                                        </a>
                                    </Button>
                                 )}
                            </div>
                         </div>
                         {match.type === 'collaborative' && match.status === 'upcoming' && (
                            <div className="border-t border-foreground/20 pt-4">
                                {isMatchFull && !isUserInMatch ? (
                                    <Button variant="outline" size="lg" className="w-full bg-background/20 border-foreground/20" disabled>Partido Lleno</Button>
                                ) : (
                                    <Button variant={isUserInMatch ? 'secondary' : 'default'} size="lg" onClick={handleJoinOrLeaveMatch} disabled={isJoining} className="w-full">
                                        {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isUserInMatch ? <LogOut className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                                        {isUserInMatch ? 'Darse de baja' : 'Apuntarse'}
                                    </Button>
                                )}
                            </div>
                         )}
                    </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="bg-background/20 border-foreground/10 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle>Equipos ({match.players.length} / {match.matchSize})</CardTitle>
                                 <div className="pt-2">
                                    {isOwner && match.teams && match.teams.length > 0 && match.status === 'upcoming' && (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button variant="outline" size="sm" onClick={handleShuffleTeams} disabled={isShuffling} className="bg-background/20 border-foreground/20 hover:bg-background/40 text-foreground">{isShuffling && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Shuffle className="mr-2 h-4 w-4"/>Volver a Sortear</Button>
                                            <Button variant="outline" size="sm" asChild className="bg-background/20 border-foreground/20 hover:bg-background/40 text-foreground"><a href={`https://wa.me/?text=${whatsAppTeamsText}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="mr-2 h-4 w-4"/>Compartir Equipos</a></Button>
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
                                            <Card key={team.name} className="bg-background/20 border-foreground/10">
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
                                                                    {isOwner && match.status === 'upcoming' && (
                                                                        <SwapPlayerDialog match={match} playerToSwap={player}>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7"><Shuffle className="h-4 w-4" /></Button>
                                                                        </SwapPlayerDialog>
                                                                    )}
                                                                    <Badge variant="outline" className={cn("text-xs bg-background/20 border-foreground/20", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>{player.position}</Badge>
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
                                            <div key={`${player.uid}-${idx}`} className="flex flex-col items-center text-center p-3 gap-2 border border-foreground/10 rounded-lg bg-background/20">
                                                <Avatar className="h-16 w-16"><AvatarImage src={player.photoUrl} alt={player.displayName} /><AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback></Avatar>
                                                <div>
                                                    <p className="font-bold text-sm truncate w-24">{player.displayName}</p>
                                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                                        <Badge variant="outline" className={cn("text-xs bg-background/20 border-foreground/20", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>{player.position}</Badge>
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
                        {isOwner && (
                            <Card className="bg-background/20 border-foreground/10 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle>Gestión del Partido</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {canFinalize && (
                                        <Button onClick={handleFinishMatch} disabled={isFinishing} size="sm">
                                            {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                            Finalizar
                                        </Button>
                                    )}
                                    {canInvite && <InvitePlayerDialog playerToInvite={null} userMatches={match ? [match] : []} allGroupPlayers={allGroupPlayers || []} match={match}><Button variant="outline" size="sm" className="bg-background/20 border-foreground/20 hover:bg-background/40"><UserPlus className="mr-2 h-4 w-4"/>Invitar</Button></InvitePlayerDialog>}
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={isDeleting}><Trash2 className="mr-2 h-4 w-4"/>Eliminar</Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>¿Borrar este partido?</AlertDialogTitle><AlertDialogDescription>Esta acción es permanente y no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Eliminar</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardContent>
                            </Card>
                        )}
                        <MatchChatView match={match} />
                    </div>
                </div>
            </div>
        </div>
    );
}
