'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit, addDoc } from 'firebase/firestore';
import type { Evaluation, Match, PerformanceTag } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, Goal, Star, Calendar, Quote, Lock, Unlock, User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { logger } from '@/lib/logger';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type PlayerRecentActivityProps = {
  playerId: string;
};

type MatchFeedbackContext = {
  match: Match;
  selfEvaluation?: Evaluation;
  peerEvaluations: Evaluation[];
  stats: {
    goals: number;
    assists: number;
    avgRating: number;
  }
};

export function PlayerRecentActivity({ playerId }: PlayerRecentActivityProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [activities, setActivities] = useState<MatchFeedbackContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to handle identity request (Mock logic for now)
  const handleRequestIdentity = async (evaluationId: string) => {
    toast({ description: 'Solicitud de identidad enviada (Simulación)' });
    // TODO: Implement actual notification logic
  };

  useEffect(() => {
    async function fetchActivity() {
      if (!firestore || !playerId) {
        setIsLoading(false);
        return;
      };
      setIsLoading(true);

      try {
        // 1. Fetch recent evaluations (both self and peer)
        const evalsQuery = query(
          collection(firestore, 'evaluations'),
          where('playerId', '==', playerId),
          orderBy('evaluatedAt', 'desc'),
          limit(20) // Fetch more to group by match
        );
        const evalsSnapshot = await getDocs(evalsQuery);
        const allEvals = evalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));

        if (allEvals.length === 0) {
          setActivities([]);
          setIsLoading(false);
          return;
        }

        // 2. Group by Match
        const evalsByMatchId = allEvals.reduce((acc, ev) => {
          if (!acc[ev.matchId]) acc[ev.matchId] = [];
          acc[ev.matchId].push(ev);
          return acc;
        }, {} as Record<string, Evaluation[]>);

        const matchIds = Object.keys(evalsByMatchId);

        // 3. Fetch Match Details
        const matchPromises = matchIds.map(id => getDoc(doc(firestore, 'matches', id)));
        const matchSnaps = await Promise.all(matchPromises);
        const matchesMap = new Map(matchSnaps.map(snap => [snap.id, { id: snap.id, ...snap.data() } as Match]));

        const contexts: MatchFeedbackContext[] = [];

        for (const matchId of matchIds) {
          const match = matchesMap.get(matchId);
          if (!match) continue;

          const evals = evalsByMatchId[matchId];

          // Separate Self Eval vs Peer Evals
          // Assuming self-eval is where evaluatorId === playerId
          const selfEval = evals.find(e => e.evaluatorId === playerId);
          const peerEvaluations = evals.filter(e => e.evaluatorId !== playerId);

          // Calculate Aggregates
          // Stats usually come from Self-Evaluation or are aggregated. 
          // If SelfEval exists, distinct stats are there.
          const stats = {
            goals: selfEval ? selfEval.goals : evals.reduce((sum, e) => sum + (e.goals || 0), 0) / (evals.length || 1), // Fallback avg if no self
            assists: selfEval ? (selfEval.assists || 0) : 0,
            avgRating: peerEvaluations.length > 0
              ? peerEvaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / peerEvaluations.length
              : (selfEval?.rating || 0) // Fallback to self-rating if no peers (solo match)
          };

          contexts.push({
            match,
            selfEvaluation: selfEval,
            peerEvaluations,
            stats
          });
        }

        // Sort by match date descending
        contexts.sort((a, b) => {
          if (!a.match.date || !b.match.date) return 0;
          return new Date(b.match.date).getTime() - new Date(a.match.date).getTime();
        });

        setActivities(contexts);

      } catch (error: any) {
        logger.error('Failed to fetch player activity', error, { playerId });
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivity();
  }, [firestore, playerId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Historial de Partidos</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div></CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Historial de Partidos</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-4">Aún no hay partidos evaluados.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold px-1">Historial y Feedback</h3>
      {activities.map(({ match, selfEvaluation, peerEvaluations, stats }) => (
        <Card key={match.id} className="overflow-hidden border-l-4 border-l-primary/70">
          <CardHeader className="bg-muted/20 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{match.title}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  {match.date ? format(new Date(match.date), 'EEEE d MMMM, yyyy', { locale: es }) : 'Fecha desconocida'}
                </div>
              </div>
              {stats.avgRating > 0 && (
                <div className="flex flex-col items-end">
                  <Badge variant="secondary" className={cn(
                    "text-lg font-bold px-2 py-1",
                    stats.avgRating >= 9 ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
                      stats.avgRating >= 7 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" :
                        "bg-slate-100 text-slate-700"
                  )}>
                    <Star className={cn("h-4 w-4 mr-1 fill-current", stats.avgRating >= 9 ? "text-amber-500" : "text-emerald-500")} />
                    {stats.avgRating.toFixed(1)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Stats Summary */}
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-1.5 bg-background/50 px-3 py-1.5 rounded-full border text-sm font-medium">
                <Goal className="h-4 w-4 text-primary" />
                <span>{stats.goals} {stats.goals === 1 ? 'Gol' : 'Goles'}</span>
              </div>
              {stats.assists > 0 && (
                <div className="flex items-center gap-1.5 bg-background/50 px-3 py-1.5 rounded-full border text-sm font-medium">
                  <div className="h-4 w-4 flex items-center justify-center font-serif italic font-bold text-primary">A</div>
                  <span>{stats.assists} {stats.assists === 1 ? 'Asistencia' : 'Asistencias'}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Personal Chronicle */}
            {selfEvaluation?.personalChronicle && (
              <div className="bg-muted/30 p-4 rounded-lg italic text-sm text-muted-foreground border border-dashed">
                <div className="flex items-center gap-2 mb-2 not-italic font-semibold text-foreground/80">
                  <Quote className="h-3 w-3 rotate-180" /> Tu Crónica
                </div>
                "{selfEvaluation.personalChronicle}"
              </div>
            )}

            {/* Peer Feedback Wall */}
            {peerEvaluations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Feedback de compañeros
                </h4>
                <div className="space-y-3">
                  {peerEvaluations.map((evalItem) => (
                    <div key={evalItem.id} className="group relative bg-background border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                          {evalItem.identityRevealed ? (
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${evalItem.evaluatorId}`} />
                            // Ideally fetch real photoURL if revealed
                          ) : (
                            <div className="h-full w-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground opacity-50" />
                            </div>
                          )}
                          <AvatarFallback>?</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                                {evalItem.identityRevealed ? "Nombre del Jugador" : "Compañero Anónimo"}
                                {evalItem.identityRevealed && <Badge variant="outline" className="text-[10px] h-4 px-1">Verificado</Badge>}
                              </span>
                              {evalItem.role && <span className="text-xs text-muted-foreground capitalize">{evalItem.role}</span>}
                            </div>

                            {!evalItem.identityRevealed && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                                      onClick={() => handleRequestIdentity(evalItem.id)}
                                      disabled={evalItem.identityRequestStatus === 'pending'}
                                    >
                                      {evalItem.identityRequestStatus === 'pending' ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Lock className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{evalItem.identityRequestStatus === 'pending' ? 'Solicitud pendiente' : 'Solicitar identidad'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>

                          {/* Text Description */}
                          {evalItem.textDescription ? (
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              "{evalItem.textDescription}"
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Sin comentario escrito.
                            </p>
                          )}

                          {/* Tags */}
                          {evalItem.performanceTags && evalItem.performanceTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {evalItem.performanceTags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] bg-secondary/50 hover:bg-secondary/70 border-0">
                                  {typeof tag === 'string' ? tag : tag.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
