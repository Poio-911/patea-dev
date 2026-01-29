
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { League, Match, LeagueStanding } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Calendar, ArrowRight, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getLeagueProgress, getNextMatchForTeam } from '@/lib/utils/league-standings';
import { cn } from '@/lib/utils';

type LeagueCardProps = {
  league: League;
  matches?: Match[];
  standings?: LeagueStanding[];
};

const statusConfig = {
  draft: { label: 'Borrador', variant: 'secondary' as const },
  open_for_applications: { label: 'Abierta', variant: 'default' as const },
  in_progress: { label: 'En Curso', variant: 'default' as const },
  completed: { label: 'Finalizada', variant: 'outline' as const },
};

export function LeagueCard({ league, matches = [], standings = [] }: LeagueCardProps) {
  const status = statusConfig[league.status] || statusConfig.draft;
  const progress = getLeagueProgress(matches);
  const completedMatches = matches.filter(m => m.status === 'completed' || m.status === 'evaluated').length;
  const leader = standings[0];

  // Get next upcoming match
  const nextMatch = useMemo(() => {
    const now = new Date();
    return matches
      .filter(m => m.status === 'upcoming' && new Date(m.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  }, [matches]);

  return (
    <Link href={`/competitions/leagues/${league.id}`} className="block group">
      <Card className={cn(
        "fifa-league-card h-full transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1",
        "hover:bg-transparent"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* League Icon or Logo */}
            <div className={cn(
              "w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center",
              league.logoUrl ? "border bg-muted/30" : "bg-card border"
            )}>
              {league.logoUrl ? (
                <img src={league.logoUrl} alt={league.name} className="w-full h-full object-contain" />
              ) : (
                <Shield className="h-6 w-6 fifa-league-icon fifa-league-icon-animated" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg group-hover:text-foreground transition-colors">
                  {league.name}
                </CardTitle>
                <Badge className="shrink-0" variant={league.status === 'in_progress' ? 'default' : status.variant}>
                  {league.status === 'in_progress' ? 'En Curso' : status.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{league.teams.length} equipos</span>
                <span>·</span>
                <span>{league.format === 'round_robin' ? 'Todos vs Todos' : 'Ida y Vuelta'}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-4">
          {/* Progress Bar */}
          {league.status !== 'draft' && matches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progreso</span>
                <span>{completedMatches} / {matches.length} partidos</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Leader */}
          {leader && league.status !== 'draft' && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border">
              <Trophy className="h-4 w-4 text-foreground shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <JerseyPreview jersey={leader.teamJersey} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground">{leader.teamName}</p>
                  <p className="text-xs text-muted-foreground">{leader.points} pts</p>
                </div>
              </div>
            </div>
          )}

          {/* Next Match */}
          {nextMatch && league.status === 'in_progress' && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Próximo partido</p>
                <p className="text-sm font-medium truncate">
                  {nextMatch.teams?.[0]?.name} vs {nextMatch.teams?.[1]?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(nextMatch.date), "EEE d, HH:mm'hs'", { locale: es })}
                </p>
              </div>
            </div>
          )}

          {/* Draft State Message */}
          {league.status === 'draft' && (
            <div className="p-3 rounded-md bg-muted/30 border border-dashed">
              <p className="text-xs text-muted-foreground text-center">
                Liga en borrador - Lista para iniciar
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0">
          <Button variant="link" className="p-0 h-auto group-hover:gap-3 transition-all">
            Ver Liga <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
