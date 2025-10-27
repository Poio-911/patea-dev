
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, Navigation, Sun, Cloud, Cloudy, CloudRain, Wind, Zap } from 'lucide-react';
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
import { WhatsAppIcon } from './icons/whatsapp-icon';
import { MatchChatView } from './match-chat-view';
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

const weatherIcons: Record<string, React.ElementType> = {
    Sun, Cloud, Cloudy, CloudRain, Wind, Zap,
};

const weatherImageMap: Record<string, string> = {
    Sun: 'sunny football pitch',
    Cloud: 'cloudy football pitch',
    Cloudy: 'overcast football pitch',
    CloudRain: 'rainy football pitch',
    Wind: 'windy football pitch',
    Zap: 'stormy football pitch',
};


export default function MatchDetailView({ matchId }: MatchDetailViewProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const matchRef = useMemo(() => {
        if (!firestore || !matchId) return null;
        return doc(firestore, 'matches', matchId);
    }, [firestore, matchId]);
    
    const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);
    
    const isOwner = user?.uid === match?.ownerUid;

    const googleMapsUrl = match ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}` : '';
    const WeatherIcon = match?.weather?.icon ? weatherIcons[match.weather.icon] : null;

    const handleShareTeams = () => {
        if (!match || !match.teams || match.teams.length < 2) {
            toast({ variant: 'destructive', title: 'Error', description: 'Los equipos aún no han sido generados.' });
            return;
        }

        const teamA = match.teams[0];
        const teamB = match.teams[1];

        const formatTeam = (team: any) => 
            `*${team.name} (OVR ${team.averageOVR.toFixed(1)})*\n` +
            team.players.map((p: any) => `- ${p.displayName} (OVR ${p.ovr})`).join('\n');

        const message = `*¡Equipos para el partido "${match.title}"!* ⚽\n\n${formatTeam(teamA)}\n\n${formatTeam(teamB)}`;
        
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
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

            <PageHeader title={match.title} />

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground border-t border-b py-3">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4"/>
                    <span className="font-semibold">{format(new Date(match.date), "EEEE d MMM, yyyy", { locale: es })}</span>
                </div>
                 <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4"/>
                    <span className="font-semibold">{match.time} hs</span>
                </div>
                {WeatherIcon && match.weather && (
                     <div className="flex items-center gap-2">
                        <WeatherIcon className="h-4 w-4 text-blue-400"/>
                        <span className="font-semibold">{match.weather.temperature}°C, {match.weather.description}</span>
                    </div>
                )}
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
                                {match.teams && match.teams.length > 0 && (
                                    <Button onClick={handleShareTeams} size="sm">
                                        <WhatsAppIcon className="mr-2 h-4 w-4"/>
                                        Compartir Equipos
                                    </Button>
                                )}
                            </CardTitle>
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
                                <CardTitle>Equipos Generados</CardTitle>
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
                <div className="space-y-6">
                    <MatchChatView match={match} />
                    <MatchChronicleCard match={match} />
                </div>
            </div>
        </div>
    );
}
