
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Match, Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Users, Navigation, Sun, Cloud, Cloudy, CloudRain, Wind, Zap, User, FileSignature, Share2, MessageCircle } from 'lucide-react';
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

interface MatchDetailViewProps {
  matchId: string;
}

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

    const matchRef = useMemo(() => {
        if (!firestore || !matchId) return null;
        return doc(firestore, 'matches', matchId);
    }, [firestore, matchId]);
    
    const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);
    
    const isOwner = user?.uid === match?.ownerUid;

    const googleMapsUrl = match ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}` : '';

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
                 <Badge variant="default" className="text-base py-1 px-3">
                    <Calendar className="mr-2 h-4 w-4"/>
                    <span className="font-semibold">{format(new Date(match.date), "EEEE, d 'de' MMMM", { locale: es })}</span>
                </Badge>
                 <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4"/>
                    <span className="font-semibold">{match.time} hs</span>
                </div>
                 <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-semibold">Organiza: {match.ownerUid === user?.uid ? 'Vos' : 'Otro'}</span>
                </div>
                <div className="flex items-center gap-2">
                     <Badge variant="outline" className="capitalize">
                        {match.type === 'by_teams' ? 'Por Equipos' : match.type}
                     </Badge>
                </div>
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
                                    <Button onClick={handleShareTeams} size="sm" variant="outline">
                                        <WhatsAppIcon className="mr-2 h-4 w-4"/>
                                        Compartir Equipos
                                    </Button>
                                )}
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
                                                <div className="space-y-2">
                                                    {team.players.map(player => (
                                                        <div key={player.uid} className="flex items-center gap-3 p-2 border-b last:border-b-0">
                                                             <Avatar className="h-9 w-9">
                                                                <AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoUrl} alt={player.displayName} />
                                                                <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-semibold text-sm">{player.displayName}</p>
                                                                <p className={cn("text-xs", positionBadgeStyles[player.position])}>{player.position} / {player.ovr}</p>
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
