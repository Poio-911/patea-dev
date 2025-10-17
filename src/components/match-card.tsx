
'use client';

import { useState, useMemo } from 'react';
import type { Match, Player, EvaluationAssignment } from '@/lib/types';
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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
import { Calendar, Clock, MapPin, Users, Trash2, CheckCircle, Eye, Loader2, UserPlus, LogOut, Star, Sun, Cloud, Cloudy, CloudRain, Wind, Zap } from 'lucide-react';
import { InvitePlayerDialog } from './invite-player-dialog';
import Link from 'next/link';


type MatchCardProps = {
  match: Match;
  allPlayers: Player[];
};

const statusConfig = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

const weatherIcons: Record<string, React.ElementType> = {
    Sun, Cloud, Cloudy, CloudRain, Wind, Zap,
};

const InfoRow = ({ icon: Icon, text, children }: { icon: React.ElementType, text?: string, children?: React.ReactNode }) => (
    <div className="flex items-center gap-3 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {text && <span>{text}</span>}
        {children}
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
        const realPlayerUids = match.players
            .map(p => allPlayers.find(ap => ap.id === p.uid))
            .filter(p => p && isRealUser(p))
            .map(p => p!.id);

        realPlayerUids.forEach(evaluatorId => {
            const team = match.teams.find(t => t.players.some(p => p.uid === evaluatorId));
            if (!team) return;

            const teammates = team.players.filter(p => p.uid !== evaluatorId);
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
        if (!firestore) return;
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
        
        const playerProfile = allPlayers?.find(p => p.id === user.uid);

        if (!playerProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se encontró tu perfil de jugador.' });
            setIsJoining(false);
            return;
        }

        const matchRef = doc(firestore, 'matches', match.id);
        const playerPayload = { 
            uid: user.uid,
            displayName: playerProfile.name,
            ovr: playerProfile.ovr,
            position: playerProfile.position,
            photoUrl: playerProfile.photoUrl || ''
        };

        try {
            if(isUserInMatch) {
                const playerToRemove = match.players.find(p => p.uid === user.uid);
                if (playerToRemove) {
                    await updateDoc(matchRef, {
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
                await updateDoc(matchRef, {
                    players: arrayUnion(playerPayload)
                });
                toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${match.title}".` });
            }
        } catch (error) {
            console.error("Error joining/leaving match: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la operación.' });
        } finally {
            setIsJoining(false);
        }
    }


    const renderPrimaryAction = () => {
        if (match.status === 'upcoming' && match.type === 'collaborative' && user?.uid !== match.ownerUid) {
            if (isMatchFull && !isUserInMatch) {
                return <Button variant="outline" size="sm" className="w-full" disabled>Partido Lleno</Button>
            }
            return (
                 <Button variant={isUserInMatch ? 'secondary' : 'default'} size="sm" onClick={handleJoinOrLeaveMatch} disabled={isJoining} className="w-full">
                    {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isUserInMatch ? <LogOut className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                    {isUserInMatch ? 'Darse de baja' : 'Apuntarse'}
                </Button>
            );
        }
        if (match.status === 'upcoming' && user?.uid === match.ownerUid) {
            return (
                <Button variant="default" size="sm" onClick={handleFinishMatch} disabled={isFinishing} className="w-full">
                    {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Finalizar
                </Button>
            );
        }
        if (match.status === 'completed' && user?.uid === match.ownerUid) {
             return (
                <Button asChild variant="default" size="sm" className="w-full">
                    <Link href={`/matches/${match.id}/evaluate`}>
                        <Star className="mr-2 h-4 w-4" />
                        Supervisar Evaluación
                    </Link>
                </Button>
             );
        }
        return null;
    }

    const renderSecondaryActions = () => (
        <>
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
        <Card className="flex flex-col border-l-4" style={{borderLeftColor: `hsl(var(--${match.status === 'upcoming' ? 'primary' : 'card'}))`}}>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className="line-clamp-2">{match.title}</CardTitle>
                    <Badge variant="outline" className={cn("whitespace-nowrap uppercase text-xs", currentStatus.className)}>
                        {currentStatus.label}
                    </Badge>
                </div>
                <CardDescription>
                     <Badge variant="secondary">{match.type === 'manual' ? 'Manual' : 'Colaborativo'}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
                <InfoRow icon={Calendar} text={match.date ? format(new Date(match.date), 'E, d MMM, yyyy') : 'Fecha no definida'} />
                <InfoRow icon={Clock} text={match.time} />
                <InfoRow icon={MapPin}>
                    <div className="flex items-center gap-2">
                        <span>{match.location}</span>
                        {WeatherIcon && <WeatherIcon className="h-4 w-4 text-blue-500" />}
                    </div>
                </InfoRow>
                <InfoRow icon={Users} text={`${match.players.length} / ${match.matchSize} jugadores`} />
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-2 p-4 bg-muted/50">
                 <div className="grid grid-cols-2 gap-2">
                    {renderPrimaryAction()}
                    {renderSecondaryActions()}
                 </div>

                 {user?.uid === match.ownerUid &&(
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
