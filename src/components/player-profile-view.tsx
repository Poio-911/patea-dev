
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { Player, Evaluation, Match, OvrHistory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart2, Star, Goal, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

type PlayerProfileViewProps = {
  playerId: string;
  isUploading?: boolean;
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'text-chart-1',
  MED: 'text-chart-2',
  DEF: 'text-chart-3',
  POR: 'text-chart-4',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

type DetailedEvaluation = Evaluation & { evaluatorName?: string; evaluatorPhoto?: string };
type MatchEvaluationSummary = {
    match: Match;
    avgRating: number;
    goals: number;
    individualEvaluations: DetailedEvaluation[];
};

export default function PlayerProfileView({ playerId, isUploading }: PlayerProfileViewProps) {
  const firestore = useFirestore();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluatorProfiles, setEvaluatorProfiles] = useState<Record<string, {displayName: string, photoURL: string}>>({});
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const playerRef = useMemo(() => firestore && playerId ? doc(firestore, 'players', playerId) : null, [firestore, playerId]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const ovrHistoryQuery = useMemo(() => {
    if (!firestore || !playerId) return null;
    return query(collection(firestore, 'players', playerId, 'ovrHistory'), orderBy('date', 'asc'));
  }, [firestore, playerId]);
  const { data: ovrHistory, loading: historyLoading } = useCollection<OvrHistory>(ovrHistoryQuery);
  
  useEffect(() => {
    async function fetchEvaluationData() {
        if (!firestore || !playerId) return;

        setIsLoading(true);
        try {
            // 1. Fetch all evaluations for the player
            const evalsQuery = query(collection(firestore, 'evaluations'), where('playerId', '==', playerId));
            const evalsSnapshot = await getDocs(evalsQuery);
            const playerEvals = evalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
            setEvaluations(playerEvals);

            // 2. Get unique match and evaluator IDs
            const matchIds = [...new Set(playerEvals.map(e => e.matchId))];
            const evaluatorIds = [...new Set(playerEvals.map(e => e.evaluatorId))];

            // 3. Fetch corresponding matches
            if (matchIds.length > 0) {
                const matchesQuery = query(collection(firestore, 'matches'), where('__name__', 'in', matchIds));
                const matchesSnapshot = await getDocs(matchesQuery);
                const fetchedMatches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
                setMatches(fetchedMatches);
            }

            // 4. Fetch evaluator profiles
            if (evaluatorIds.length > 0) {
                const usersQuery = query(collection(firestore, 'users'), where('uid', 'in', evaluatorIds));
                const usersSnapshot = await getDocs(usersQuery);
                const newProfiles: Record<string, {displayName: string, photoURL: string}> = {};
                usersSnapshot.forEach(doc => {
                    const data = doc.data();
                    newProfiles[doc.id] = {
                        displayName: data.displayName || 'Anónimo',
                        photoURL: data.photoURL || '',
                    };
                });
                setEvaluatorProfiles(newProfiles);
            }
        } catch (error) {
            console.error("Error fetching evaluation data:", error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchEvaluationData();
  }, [firestore, playerId]);

  const filteredEvaluationsByMatch = useMemo((): MatchEvaluationSummary[] => {
    if (isLoading || evaluations.length === 0 || matches.length === 0) return [];
    
    const evalsByMatch: Record<string, { match: Match; evaluations: DetailedEvaluation[] }> = {};

    evaluations.forEach(ev => {
        const matchForEval = matches.find(m => m.id === ev.matchId);
        if (matchForEval) {
            if (!evalsByMatch[ev.matchId]) {
                evalsByMatch[ev.matchId] = { match: matchForEval, evaluations: [] };
            }
            const detailedEval: DetailedEvaluation = {
                ...ev,
                evaluatorName: evaluatorProfiles[ev.evaluatorId]?.displayName || 'Cargando...',
                evaluatorPhoto: evaluatorProfiles[ev.evaluatorId]?.photoURL || '',
            };
            evalsByMatch[ev.matchId].evaluations.push(detailedEval);
        }
    });

    return Object.values(evalsByMatch).map(summary => {
        const ratings = summary.evaluations.map(ev => ev.rating).filter((r): r is number => r !== undefined);
        const goals = summary.evaluations.reduce((sum, ev) => sum + (ev.goals || 0), 0);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        
        return {
            match: summary.match,
            avgRating,
            goals,
            individualEvaluations: summary.evaluations
        };
    }).sort((a,b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());

  }, [evaluations, matches, evaluatorProfiles, isLoading]);

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


  const loading = playerLoading || historyLoading || isLoading;

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!player) {
    return <div>No se encontró al jugador.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
            <Card>
                <CardContent className="pt-6 flex flex-col items-center gap-4">
                    <div className="relative">
                        <Avatar className="h-32 w-32 border-4 border-primary/50">
                            <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {isUploading && (
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                            </div>
                        )}
                    </div>
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
          <CardDescription>Rendimiento del jugador en los últimos partidos evaluados. Haz clic en un partido para ver el detalle.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12'></TableHead>
                <TableHead>Partido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Rating Prom.</TableHead>
                <TableHead className="text-center">Goles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredEvaluationsByMatch.length > 0 ? filteredEvaluationsByMatch.map(({ match, avgRating, goals, individualEvaluations }) => {
                    const isOpen = openAccordion === match.id;
                    return (
                        <React.Fragment key={match.id}>
                            <TableRow 
                                className="cursor-pointer"
                                onClick={() => setOpenAccordion(isOpen ? null : match.id)}
                            >
                                <TableCell>
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                </TableCell>
                                <TableCell className="font-medium">{match.title}</TableCell>
                                <TableCell>{format(new Date(match.date), 'dd MMM, yyyy', { locale: es })}</TableCell>
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
                            {isOpen && (
                                <TableRow>
                                    <TableCell colSpan={5} className="p-0">
                                        <div className="bg-muted/50 p-4">
                                            <h4 className="font-semibold text-md mb-2 ml-4">Detalle de evaluaciones:</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Evaluador</TableHead>
                                                        <TableHead className="text-center">Rating</TableHead>
                                                        <TableHead>Etiquetas de Rendimiento</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {individualEvaluations.map(ev => (
                                                        <TableRow key={ev.id} className="bg-background">
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-8 w-8">
                                                                        <AvatarImage src={ev.evaluatorPhoto} alt={ev.evaluatorName} />
                                                                        <AvatarFallback>{ev.evaluatorName?.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span>{ev.evaluatorName}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="secondary">{ev.rating}</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex gap-1 flex-wrap">
                                                                {ev.performanceTags && ev.performanceTags.length > 0 ? ev.performanceTags.map(tag => (
                                                                    <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                                                                )) : <span className="text-muted-foreground text-xs">Sin etiquetas</span>}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </React.Fragment>
                    )
                }) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
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
