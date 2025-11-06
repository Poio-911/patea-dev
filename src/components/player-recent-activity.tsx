
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import type { Evaluation, Match, PerformanceTag } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Minus, Goal, Star, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { logger } from '@/lib/logger';

type PlayerRecentActivityProps = {
  playerId: string;
};

type PerformanceLevel = 'Excelente' | 'Bueno' | 'Medio' | 'Regular' | 'Bajo';

type MatchEvaluationSummary = {
    match: Match;
    performance: {
        level: PerformanceLevel;
        color: string;
        rating?: number;
    };
    goals: number;
};

const getPerformanceFromRating = (rating: number): { level: PerformanceLevel; color: string } => {
    if (rating >= 9) return { level: 'Excelente', color: 'text-green-400 border-green-400/50 bg-green-400/10' };
    if (rating >= 7) return { level: 'Bueno', color: 'text-emerald-400 border-emerald-400/50 bg-emerald-400/10' };
    if (rating >= 5) return { level: 'Medio', color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' };
    if (rating >= 3) return { level: 'Regular', color: 'text-orange-400 border-orange-400/50 bg-orange-400/10' };
    return { level: 'Bajo', color: 'text-red-400 border-red-400/50 bg-red-400/10' };
};

const getPerformanceFromTags = (tags: PerformanceTag[]): { level: PerformanceLevel; color: string } => {
    if (!tags || tags.length === 0) return { level: 'Medio', color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' };
    const score = tags.reduce((acc, tag) => {
        if (!tag || typeof tag !== 'object' || !('impact' in tag)) return acc;
        if (tag.impact === 'positive') return acc + 1;
        if (tag.impact === 'negative') return acc - 1;
        return acc;
    }, 0);

    if (score >= 3) return { level: 'Excelente', color: 'text-green-400 border-green-400/50 bg-green-400/10' };
    if (score > 0) return { level: 'Bueno', color: 'text-emerald-400 border-emerald-400/50 bg-emerald-400/10' };
    if (score === 0) return { level: 'Medio', color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' };
    if (score < 0) return { level: 'Regular', color: 'text-orange-400 border-orange-400/50 bg-orange-400/10' };
    return { level: 'Bajo', color: 'text-red-400 border-red-400/50 bg-red-400/10' };
};

export function PlayerRecentActivity({ playerId }: PlayerRecentActivityProps) {
  const firestore = useFirestore();
  const [summaries, setSummaries] = useState<MatchEvaluationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      if (!firestore || !playerId) return;
      setIsLoading(true);

      try {
        const evalsQuery = query(
          collection(firestore, 'evaluations'),
          where('playerId', '==', playerId),
          orderBy('evaluatedAt', 'desc'),
          limit(5)
        );
        const evalsSnapshot = await getDocs(evalsQuery);
        const playerEvals = evalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
        
        if (playerEvals.length === 0) {
            setSummaries([]);
            setIsLoading(false);
            return;
        }

        const evalsByMatchId = playerEvals.reduce((acc, ev) => {
            if (!acc[ev.matchId]) {
                acc[ev.matchId] = [];
            }
            acc[ev.matchId].push(ev);
            return acc;
        }, {} as Record<string, Evaluation[]>);

        const matchIds = Object.keys(evalsByMatchId);
        const matchPromises = matchIds.map(id => getDoc(doc(firestore, 'matches', id)));
        const matchSnaps = await Promise.all(matchPromises);
        const matchesMap = new Map(matchSnaps.map(snap => [snap.id, { id: snap.id, ...snap.data() } as Match]));

        const activitySummaries: MatchEvaluationSummary[] = [];

        for (const matchId of matchIds) {
            const match = matchesMap.get(matchId);
            const evaluations = evalsByMatchId[matchId];
            if (!match || !evaluations) continue;

            const ratings = evaluations.map(ev => ev.rating).filter((r): r is number => typeof r === 'number' && !isNaN(r));
            const hasNumericRatings = ratings.length > 0;
            const goals = evaluations.reduce((sum, ev) => sum + (ev.goals || 0), 0);
            const allTags = evaluations.flatMap(ev => ev.performanceTags).filter(Boolean) as PerformanceTag[];

            let performance: { level: PerformanceLevel; color: string, rating?: number };
            if (hasNumericRatings) {
                const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                performance = { ...getPerformanceFromRating(avgRating), rating: avgRating };
            } else {
                performance = getPerformanceFromTags(allTags);
            }
            
            activitySummaries.push({ match, performance, goals });
        }
        
        activitySummaries.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
        setSummaries(activitySummaries);

      } catch (error: any) {
        logger.error('Failed to fetch player activity', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivity();
  }, [firestore, playerId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Actividad Reciente</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div></CardContent>
      </Card>
    );
  }

  if (summaries.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Actividad Reciente</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-4">Aún no hay partidos evaluados.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
        <CardDescription>Resumen de tus últimos partidos evaluados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {summaries.map(({ match, performance, goals }) => (
          <div key={match.id} className="p-3 border rounded-lg bg-muted/30">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold text-sm truncate">{match.title}</h4>
              <p className="text-xs text-muted-foreground">{format(new Date(match.date), 'dd MMM yyyy', { locale: es })}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 pt-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Rendimiento</p>
                <Badge variant="outline" className={cn('text-base mt-1', performance.color)}>{performance.level}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rating / Goles</p>
                <div className="flex items-center justify-center gap-3 mt-1">
                    {performance.rating !== undefined ? (
                        <div className="flex items-center gap-1 font-bold"><Star className="h-4 w-4 text-amber-400" /> {performance.rating.toFixed(1)}</div>
                    ) : (
                        <div className="flex items-center gap-1 font-bold text-muted-foreground"><Star className="h-4 w-4" /> -</div>
                    )}
                    <div className="flex items-center gap-1 font-bold"><Goal className="h-4 w-4" /> {goals}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
