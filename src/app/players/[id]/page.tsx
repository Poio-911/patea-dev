'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { Player, Evaluation, Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart2, Star, Goal } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMemo } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

type OvrHistory = {
    date: string;
    oldOVR: number;
    newOVR: number;
    change: number;
    matchId: string;
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'text-red-400',
  MED: 'text-green-400',
  DEF: 'text-blue-400',
  POR: 'text-orange-400',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);


export default function PlayerDetailPage() {
  const { id: playerId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();

  const playerRef = useMemo(() => firestore && playerId ? doc(firestore, 'players', playerId as string) : null, [firestore, playerId]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  // Fetch evaluations for this player
  const evaluationsQuery = useMemo(() => {
    if (!firestore || !playerId || !user?.activeGroupId) return null;
    return query(
      collection(firestore, `evaluations`),
      where('playerId', '==', playerId),
      // We can't query by groupId directly on evaluations, so we'll filter later
    );
  }, [firestore, playerId, user?.activeGroupId]);
  const { data: evaluations, loading: evaluationsLoading } = useCollection<Evaluation>(evaluationsQuery);

  // Fetch all matches from the group to correlate evaluations
  const matchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('groupId', '==', user?.activeGroupId),
      where('status', '==', 'evaluated')
    );
  }, [firestore, user?.activeGroupId]);
  const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);
  
  // Fetch OVR progression history
  const ovrHistoryQuery = useMemo(() => {
    if (!firestore || !playerId) return null;
    return query(collection(firestore, 'players', playerId as string, 'ovrHistory'), orderBy('date', 'asc'));
  }, [firestore, playerId]);
  const { data: ovrHistory, loading: historyLoading } = useCollection<OvrHistory>(ovrHistoryQuery);


  const filteredEvaluations = useMemo(() => {
    if (!evaluations || !matches) return [];
    const matchIdsInGroup = new Set(matches.map(m => m.id));
    
    const evalsByMatch: Record<string, { ratings: number[], goals: number }> = {};

    evaluations.forEach(ev => {
      const matchForEval = matches.find(m => m.id === ev.matchId);
      if (matchForEval) {
          if (!evalsByMatch[ev.matchId]) {
              evalsByMatch[ev.matchId] = { ratings: [], goals: 0 };
          }
          evalsByMatch[ev.matchId].ratings.push(ev.rating);
          evalsByMatch[ev.matchId].goals += ev.goals;
      }
    });

    return Object.entries(evalsByMatch).map(([matchId, data]) => {
        const match = matches.find(m => m.id === matchId)!;
        const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
        return {
            match,
            avgRating,
            goals: data.goals,
        }
    }).sort((a,b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());

  }, [evaluations, matches]);

  const chartData = useMemo(() => {
    if (!ovrHistory) return [];
    if (ovrHistory.length === 0 && player) {
        return [{name: 'Inicial', OVR: player.ovr}]
    }
    return ovrHistory.map((entry, index) => ({
      name: `P. ${index + 1}`,
      OVR: entry.newOVR,
      Fecha: format(new Date(entry.date), 'dd/MM'),
    }));
  }, [ovrHistory, player]);


  const loading = playerLoading || evaluationsLoading || matchesLoading || historyLoading;

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!player) {
    return <div>No se encontró al jugador.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={player.name}
        description={`Estadísticas detalladas y progresión de ${player.name}.`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
            <Card>
                <CardContent className="pt-6 flex flex-col items-center gap-4">
                    <Avatar className="h-32 w-32 border-4 border-primary/50">
                        <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold font-headline">{player.name}</h2>
                        <div className="flex items-center justify-center gap-4 mt-1">
                            <span className={cn("text-4xl font-bold", positionColors[player.position])}>{player.ovr}</span>
                            <Badge variant="secondary" className="text-lg">{player.position}</Badge>
                        </div>
                    </div>
                    <Separator />
                     <div className="w-full grid grid-cols-2 gap-x-8 gap-y-3 px-4">
                        <Stat label="RIT" value={player.pac} />
                        <Stat label="TIR" value={player.sho} />
                        <Stat label="PAS" value={player.pas} />
                        <Stat label="REG" value={player.dri} />
                        <Stat label="DEF" value={player.def} />
                        <Stat label="FIS" value={player.phy} />
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="h-6 w-6" />
                Progresión de OVR
              </CardTitle>
              <CardDescription>Evolución del OVR del jugador a lo largo de los últimos partidos.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                            return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col">
                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                            Partido
                                        </span>
                                        <span className="font-bold text-muted-foreground">
                                            {label} ({payload[0].payload.Fecha})
                                        </span>
                                        </div>
                                        <div className="flex flex-col">
                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                            OVR
                                        </span>
                                        <span className="font-bold text-foreground">
                                            {payload[0].value}
                                        </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="OVR" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Historial de Evaluaciones</CardTitle>
          <CardDescription>Rendimiento del jugador en los últimos partidos evaluados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Rating Prom.</TableHead>
                <TableHead className="text-center">Goles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvaluations.map(({ match, avgRating, goals }) => (
                <TableRow key={match.id}>
                  <TableCell className="font-medium">{match.title}</TableCell>
                  <TableCell>{format(new Date(match.date), 'dd MMM, yyyy')}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={avgRating >= 7 ? 'default' : avgRating >= 5 ? 'secondary' : 'destructive'} className="text-base">
                      <Star className="mr-1 h-3 w-3" /> {avgRating.toFixed(2)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                     <Badge variant="outline" className="text-base">
                        <Goal className="mr-1 h-3 w-3" /> {goals}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
               {filteredEvaluations.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Este jugador aún no tiene evaluaciones registradas.
                    </TableCell>
                 </TableRow>
               )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
