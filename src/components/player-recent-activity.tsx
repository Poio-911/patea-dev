'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit, Timestamp } from 'firebase/firestore';
import type { Evaluation, Match, OvrHistory } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Goal, Star, Calendar, Quote, Lock, MessageSquare, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requestIdentityRevelation } from '@/lib/actions/evaluation-actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  };
  ovrUpdate?: {
    change: number;
    newOVR: number;
  };
};

export function PlayerRecentActivity({ playerId }: PlayerRecentActivityProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activities, setActivities] = useState<MatchFeedbackContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to handle identity request
  const handleRequestIdentity = async (evaluationId: string) => {
    try {
      const result = await requestIdentityRevelation(evaluationId, playerId);
      if (result.success) {
        toast({
          title: "Solicitud Enviada",
          description: 'Se ha notificado al compañero que quieres saber su identidad.'
        });
        // Optimistic update
        setActivities(prev => prev.map(activity => ({
          ...activity,
          peerEvaluations: activity.peerEvaluations.map(ev =>
            ev.id === evaluationId ? { ...ev, identityRequestStatus: 'pending' as const } : ev
          )
        })));
      } else {
        toast({ variant: 'destructive', description: result.error || "Error al solicitar identidad." });
      }
    } catch (error) {
      toast({ variant: 'destructive', description: "Error de conexión." });
    }
  };

  useEffect(() => {
    async function fetchActivity() {
      if (!firestore || !playerId) {
        setIsLoading(false);
        return;
      };
      setIsLoading(true);

      try {
        // 1. Fetch recent evaluations
        const evalsQuery = query(
          collection(firestore, 'evaluations'),
          where('playerId', '==', playerId),
          orderBy('evaluatedAt', 'desc'),
          limit(20)
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

        // 3. Fetch Match Details & OVR History concurrently
        const matchPromises = matchIds.map(id => getDoc(doc(firestore, 'matches', id)));
        const ovrHistoryQuery = query(
          collection(firestore, 'players', playerId, 'ovrHistory'),
          where('matchId', 'in', matchIds.slice(0, 10)) // Limit check (max 10 for 'in')
        );

        const [matchSnaps, ovrHistorySnap] = await Promise.all([
          Promise.all(matchPromises),
          matchIds.length > 0 ? getDocs(ovrHistoryQuery) : Promise.resolve({ docs: [] } as any)
        ]);

        const matchesMap = new Map(matchSnaps.map(snap => [snap.id, { id: snap.id, ...snap.data() } as Match]));
        const ovrHistoryMap = new Map();
        ovrHistorySnap.docs.forEach((doc: any) => {
          const data = doc.data();
          ovrHistoryMap.set(data.matchId, data);
        });

        const contexts: MatchFeedbackContext[] = [];

        for (const matchId of matchIds) {
          const match = matchesMap.get(matchId);
          if (!match) continue;

          const evals = evalsByMatchId[matchId];
          const selfEval = evals.find(e => e.evaluatorId === playerId);
          const peerEvaluations = evals.filter(e => e.evaluatorId !== playerId);

          // Calculate Aggregates (Rounded to integer for goals)
          const avgGoals = evals.reduce((sum, e) => sum + (e.goals || 0), 0) / (evals.length || 1);

          const stats = {
            goals: selfEval ? selfEval.goals : Math.round(avgGoals), // Use round to avoid 0.5
            assists: selfEval ? (selfEval.assists || 0) : 0,
            avgRating: peerEvaluations.length > 0
              ? peerEvaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / peerEvaluations.length
              : (selfEval?.rating || 0)
          };

          contexts.push({
            match,
            selfEvaluation: selfEval,
            peerEvaluations,
            stats,
            ovrUpdate: ovrHistoryMap.get(matchId)
          });
        }

        // Sort by match date descending
        contexts.sort((a, b) => {
          const getTs = (d: any) => d?.toDate ? d.toDate().getTime() : new Date(d).getTime();
          const dateA = a.match.date ? getTs(a.match.date) : 0;
          const dateB = b.match.date ? getTs(b.match.date) : 0;
          return dateB - dateA;
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
        <CardContent className="pt-6"><div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div></CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6"><p className="text-sm text-muted-foreground text-center py-4">Aún no hay partidos evaluados.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold px-1 flex items-center gap-2">
        Historial y Feedback
        <Badge variant="outline" className="text-xs font-normal">Últimos {activities.length}</Badge>
      </h3>

      {activities.map(({ match, selfEvaluation, peerEvaluations, stats, ovrUpdate }) => {
        // Fix Date Parsing
        let matchDate: Date | null = null;
        const rawDate = match.date || selfEvaluation?.reportedAt || (peerEvaluations[0] as any)?.evaluatedAt;

        if (rawDate) {
          if (typeof (rawDate as any).toDate === 'function') {
            matchDate = (rawDate as any).toDate();
          } else {
            matchDate = new Date(rawDate);
            // Check if valid
            if (isNaN(matchDate.getTime())) matchDate = null;
          }
        }

        const formattedDate = matchDate ? format(matchDate, 'EEE d MMM, yyyy', { locale: es }) : 'Fecha desconocida';

        // Fix Title parsing
        const displayTitle = match.title
          ? match.title
          : (match.teams && match.teams.length >= 2
            ? `${match.teams[0].name} vs ${match.teams[1].name}`
            : 'Partido Amistoso');

        return (
          <Collapsible key={match.id} className="group">
            <Card className="overflow-hidden border-l-4 border-l-primary/70 hover:shadow-md transition-all">
              <CollapsibleTrigger className="w-full text-left">
                <div className="p-4 flex items-center justify-between bg-card hover:bg-accent/5 transition-colors">
                  {/* Left: Date & Title */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      <span className="capitalize">{formattedDate}</span>
                      {ovrUpdate ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> OVR {ovrUpdate.change >= 0 ? '+' : ''}{ovrUpdate.change.toFixed(1)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground gap-1">
                          <Clock className="h-3 w-3" /> Pendiente
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-bold text-base truncate">{displayTitle}</h4>
                  </div>

                  {/* Right: Rating & Stats */}
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex gap-2">
                      <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-full text-xs font-medium">
                        <Goal className="h-3 w-3 text-primary" />
                        <span>{stats.goals}</span>
                      </div>
                    </div>

                    {stats.avgRating > 0 && (
                      <Badge className={cn(
                        "text-sm font-bold px-2 py-1 h-8 min-w-[3rem] justify-center",
                        stats.avgRating >= 8 ? "bg-emerald-500 hover:bg-emerald-600" :
                          stats.avgRating >= 6 ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-500"
                      )}>
                        {stats.avgRating.toFixed(1)}
                      </Badge>
                    )}

                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 pt-0 space-y-4">
                  <div className="h-px bg-border/50 mx-2 mb-4" />

                  {/* Personal Chronicle */}
                  {selfEvaluation?.personalChronicle && (
                    <div className="bg-muted/30 p-3 rounded-lg italic text-sm text-muted-foreground border border-dashed relative">
                      <Quote className="h-6 w-6 text-muted-foreground/10 absolute top-2 right-2 rotate-180" />
                      <span className="font-semibold text-foreground/80 not-italic block mb-1 text-xs uppercase tracking-wider">Tu Crónica</span>
                      "{selfEvaluation.personalChronicle}"
                    </div>
                  )}

                  {/* Peer Feedback */}
                  {peerEvaluations.length > 0 ? (
                    <div>
                      <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                        <MessageSquare className="h-3 w-3" /> Feedback de compañeros
                      </h4>
                      <div className="grid gap-2">
                        {peerEvaluations.map((evalItem) => (
                          <div key={evalItem.id} className="bg-background border rounded-md p-3 text-sm shadow-sm flex gap-3">
                            <Avatar className="h-8 w-8 mt-0.5">
                              {evalItem.identityRevealed ? (
                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${evalItem.evaluatorId}`} />
                              ) : (
                                <AvatarFallback><Lock className="h-3 w-3 text-muted-foreground" /></AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-foreground">
                                  {evalItem.identityRevealed ? "Compañero (Revelado)" : "Compañero Anónimo"}
                                </span>
                                {!evalItem.identityRevealed && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-2 text-[10px] text-primary hover:bg-primary/10"
                                    onClick={() => handleRequestIdentity(evalItem.id)}
                                  >
                                    Solicitar Identidad
                                  </Button>
                                )}
                              </div>

                              {evalItem.textDescription ? (
                                <p className="text-muted-foreground leading-relaxed">"{evalItem.textDescription}"</p>
                              ) : (
                                <p className="text-muted-foreground/50 italic text-xs">Sin comentario escrito.</p>
                              )}

                              {evalItem.performanceTags && evalItem.performanceTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-2">
                                  {evalItem.performanceTags.map((tag, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 border-0 bg-secondary/40 text-secondary-foreground font-normal">
                                      {typeof tag === 'string' ? tag : tag.name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-2">No recibiste feedback escrito en este partido.</p>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
