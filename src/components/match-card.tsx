
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, UserProfile, Invitation, Jersey } from '@/lib/types';
import { doc, getDoc, query, where, collection } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatVenueName } from '@/lib/utils';
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
import { Calendar, Clock, MapPin, Trash2, CheckCircle, Eye, Loader2, UserPlus, LogOut, User, MessageCircle, FileSignature, MoreVertical, Users, UserCheck, Shuffle, UsersRound } from 'lucide-react';
import { InvitePlayerDialog } from './invite-player-dialog';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { MatchChatSheet } from './match-chat-sheet';
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
import { getMatchTheme, getMatchTypeLabel } from '@/lib/match-theme';
import { Trophy, Handshake } from 'lucide-react';
import { CountdownTimer } from './ui/countdown-timer';
import { MatchWeatherForecast } from './matches/match-weather-forecast';


type MatchCardProps = {
    match: Match;
    allPlayers: Player[];
};

const statusConfig: Record<Match['status'], { label: string; className: string; neonClass: string; gradientClass: string }> = {
    planning: {
        label: 'A Confirmar',
        className: 'bg-primary/5 text-primary border border-primary/20 rounded-full backdrop-blur-sm',
        neonClass: 'text-shadow-[0_0_6px_hsl(var(--primary))]',
        gradientClass: 'from-primary/10'
    },
    upcoming: {
        label: 'Próximo',
        className: 'bg-primary/10 text-foreground border border-primary/30 rounded-full backdrop-blur-sm',
        neonClass: 'text-shadow-[0_0_6px_hsl(var(--primary))]',
        gradientClass: 'from-primary/20'
    },
    active: {
        label: 'Activo',
        className: 'bg-foreground/10 text-foreground border border-foreground/30 rounded-full backdrop-blur-sm',
        neonClass: 'text-shadow-[0_0_6px_hsl(var(--foreground))]',
        gradientClass: 'from-foreground/20'
    },
    completed: {
        label: 'Finalizado',
        className: 'bg-muted/40 text-muted-foreground border border-muted/50 rounded-full backdrop-blur-sm',
        neonClass: 'text-shadow-[0_0_4px_hsl(var(--muted-foreground))]',
        gradientClass: 'from-muted-foreground/20'
    },
    evaluated: {
        label: 'Evaluado',
        className: 'bg-card/60 text-foreground border border-border rounded-full backdrop-blur-sm',
        neonClass: 'text-shadow-[0_0_6px_hsl(var(--chart-2))]',
        gradientClass: 'from-info/20'
    },
};

export function MatchCard({ match, allPlayers }: MatchCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [ownerName, setOwnerName] = useState<string | null>(null);

    // Get theme for this match type
    const matchTheme = getMatchTheme(match.type);

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
        <Card className={cn(
            "flex flex-col overflow-hidden shadow-lg transition-shadow duration-300 hover:shadow-primary/20 border"
        )}>
            <CardHeader className={cn('relative p-4 bg-gradient-to-br', matchTheme.gradient)}>
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className={cn("text-xl font-bold", currentStatus.neonClass)}>
                        {match.title}
                    </CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <CardDescription className="flex items-center gap-2 text-xs text-foreground/80">
                        <User className="h-3 w-3" /> Organizado por {ownerName || 'Cargando...'}
                    </CardDescription>
                    <Badge className={cn("text-xs", matchTheme.badge, matchTheme.badgeText, matchTheme.animate && "animate-pulse")}>
                        {matchTheme.icon === 'UserCheck' && <UserCheck className="mr-1.5 h-3 w-3" />}
                        {matchTheme.icon === 'Users' && <Users className="mr-1.5 h-3 w-3" />}
                        {matchTheme.icon === 'UsersRound' && <UsersRound className="mr-1.5 h-3 w-3" />}
                        {matchTheme.icon === 'Trophy' && <Trophy className="mr-1.5 h-3 w-3" />}
                        {matchTheme.icon === 'Handshake' && <Handshake className="mr-1.5 h-3 w-3" />}
                        {matchTheme.label}
                    </Badge>
                    <Badge className={cn("whitespace-nowrap uppercase text-xs z-10 px-2.5 py-0.5", currentStatus.className)}>
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

                {/* Countdown for upcoming matches */}
                {match.status === 'upcoming' && (
                    <CountdownTimer
                        targetDate={`${match.date}T${match.time.replace(' hs', '').replace('hs', '').trim()}`}
                        className="border-t pt-3 mt-3"
                    />
                )}

                <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                        <p className="text-xs text-muted-foreground">Lugar</p>
                        <p className="font-bold text-sm">{formatVenueName(match.location.name, match.location.address)}</p>
                    </div>
                </div>

                {match.weather && (
                    <div className="border-t pt-3 mt-3">
                        <MatchWeatherForecast match={match} compact />
                    </div>
                )}

                <Separator />

                {/* Type-specific information */}
                {match.type === 'collaborative' && (
                    <div className="space-y-2">
                        {/* Progress bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Cupos</span>
                                <span className="font-semibold">{match.players?.length || 0} / {match.matchSize}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-300 bg-primary"
                                    )}
                                    style={{ width: `${((match.players?.length || 0) / match.matchSize) * 100}%` }}
                                />
                            </div>
                        </div>
                        {/* Urgency badge */}
                        {match.status === 'upcoming' && match.matchSize - (match.players?.length || 0) <= 3 && match.matchSize - (match.players?.length || 0) > 0 && (
                            <Badge className="bg-card border text-foreground text-xs">
                                ¡Últimos {match.matchSize - (match.players?.length || 0)} lugares!
                            </Badge>
                        )}
                    </div>
                )}

                {/* League/Cup context */}
                {(match.type === 'league' || match.type === 'cup' || match.type === 'league_final') && match.leagueInfo && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                            <Trophy className="h-3.5 w-3.5 text-foreground" />
                            <span className="font-semibold text-foreground">
                                {match.type === 'league' ? 'Liga' : match.type === 'cup' ? 'Copa' : 'Competición'}
                            </span>
                        </div>
                        {match.type === 'league' && (
                            <p className="text-xs text-muted-foreground">
                                Fecha {match.leagueInfo.round}
                            </p>
                        )}
                        {match.type === 'cup' && (
                            <p className="text-xs text-muted-foreground">
                                {match.leagueInfo.round === 1 ? 'FINAL' :
                                    match.leagueInfo.round === 2 ? 'SEMIFINAL' :
                                        match.leagueInfo.round === 3 ? 'CUARTOS DE FINAL' :
                                            `Ronda ${match.leagueInfo.round}`}
                            </p>
                        )}
                        {match.type === 'league_final' && (
                            <Badge className="bg-card border text-foreground text-xs font-bold">
                                ⚡ DEFINITORIO ⚡
                            </Badge>
                        )}
                    </div>
                )}

                {(match.type === 'by_teams' || match.type === 'league' || match.type === 'cup' || match.type === 'league_final') && match.teams && match.teams.length === 2 ? (
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
                                <UsersRound className="mr-2 h-4 w-4" />
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
