
'use client';

import { useMemo, useState } from 'react';
import type { Match, Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, Navigation, Sun, Cloud, Cloudy, CloudRain, Wind, Zap, MessageCircle } from 'lucide-react';
import { PageHeader } from './page-header';
import { Button } from './ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { MatchChatSheet } from './match-chat-sheet';
import { MatchTeamsDialog } from './match-teams-dialog';
import { TeamsIcon } from './icons/teams-icon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

const weatherImageMap: Record<string, { url: string; hint: string }> = {
    Sun: { url: 'https://picsum.photos/seed/sunny-pitch/1200/400', hint: 'sunny football' },
    Cloud: { url: 'https://picsum.photos/seed/cloudy-pitch/1200/400', hint: 'cloudy football' },
    Cloudy: { url: 'https://picsum.photos/seed/overcast-pitch/1200/400', hint: 'overcast football' },
    CloudRain: { url: 'https://picsum.photos/seed/rainy-pitch/1200/400', hint: 'rainy football' },
    Wind: { url: 'https://picsum.photos/seed/windy-pitch/1200/400', hint: 'windy football' },
    Zap: { url: 'https://picsum.photos/seed/stormy-pitch/1200/400', hint: 'stormy football' },
    default: { url: 'https://picsum.photos/seed/stadium-default/1200/400', hint: 'football stadium' }
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
    
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}`;
    const weatherImageData = weatherImageMap[match.weather?.icon || 'default'] || weatherImageMap.default;
    const WeatherIcon = match.weather?.icon ? weatherIcons[match.weather.icon] : null;

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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                 <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                    <Calendar className="h-6 w-6 text-muted-foreground mb-1"/>
                    <p className="font-bold text-sm capitalize">{format(new Date(match.date), "EEEE d MMM", { locale: es })}</p>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                    <Clock className="h-6 w-6 text-muted-foreground mb-1"/>
                    <p className="font-bold text-sm">{match.time} hs</p>
                </div>
                {WeatherIcon && match.weather && (
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                        <WeatherIcon className="h-6 w-6 text-muted-foreground mb-1 text-blue-400"/>
                        <p className="font-bold text-sm">{match.weather.temperature}°C</p>
                    </div>
                )}
                 <Button asChild size="sm" className="h-full flex-col gap-1 p-2">
                    <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                         <Navigation className="h-6 w-6"/>
                         <span className="text-sm">Ir al mapa</span>
                    </Link>
                </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-b py-2 px-4">
                <MapPin className="h-4 w-4"/>
                <span className="font-semibold">{match.location.name}</span>
                <span className="hidden sm:inline">- {match.location.address}</span>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-6">
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
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
            </div>
        </div>
    );
}
