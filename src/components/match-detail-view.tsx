
'use client';

import { useMemo, useState } from 'react';
import type { Match, Player, Evaluation, UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, Info, Edit, Trash2, CheckCircle, FileSignature, MessageCircle } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { MatchChatSheet } from './match-chat-sheet';
import { MatchTeamsDialog } from './match-teams-dialog';
import { TeamsIcon } from './icons/teams-icon';
import { cn } from '@/lib/utils';
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

interface MatchDetailViewProps {
  matchId: string;
}

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

export default function MatchDetailView({ matchId }: MatchDetailViewProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    const matchRef = useMemo(() => {
        if (!firestore || !matchId) return null;
        return doc(firestore, 'matches', matchId);
    }, [firestore, matchId]);
    
    const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);
    
    const isOwner = user?.uid === match?.ownerUid;

    const handleDeleteMatch = async () => {
        // Implement delete logic
        toast({ title: "Función no implementada", description: "La eliminación de partidos estará disponible pronto." });
    };

    if (matchLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (!match) {
        return (
            <div className="text-center p-8">
                <h2 className="text-xl font-bold">Partido no encontrado</h2>
                <p className="text-muted-foreground">El partido que buscas no existe o ha sido eliminado.</p>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/matches">Volver a Partidos</Link>
                </Button>
            </div>
        );
    }
    
    const statusInfo = statusConfig[match.status];
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}`;

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
                <Badge variant="outline" className={cn("text-sm", statusInfo.className)}>{statusInfo.label}</Badge>
            </PageHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Columna Izquierda - Información y Acciones */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalles del Evento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3"><Calendar className="h-5 w-5 text-muted-foreground mt-0.5"/><p className="font-bold">{format(new Date(match.date), "EEEE, d 'de' MMMM", { locale: es })}</p></div>
                            <div className="flex items-start gap-3"><Clock className="h-5 w-5 text-muted-foreground mt-0.5"/><p className="font-bold">{match.time} hs</p></div>
                            <div className="flex items-start gap-3"><MapPin className="h-5 w-5 text-muted-foreground mt-0.5"/><p className="font-bold">{match.location.name}</p></div>
                             <Button asChild size="sm" className="w-full">
                                <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                    Ir en Google Maps
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {isOwner && (
                        <Card>
                             <CardHeader>
                                <CardTitle>Acciones de DT</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button className="w-full" disabled><Edit className="mr-2 h-4 w-4"/>Editar Partido (Pronto)</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full" disabled={isDeleting}>
                                            <Trash2 className="mr-2 h-4 w-4"/>Eliminar Partido
                                        </Button>
                                    </AlertDialogTrigger>
                                     <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Borrar "{match.title}"?</AlertDialogTitle>
                                            <AlertDialogDescription>Esta acción es permanente y no se puede deshacer.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting}>
                                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Sí, eliminar'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                 {match.status === 'completed' && (
                                     <Button asChild className="w-full" variant="secondary">
                                        <Link href={`/matches/${matchId}/evaluate`}>
                                            <FileSignature className="mr-2 h-4 w-4"/>Supervisar Evaluaciones
                                        </Link>
                                    </Button>
                                 )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Columna Derecha - Jugadores y Equipos */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Plantel ({match.players.length} / {match.matchSize})</span>
                                <MatchChatSheet match={match}>
                                    <Button variant="outline">
                                        <MessageCircle className="mr-2 h-4 w-4"/>
                                        Chat del Partido
                                    </Button>
                                </MatchChatSheet>
                            </CardTitle>
                            <CardDescription>Lista de jugadores apuntados al partido.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-64">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-4">
                                    {match.players.map((player, idx) => (
                                        <div key={`${player.uid}-${idx}`} className="flex items-center gap-3 p-2 rounded-md border">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                                <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm truncate">{player.displayName}</p>
                                                <p className={cn("text-xs font-medium", positionBadgeStyles[player.position])}>{player.position}</p>
                                            </div>
                                            <Badge variant="secondary">{player.ovr}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {match.teams && match.teams.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>Equipos Generados</span>
                                     <MatchTeamsDialog match={match}>
                                        <Button variant="outline" size="sm">
                                            <TeamsIcon className="mr-2 h-4 w-4"/>Ver en Detalle
                                        </Button>
                                    </MatchTeamsDialog>
                                </CardTitle>
                                <CardDescription>Equipos balanceados por la IA.</CardDescription>
                            </CardHeader>
                            <CardContent>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {match.teams.map(team => (
                                        <div key={team.name} className="border p-4 rounded-lg">
                                            <h4 className="font-bold text-lg text-center mb-2">{team.name}</h4>
                                            <p className="text-center text-sm text-muted-foreground">OVR Promedio: <span className="font-bold text-foreground">{team.averageOVR.toFixed(1)}</span></p>
                                        </div>
                                    ))}
                               </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
