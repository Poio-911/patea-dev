
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { League, Match, LeagueStanding } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Calendar, ArrowRight, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getLeagueProgress } from '@/lib/utils/league-standings';
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
  const top3 = standings.slice(0, 3);

  const nextMatch = useMemo(() => {
    const now = new Date();
    return matches
      .filter(m => m.status === 'upcoming' && new Date(m.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  }, [matches]);

  return (
    <Link href={`/competitions/leagues/${league.id}`} className="block group">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border transition-all duration-300',
          'hover:shadow-xl hover:-translate-y-1.5 hover:shadow-blue-500/10 game:hover:shadow-blue-500/25',
          'bg-gradient-to-br from-blue-50 via-white to-indigo-50/50',
          'dark:from-blue-950/30 dark:via-card dark:to-indigo-950/20',
          'game:from-blue-900/50 game:via-blue-950/30 game:to-indigo-900/40',
          'border-blue-100 dark:border-blue-900/50 game:border-blue-500/50',
          'group-hover:border-blue-300 dark:group-hover:border-blue-700/60 game:group-hover:border-blue-400/70',
        )}
      >
        {/* Top accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500" />

        <div className="p-5 space-y-4">
          {/* Header: icon + name + status badge */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md',
                league.logoUrl
                  ? 'border border-blue-100 dark:border-blue-900/50 bg-white dark:bg-blue-950/20'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600',
              )}
            >
              {league.logoUrl ? (
                <img src={league.logoUrl} alt={league.name} className="w-full h-full object-contain" />
              ) : (
                <Shield className="h-7 w-7 text-white" strokeWidth={1.5} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                  {league.name}
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 text-xs font-medium',
                    league.status === 'in_progress' &&
                      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
                    league.status === 'completed' && 'bg-muted text-muted-foreground',
                    league.status === 'draft' && 'bg-muted text-muted-foreground',
                    league.status === 'open_for_applications' &&
                      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300',
                  )}
                >
                  {league.status === 'in_progress' ? 'En Curso' : status.label}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <span>{league.teams.length} equipos</span>
                <span>·</span>
                <span>{league.format === 'round_robin' ? 'Todos vs Todos' : 'Ida y Vuelta'}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {league.status !== 'draft' && matches.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progreso</span>
                <span className="font-medium tabular-nums">
                  {completedMatches}/{matches.length} partidos
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2 bg-blue-100 dark:bg-blue-950/50 [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:to-indigo-500"
              />
            </div>
          )}

          {/* Mini standings top-3 */}
          {top3.length > 0 && league.status !== 'draft' && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Posiciones
              </p>
              <div className="space-y-0.5">
                {top3.map((standing, i) => (
                  <div key={standing.teamId} className="flex items-center gap-2 py-1 px-1">
                    <span
                      className={cn(
                        'text-sm w-5 text-center',
                        i === 0 && 'text-yellow-500',
                        i === 1 && 'text-slate-400',
                        i === 2 && 'text-amber-600',
                      )}
                    >
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </span>
                    <JerseyPreview jersey={standing.teamJersey} size="sm" />
                    <span className="flex-1 text-xs font-medium truncate">{standing.teamName}</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {standing.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leader only (when full standings not available but one exists) */}
          {top3.length === 0 && standings[0] && league.status !== 'draft' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40">
              <Trophy className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <JerseyPreview jersey={standings[0].teamJersey} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{standings[0].teamName}</p>
                  <p className="text-xs text-muted-foreground">{standings[0].points} pts</p>
                </div>
              </div>
            </div>
          )}

          {/* Next Match */}
          {nextMatch && league.status === 'in_progress' && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider font-medium">Próximo partido</p>
                <p className="text-sm font-medium truncate leading-tight">
                  {nextMatch.teams?.[0]?.name} vs {nextMatch.teams?.[1]?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(nextMatch.date), "EEE d, HH:mm'hs'", { locale: es })}
                </p>
              </div>
            </div>
          )}

          {/* Draft state */}
          {league.status === 'draft' && (
            <div className="p-3 rounded-xl bg-muted/30 border border-dashed text-center">
              <p className="text-xs text-muted-foreground">Liga en borrador — Lista para iniciar</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex items-center justify-end">
          <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 game:text-blue-300 group-hover:gap-2 transition-all">
            Ver Liga
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}
