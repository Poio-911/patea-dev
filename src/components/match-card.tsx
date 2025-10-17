
'use client';

import { useState, useMemo } from 'react';
import type { Match, Player, EvaluationAssignment, Notification } from '@/lib/types';
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, getDoc } from 'firebase/firestore';
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
import { Calendar, Clock, MapPin, Trash2, CheckCircle, Eye, Loader2, UserPlus, LogOut, Star, Sun, Cloud, Cloudy, CloudRain, Wind, Zap } from 'lucide-react';
import { InvitePlayerDialog } from './invite-player-dialog';
import Link from 'next/link';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';


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

const InfoRow = ({ icon: Icon, text, children }: { icon: React.ElementType, text?: string, children?: React.ReactNode }) => (
    <div className="flex items-center gap-4">
        <Icon className="h-6 w-6 text-primary flex-shrink-0" />
        <div className="text-sm">
            {text && <span>{text}</span>}
            {children}
        </div>
    </div>
);

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

export function MatchCard({ match, allPlayers }: MatchCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    const isUserInMatch = useMemo(() => {
        if (!user) return false;
        return match.players.some(p => p.uid === user.uid);
    }, [match.players, user]);

    const isMatchFull = useMemo(() => {
        return match.players.length >= match.matchSize;
    }, [match.players, match.matchSize]);

    const availablePlayersToInvite = useMemo(() => {
        if (!allPlayers) return [];
        const matchPlayerIds = match.players.map(p => p.uid);
        return allPlayers.filter(p => !matchPlayerIds.includes(p.id));
    }, [allPlayers, match.players]);

    const currentStatus = statusConfig[match.status] || statusConfig.completed;

    const handleDeleteMatch = async () => {
        if (!firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'matches', match.id));
            toast({
                title: 'Partido Eliminado',
                description: 'El partido ha sido eliminado correctamente.'
            });
        } catch (error) {
            console.error("Error deleting match: ", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo eliminar el partido.'
            });
        } finally {
            setIsDeleting(false);
        }
    };
    
    const generateEvaluationAssignments = (match: Match, allPlayers: Player[]): Omit<EvaluationAssignment, 'id'>[] => {
        const assignments: Omit<EvaluationAssignment, 'id'>[] = [];
        const matchPlayers = allPlayers.filter(p => match.players.some(mp => mp.uid === p.id));
        const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);

        realPlayerUids.forEach(evaluatorId => {
            const team = match.teams.find(t => t.players.some(p => p.uid === evaluatorId));
            if (!team) return;

            const teammates = team.players.filter(p => p.uid !== evaluatorId && realPlayerUids.includes(p.uid));
            // Shuffle teammates for random assignment
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
            let matchUpdate: any = { status: 'completed' };

            // Generate teams if it's a collaborative match being finished
            if(match.type === 'collaborative' && isMatchFull) {
                const selectedPlayersData = allPlayers.filter(p => match.players.some(mp => mp.uid === p.id));
                const teamGenerationResult = await generateTeamsAction(selectedPlayersData);
                
                if ('error' in teamGenerationResult) {
                    throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
                }
                if (!teamGenerationResult.teams) {
                    throw new Error('La respuesta de la IA no contiene equipos.');
                }
                finalTeams = teamGenerationResult.teams;
                matchUpdate.teams = finalTeams;
            }

            batch.update(matchRef, matchUpdate);

            // Generate and save evaluation assignments
            const assignments = generateEvaluationAssignments({ ...match, teams: finalTeams }, allPlayers);
            assignments.forEach(assignment => {
                const assignmentRef = doc(collection(firestore, 'matches', match.id, 'assignments'));
                batch.set(assignmentRef, assignment);

                // Create a notification for the evaluator
                const notificationRef = doc(collection(firestore, 'users', assignment.evaluatorId, 'notifications'));
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
           
            await batch.commit();

            toast({
                title: 'Partido Finalizado',
                description: `El partido "${match.title}" ha sido marcado como finalizado y se han generado las asignaciones de evaluación.`
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
                        players: arrayRemove(playerToRemove)
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
                    players: arrayUnion(playerPayload)
                });
                
                // Notify the organizer
                const notificationRef = doc(collection(firestore, 'users', match.ownerUid, 'notifications'));
                const notification: Omit<Notification, 'id'> = {
                    type: 'new_joiner',
                    title: '¡Nuevo Jugador!',
                    message: `${user.displayName} se ha apuntado a tu partido "${match.title}".`,
                    link: `/matches/${match.id}`,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                };
                batch.set(notificationRef, notification);

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

    const renderPrimaryAction = () => {
        if (match.status !== 'upcoming') return null;
    
        // Show join/leave button for collaborative matches or public matches
        if (match.type === 'collaborative' || match.isPublic) {
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
    }

    const renderSecondaryActions = () => (
        <>
            {user?.uid === match.ownerUid && match.status === 'upcoming' && match.type === 'collaborative' && isMatchFull && (
                <Button variant="default" size="sm" onClick={handleFinishMatch} disabled={isFinishing} className="w-full">
                    {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Finalizar
                </Button>
            )}

            <MatchTeamsDialog match={match}>
                <Button variant="outline" size="sm" className="w-full" disabled={!match.teams || match.teams.length === 0}>
                    <Eye className="mr-2 h-4 w-4" />
                    Equipos
                </Button>
            </MatchTeamsDialog>

            {match.status === 'upcoming' && user?.uid === match.ownerUid && match.type === 'collaborative' && (
                <InvitePlayerDialog 
                    match={match} 
                    availablePlayers={availablePlayersToInvite}
                    disabled={isMatchFull} 
                >
                    <Button variant="outline" size="sm" className="w-full" disabled={isMatchFull}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invitar
                    </Button>
                </InvitePlayerDialog>
            )}

            {match.status === 'completed' && user?.uid === match.ownerUid && (
                 <Button asChild variant="default" size="sm" className="w-full">
                    <Link href={`/matches/${match.id}/evaluate`}>
                        <Star className="mr-2 h-4 w-4" />
                        Supervisar
                    </Link>
                </Button>
             )}

            {match.status === 'evaluated' && user?.uid === match.ownerUid && (
                <Button asChild variant="secondary" size="sm" className="w-full">
                    <Link href={`/matches/${match.id}/evaluate`}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Evaluado
                    </Link>
                </Button>
             )}
        </>
    );
    
    const WeatherIcon = match.weather?.icon ? weatherIcons[match.weather.icon] : null;

    return (
        <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
            <CardHeader className={cn('bg-gradient-to-br to-transparent', currentStatus.gradientClass)}>
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className={cn("text-xl font-bold", currentStatus.neonClass)}>
                        {match.title}
                    </CardTitle>
                    <Badge variant="outline" className={cn("whitespace-nowrap uppercase text-xs", currentStatus.className)}>
                        {currentStatus.label}
                    </Badge>
                </div>
                <CardDescription>
                     <Badge variant="secondary" className="font-semibold">{match.type === 'manual' ? 'Manual' : match.isPublic ? 'Público' : 'Colaborativo'}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-6">

                <div className="grid grid-cols-1 gap-y-3">
                    <InfoRow icon={Calendar} text={match.date ? format(new Date(match.date), 'E, d MMM, yyyy', { locale: es }) : 'Fecha no definida'} />
                    <InfoRow icon={Clock} text={match.time} />
                    <InfoRow icon={MapPin} text={match.location.address} />
                </div>
                
                {WeatherIcon && match.weather && (
                    <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-3">
                        <WeatherIcon className="h-8 w-8 text-blue-400" />
                        <div>
                            <p className="font-semibold text-sm">{match.weather.description}</p>
                            <p className="text-xs text-muted-foreground">{match.weather.temperature}°C</p>
                        </div>
                    </div>
                )}
                
                <Separator />
                
                <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-lg font-bold">
                        <SoccerPlayerIcon className="h-5 w-5 text-muted-foreground" />
                        <span>{match.players.length} / {match.matchSize}</span>
                     </div>
                     <span className="text-sm text-muted-foreground">jugadores</span>
                </div>

            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-2 p-3 bg-muted/50 mt-auto">
                 <div className="grid grid-cols-2 gap-2">
                    {renderPrimaryAction()}
                    {renderSecondaryActions()}
                 </div>

                 {user?.uid === match.ownerUid && match.status !== 'evaluated' && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-8 mt-2">
                                <Trash2 className="mr-2 h-3 w-3" />
                                Eliminar Partido
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente el partido
                                y todos sus datos asociados.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Sí, eliminar partido
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}
            </CardFooter>
        </Card>
    );
}
