
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
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Calendar, Clock, MapPin, Trash2, CheckCircle, Eye, Loader2, UserPlus, LogOut, User, FileSignature, MoreVertical, Users, UserCheck, Shuffle, UsersRound, Shirt, Globe } from 'lucide-react';
import { InvitePlayerDialog } from './invite-player-dialog';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
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

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    planning: {
        label: 'A Confirmar',
        className: 'bg-muted text-muted-foreground border-border',
    },
    upcoming: {
        label: 'Próximo',
        className: 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/40',
    },
    active: {
        label: 'Activo',
        className: 'bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/30 dark:text-green-200 dark:border-green-400/40',
    },
    completed: {
        label: 'Finalizado',
        className: 'bg-muted/50 text-muted-foreground border-border/50',
    },
    evaluated: {
        label: 'Evaluado',
        className: 'bg-secondary text-secondary-foreground border-border',
    },
};

function PlayerAvatarStack({ players, maxVisible = 5, matchSize }: {
    players: { uid: string; displayName: string; photoURL: string }[];
    maxVisible?: number;
    matchSize: number;
}) {
    if (!players || players.length === 0) return null;

    // Fix: Filter duplicates by uid to avoid key collision
    const uniquePlayers = Array.from(new Map(players.map(p => [p.uid, p])).values());
    const visible = uniquePlayers.slice(0, maxVisible);
    const extra = uniquePlayers.length - maxVisible;

    return (
        <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
                {visible.map(p => (
                    <div key={p.uid} className="w-6 h-6 rounded-full border-2 border-background dark:border-white/20 overflow-hidden flex-shrink-0">
                        {p.photoURL
                            ? <img src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                                {p.displayName?.[0]?.toUpperCase()}
                            </div>
                        }
                    </div>
                ))}
            </div>
            {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
            <span className="text-xs text-muted-foreground ml-1">{uniquePlayers.length}/{matchSize}</span>
        </div>
    );
}

export function MatchCard({ match, allPlayers }: MatchCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [ownerName, setOwnerName] = useState<string | null>(null);
    const [ownerPhoto, setOwnerPhoto] = useState<string | null>(null);

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

    // Compute unique players once for the whole component
    const uniquePlayers = useMemo(() => {
        if (!match.players) return [];
        return Array.from(new Map(match.players.map(p => [p.uid, p])).values());
    }, [match.players]);

    useEffect(() => {
        const fetchOwnerName = async () => {
            if (!firestore) return;
            const ownerInGroup = allPlayers.find(p => p.id === match.ownerUid);
            if (ownerInGroup) {
                setOwnerName(ownerInGroup.name);
                setOwnerPhoto((ownerInGroup as any).photoUrl || (ownerInGroup as any).photoURL || null);
            } else {
                try {
                    const userDocRef = doc(firestore, 'users', match.ownerUid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as UserProfile;
                        setOwnerName(userData.displayName || 'Organizador');
                        setOwnerPhoto(userData.photoURL || null);
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
                return (
                    <Button variant="outline" size="sm" className="w-full bg-white/10 text-white/50 border-white/20" disabled>
                        Partido Lleno
                    </Button>
                );
            }
            return (
                <Button
                    variant={isUserInMatch ? 'secondary' : 'default'}
                    size="sm"
                    onClick={handleJoinOrLeave}
                    disabled={isJoining}
                    className="w-full"
                >
                    {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isUserInMatch ? <LogOut className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                    {isUserInMatch ? 'Darse de baja' : 'Apuntarse'}
                </Button>
            );
        }
        return null;
    };

    const showAvatarStack = match.type !== 'by_teams' && match.players && match.players.length > 0;

    return (
        <Card
            className={cn(
                "flex flex-col shadow-xl relative",
                "transition-all duration-300",
                "hover:shadow-2xl hover:scale-[1.01]",
                "bg-gradient-to-br",
                matchTheme.gradient,
                matchTheme.border,
            )}
        >
            {/* Pitch texture overlay - Subtle and only in Dark/Game mode */}
            <div className="absolute inset-0 pitch-texture pointer-events-none opacity-0 dark:opacity-5 z-0" />


            <CardHeader className="relative z-10 p-4 pb-3">
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-xl font-bold">
                        {match.title}
                    </CardTitle>
                </div>

                {/* Organizer row */}
                <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0 border border-border">
                        {ownerPhoto
                            ? <img src={ownerPhoto} alt={ownerName ?? ''} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                        }
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                        {ownerName || 'Cargando...'}
                    </span>
                </div>

                {/* Types & Status Indicators - Cleaner Integration */}
                <div className="flex items-center gap-2 mt-2">
                    {/* Match Type - Stylized Icon Tag */}
                    <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase border bg-background/50 backdrop-blur-sm shadow-sm transition-all",
                        matchTheme.border,
                        (match.type === 'league' || match.type === 'cup' || match.type === 'league_final') && "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-200"
                    )}>
                        <div className={cn("p-0.5 rounded", matchTheme.badge)}>
                            {matchTheme.icon === 'UserCheck' && <UserCheck className="h-3 w-3" />}
                            {matchTheme.icon === 'Users' && <Users className="h-3 w-3" />}
                            {matchTheme.icon === 'Shirt' && <Shirt className="h-3 w-3" />}
                            {matchTheme.icon === 'Trophy' && <Trophy className="h-3 w-3" />}
                            {matchTheme.icon === 'Handshake' && <Handshake className="h-3 w-3" />}
                            {matchTheme.icon === 'Globe' && <Globe className="h-3 w-3" />}
                        </div>
                        <span className="opacity-90">{matchTheme.label}</span>
                    </div>

                    {/* Status Indicator */}
                    <div className={cn(
                        "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider",
                        currentStatus.className
                    )}>
                        {match.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />}
                        {currentStatus.label}
                    </div>
                </div>
            </CardHeader>

            {/* Content area - Adaptive glass look - Aligned with header padding */}
            <div className="relative z-10 mx-0 rounded-xl bg-background/40 dark:bg-black/20 backdrop-blur-md border border-border/50 dark:border-white/5 p-4 py-3 mb-0 flex-grow space-y-3">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Fecha</p>
                            <p className="font-bold text-sm capitalize">{format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</p>
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
                        className="border-t border-white/10 pt-3 mt-3"
                    />
                )}

                <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                        <p className="text-xs text-muted-foreground">Lugar</p>
                        <p className="font-bold text-sm">{formatVenueName(match.location.name, match.location.address)}</p>
                    </div>
                </div>

                {/* Inline weather */}
                {match.weather && (
                    <MatchWeatherForecast match={match} compact />
                )}

                {/* Player avatar stack */}
                {showAvatarStack && (
                    <PlayerAvatarStack
                        players={match.players}
                        maxVisible={5}
                        matchSize={match.matchSize}
                    />
                )}

                <Separator className="opacity-20 dark:opacity-10" />

                {/* Type-specific information */}
                {match.type === 'collaborative' && (
                    <div className="space-y-2">
                        {/* Progress bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Cupos</span>
                                <span className="font-semibold">{uniquePlayers.length} / {match.matchSize}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all duration-300 bg-primary/60 dark:bg-white/60"
                                    style={{ width: `${(uniquePlayers.length / match.matchSize) * 100}%` }}
                                />
                            </div>
                        </div>
                        {/* Urgency badge */}
                        {match.status === 'upcoming' && match.matchSize - uniquePlayers.length <= 3 && match.matchSize - uniquePlayers.length > 0 && (
                            <Badge variant="outline" className="text-[10px] py-0">
                                ¡Últimos {match.matchSize - uniquePlayers.length} lugares!
                            </Badge>
                        )}
                    </div>
                )}

                {/* League/Cup context */}
                {(match.type === 'league' || match.type === 'cup' || match.type === 'league_final') && match.leagueInfo && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold text-muted-foreground">
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
                            <Badge className="bg-white/10 border border-white/20 text-white text-xs font-bold">
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
                        <span className="text-xl font-bold text-foreground">{uniquePlayers.length} / {match.matchSize}</span>
                        <span className="text-sm">Jugadores</span>
                    </div>
                )}
            </div>

            <CardFooter className="relative z-10 flex flex-col items-stretch gap-2 p-3 mt-2">
                <div className="flex gap-2">
                    <Button
                        asChild
                        className={cn("w-full font-semibold", matchTheme.button)}
                    >
                        <Link href={`/matches/${match.id}`}>
                            <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                        </Link>
                    </Button>
                    {match.teams && match.teams.length > 0 && (
                        <MatchTeamsDialog match={match}>
                            <Button variant="outline" className="w-full">
                                <UsersRound className="mr-2 h-4 w-4" /> Equipos
                            </Button>
                        </MatchTeamsDialog>
                    )}
                </div>
                <JoinLeaveButton />
            </CardFooter>
        </Card>
    );
}
