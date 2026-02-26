'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit, Timestamp } from 'firebase/firestore';
import type { Evaluation, Match, OvrHistory } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Goal, Star, Calendar, Quote, Lock, MessageSquare, ChevronDown, CheckCircle2, Clock, Brain, Zap, Target } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requestIdentityRevelation } from '@/lib/actions/evaluation-actions';
import {
  ResponsiveTooltip as Tooltip,
  ResponsiveTooltipContent as TooltipContent,
  ResponsiveTooltipProvider as TooltipProvider,
  ResponsiveTooltipTrigger as TooltipTrigger,
} from '@/components/ui/responsive-tooltip';
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
      const result = await requestIdentityRevelation(evaluationId);
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
                  {/* Peer Feedback - Aura Style */}
                  {/* Peer Feedback - High Contrast Gamer Style */}
                  {peerEvaluations.length > 0 ? (
                    <div>
                      <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                        <MessageSquare className="h-3 w-3" /> Feedback del Vestuario
                      </h4>
                      <div className="grid gap-3">
                        {peerEvaluations.map((evalItem) => {
                          const hasRating = typeof evalItem.rating === 'number';
                          const hasTags = evalItem.performanceTags && evalItem.performanceTags.length > 0;

                          // Determine Style Scheme based on rating or default
                          let cardBorderColor = "border-l-slate-300";
                          let ratingBadgeColor = "bg-slate-100 text-slate-700";

                          if (hasRating) {
                            if (evalItem.rating! >= 9) {
                              cardBorderColor = "border-l-[hsl(280,85%,60%)]"; // Elite Purple
                              ratingBadgeColor = "bg-[hsl(280,85%,60%)] text-white shadow-lg shadow-purple-500/20";
                            } else if (evalItem.rating! >= 7) {
                              cardBorderColor = "border-l-[hsl(43,96%,50%)]"; // Gold
                              ratingBadgeColor = "bg-[hsl(43,96%,50%)] text-black shadow-lg shadow-amber-500/20";
                            } else if (evalItem.rating! < 5) {
                              cardBorderColor = "border-l-red-500";
                              ratingBadgeColor = "bg-red-500 text-white";
                            } else {
                              cardBorderColor = "border-l-slate-400"; // Silver
                              ratingBadgeColor = "bg-slate-200 text-slate-700";
                            }
                          } else if (hasTags) {
                            // If only tags, use primary color
                            cardBorderColor = "border-l-primary";
                          }

                          return (
                            <div key={evalItem.id} className={cn(
                              "relative overflow-hidden rounded-lg bg-card border shadow-sm transition-all hover:shadow-md",
                              "border-l-[6px]", cardBorderColor // Thicker border for visual impact
                            )}>
                              <div className="p-4 flex gap-4 items-start">
                                {/* Avatar Section */}
                                <div className="flex flex-col items-center gap-2 min-w-[3.5rem]">
                                  <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                                    {evalItem.identityRevealed && evalItem.evaluatorPhotoUrl ? (
                                      <AvatarImage src={evalItem.evaluatorPhotoUrl} />
                                    ) : evalItem.identityRevealed ? (
                                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                        {evalItem.evaluatorDisplayName?.charAt(0).toUpperCase() || '?'}
                                      </AvatarFallback>
                                    ) : (
                                      <AvatarFallback className="bg-muted text-muted-foreground"><Lock className="h-4 w-4" /></AvatarFallback>
                                    )}
                                  </Avatar>
                                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight text-center leading-tight">
                                    {evalItem.identityRevealed ? "Revelado" : "Anónimo"}
                                  </span>
                                </div>

                                {/* Content Section */}
                                <div className="flex-1 min-w-0 space-y-3">
                                  {/* Header: evaluator name when revealed, or request button */}
                                  <div className="flex justify-between items-center min-h-[1.5rem]">
                                    {evalItem.identityRevealed ? (
                                      <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {evalItem.evaluatorDisplayName || 'Identidad revelada'}
                                      </span>
                                    ) : (
                                      <div className="flex-1" />
                                    )}
                                    {!evalItem.identityRevealed && evalItem.evaluatorId !== 'AI' && (
                                      evalItem.identityRequestStatus === 'pending' ? (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" /> Solicitud enviada
                                        </span>
                                      ) : evalItem.identityRequestStatus === 'rejected' ? (
                                        <span className="text-[10px] text-muted-foreground/60 italic">Rechazada</span>
                                      ) : (
                                        <button
                                          onClick={() => handleRequestIdentity(evalItem.id)}
                                          className="text-[10px] font-semibold text-primary/80 hover:text-primary hover:underline flex items-center gap-1 transition-colors bg-primary/5 px-2 py-1 rounded-full"
                                        >
                                          <Lock className="h-3 w-3" /> Solicitar ID
                                        </button>
                                      )
                                    )}
                                  </div>

                                  {/* 1. RATING BADGE (High Visibility) */}
                                  {hasRating && (
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "h-12 w-12 rounded-full flex items-center justify-center text-xl font-black font-headline tracking-tighter shrink-0",
                                        ratingBadgeColor
                                      )}>
                                        {evalItem.rating?.toFixed(1)}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold uppercase tracking-wide text-foreground">Puntaje General</span>
                                        <span className="text-xs text-muted-foreground">Evaluación de rendimiento</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* 2. TAGS (Solid Pills) */}
                                  {hasTags && (
                                    <div className="space-y-2">
                                      {!hasRating && <span className="text-xs font-bold uppercase text-muted-foreground tracking-wide block mb-1">Destaques</span>}
                                      <div className="flex flex-wrap gap-2">
                                        {evalItem.performanceTags!.map((tag, i) => (
                                          <div key={i} className="flex items-center gap-2 bg-secondary text-secondary-foreground border border-border/50 rounded-md px-3 py-1.5 shadow-sm">
                                            {/* Start Icon mapped by common keywords */}
                                            <div className="text-accent">
                                              {(typeof tag === 'string' ? tag : tag.name).toLowerCase().includes('tact') ? <Brain className="h-3.5 w-3.5" /> :
                                                (typeof tag === 'string' ? tag : tag.name).toLowerCase().includes('veloc') ? <Zap className="h-3.5 w-3.5" /> :
                                                  (typeof tag === 'string' ? tag : tag.name).toLowerCase().includes('gol') ? <Target className="h-3.5 w-3.5" /> :
                                                    <Star className="h-3.5 w-3.5" />}
                                            </div>
                                            <span className="text-xs font-semibold leading-none pt-0.5">
                                              {typeof tag === 'string' ? tag : tag.name}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* 3. Text Description */}
                                  {evalItem.textDescription ? (
                                    <div className="relative mt-2 p-3 bg-muted/40 rounded-r-lg border-l-2 border-primary/20 text-sm text-foreground/80 italic">
                                      "{evalItem.textDescription}"
                                    </div>
                                  ) : (
                                    // If empty text, no placeholder needed if we have rating or tags
                                    (!hasRating && !hasTags) && <p className="text-xs text-muted-foreground italic">Sin detalles adicionales.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 opacity-60">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Sin feedback escrito esta vez.</p>
                    </div>
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
