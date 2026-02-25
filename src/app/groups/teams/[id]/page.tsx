
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import type { GroupTeam, Player, DetailedTeamPlayer, Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, ArrowLeft, ShieldCheck, UserCheck, History, Globe, Swords, Pencil, Trash2 } from 'lucide-react';
import { GroupTeamRosterPlayer } from '@/components/group-team-roster-player';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getUserRoleInGroupAction } from '@/lib/actions/group-role-actions';
import type { GroupRole } from '@/lib/group-permissions';
import { hasPermission } from '@/lib/group-permissions';
import { ManageRosterDialog } from '@/components/manage-roster-dialog';
import { EditTeamDialog } from '@/components/edit-team-dialog';
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
} from '@/components/ui/alert-dialog';

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
                <Button asChild variant="outline" className="mt-4">
                    <Link href="/groups">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a Grupos
                    </Link>
                </Button>
            </div>
        );
    }

    const memberCount = team.members?.length || 0;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex w-full items-center justify-between">
                <Button asChild variant="outline" className="self-start">
                    <Link href="/groups">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a Grupos
                    </Link>
                </Button>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
                {team.jersey && (
                    <div className="h-32 w-32 flex items-center justify-center overflow-hidden">
                        <JerseyPreview jersey={team.jersey} size="xl" />
                    </div>
                )}
                <div className="flex flex-col items-center gap-2">
                    <PageHeader title={team.name} className="justify-center text-center" />
                    <Badge variant="outline" className="text-sm">
                        {memberCount} Jugadores
                    </Badge>
                </div>
            </div>

            {canEditTeam && (
                <div className="flex gap-2 justify-center flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar Equipo
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Eliminar Equipo
                            </Button>
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
                                    Eliminar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}

            {isOwner && (
                <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Swords className="h-5 w-5 text-primary" />
                            Partidos y Competiciones
                        </CardTitle>
                        <CardDescription>
                            Gestioná las postulaciones y desafíos de tu equipo
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/competitions">
                                <Swords className="mr-2 h-4 w-4" />
                                Ir a Competiciones
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Próximos Partidos
                    </CardTitle>
                    <CardDescription>Agenda y desafíos del equipo</CardDescription>
                </CardHeader>
                <CardContent>
                    <UpcomingMatchesFeed matches={upcomingMatches} teamName={team.name} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                Titulares ({titulares.length})
                            </CardTitle>
                            <CardDescription>Jugadores confirmados en el once inicial</CardDescription>
                        </div>
                        {canEditTeam && (
                            <ManageRosterDialog team={team} players={[...titulares, ...suplentes]} allGroupPlayers={groupPlayers || []}>
                                <Button variant="secondary">Gestionar Plantel</Button>
                            </ManageRosterDialog>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {titulares.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {titulares.map((player: DetailedTeamPlayer, index: number) => (
                                <GroupTeamRosterPlayer key={player.id} player={player} team={team} onPlayerUpdate={handlePlayerUpdate} index={index} canEdit={canEditTeam} />
                            ))}
                        </div>
                    ) : (
                        <Alert variant="default">
                            <AlertTitle>Sin Titulares Definidos</AlertTitle>
                            <AlertDescription>
                                Aún no asignaste jugadores al equipo titular.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-muted-foreground" />
                        Suplentes ({suplentes.length})
                    </CardTitle>
                    <CardDescription>Alternativas disponibles para el partido</CardDescription>
                </CardHeader>
                <CardContent>
                    {suplentes.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {suplentes.map((player: DetailedTeamPlayer, index: number) => (
                                <GroupTeamRosterPlayer key={player.id} player={player} team={team} onPlayerUpdate={handlePlayerUpdate} index={index} canEdit={canEditTeam} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No hay jugadores suplentes definidos.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        Historial de Partidos
                    </CardTitle>
                    <CardDescription>Resultados previos del equipo</CardDescription>
                </CardHeader>
                <CardContent>
                    {pastMatches.length > 0 ? (
                        <div className="space-y-3">
                            {pastMatches.map(match => (
                                <Card key={match.id}>
                                    <CardHeader className="flex flex-row items-center justify-between p-4">
                                        <div>
                                            <CardTitle className="text-base">{match.title}</CardTitle>
                                            <CardDescription>{format(new Date(match.date), "dd MMM yyyy", { locale: es })}</CardDescription>
                                        </div>
                                        <Badge variant="outline">Finalizado</Badge>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Alert variant="default">
                            <AlertTitle>Sin Historial</AlertTitle>
                            <AlertDescription>
                                Este equipo todavía no ha jugado ningún partido.
                            </AlertDescription>
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
