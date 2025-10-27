
'use client';

import { useMemo, useState } from 'react';
import type { Match, Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, Edit, Trash2, MessageCircle, Navigation } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

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

const weatherImageMap: Record<string, { url: string; hint: string }> = {
    Sun: { url: 'https://picsum.photos/seed/sunny-day/1200/400', hint: 'sunny day' },
    Cloud: { url: 'https://picsum.photos/seed/cloudy-sky/1200/400', hint: 'cloudy sky' },
    Cloudy: { url: 'https://picsum.photos/seed/overcast/1200/400', hint: 'overcast sky' },
    CloudRain: { url: 'https://picsum.photos/seed/rainy-pitch/1200/400', hint: 'rainy pitch' },
    Wind: { url: 'https://picsum.photos/seed/windy-day/1200/400', hint: 'windy day' },
    Zap: { url: 'https://picsum.photos/seed/stormy-sky/1200/400', hint: 'stormy sky' },
    default: { url: 'https://picsum.photos/seed/football-stadium/1200/400', hint: 'football stadium' }
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
    const weatherImageData = weatherImageMap[match.weather?.icon || 'default'] || weatherImageMap.default;

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

            {/* Weather Image Header */}
            <div className="relative h-48 w-full rounded-xl overflow-hidden shadow-lg">
                <Image
                    src={weatherImageData.url}
                    alt={match.title}
                    fill
                    className="object-cover"
                    data-ai-hint={weatherImageData.hint}
                />
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute inset-0 flex flex-col justify-center items-center text-center text-white p-4">
                    <h1 className="text-4xl font-bold font-headline" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
                        {match.title}
                    </h1>
                </div>
            </div>

            {/* Match Info Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                    <Calendar className="h-6 w-6 text-muted-foreground mb-1"/>
                    <p className="font-bold text-sm">{format(new Date(match.date), "EEEE d MMM", { locale: es })}</p>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                    <Clock className="h-6 w-6 text-muted-foreground mb-1"/>
                    <p className="font-bold text-sm">{match.time} hs</p>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                    <MapPin className="h-6 w-6 text-muted-foreground mb-1"/>
                    <p className="font-bold text-sm truncate">{match.location.name}</p>
                </div>
                <Button asChild size="sm" className="h-full flex-col gap-1 p-2">
                    <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                         <Navigation className="h-6 w-6"/>
                         <span className="text-sm">Ir al mapa</span>
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Roster Column */}
                <div className="lg:col-span-2 space-y-6">
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
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {match.players.map((player, idx) => (
                                    <div key={`${player.uid}-${idx}`} className="flex flex-col items-center text-center p-3 gap-2 border rounded-lg">
                                        <Avatar className="h-16 w-16">
                                            <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-bold text-sm truncate w-24">{player.displayName}</p>
                                            <p className={cn("text-xs font-semibold", positionBadgeStyles[player.position])}>{player.position} / {player.ovr}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
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

                {/* Owner Actions Column */}
                {isOwner && (
                    <div className="lg:col-span-1 space-y-4">
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
                    </div>
                )}
            </div>
        </div>
    );
}
