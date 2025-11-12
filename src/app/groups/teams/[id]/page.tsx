
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where, updateDoc } from 'firebase/firestore';
import type { GroupTeam, Player, DetailedTeamPlayer, Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, ArrowLeft, ShieldCheck, UserCheck, History, Globe, Swords } from 'lucide-react';
import { TeamRosterPlayer } from '@/components/team-roster-player';
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

export default function TeamDetailPage() {
  const { id: teamId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

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
        match.teams?.some(t => t.name === team.name)
      );
      
      const upcoming = teamMatches
        .filter(m => m.status === 'upcoming' || m.status === 'active')
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const past = teamMatches
        .filter(m => m.status === 'completed' || m.status === 'evaluated')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
      return { upcomingMatches: upcoming, pastMatches: past };
  }, [allGroupMatches, team?.name]);

  const loading = teamLoading || playersLoading || matchesLoading;
  const isOwner = user?.uid === team?.createdBy;
  
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
    console.log("Player updated, parent should refresh if needed.");
  }

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
        
        <Separator />
        
        <UpcomingMatchesFeed matches={upcomingMatches} teamName={team.name} />
        
        {upcomingMatches.length > 0 && <Separator />}

        <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary"/> Titulares ({titulares.length})</h2>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {titulares.map((player: DetailedTeamPlayer) => (
                    <TeamRosterPlayer key={player.id} player={player} team={team} onPlayerUpdate={handlePlayerUpdate} />
                ))}
             </div>
             {titulares.length === 0 && (
                 <Alert variant="default">
                    <AlertTitle>Sin Titulares Definidos</AlertTitle>
                    <AlertDescription>
                        Aún no has asignado jugadores al equipo titular. Puedes hacerlo desde el menú de cada jugador.
                    </AlertDescription>
                </Alert>
            )}
        </div>
        
        <Separator />

        <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><UserCheck className="h-6 w-6 text-muted-foreground"/> Suplentes ({suplentes.length})</h2>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {suplentes.map((player: DetailedTeamPlayer) => (
                    <TeamRosterPlayer key={player.id} player={player} team={team} onPlayerUpdate={handlePlayerUpdate} />
                ))}
             </div>
             {suplentes.length === 0 && <p className="text-sm text-muted-foreground">No hay jugadores suplentes definidos.</p>}
        </div>
        
        <Separator />

        <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><History className="h-6 w-6 text-muted-foreground"/> Historial de Partidos</h2>
            {pastMatches.length > 0 ? (
                 <div className="space-y-3">
                    {pastMatches.map(match => (
                        <Card key={match.id}>
                            <CardHeader className="flex flex-row items-center justify-between p-4">
                                <div>
                                    <CardTitle className="text-base">{match.title}</CardTitle>
                                    <CardDescription>{format(new Date(match.date), "dd MMM yyyy", {locale: es})}</CardDescription>
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
        </div>

    </div>
  );
}
