
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, UserProfile, Invitation, Jersey, Team } from '@/lib/types';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, User, FileSignature, CheckCircle, UserPlus, LogOut, Shuffle, Trash2, MessageCircle, Eye, MoreVertical, Edit } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { MatchChatView } from './match-chat-view';
import { MatchTeamsDialog } from './match-teams-dialog';
import { TeamsIcon } from './icons/teams-icon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { WhatsAppIcon } from './icons/whatsapp-icon';
import { MatchChronicleCard } from './match-chronicle-card';
import { Separator } from './ui/separator';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { EditableTeamsDialog } from './editable-teams-dialog';
import { InvitePlayerDialog } from './invite-player-dialog';

interface MatchDetailViewProps {
  matchId: string;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;


export default function MatchDetailView({ matchId }: MatchDetailViewProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isFinishing, setIsFinishing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const matchRef = useMemo(() => firestore ? doc(firestore, 'matches', matchId) : null, [firestore, matchId]);
    const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

    const allGroupPlayersQuery = useMemo(() => {
      if (!firestore || !match?.groupId) return null;
      return query(collection(firestore, 'players'), where('groupId', '==', match.groupId));
    }, [firestore, match?.groupId]);
    const { data: allGroupPlayers } = useCollection<Player>(allGroupPlayersQuery);

    const isOwner = user?.uid === match?.ownerUid;

    const googleMapsUrl = match ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}` : '';
    
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
    
    const handleDeleteMatch = async () => {
        if (!firestore || !match) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'matches', match.id));
            toast({ title: "Partido Eliminado", description: "El partido ha sido eliminado con éxito." });
            // Redirect or update UI
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el partido." });
        } finally {
            setIsDeleting(false);
        }
    };

    if (matchLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (!match) {
        return <div className="text-center p-8"><h2 className="text-xl font-bold">Partido no encontrado</h2></div>;
    }

    const isMatchFull = match.players.length >= match.matchSize;
    const canFinalize = isOwner && match.status === 'upcoming' && isMatchFull;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex w-full items-center justify-between">
                <Button asChild variant="outline" className="self-start">
                    <Link href="/matches">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a Partidos
                    </Link>
                </Button>
            </div>
            
            <PageHeader title={match.title}>
              {isOwner && (
                <div className="flex items-center gap-2">
                    {canFinalize && (
                        <Button onClick={handleFinishMatch} disabled={isFinishing}>
                            {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                            Finalizar Partido
                        </Button>
                    )}
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         {match.teams && match.teams.length > 0 && (
                            <EditableTeamsDialog match={match}>
                                <DropdownMenuItem onSelect={e => e.preventDefault()}>
                                    <Shuffle className="mr-2 h-4 w-4"/> Editar Equipos
                                </DropdownMenuItem>
                            </EditableTeamsDialog>
                         )}
                         <InvitePlayerDialog userMatches={[match]} allGroupPlayers={allGroupPlayers || []} match={match} disabled={isMatchFull}>
                            <DropdownMenuItem onSelect={e => e.preventDefault()} disabled={isMatchFull}>
                                <UserPlus className="mr-2 h-4 w-4"/> Invitar Jugadores
                            </DropdownMenuItem>
                         </InvitePlayerDialog>
                         <DropdownMenuSeparator />
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4"/> Eliminar Partido
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Borrar este partido?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción es permanente y no se puede deshacer.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting}>
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                        Eliminar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              )}
            </PageHeader>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground border-t border-b py-3">
                 <Badge variant="default" className="text-base py-1 px-3">
                    <Calendar className="mr-2 h-4 w-4"/>
                    <span className="font-semibold">{format(new Date(match.date), "EEEE, d 'de' MMMM", { locale: es })}</span>
                </Badge>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4"/><span className="font-semibold">{match.time} hs</span></div>
                <div className="flex items-center gap-2"><User className="h-4 w-4" /><span className="font-semibold">Organiza: {isOwner ? 'Vos' : 'Otro'}</span></div>
                <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{match.type === 'by_teams' ? 'Por Equipos' : match.type}</Badge></div>
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4"/>
                    <Button asChild variant="link" className="p-0 h-auto text-sm text-muted-foreground"><Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">{match.location.name}</Link></Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Plantel ({match.players.length} / {match.matchSize})</span>
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
                                                            <Avatar className="h-9 w-9">
                                                                <AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoUrl} alt={player.displayName} />
                                                                <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1">
                                                                <p className="font-semibold text-sm">{player.displayName}</p>
                                                            </div>
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
                    <MatchChronicleCard match={match} />
                </div>
                <div className="space-y-6">
                    <MatchChatView match={match} />
                </div>
            </div>
        </div>
    );
}
