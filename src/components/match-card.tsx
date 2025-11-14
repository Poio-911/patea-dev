
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, UserProfile, Invitation, Jersey } from '@/lib/types';
import { doc, getDoc, query, where, collection } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MatchTeamsDialog } from '@/components/match-teams-dialog';
import { EditableTeamsDialog } from '@/components/editable-teams-dialog';
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
import { Calendar, Clock, MapPin, Trash2, CheckCircle, Eye, Loader2, UserPlus, LogOut, Sun, Cloud, Cloudy, CloudRain, Wind, Zap, User, MessageCircle, FileSignature, MoreVertical, Users, UserCheck, Shuffle } from 'lucide-react';
import { InvitePlayerDialog } from './invite-player-dialog';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { MatchChatSheet } from './match-chat-sheet';
import { TeamsIcon } from '@/components/icons/teams-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { JerseyPreview } from './team-builder/jersey-preview';
import { useMatchActions } from '@/hooks/use-match-actions';
import { useMatchPermissions } from '@/hooks/use-match-permissions';


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

export function MatchCard({ match, allPlayers }: MatchCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [ownerName, setOwnerName] = useState<string | null>(null);

    const permissions = useMatchPermissions(match, user?.uid);
    const { isOwner, isUserInMatch } = permissions;

    const actions = useMatchActions({
        match,
        firestore,
        userId: user?.uid,
        userDisplayName: user?.displayName ?? undefined,
        allGroupPlayers: allPlayers,
        isUserInMatch,
    });
    const { isJoining, handleJoinOrLeave } = actions;
    
    useEffect(() => {
        const fetchOwnerName = async () => {
            if (!firestore) return;
            const ownerInGroup = allPlayers.find(p => p.id === match.ownerUid);
            if (ownerInGroup) {
                setOwnerName(ownerInGroup.name);
            } else {
                try {
                    const userDocRef = doc(firestore, 'users', match.ownerUid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as UserProfile;
                        setOwnerName(userData.displayName || 'Organizador');
                    } else {
                        setOwnerName('Organizador');
                    }
                } catch {
                    setOwnerName('Organizador');
                }
            }
        };

        fetchOwnerName();
    }, [firestore, match.ownerUid, allPlayers]);


    const isMatchFull = useMemo(() => {
        if (!match.players) return true;
        return match.players.length >= match.matchSize;
    }, [match.players, match.matchSize]);


    const currentStatus = statusConfig[match.status] || statusConfig.completed;
    
    const WeatherIcon = match.weather?.icon ? weatherIcons[match.weather.icon] : null;

    const JoinLeaveButton = () => {
        if (match.type === 'collaborative' && match.status === 'upcoming') {
            if (isMatchFull && !isUserInMatch) {
                return <Button variant="outline" size="sm" className="w-full" disabled>Partido Lleno</Button>;
            }
            return (
                <Button variant={isUserInMatch ? 'secondary' : 'default'} size="sm" onClick={handleJoinOrLeave} disabled={isJoining} className="w-full">
                    {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isUserInMatch ? <LogOut className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                    {isUserInMatch ? 'Darse de baja' : 'Apuntarse'}
                </Button>
            );
        }
        return null;
    };

    return (
        <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
            <CardHeader className={cn('relative gradient-primary p-4', currentStatus.gradientClass)}>
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className={cn("text-xl font-bold", currentStatus.neonClass)}>
                        {match.title}
                    </CardTitle>
                </div>
                 <div className="flex items-center gap-2 flex-wrap">
                    <CardDescription className="flex items-center gap-2 text-xs text-foreground/80">
                        <User className="h-3 w-3"/> Organizado por {ownerName || 'Cargando...'}
                    </CardDescription>
                    <Badge variant="secondary" className="capitalize text-xs">
                        {match.type === 'manual' ? <UserCheck className="mr-1.5 h-3 w-3"/> : match.type === 'by_teams' ? <TeamsIcon className="mr-1.5 h-3 w-3" /> : <Users className="mr-1.5 h-3 w-3"/>}
                        {match.type === 'by_teams' ? 'Por Equipos' : match.type}
                    </Badge>
                     <Badge variant="outline" className={cn("whitespace-nowrap uppercase text-xs z-10", currentStatus.className)}>
                        {currentStatus.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-4 p-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Fecha</p>
                            <p className="font-bold text-sm capitalize">{format(new Date(match.date), "EEEE, d 'de' MMMM", { locale: es })}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Hora</p>
                            <p className="font-bold text-sm">{match.time} hs</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5"/>
                    <div>
                        <p className="text-xs text-muted-foreground">Lugar</p>
                        <p className="font-bold text-sm">{match.location.name || match.location.address}</p>
                    </div>
                </div>

                {WeatherIcon && match.weather && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3 mt-3">
                        <WeatherIcon className="h-4 w-4 text-blue-400" />
                        <span>{match.weather.description} ({match.weather.temperature}°C)</span>
                    </div>
                )}
                
                <Separator />
                
                {match.type === 'by_teams' && match.teams && match.teams.length === 2 ? (
                     <div className="flex items-center justify-around gap-2 text-center">
                        <div className="flex flex-col items-center gap-2">
                           <JerseyPreview jersey={match.teams[0].jersey} size="sm" />
                           <p className="text-sm font-semibold truncate max-w-[100px]">{match.teams[0].name}</p>
                        </div>
                        <p className="text-sm font-bold text-muted-foreground">vs</p>
                        <div className="flex flex-col items-center gap-2">
                            <JerseyPreview jersey={match.teams[1].jersey} size="sm" />
                           <p className="text-sm font-semibold truncate max-w-[100px]">{match.teams[1].name}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-5 w-5" />
                        <span className="text-xl font-bold text-foreground">{match.players?.length || 0} / {match.matchSize}</span>
                        <span className="text-sm">Jugadores</span>
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-2 p-3 bg-muted/50 mt-auto">
                 <div className="flex gap-2">
                    <Button asChild className="w-full">
                        <Link href={`/matches/${match.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalles
                        </Link>
                    </Button>
                     {match.teams && match.teams.length > 0 && (
                        <MatchTeamsDialog match={match}>
                             <Button variant="secondary" className="w-full">
                                <TeamsIcon className="mr-2 h-4 w-4" />
                                Equipos
                             </Button>
                        </MatchTeamsDialog>
                    )}
                </div>
                 <JoinLeaveButton />
            </CardFooter>
        </Card>
    );
}
