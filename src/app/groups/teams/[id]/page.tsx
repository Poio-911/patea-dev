
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where, deleteDoc } from 'firebase/firestore';
import type { GroupTeam, Player, DetailedTeamPlayer, Match, Cup, League } from '@/lib/types';
import { Loader2, ShieldCheck, UserCheck, History, Swords, Pencil, Trash2, MoreVertical, Users, CalendarDays, CheckCircle2, XCircle, Minus } from 'lucide-react';
import { BackButton } from '@/components/navigation/back-button';
import { TeamTrophiesSection } from '@/components/teams/TeamTrophiesSection';
import { GroupTeamRosterPlayer } from '@/components/group-team-roster-player';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getUserRoleInGroupAction } from '@/lib/actions/group-role-actions';
import type { GroupRole } from '@/lib/group-permissions';
import { hasPermission } from '@/lib/group-permissions';
import { ManageRosterDialog } from '@/components/manage-roster-dialog';
import { EditTeamDialog } from '@/components/edit-team-dialog';
import {
    ResponsiveAlertDialog as AlertDialog,
    ResponsiveAlertDialogAction as AlertDialogAction,
    ResponsiveAlertDialogCancel as AlertDialogCancel,
    ResponsiveAlertDialogContent as AlertDialogContent,
    ResponsiveAlertDialogDescription as AlertDialogDescription,
    ResponsiveAlertDialogFooter as AlertDialogFooter,
    ResponsiveAlertDialogHeader as AlertDialogHeader,
    ResponsiveAlertDialogTitle as AlertDialogTitle,
    ResponsiveAlertDialogTrigger as AlertDialogTrigger,
} from '@/components/ui/responsive-alert-dialog';
import {
    ResponsiveDropdownMenu,
    ResponsiveDropdownMenuContent,
    ResponsiveDropdownMenuItem,
    ResponsiveDropdownMenuSeparator,
    ResponsiveDropdownMenuTrigger,
    ResponsiveDropdownMenuLabel,
} from '@/components/ui/responsive-dropdown-menu';

export default function TeamDetailPage() {
    const params = useParams<{ id: string }>();
    const teamId = params?.id;
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<GroupRole | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const teamRef = useMemo(() => {
        if (!firestore || !teamId) return null;
        return doc(firestore, 'teams', teamId as string);
    }, [firestore, teamId]);

    const { data: team, loading: teamLoading, error: teamError } = useDoc<GroupTeam>(teamRef);

    const groupPlayersQuery = useMemo(() => {
        if (!firestore || !team?.groupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', team.groupId));
    }, [firestore, team?.groupId]);
    const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);

    const groupMatchesQuery = useMemo(() => {
        if (!firestore || !team?.groupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('groupId', '==', team.groupId)
        );
    }, [firestore, team?.groupId]);

    const { data: allGroupMatches, loading: matchesLoading } = useCollection<Match>(groupMatchesQuery);

    // Query for cup championships
    const cupChampionshipsQuery = useMemo(() => {
        if (!firestore || !teamId) return null;
        return query(
            collection(firestore, 'cups'),
            where('championTeamId', '==', teamId),
            where('status', '==', 'completed')
        );
    }, [firestore, teamId]);

    const { data: championCups } = useCollection<Cup>(cupChampionshipsQuery);

    // Query for league championships
    const leagueChampionshipsQuery = useMemo(() => {
        if (!firestore || !teamId) return null;
        return query(
            collection(firestore, 'leagues'),
            where('championTeamId', '==', teamId),
            where('status', '==', 'completed')
        );
    }, [firestore, teamId]);

    const { data: championLeagues } = useCollection<League>(leagueChampionshipsQuery);

    const { upcomingMatches, pastMatches } = useMemo(() => {
        if (!allGroupMatches || !team?.name) return { upcomingMatches: [], pastMatches: [] };

        const teamMatches = allGroupMatches.filter(match =>
            Array.isArray(match.teams) && match.teams.some(t => t.name === team.name)
        );

        const upcoming = teamMatches
            .filter(m => m.status === 'upcoming' || m.status === 'active')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const past = teamMatches
            .filter(m => m.status === 'completed' || m.status === 'evaluated')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return { upcomingMatches: upcoming, pastMatches: past };
    }, [allGroupMatches, team?.name]);

    const loading = teamLoading || playersLoading || matchesLoading;
    const isOwner = user?.uid === team?.createdBy;

    useEffect(() => {
        const fetchRole = async () => {
            if (!team?.groupId || !user?.uid) return;
            try {
                const result = await getUserRoleInGroupAction(team.groupId);
                if (result.success && result.role) {
                    setCurrentUserRole(result.role);
                }
            } catch (e) {
                console.error('Error fetching user role in group:', e);
            }
        };
        fetchRole();
    }, [team?.groupId, user?.uid]);

    const canEditTeam = isOwner || (currentUserRole ? hasPermission(currentUserRole, 'teams.edit') : false);

    const { titulares, suplentes } = useMemo(() => {
        if (loading || !team || !groupPlayers || !team.members) return { titulares: [], suplentes: [] };

        const detailedPlayers: DetailedTeamPlayer[] = team.members
            .map((member) => {
                const playerDetails = groupPlayers.find((p: Player) => p.id === member.playerId);
                if (!playerDetails) return null;
                return {
                    ...playerDetails,
                    number: member.number !== undefined ? member.number : 0,
                    status: member.status || 'titular'
                };
            })
            .filter((p): p is DetailedTeamPlayer => p !== null)
            .sort((a: DetailedTeamPlayer, b: DetailedTeamPlayer) => a.number - b.number);

        return {
            titulares: detailedPlayers.filter(p => p.status === 'titular'),
            suplentes: detailedPlayers.filter(p => p.status === 'suplente'),
        }

    }, [team, groupPlayers, loading]);

    const handlePlayerUpdate = () => {
    }

    const handleDeleteTeam = async () => {
        if (!firestore || !teamId) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'teams', teamId as string));
            toast({ title: 'Equipo eliminado', description: `"${team?.name}" fue eliminado correctamente.` });
            router.push('/groups');
        } catch (error) {
            console.error('Error deleting team:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el equipo.' });
            setIsDeleting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (!team || teamError) {
        return (
            <div className="text-center p-8">
                <h2 className="text-xl font-bold">Equipo no encontrado</h2>
                <div className="mt-4">
                    <BackButton href="/groups" label="Volver a Grupos" />
                </div>
            </div>
        );
    }

    const memberCount = team.members?.length || 0;

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Back navigation */}
            <BackButton href="/groups" label="Volver a Grupos" />

            {/* ── Editorial Header ── */}
            <div className="flex flex-row items-start gap-4">
                {/* Jersey */}
                <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 flex items-center justify-center">
                    <JerseyPreview jersey={team.jersey} size="xl" />
                </div>

                {/* Info + actions */}
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                        <h1 className="text-2xl md:text-3xl font-black sport-text leading-tight tracking-tight text-foreground truncate">
                            {team.name}
                        </h1>

                        {/* Actions dropdown — only for owners/admins */}
                        {canEditTeam && (
                            <ResponsiveDropdownMenu>
                                <ResponsiveDropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </ResponsiveDropdownMenuTrigger>
                                <ResponsiveDropdownMenuContent align="end">
                                    <ResponsiveDropdownMenuLabel>Equipo</ResponsiveDropdownMenuLabel>
                                    <ResponsiveDropdownMenuSeparator />
                                    <ResponsiveDropdownMenuItem
                                        disableAutoClose
                                        onClick={() => setIsEditOpen(true)}
                                        className="gap-2"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Editar Equipo
                                    </ResponsiveDropdownMenuItem>
                                    <ResponsiveDropdownMenuSeparator />
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <ResponsiveDropdownMenuItem
                                                disableAutoClose
                                                className="gap-2 text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Eliminar Equipo
                                            </ResponsiveDropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Eliminar "{team.name}"?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción no se puede deshacer. El equipo y su configuración se eliminarán permanentemente.
                                                    Los partidos anteriores no se verán afectados.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={handleDeleteTeam}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                    Eliminar
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </ResponsiveDropdownMenuContent>
                            </ResponsiveDropdownMenu>
                        )}
                    </div>

                    {/* Meta badges */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {memberCount} jugadores
                        </span>
                    </div>

                    {/* Champion trophies */}
                    <TeamTrophiesSection
                        cups={championCups || []}
                        leagues={championLeagues || []}
                    />
                </div>
            </div>

            {/* Competitions shortcut — for owner */}
            {isOwner && (
                <Card className="border-primary/20 bg-gradient-to-r from-primary/8 to-transparent">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <Swords className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">Competiciones</p>
                                <p className="text-xs text-muted-foreground">Postulaciones y desafíos</p>
                            </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                            <Link href="/competitions">
                                Ir a Competiciones
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Upcoming matches */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        Próximos Partidos
                    </CardTitle>
                    <CardDescription>Agenda y desafíos del equipo</CardDescription>
                </CardHeader>
                <CardContent>
                    <UpcomingMatchesFeed matches={upcomingMatches} teamName={team.name} />
                </CardContent>
            </Card>

            {/* ── Roster tabs ── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                Plantel
                            </CardTitle>
                            <CardDescription>{titulares.length} titulares · {suplentes.length} suplentes</CardDescription>
                        </div>
                        {canEditTeam && (
                            <ManageRosterDialog team={team} players={[...titulares, ...suplentes]} allGroupPlayers={groupPlayers || []}>
                                <Button variant="secondary" size="sm">Gestionar</Button>
                            </ManageRosterDialog>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <Tabs defaultValue="titulares">
                        <TabsList className="w-full mb-4">
                            <TabsTrigger value="titulares" className="flex-1">
                                <ShieldCheck className="h-4 w-4 mr-1.5" />
                                Titulares ({titulares.length})
                            </TabsTrigger>
                            <TabsTrigger value="suplentes" className="flex-1">
                                <UserCheck className="h-4 w-4 mr-1.5" />
                                Suplentes ({suplentes.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="titulares">
                            {titulares.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {titulares.map((player: DetailedTeamPlayer, index: number) => (
                                        <GroupTeamRosterPlayer key={player.id} player={player} team={team} onPlayerUpdate={() => { }} index={index} canEdit={canEditTeam} />
                                    ))}
                                </div>
                            ) : (
                                <Alert>
                                    <AlertTitle>Sin Titulares</AlertTitle>
                                    <AlertDescription>Aún no asignaste jugadores al once inicial.</AlertDescription>
                                </Alert>
                            )}
                        </TabsContent>

                        <TabsContent value="suplentes">
                            {suplentes.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {suplentes.map((player: DetailedTeamPlayer, index: number) => (
                                        <GroupTeamRosterPlayer key={player.id} player={player} team={team} onPlayerUpdate={() => { }} index={index} canEdit={canEditTeam} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No hay jugadores suplentes.</p>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* ── Match History ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        Historial de Partidos
                    </CardTitle>
                    <CardDescription>Resultados previos del equipo</CardDescription>
                </CardHeader>
                <CardContent>
                    {pastMatches.length > 0 ? (
                        <div className="space-y-2">
                            {pastMatches.slice(0, 10).map(match => {
                                // finalScore lives directly on the match, not match.result
                                const score = match.finalScore as { team1: number; team2: number } | undefined;
                                const teamIndex = match.teams?.findIndex(t => t.name === team.name) ?? -1;
                                const opponentIndex = teamIndex === 0 ? 1 : 0;
                                const opponent = match.teams?.[opponentIndex];

                                // team.finalScore (per-team) takes priority; fallback to match.finalScore by index
                                const teamGoals: number | null = (() => {
                                    if (match.teams?.[teamIndex]?.finalScore != null) return match.teams[teamIndex].finalScore!;
                                    if (score != null && teamIndex !== -1) return teamIndex === 0 ? score.team1 : score.team2;
                                    return null;
                                })();
                                const opponentGoals: number | null = (() => {
                                    if (match.teams?.[opponentIndex]?.finalScore != null) return match.teams[opponentIndex].finalScore!;
                                    if (score != null && teamIndex !== -1) return opponentIndex === 0 ? score.team1 : score.team2;
                                    return null;
                                })();

                                const hasResult = teamGoals !== null && opponentGoals !== null;
                                const won = hasResult && teamGoals! > opponentGoals!;
                                const lost = hasResult && teamGoals! < opponentGoals!;

                                return (
                                    <Link key={match.id} href={`/matches/${match.id}`} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-accent/50 transition-colors">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${won ? 'bg-green-500/15' : lost ? 'bg-red-500/15' : 'bg-muted'
                                            }`}>
                                            {won ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                                                lost ? <XCircle className="h-4 w-4 text-red-500" /> :
                                                    <Minus className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{match.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(match.date), "dd MMM yyyy", { locale: es })}
                                            </p>
                                        </div>
                                        {hasResult && (
                                            <span className={`font-bold text-sm tabular-nums ${won ? 'text-green-500' : lost ? 'text-red-500' : 'text-muted-foreground'
                                                }`}>
                                                {teamGoals} - {opponentGoals}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <Alert>
                            <AlertTitle>Sin Historial</AlertTitle>
                            <AlertDescription>Este equipo todavía no ha jugado ningún partido.</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {canEditTeam && (
                <EditTeamDialog open={isEditOpen} onOpenChange={setIsEditOpen} team={team} />
            )}
        </div>
    );
}
