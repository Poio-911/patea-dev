'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import type { Evaluation, Match, OvrHistory, Player } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2, Goal, Star, Calendar, Quote, Lock, MessageSquare,
  ChevronDown, CheckCircle2, Clock, Brain, Zap, Target, TrendingUp, TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { requestIdentityRevelation } from '@/lib/actions/evaluation-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerMatchHistoryProps = {
  playerId: string;
  player?: Player;
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
    oldOVR?: number;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTR_LABELS: Record<string, string> = {
  pac: 'RIT', sho: 'TIR', pas: 'PAS', dri: 'REG', def: 'DEF', phy: 'FIS',
};

const ATTR_ORDER = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMatchDate(match: Match, selfEval?: Evaluation, peerEvals?: Evaluation[]): Date | null {
  const rawDate = match.date || selfEval?.evaluatedAt || peerEvals?.[0]?.evaluatedAt;
  if (!rawDate) return null;
  if (typeof (rawDate as any).toDate === 'function') return (rawDate as any).toDate();
  const d = new Date(rawDate as string);
  return isNaN(d.getTime()) ? null : d;
}

function getMatchTitle(match: Match): string {
  if (match.title) return match.title;
  if (match.teams && match.teams.length >= 2) return `${match.teams[0].name} vs ${match.teams[1].name}`;
  return 'Partido Amistoso';
}

function getBorderByRating(rating: number): string {
  if (rating >= 9) return 'border-l-[hsl(280,85%,60%)]';
  if (rating >= 7) return 'border-l-[hsl(43,96%,50%)]';
  if (rating >= 5) return 'border-l-slate-400';
  if (rating > 0) return 'border-l-red-500';
  return 'border-l-border';
}

function getPeerCardStyle(rating?: number, hasTags?: boolean): { border: string; badge: string } {
  if (rating !== undefined) {
    if (rating >= 9) return { border: 'border-l-[hsl(280,85%,60%)]', badge: 'bg-[hsl(280,85%,60%)] text-white shadow-lg shadow-purple-500/20' };
    if (rating >= 7) return { border: 'border-l-[hsl(43,96%,50%)]', badge: 'bg-[hsl(43,96%,50%)] text-black shadow-lg shadow-amber-500/20' };
    if (rating < 5) return { border: 'border-l-red-500', badge: 'bg-red-500 text-white' };
    return { border: 'border-l-slate-400', badge: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100' };
  }
  if (hasTags) return { border: 'border-l-primary', badge: '' };
  return { border: 'border-l-slate-300', badge: '' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroStat({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="text-2xl font-black font-mono tabular-nums text-foreground leading-none">{value}</span>
    </div>
  );
}

function StatPill({ icon: Icon, value, label }: { icon: React.ElementType; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full text-xs font-semibold">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="tabular-nums">{value}</span>
      <span className="text-muted-foreground font-normal">{label}</span>
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  return (
    <Badge className={cn(
      'text-sm font-bold px-2.5 py-1 h-8 min-w-[3.2rem] justify-center tabular-nums',
      rating >= 8 ? 'bg-emerald-500 hover:bg-emerald-600' :
        rating >= 6 ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-slate-500 hover:bg-slate-600',
    )}>
      {rating.toFixed(1)}
    </Badge>
  );
}

function TagIcon({ tag }: { tag: string }) {
  const lower = tag.toLowerCase();
  if (lower.includes('tact')) return <Brain className="h-3.5 w-3.5" />;
  if (lower.includes('veloc')) return <Zap className="h-3.5 w-3.5" />;
  if (lower.includes('gol')) return <Target className="h-3.5 w-3.5" />;
  return <Star className="h-3.5 w-3.5" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlayerMatchHistory({ playerId, player }: PlayerMatchHistoryProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activities, setActivities] = useState<MatchFeedbackContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleRequestIdentity = async (evaluationId: string) => {
    try {
      const result = await requestIdentityRevelation(evaluationId);
      if (result.success) {
        toast({ title: 'Solicitud Enviada', description: 'Se ha notificado al compañero que querés saber su identidad.' });
        setActivities(prev => prev.map(activity => ({
          ...activity,
          peerEvaluations: activity.peerEvaluations.map(ev =>
            ev.id === evaluationId ? { ...ev, identityRequestStatus: 'pending' as const } : ev
          ),
        })));
      } else {
        toast({ variant: 'destructive', description: result.error || 'Error al solicitar identidad.' });
      }
    } catch {
      toast({ variant: 'destructive', description: 'Error de conexión.' });
    }
  };

  useEffect(() => {
    async function fetchActivity() {
      if (!firestore || !playerId) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        const evalsQuery = query(
          collection(firestore, 'evaluations'),
          where('playerId', '==', playerId),
          orderBy('evaluatedAt', 'desc'),
          limit(20),
        );
        const evalsSnapshot = await getDocs(evalsQuery);
        const allEvals = evalsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation));

        if (allEvals.length === 0) { setActivities([]); setIsLoading(false); return; }

        const evalsByMatchId = allEvals.reduce((acc, ev) => {
          if (!acc[ev.matchId]) acc[ev.matchId] = [];
          acc[ev.matchId].push(ev);
          return acc;
        }, {} as Record<string, Evaluation[]>);

        const matchIds = Object.keys(evalsByMatchId);

        const matchPromises = matchIds.map(id => getDoc(doc(firestore, 'matches', id)));
        const ovrHistoryQuery = query(
          collection(firestore, 'players', playerId, 'ovrHistory'),
          where('matchId', 'in', matchIds.slice(0, 10)),
        );

        const [matchSnaps, ovrHistorySnap] = await Promise.all([
          Promise.all(matchPromises),
          matchIds.length > 0 ? getDocs(ovrHistoryQuery) : Promise.resolve({ docs: [] } as any),
        ]);

        const matchesMap = new Map(matchSnaps.map(snap => [snap.id, { id: snap.id, ...snap.data() } as Match]));
        const ovrHistoryMap = new Map<string, OvrHistory>();
        ovrHistorySnap.docs.forEach((d: any) => {
          const data = d.data();
          ovrHistoryMap.set(data.matchId, data);
        });

        const contexts: MatchFeedbackContext[] = [];

        for (const matchId of matchIds) {
          const match = matchesMap.get(matchId);
          if (!match) continue;

          const evals = evalsByMatchId[matchId];
          const selfEval = evals.find(e => e.evaluatorId === playerId);
          const peerEvaluations = evals.filter(e => e.evaluatorId !== playerId);

          const avgGoals = evals.reduce((sum, e) => sum + (e.goals || 0), 0) / (evals.length || 1);

          const stats = {
            goals: selfEval ? selfEval.goals : Math.round(avgGoals),
            assists: selfEval ? (selfEval.assists || 0) : 0,
            avgRating: peerEvaluations.length > 0
              ? peerEvaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / peerEvaluations.length
              : (selfEval?.rating || 0),
          };

          const ovrEntry = ovrHistoryMap.get(matchId);
          contexts.push({
            match,
            selfEvaluation: selfEval,
            peerEvaluations,
            stats,
            ovrUpdate: ovrEntry ? { change: ovrEntry.change, newOVR: ovrEntry.newOVR, oldOVR: ovrEntry.oldOVR } : undefined,
          });
        }

        contexts.sort((a, b) => {
          const getTs = (d: any) => d?.toDate ? d.toDate().getTime() : new Date(d).getTime();
          return getTs(b.match.date || 0) - getTs(a.match.date || 0);
        });

        setActivities(contexts);
      } catch (error: any) {
        logger.error('Failed to fetch player match history', error, { playerId });
      } finally {
        setIsLoading(false);
      }
    }
    fetchActivity();
  }, [firestore, playerId]);

  // ── Hero Stats ───────────────────────────────────────────────────────────────
  const heroStats = useMemo(() => {
    const withRating = activities.filter(a => a.stats.avgRating > 0);
    return {
      totalGoals: activities.reduce((s, a) => s + a.stats.goals, 0),
      avgRating: withRating.length > 0
        ? withRating.reduce((s, a) => s + a.stats.avgRating, 0) / withRating.length
        : 0,
      totalOvrChange: activities.reduce((s, a) => s + (a.ovrUpdate?.change ?? 0), 0),
      matchCount: activities.length,
    };
  }, [activities]);

  // ── Loading / Empty ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center py-4">Aún no hay partidos evaluados.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold px-1 flex items-center gap-2">
        Historial de Partidos
        <Badge variant="outline" className="text-xs font-normal">Últimos {activities.length}</Badge>
      </h3>

      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <HeroStat label="OVR Actual" value={player?.ovr ?? '─'} />
        <HeroStat label="Rating Promedio" value={heroStats.avgRating > 0 ? heroStats.avgRating.toFixed(1) : '─'} icon={Star} />
        <HeroStat label="Goles Totales" value={heroStats.totalGoals} icon={Goal} />
        <HeroStat label="Partidos" value={heroStats.matchCount} icon={Calendar} />
      </div>

      {/* OVR trend badge */}
      {heroStats.totalOvrChange !== 0 && (
        <div className={cn(
          'flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg w-fit',
          heroStats.totalOvrChange > 0
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-500/10 text-red-600 dark:text-red-400',
        )}>
          {heroStats.totalOvrChange > 0
            ? <TrendingUp className="h-4 w-4" />
            : <TrendingDown className="h-4 w-4" />}
          {heroStats.totalOvrChange > 0 ? '▲' : '▼'} {Math.abs(heroStats.totalOvrChange).toFixed(1)} OVR en {activities.filter(a => a.ovrUpdate).length} partidos
        </div>
      )}

      {/* ── Match Cards ──────────────────────────────────────────────────────── */}
      {activities.map(({ match, selfEvaluation, peerEvaluations, stats, ovrUpdate }) => {
        const matchDate = parseMatchDate(match, selfEvaluation, peerEvaluations);
        const formattedDate = matchDate ? format(matchDate, 'EEE d MMM, yyyy', { locale: es }) : 'Fecha desconocida';
        const displayTitle = getMatchTitle(match);
        const borderColor = getBorderByRating(stats.avgRating);

        // Aggregate aiAttributeChanges across all peer evaluations
        const attributeDeltas = peerEvaluations.reduce((acc, ev) => {
          for (const change of (ev.aiAttributeChanges ?? [])) {
            acc[change.attribute] = (acc[change.attribute] ?? 0) + change.change;
          }
          return acc;
        }, {} as Record<string, number>);
        const activeDeltas = Object.entries(attributeDeltas).filter(([, v]) => v !== 0);

        return (
          <Collapsible key={match.id} className="group">
            <div className={cn(
              'overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md',
              'border-l-[6px]', borderColor,
            )}>
              {/* ── Card Header (always visible) ─────────────────────────── */}
              <CollapsibleTrigger className="w-full text-left">
                <div className="p-4 flex items-center gap-3 hover:bg-accent/5 transition-colors">
                  {/* Date */}
                  <span className="text-xs text-muted-foreground capitalize hidden sm:block w-28 shrink-0">
                    {formattedDate}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize sm:hidden shrink-0">
                    {matchDate ? format(matchDate, 'd MMM', { locale: es }) : '—'}
                  </span>

                  {/* Title */}
                  <span className="font-bold flex-1 truncate text-sm">{displayTitle}</span>

                  {/* OVR delta */}
                  {ovrUpdate && (
                    <span className={cn(
                      'font-bold tabular-nums text-sm shrink-0',
                      ovrUpdate.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                    )}>
                      {ovrUpdate.change >= 0 ? '▲' : '▼'} {Math.abs(ovrUpdate.change).toFixed(1)}
                    </span>
                  )}

                  {/* Rating badge */}
                  {stats.avgRating > 0 && <RatingBadge rating={stats.avgRating} />}

                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>

              {/* ── Expanded Body ─────────────────────────────────────────── */}
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-1 border-t border-border/40">
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* ── Left: Actuación + Crónica ── */}
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Actuación</h5>
                        <div className="flex flex-wrap gap-2">
                          <StatPill icon={Goal} value={stats.goals} label="goles" />
                          {stats.assists > 0 && (
                            <StatPill icon={Target} value={stats.assists} label="asist." />
                          )}
                          {stats.avgRating > 0 && (
                            <StatPill icon={Star} value={stats.avgRating.toFixed(1)} label="rating" />
                          )}
                        </div>
                      </div>

                      {selfEvaluation?.personalChronicle && (
                        <blockquote className="border-l-2 border-primary/30 pl-3 italic text-sm text-muted-foreground">
                          <Quote className="h-3.5 w-3.5 inline-block mr-1 opacity-50 -mt-1" />
                          {selfEvaluation.personalChronicle}
                        </blockquote>
                      )}
                    </div>

                    {/* ── Right: Atributos Modificados ── */}
                    {activeDeltas.length > 0 && (
                      <div>
                        <h5 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Atributos Modificados</h5>
                        <div className="space-y-1.5">
                          {ATTR_ORDER.map(attr => {
                            const delta = attributeDeltas[attr] ?? 0;
                            return (
                              <div key={attr} className="flex items-center gap-2">
                                <span className="text-xs font-mono w-8 text-muted-foreground shrink-0">{ATTR_LABELS[attr]}</span>
                                {delta !== 0 ? (
                                  <>
                                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={cn('h-full rounded-full transition-all', delta > 0 ? 'bg-emerald-500' : 'bg-red-500')}
                                        style={{ width: `${Math.min(Math.abs(delta) * 20, 100)}%` }}
                                      />
                                    </div>
                                    <span className={cn(
                                      'text-xs font-bold w-8 text-right tabular-nums shrink-0',
                                      delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                                    )}>
                                      {delta > 0 ? '+' : ''}{delta}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground/40 ml-1">─</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Votos del Vestuario (full width) ── */}
                  {peerEvaluations.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      <h5 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" /> Votos del Vestuario
                      </h5>
                      <div className="grid gap-3">
                        {peerEvaluations.map(evalItem => {
                          const hasRating = typeof evalItem.rating === 'number';
                          const hasTags = !!(evalItem.performanceTags && evalItem.performanceTags.length > 0);
                          const style = getPeerCardStyle(hasRating ? evalItem.rating : undefined, hasTags);

                          return (
                            <div key={evalItem.id} className={cn(
                              'relative overflow-hidden rounded-lg bg-card border shadow-sm transition-all hover:shadow-md',
                              'border-l-[6px]', style.border,
                            )}>
                              <div className="p-4 flex gap-4 items-start">
                                {/* Avatar */}
                                <div className="flex flex-col items-center gap-1.5 min-w-[3.5rem]">
                                  <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                                    {evalItem.identityRevealed && evalItem.evaluatorPhotoUrl ? (
                                      <AvatarImage src={evalItem.evaluatorPhotoUrl} />
                                    ) : evalItem.identityRevealed ? (
                                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                        {evalItem.evaluatorDisplayName?.charAt(0).toUpperCase() || '?'}
                                      </AvatarFallback>
                                    ) : (
                                      <AvatarFallback className="bg-muted text-muted-foreground">
                                        <Lock className="h-4 w-4" />
                                      </AvatarFallback>
                                    )}
                                  </Avatar>
                                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight text-center leading-tight">
                                    {evalItem.identityRevealed ? 'Revelado' : 'Anónimo'}
                                  </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-3">
                                  {/* Identity row */}
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

                                  {/* Rating circle */}
                                  {hasRating && (
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        'h-12 w-12 rounded-full flex items-center justify-center text-xl font-black font-mono tracking-tighter shrink-0 tabular-nums',
                                        style.badge,
                                      )}>
                                        {evalItem.rating?.toFixed(1)}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold uppercase tracking-wide text-foreground">Puntaje General</span>
                                        <span className="text-xs text-muted-foreground">Evaluación de rendimiento</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Tags */}
                                  {hasTags && (
                                    <div className="space-y-2">
                                      {!hasRating && (
                                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-wide block mb-1">Destaques</span>
                                      )}
                                      <div className="flex flex-wrap gap-2">
                                        {evalItem.performanceTags!.map((tag, i) => {
                                          const tagName = typeof tag === 'string' ? tag : tag.name;
                                          return (
                                            <div key={i} className="flex items-center gap-2 bg-secondary text-secondary-foreground border border-border/50 rounded-md px-3 py-1.5 shadow-sm">
                                              <div className="text-accent"><TagIcon tag={tagName} /></div>
                                              <span className="text-xs font-semibold leading-none pt-0.5">{tagName}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Text description */}
                                  {evalItem.textDescription ? (
                                    <div className="relative mt-2 p-3 bg-muted/40 rounded-r-lg border-l-2 border-primary/20 text-sm text-foreground/80 italic">
                                      &ldquo;{evalItem.textDescription}&rdquo;
                                    </div>
                                  ) : (!hasRating && !hasTags) && (
                                    <p className="text-xs text-muted-foreground italic">Sin detalles adicionales.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-2 opacity-60 mt-4">
                      <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Sin feedback escrito esta vez.</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
