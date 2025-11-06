
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs
} from 'firebase/firestore';
import type { Player, Evaluation, Match, OvrHistory, UserProfile, PerformanceTag } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUp, ArrowDown, Minus, Goal, Eye, LineChart as LineChartIcon, TrendingUp, ChevronDown, Star } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import { PlayerDetailCard } from '@/components/player-detail-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { PlayerInsightsPanel } from './player-insights-panel';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type PlayerProfileViewProps = {
  playerId: string;
};

type DetailedEvaluation = Evaluation & { evaluatorName?: string; evaluatorPhoto?: string };

type PerformanceLevel = 'Excelente' | 'Bueno' | 'Medio' | 'Regular' | 'Bajo';

type MatchEvaluationSummary = {
    match: Match;
    teamName: string;
    hasNumericRatings: boolean;
    performance: {
        level: PerformanceLevel;
        color: string;
    };
    goals: number;
    individualEvaluations: DetailedEvaluation[];
};

const getPerformanceFromRating = (rating: number): { level: PerformanceLevel; color: string } => {
    if (rating >= 9) return { level: 'Excelente', color: 'bg-green-500' };
    if (rating >= 7) return { level: 'Bueno', color: 'bg-green-400' };
    if (rating >= 5) return { level: 'Medio', color: 'bg-yellow-500' };
    if (rating >= 3) return { level: 'Regular', color: 'bg-orange-500' };
    return { level: 'Bajo', color: 'bg-red-500' };
};

const getPerformanceFromTags = (tags: PerformanceTag[]): { level: PerformanceLevel; color: string } => {
    if (!tags || tags.length === 0) return { level: 'Medio', color: 'bg-yellow-500' };
    const score = tags.reduce((acc, tag) => {
        if (!tag || typeof tag !== 'object' || !('impact' in tag)) return acc;
        if (tag.impact === 'positive') return acc + 1;
        if (tag.impact === 'negative') return acc - 1;
        return acc;
    }, 0);

    if (score >= 3) return { level: 'Excelente', color: 'bg-green-500' };
    if (score > 0) return { level: 'Bueno', color: 'bg-green-400' };
    if (score === 0) return { level: 'Medio', color: 'bg-yellow-500' };
    if (score < 0) return { level: 'Regular', color: 'bg-orange-500' };
    return { level: 'Bajo', color: 'bg-red-500' };
};

const FormTrend = ({ history }: { history: OvrHistory[] }) => {
    const lastFive = history.slice(-5);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Estado de Forma</CardTitle>
                <CardDescription>Rendimiento en los últimos 5 partidos.</CardDescription>
            </CardHeader>
            <CardContent>
                {lastFive.length > 0 ? (
                    <div className="flex justify-center items-center gap-2">
                        {lastFive.map((entry, index) => {
                            const Icon = entry.change > 0 ? ArrowUp : entry.change < 0 ? ArrowDown : Minus;
                            const color = entry.change > 0 ? 'text-green-500' : entry.change < 0 ? 'text-red-500' : 'text-gray-500';
                            return (
                                <TooltipProvider key={index}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${color.replace('text-', 'border-')} bg-opacity-10`}>
                                                <Icon className={cn("h-6 w-6", color)} />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Partido {index + 1}: OVR {entry.oldOVR} → {entry.newOVR} ({entry.change > 0 ? '+' : ''}{entry.change})</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">No hay suficientes partidos para mostrar una tendencia.</p>
                )}
            </CardContent>
        </Card>
    );
};


export default function PlayerProfileView({ playerId }: PlayerProfileViewProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluatorProfiles, setEvaluatorProfiles] = useState<Record<string, {displayName: string, photoURL: string}>>({});
  const [isLoading, setIsLoading] = useState(true);

  const playerRef = useMemo(() => firestore && playerId ? doc(firestore, 'players', playerId) : null, [firestore, playerId]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const ovrHistoryQuery = useMemo(() => {
    if (!firestore || !playerId) return null;
    return query(collection(firestore, 'players', playerId, 'ovrHistory'), orderBy('date', 'asc'));
  }, [firestore, playerId]);
  const { data: ovrHistory, loading: historyLoading } = useCollection<OvrHistory>(ovrHistoryQuery);
  
  const isCurrentUserProfile = user?.uid === playerId;
  
  useEffect(() => {
    async function fetchEvaluationData() {
        if (!firestore || !playerId) {
            setIsLoading(false);
            return;
        };

        setIsLoading(true);
        try {
            const evalsQuery = query(collection(firestore, 'evaluations'), where('playerId', '==', playerId));
            const evalsSnapshot = await getDocs(evalsQuery);
            const playerEvals = evalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
            setEvaluations(playerEvals);

            const matchIds = [...new Set(playerEvals.map(e => e.matchId).filter(id => id))];
            if (matchIds.length > 0) {
                const matchChunks: string[][] = [];
                for (let i = 0; i < matchIds.length; i += 30) {
                    matchChunks.push(matchIds.slice(i, i + 30));
                }

                const matchPromises = matchChunks.map(chunk =>
                    getDocs(query(collection(firestore, 'matches'), where('__name__', 'in', chunk)))
                );
                
                const matchSnapshots = await Promise.all(matchPromises);
                const allMatches = matchSnapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)));
                setMatches(allMatches);
            } else {
                setMatches([]);
            }

            const evaluatorIds = [...new Set(playerEvals.map(e => e.evaluatorId).filter(id => id))];
            if (evaluatorIds.length > 0) {
                const usersQuery = query(collection(firestore, 'users'), where('__name__', 'in', evaluatorIds));
                const usersSnapshot = await getDocs(usersQuery);
                const newProfiles: Record<string, {displayName: string, photoURL: string}> = {};
                usersSnapshot.forEach(doc => {
                    const data = doc.data() as UserProfile;
                    newProfiles[doc.id] = {
                        displayName: data.displayName || 'Anónimo',
                        photoURL: data.photoURL || '',
                    };
                });
                setEvaluatorProfiles(newProfiles);
            } else {
                setEvaluatorProfiles({});
            }
        } catch (error) {
            logger.error("Error fetching evaluation data", error, { playerId });
        } finally {
            setIsLoading(false);
        }
    }
    fetchEvaluationData();
  }, [firestore, playerId]);

  const filteredEvaluationsByMatch: MatchEvaluationSummary[] = useMemo(() => {
    if (isLoading || evaluations.length === 0) return [];

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
      const ratings = summary.evaluations.map(ev => ev.rating).filter((r): r is number => typeof r === 'number' && !isNaN(r));
      const hasNumericRatings = ratings.length > 0;
      const goals = summary.evaluations.reduce((sum, ev) => sum + (ev.goals || 0), 0);
      
      const allTags = summary.evaluations.flatMap(ev => ev.performanceTags)
        .filter((tag): tag is PerformanceTag => Boolean(tag && typeof tag === 'object' && 'impact' in tag));
      
      let performance: { level: PerformanceLevel; color: string };
      if (hasNumericRatings) {
          const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          performance = getPerformanceFromRating(avgRating);
      } else {
          performance = getPerformanceFromTags(allTags);
      }

      const team = summary.match.teams?.find(t => t.players.some(p => p.uid === playerId));

      return {
        match: summary.match,
        teamName: team?.name || '',
        hasNumericRatings,
        performance,
        goals,
        individualEvaluations: summary.evaluations,
      };
    }).sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
  }, [evaluations, matches, evaluatorProfiles, isLoading, playerId]);

  if (playerLoading || historyLoading || isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!player) {
    return <div>No se encontró al jugador.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <PlayerDetailCard player={player} />

      <Accordion type="multiple" className="w-full space-y-4">
        <AccordionItem value="history" className="border-b-0">
          <Card>
            <AccordionTrigger className="w-full p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg text-left">Historial de Rendimiento</h3>
                  <p className="text-sm text-muted-foreground text-left">Mirá tus últimas evaluaciones partido a partido.</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
              <div className="space-y-3">
                {filteredEvaluationsByMatch.length > 0 ? filteredEvaluationsByMatch.slice(0, 5).map(({ match, teamName, performance, goals, individualEvaluations }) => (
                  <Card key={match.id} className="bg-muted/50">
                     <CardHeader className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{match.title}</CardTitle>
                          <CardDescription>{format(new Date(match.date), 'dd MMM yyyy', { locale: es })}</CardDescription>
                        </div>
                        <Badge style={{ backgroundColor: performance.color }} className="text-white text-xs">{performance.level}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                        {teamName && <Badge variant="outline">Equipo: {teamName}</Badge>}
                        <div className="flex items-center gap-1"><Goal className="h-3 w-3" /> {goals} Goles</div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm" className="w-full">
                            <Eye className="mr-2 h-4 w-4" /> Ver Detalles de Evaluación
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Evaluación de: {match.title}</DialogTitle>
                          </DialogHeader>
                          <Table>
                            <TableHeader><TableRow><TableHead>Evaluador</TableHead><TableHead className="text-center">Rating</TableHead><TableHead>Etiquetas</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {individualEvaluations.map(ev => (
                                <TableRow key={ev.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarImage src={ev.evaluatorPhoto} alt={ev.evaluatorName} /><AvatarFallback>{ev.evaluatorName?.charAt(0)}</AvatarFallback></Avatar><span>{ev.evaluatorName}</span></div>
                                  </TableCell>
                                  <TableCell className="text-center">{ev.rating !== undefined ? <Badge variant="secondary">{ev.rating}</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1 flex-wrap">
                                      {(ev.performanceTags || []).map((tag, idx) => tag && typeof tag === 'object' && 'name' in tag && <Badge key={(tag as any).id || idx} variant="outline">{(tag as any).name}</Badge>)}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                )) : <p className="text-sm text-muted-foreground text-center py-4">Este jugador aún no tiene evaluaciones.</p>}
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {isCurrentUserProfile && (
            <AccordionItem value="analysis" className="border-b-0">
                 <Card>
                    <AccordionTrigger className="w-full p-4">
                        <div className="flex items-center gap-3">
                            <LineChartIcon className="h-6 w-6 text-primary" />
                            <div>
                                <h3 className="font-semibold text-lg text-left">Análisis Avanzado</h3>
                                <p className="text-sm text-muted-foreground text-left">Explorá tu rendimiento con la ayuda de la IA.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                     <AccordionContent className="p-4 pt-0">
                         <Button asChild className="w-full">
                            <Link href={`/players/${playerId}/analysis`}>
                                <LineChartIcon className="mr-2 h-4 w-4"/>
                                Ir al Análisis Avanzado
                            </Link>
                        </Button>
                    </AccordionContent>
                 </Card>
            </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

    