
'use client';

import { useState, useMemo } from 'react';
import type { Match, Player } from '@/lib/types';
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { generateTeamsAction } from '@/lib/actions';

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
} from "@/components/ui/alert-dialog"
import { Calendar, Clock, MapPin, Users, Trash2, CheckCircle, Eye, Loader2, UserPlus, LogOut, ShieldQuestion } from 'lucide-react';
import { InvitePlayerDialog } from './invite-player-dialog';


type MatchCardProps = {
  match: Match;
  allPlayers: Player[];
};

const statusConfig = {
    upcoming: { label: 'Próximo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    active: { label: 'Activo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

const InfoRow = ({ icon: Icon, text }: { icon: React.ElementType, text: string }) => (
    <div className="flex items-center gap-3 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{text}</span>
    </div>
);

export function MatchCard({ match, allPlayers }: MatchCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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

    const handleFinishMatch = async () => {
        if (!firestore) return;
        setIsFinishing(true);
        try {
            // For collaborative matches that are full, generate teams first
            if(match.type === 'collaborative' && isMatchFull) {
                const selectedPlayersData = allPlayers.filter(p => match.players.some(mp => mp.uid === p.id));
                const teamGenerationResult = await generateTeamsAction(selectedPlayersData);
                
                if (teamGenerationResult.error || !teamGenerationResult.teams) {
                    throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
                }
                 if (teamGenerationResult.teams.length > 0 && teamGenerationResult.balanceMetrics) {
                    teamGenerationResult.teams[0].balanceMetrics = teamGenerationResult.balanceMetrics;
                }

                await updateDoc(doc(firestore, 'matches', match.id), {
                    status: 'completed',
                    teams: teamGenerationResult.teams
                });

            } else {
                 await updateDoc(doc(firestore, 'matches', match.id), {
                    status: 'completed'
                });
            }
           
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


    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className="line-clamp-2">{match.title}</CardTitle>
                    <Badge variant="secondary" className={cn("whitespace-nowrap", currentStatus.className)}>
                        {currentStatus.label}
                    </Badge>
                </div>
                <CardDescription>
                     <Badge variant="outline">{match.type === 'manual' ? 'Manual' : 'Colaborativo'}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <InfoRow icon={Calendar} text={match.date ? format(new Date(match.date), 'E, d MMM, yyyy') : 'Fecha no definida'} />
                <InfoRow icon={Clock} text={match.time} />
                <InfoRow icon={MapPin} text={match.location} />
                <InfoRow icon={Users} text={`${match.players.length} / ${match.matchSize} jugadores`} />
            </CardContent>
            <Separator />
            <CardFooter className="grid grid-cols-2 gap-2 p-4">
                 <MatchTeamsDialog match={match}>
                    <Button variant="outline" size="sm" className="w-full" disabled={!match.teams || match.teams.length === 0}>
                        <Eye className="mr-2 h-4 w-4" />
                        Equipos
                    </Button>
                </MatchTeamsDialog>

                {match.status === 'upcoming' && match.type === 'manual' && (
                    <Button variant="default" size="sm" onClick={handleFinishMatch} disabled={isFinishing} className="w-full">
                        {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Finalizar
                    </Button>
                )}

                {match.status === 'upcoming' && match.type === 'collaborative' && (
                     <>
                        {!isMatchFull && (
                            <Button variant={isUserInMatch ? 'secondary' : 'default'} size="sm" onClick={handleJoinOrLeaveMatch} disabled={isJoining}>
                                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isUserInMatch ? <LogOut className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                                {isUserInMatch ? 'Darse de baja' : 'Apuntarse'}
                            </Button>
                        )}
                        {isMatchFull && !isUserInMatch && (
                            <Button variant="outline" size="sm" disabled>Partido Lleno</Button>
                        )}
                         {isMatchFull && isUserInMatch && (
                            <Button variant="secondary" size="sm" onClick={handleJoinOrLeaveMatch} disabled={isJoining}>
                                {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                                Darse de baja
                            </Button>
                        )}

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

                        {isMatchFull && (
                             <Button variant="default" size="sm" onClick={handleFinishMatch} disabled={isFinishing} className="w-full col-span-2">
                                {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldQuestion className="mr-2 h-4 w-4" />}
                                Generar Equipos y Finalizar
                            </Button>
                        )}
                    </>
                )}
                 
                 {(match.status === 'completed' || match.status === 'evaluated') && (
                     <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive col-span-2" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                    </Button>
                 )}

                 <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    {match.status !== 'completed' && match.status !== 'evaluated' && (
                         <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive col-span-2" onClick={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                        </Button>
                    )}
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
            </CardFooter>
        </Card>
    );
}
