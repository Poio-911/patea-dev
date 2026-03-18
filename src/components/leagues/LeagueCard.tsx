
'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import Link from 'next/link';
import type { League, Match, LeagueStanding } from '@/lib/types';
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

const statusLabels = {
  draft: 'Borrador',
  open_for_applications: 'Abierta',
  in_progress: 'En Curso',
  completed: 'Finalizada',
};

export function LeagueCard({ league, matches = [], standings = [] }: LeagueCardProps) {
  const statusLabel = statusLabels[league.status] || 'Borrador';
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
          'relative rounded-2xl border border-border border-l-4 border-l-blue-500 bg-card',
          'overflow-hidden transition-all duration-300',
          'hover:-translate-y-1.5 hover:shadow-lg hover:shadow-blue-500/10',
        )}
      >
        <div className="p-5 space-y-4">
          {/* Header: icon + name + status badge */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'relative w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center',
                league.logoUrl
                  ? 'bg-muted/30 border border-border'
                  : 'bg-blue-500/10',
              )}
            >
              {league.logoUrl ? (
                <Image src={league.logoUrl} alt={league.name} fill sizes="56px" unoptimized className="object-contain" />
              ) : (
                <Shield className="h-7 w-7 text-blue-500" strokeWidth={1.5} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                  {league.name}
                </h3>
                <span className="shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-bold sport-text uppercase tracking-widest">
                  ● {statusLabel}
                </span>
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
                className="h-2 bg-muted [&>div]:bg-blue-500"
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
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              <Trophy className="h-4 w-4 text-blue-500 shrink-0" />
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
          <div className="flex items-center gap-1 text-sm font-semibold text-blue-500 sport-text group-hover:gap-2 transition-all">
            Ver Liga
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}
