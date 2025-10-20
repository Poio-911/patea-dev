
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, UserProfile, Invitation } from '@/lib/types';
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateTeamsAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MatchTeamsDialog } from '@/components/match-teams-dialog';
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
import { Calendar, Clock, MapPin, Trash2, CheckCircle, Eye, Loader2, UserPlus, LogOut, Sun, Cloud, Cloudy, CloudRain, Wind, Zap, User, MessageCircle, FileSignature, MoreVertical, Users, UserCheck } from 'lucide-react';
import { InvitePlayerDialog } from './invite-player-dialog';
import Link from 'next/link';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';
import { MatchChatSheet } from './match-chat-sheet';
import { MatchDetailsDialog } from './match-details-dialog';
import { TeamsIcon } from './icons/teams-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"


type MatchCardProps = {
  match: Match;
  allPlayers: Player[];
};

const statusConfig: Record<Match['status'], { label: string; className: string; neonClass: string; gradientClass: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', neonClass: 'text-shadow-[0_0_10px_hsl(var(--primary))]', gradientClass: 'from-blue-500/20' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', neonClass: 'text-shadow-[0_0_10px_hsl(var(--accent))]', gradientClass: 'from-green-500/20' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', neonClass: 'text-shadow-[0_0_8px_hsl(var(--muted-foreground))]', gradientClass: 'from-gray-500/20' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300', neonClass: 'text-shadow-[0_0_10px_hsl(var(--chart-2))]', gradientClass: 'from-purple-500/20' },
};

const weatherIcons: Record<string, React.ElementType> = {
    Sun, Cloud, Cloudy, CloudRain, Wind, Zap,
};

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

export function MatchCard({ match, allPlayers }: MatchCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isFinishing, setIsFinishing] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [ownerName, setOwnerName] = useState<string | null>(null);

    useEffect(() => {
        const fetchOwnerName = async () => {
            if (!firestore) return;
            const ownerInGroup = allPlayers.find(p => p.id === match.ownerUid);
            if (ownerInGroup) {
                setOwnerName(ownerInGroup.name);
            } else {
                try {
                    const userDocRef = doc(firestore, 'users', match.ownerUid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as UserProfile;
                        setOwnerName(userData.displayName || 'Organizador');
                    } else {
                        setOwnerName('Organizador');
                    }
                } catch {
                    setOwnerName('Organizador');
                }
            }
        };

        fetchOwnerName();
    }, [firestore, match.ownerUid, allPlayers]);


    const isUserInMatch = useMemo(() => {
        if (!user) return false;
        return match.playerUids.includes(user.uid);
    }, [match.playerUids, user]);
    
    const isOwner = user?.uid === match.ownerUid;

    const isMatchFull = useMemo(() => {
        return match.players.length >= match.matchSize;
    }, [match.players, match.matchSize]);


    const currentStatus = statusConfig[match.status] || statusConfig.completed;

    const generateEvaluationAssignments = (match: Match, allPlayers: Player[]): Omit<EvaluationAssignment, 'id'>[] => {
        const assignments: Omit<EvaluationAssignment, 'id'>[] = [];
        const matchPlayers = allPlayers.filter(p => match.playerUids.includes(p.id));
        const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);

        realPlayerUids.forEach(evaluatorId => {
            const team = match.teams.find(t => t.players.some(p => p.uid === evaluatorId));
            if (!team) return;

            const teammates = team.players.filter(p => p.uid !== evaluatorId && realPlayerUids.includes(p.uid));
            const shuffledTeammates = teammates.sort(() => 0.5 - Math.random());
            const playersToEvaluate = shuffledTeammates.slice(0, 2);

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
        if (!firestore || !user) return;
        setIsFinishing(true);
        const batch = writeBatch(firestore);
        const matchRef = doc(firestore, 'matches', match.id);

        try {
            let finalTeams = match.teams;
            let matchUpdateData: any = { status: 'completed' };

            if ((match.type === 'collaborative' && isMatchFull) || (match.type === 'manual' && (!finalTeams || finalTeams.length === 0))) {
                const selectedPlayersData = allPlayers.filter(p => match.playerUids.includes(p.id));
                
                if (selectedPlayersData.length === match.matchSize) {
                    const teamGenerationResult = await generateTeamsAction(selectedPlayersData);
                    
                    if ('error' in teamGenerationResult) {
                        throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
                    }
                    if (!teamGenerationResult.teams) {
                        throw new Error('La respuesta de la IA no contiene equipos.');
                    }
                    finalTeams = teamGenerationResult.teams;
                    matchUpdateData.teams = finalTeams;
                } else {
                     console.warn("Finishing match without full player list. Teams not generated.");
                }
            }

            batch.update(matchRef, matchUpdateData);

            if (finalTeams && finalTeams.length > 0) {
                const assignments = generateEvaluationAssignments({ ...match, teams: finalTeams }, allPlayers);
                assignments.forEach(assignment => {
                    const assignmentRef = doc(collection(firestore, `matches/${match.id}/assignments`));
                    batch.set(assignmentRef, assignment);

                    const notificationRef = doc(collection(firestore, `users/${assignment.evaluatorId}/notifications`));
                    const notification: Omit<Notification, 'id'> = {
                        type: 'evaluation_pending',
                        title: '¡Evaluación pendiente!',
                        message: `Es hora de evaluar a tus compañeros del partido "${match.title}".`,
                        link: `/evaluations/${match.id}`,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                    };
                    batch.set(notificationRef, notification);
                });
            }
           
            await batch.commit();

            toast({
                title: 'Partido Finalizado',
                description: `El partido "${match.title}" ha sido marcado como finalizado.`
            });

        } catch (error: any) {
             console.error("Error finishing match: ", error);
             toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'No se pudo finalizar el partido.'
            });
        } finally {
            setIsFinishing(false);
        }
    };


    const handleJoinOrLeaveMatch = async () => {
        if (!firestore || !user) return;
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
                if (isMatchFull) {
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
    
    const WeatherIcon = match.weather?.icon ? weatherIcons[match.weather.icon] : null;

    const PrimaryAction = () => {
        if (isOwner && match.status === 'upcoming') {
            return (
                <Button variant="default" size="sm" onClick={handleFinishMatch} disabled={isFinishing} className="w-full">
                    {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Finalizar Partido
                </Button>
            );
        }
    
        if (isOwner && match.status === 'completed') {
            return (
                <Button asChild variant="default" size="sm" className="w-full">
                    <Link href={`/matches/${match.id}/evaluate`}>
                        <FileSignature className="mr-2 h-4 w-4" />
                        Supervisar
                    </Link>
                </Button>
            );
        }
    
        if (match.type === 'collaborative' && match.status === 'upcoming') {
            if (isMatchFull && !isUserInMatch) {
                return <Button variant="outline" size="sm" className="w-full" disabled>Partido Lleno</Button>;
            }
            return (
                <Button variant={isUserInMatch ? 'secondary' : 'default'} size="sm" onClick={handleJoinOrLeaveMatch} disabled={isJoining} className="w-full">
                    {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isUserInMatch ? <LogOut className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                    {isUserInMatch ? 'Darse de baja' : 'Apuntarse'}
                </Button>
            );
        }
    
        return null;
    };


    return (
        <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
            <CardHeader className={cn('relative bg-gradient-to-br to-transparent p-4', currentStatus.gradientClass)}>
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className={cn("text-xl font-bold", currentStatus.neonClass)}>
                        {match.title}
                    </CardTitle>
                     <Badge variant="outline" className={cn("whitespace-nowrap uppercase text-xs z-10", currentStatus.className)}>
                        {currentStatus.label}
                    </Badge>
                </div>
                 <div className="flex items-center gap-2 flex-wrap">
                    <CardDescription className="flex items-center gap-2 text-xs text-foreground/80">
                        <User className="h-3 w-3"/> Organizado por {ownerName || 'Cargando...'}
                    </CardDescription>
                    <Badge variant="secondary" className="capitalize text-xs">
                        {match.type === 'manual' ? <UserCheck className="mr-1.5 h-3 w-3"/> : <Users className="mr-1.5 h-3 w-3"/>}
                        {match.type}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-4 p-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Fecha</p>
                            <p className="font-bold text-sm capitalize">{format(new Date(match.date), "EEEE, d 'de' MMMM", { locale: es })}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Hora</p>
                            <p className="font-bold text-sm">{match.time} hs</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5"/>
                    <div>
                        <p className="text-xs text-muted-foreground">Lugar</p>
                        <p className="font-bold text-sm">{match.location.name || match.location.address}</p>
                    </div>
                </div>

                {WeatherIcon && match.weather && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3 mt-3">
                        <WeatherIcon className="h-4 w-4 text-blue-400" />
                        <span>{match.weather.description} ({match.weather.temperature}°C)</span>
                    </div>
                )}
                
                <Separator />
                
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-5 w-5" />
                    <span className="text-xl font-bold text-foreground">{match.players.length} / {match.matchSize}</span>
                    <span className="text-sm">Jugadores</span>
                </div>
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-2 p-3 bg-muted/50 mt-auto">
                <div className="grid grid-cols-2 gap-2">
                    <PrimaryAction />
                    <MatchDetailsDialog match={match} isOwner={isOwner}>
                        <Button variant="outline" size="sm" className="w-full">
                            <Eye className="mr-2 h-4 w-4" />
                            Detalles
                        </Button>
                    </MatchDetailsDialog>
                    {isUserInMatch && <MatchChatSheet match={match}><Button variant="outline" size="sm" className="w-full"><MessageCircle className="mr-2 h-4 w-4" />Chat</Button></MatchChatSheet>}
                    {match.teams && match.teams.length > 0 && <MatchTeamsDialog match={match}><Button variant="outline" size="sm" className="w-full"><TeamsIcon className="mr-2 h-4 w-4" />Equipos</Button></MatchTeamsDialog>}
                    
                    {isOwner && match.status === 'upcoming' && (match.type === 'collaborative' || match.isPublic) && (
                        <InvitePlayerDialog 
                            playerToInvite={null} 
                            userMatches={[]} 
                            match={match} 
                            allGroupPlayers={allPlayers}
                            disabled={isMatchFull}
                        >
                            <Button variant="outline" size="sm" className="w-full" disabled={isMatchFull}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Invitar
                            </Button>
                        </InvitePlayerDialog>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
