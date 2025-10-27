'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, UserProfile } from '@/lib/types';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, User, CheckCircle, Shuffle, Trash2, UserPlus } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { MatchChatView } from './match-chat-view';
import { TeamsIcon } from './icons/teams-icon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { EditableTeamsDialog } from './editable-teams-dialog';
import { InvitePlayerDialog } from './invite-player-dialog';
import { WhatsAppIcon } from './icons/whatsapp-icon';
import { MatchChronicleCard } from './match-chronicle-card';

interface MatchDetailViewProps {
  matchId: string;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

const isRealUser = (player: Player) => player.id === player.ownerUid;

const ActionCard = ({ icon: Icon, title, description, children, iconClassName }: { icon: React.ElementType, title: string, description: string, children: React.ReactNode, iconClassName?: string }) => (
    <Card className="flex flex-col">
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-2">
            <div className={cn("p-2 rounded-full", iconClassName)}>
                <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="mt-auto">
            {children}
        </CardContent>
    </Card>
);

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
    
    const whatsAppShareText = useMemo(() => {
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

    if (matchLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (!match) {
        return <div className="text-center p-8"><h2 className="text-xl font-bold">Partido no encontrado</h2></div>;
    }

    const isMatchFull = match.players.length >= match.matchSize;
    const canFinalize = isOwner && match.status === 'upcoming' && isMatchFull;

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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-6 w-6 text-primary"/>
                    <div>
                        <p className="font-bold">{format(new Date(match.date), "EEEE, d MMM", { locale: es })}</p>
                        <p className="text-muted-foreground">{new Date(match.date).getFullYear()}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-6 w-6 text-primary"/>
                    <div>
                        <p className="font-bold">{match.time} hs</p>
                        <p className="text-muted-foreground">Hora de inicio</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <User className="h-6 w-6 text-primary"/>
                    <div>
                        <p className="font-bold">{isOwner ? 'Vos' : 'Otro'}</p>
                        <p className="text-muted-foreground">Organizador</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Badge variant="outline" className="capitalize text-sm h-full">{match.type === 'by_teams' ? 'Por Equipos' : match.type}</Badge>
                </div>
            </div>
            
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1"/>
                <div>
                    <p className="font-bold">{match.location.name}</p>
                    <p className="text-sm text-muted-foreground">{match.location.address}</p>
                </div>
            </a>


            {isOwner && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold">Panel del Organizador</h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {canFinalize && <ActionCard icon={CheckCircle} title="Finalizar Partido" description="Genera equipos y abre las evaluaciones." iconClassName="bg-green-500"><Button onClick={handleFinishMatch} disabled={isFinishing} className="w-full">{isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Finalizar</Button></ActionCard>}
                        {match.teams && match.teams.length > 0 && <ActionCard icon={Shuffle} title="Editar Equipos" description="Reorganizá los equipos arrastrando jugadores." iconClassName="bg-blue-500"><EditableTeamsDialog match={match}><Button variant="outline" className="w-full">Editar</Button></EditableTeamsDialog></ActionCard>}
                        {!isMatchFull && <ActionCard icon={UserPlus} title="Invitar Jugadores" description="Completá el plantel para el partido." iconClassName="bg-purple-500"><InvitePlayerDialog userMatches={[match]} allGroupPlayers={allGroupPlayers || []} match={match}><Button variant="outline" className="w-full">Invitar</Button></InvitePlayerDialog></ActionCard>}
                        {match.teams && match.teams.length > 0 && <ActionCard icon={WhatsAppIcon} title="Compartir Equipos" description="Enviá la formación por WhatsApp." iconClassName="bg-[#25D366]"><Button variant="whatsapp" asChild className="w-full"><a href={`https://wa.me/?text=${whatsAppShareText}`} target="_blank" rel="noopener noreferrer">Compartir</a></Button></ActionCard>}
                        <ActionCard icon={Trash2} title="Eliminar Partido" description="Esta acción es permanente." iconClassName="bg-red-500">
                             <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="destructive" className="w-full" disabled={isDeleting}>Eliminar</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>¿Borrar este partido?</AlertDialogTitle><AlertDialogDescription>Esta acción es permanente y no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Eliminar</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                             </AlertDialog>
                        </ActionCard>
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
                    <MatchChronicleCard match={match} />
                </div>
                <div className="space-y-6">
                    <MatchChatView match={match} />
                </div>
            </div>
        </div>
    );
}
