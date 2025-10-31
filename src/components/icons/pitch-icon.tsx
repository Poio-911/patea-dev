'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, UserProfile } from '@/lib/types';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, User, CheckCircle, Shuffle, Trash2, UserPlus, LogOut, MessageCircle, MoreVertical, Share2, ClipboardCopy } from 'lucide-react';
import { PageHeader } from '../page-header';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
// import { MatchChatView } from './match-chat-view'; // TODO: Component not yet implemented
import { TeamsIcon } from '../icons/teams-icon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '../ui/separator';
import { generateTeamsAction } from '@/lib/actions';
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
import { InvitePlayerDialog } from '../invite-player-dialog';
import { WhatsAppIcon } from '../icons/whatsapp-icon';
// import { MatchChronicleCard } from './match-chronicle-card'; // TODO: Component not yet implemented
import { Sun, Cloud, Cloudy, CloudRain, Wind, Zap } from 'lucide-react';
import { MatchTeamsDialog } from '../match-teams-dialog';

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
            message += `*${team.name} (OVR ${team.averageOVR.toFixed(1)})*\n`;
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
                    finalTeams = teamGenerationResult.teams;
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
        <div className="flex flex-col gap-8">
            <div className="flex w-full items-center justify-between">
                <Button asChild variant="outline" className="self-start">
                    <Link href="/matches">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a Partidos
                    </Link>
                </Button>
            </div>
            
            <PageHeader title={match.title} />

            <Card>
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
                                    <p className="text-sm text-muted-foreground">Organizado por {ownerProfile.displayName}</p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3 text-left sm:text-right">
                           <div className="flex items-center gap-3 text-lg justify-start sm:justify-end">
                                <Clock className="h-5 w-5 text-primary"/>
                                <span className="font-bold">{match.time} hs</span>
                                {WeatherIcon && match.weather && (
                                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                        <WeatherIcon className="h-4 w-4 text-blue-400" />
                                        <span>({match.weather.temperature}°C)</span>
                                    </span>
                                )}
                            </div>
                            <Badge variant="outline" className="capitalize text-sm">{match.type === 'by_teams' ? 'Por Equipos' : match.type}</Badge>
                        </div>
                    </div>
                     <Separator />
                     <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0"/>
                            <div>
                                <p className="font-bold">{match.location.name}</p>
                                <p className="text-sm text-muted-foreground">{match.location.address}</p>
                            </div>
                        </div>
                        <Button asChild variant="secondary" size="sm">
                            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">Ir a la cancha</a>
                        </Button>
                     </div>
                     {match.type === 'collaborative' && match.status === 'upcoming' && (
                        <div className="border-t pt-4">
                            {isMatchFull && !isUserInMatch ? (
                                <Button variant="outline" size="lg" className="w-full" disabled>Partido Lleno</Button>
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
            
            {isOwner && match.status === 'upcoming' && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold">Panel del Organizador</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="md:col-span-2 border-primary">
                            <CardHeader>
                                <CardTitle>Estado del Partido</CardTitle>
                                <CardDescription>Finalizá el encuentro cuando termine para poder iniciar las evaluaciones.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {canFinalize ? (
                                    <Button onClick={handleFinishMatch} disabled={isFinishing} size="lg">
                                        {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                        Finalizar Partido
                                    </Button>
                                ) : (
                                    <p className="text-sm text-muted-foreground">El partido debe estar lleno para poder finalizarlo.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Plantel y Tácticas</CardTitle>
                                <CardDescription>Gestiona a los jugadores y la formación.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {canInvite && <InvitePlayerDialog playerToInvite={null} userMatches={match ? [match] : []} allGroupPlayers={allGroupPlayers || []} match={match}><Button variant="outline" className="w-full"><UserPlus className="mr-2 h-4 w-4"/>Invitar Jugadores del Grupo</Button></InvitePlayerDialog>}
                                {match.teams && match.teams.length > 0 && <Button variant="outline" className="w-full" onClick={handleShuffleTeams} disabled={isShuffling}>{isShuffling && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Shuffle className="mr-2 h-4 w-4"/>Volver a Sortear (IA)</Button>}
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Difusión y Acciones</CardTitle>
                                <CardDescription>Comparte la información del partido.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <Button variant="outline" className="w-full" asChild><a href={`https://wa.me/?text=${whatsAppShareText}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="mr-2 h-4 w-4"/>Compartir Partido</a></Button>
                                {match.teams && match.teams.length > 0 && <Button variant="outline" className="w-full" asChild><a href={`https://wa.me/?text=${whatsAppTeamsText}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="mr-2 h-4 w-4"/>Compartir Equipos</a></Button>}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="destructive" className="w-full" disabled={isDeleting}><Trash2 className="mr-2 h-4 w-4"/>Eliminar Partido</Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>¿Borrar este partido?</AlertDialogTitle><AlertDialogDescription>Esta acción es permanente y no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Eliminar</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>Plantel ({match.players.length} / {match.matchSize})</span>
                            </CardTitle>
                        </CardHeader>
                         <CardContent>
                             {match.teams && match.teams.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {match.teams.map(team => (
                                        <Card key={team.name}>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <CardTitle>{team.name}</CardTitle>
                                                <Badge variant="secondary">OVR {team.averageOVR.toFixed(1)}</Badge>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-1">
                                                    {team.players.map(player => (
                                                        <div key={player.uid} className="flex items-center gap-3 p-2 border-b last:border-b-0">
                                                            <Avatar className="h-9 w-9"><AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoUrl} alt={player.displayName} /><AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback></Avatar>
                                                            <div className="flex-1"><p className="font-semibold text-sm">{player.displayName}</p></div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Badge variant="outline" className={cn("text-xs", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>{player.position}</Badge>
                                                                <Badge variant="secondary" className="text-xs">{player.ovr}</Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                             ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {match.players.map((player, idx) => (
                                        <div key={`${player.uid}-${idx}`} className="flex flex-col items-center text-center p-3 gap-2 border rounded-lg">
                                            <Avatar className="h-16 w-16"><AvatarImage src={player.photoUrl} alt={player.displayName} /><AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback></Avatar>
                                            <div>
                                                <p className="font-bold text-sm truncate w-24">{player.displayName}</p>
                                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                                    <Badge variant="outline" className={cn("text-xs", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>{player.position}</Badge>
                                                    <Badge variant="secondary">{player.ovr}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </CardContent>
                    </Card>
                    {/* <MatchChronicleCard match={match} /> */}
                </div>
                <div className="space-y-6">
                    {/* <MatchChatView match={match} /> */}
                </div>
            </div>
        </div>
    );
}