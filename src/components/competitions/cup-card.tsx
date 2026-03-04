'use client';

import Link from 'next/link';
import type { Cup } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, ArrowRight, Crown } from 'lucide-react';
import { getRoundName } from '@/lib/utils/cup-bracket';
import { cn } from '@/lib/utils';

type CupCardProps = {
  cup: Cup;
};

const statusLabels = {
  draft: 'Borrador',
  open_for_applications: 'Abierta',
  in_progress: 'En Curso',
  completed: 'Finalizada',
};

export function CupCard({ cup }: CupCardProps) {
  const statusLabel = statusLabels[cup.status] || 'Borrador';
  const isCompleted = cup.status === 'completed' && cup.championTeamId;

  // Bracket progress from bracket data
  const totalMatches = cup.bracket?.length || 0;
  const completedMatches = cup.bracket?.filter((m) => m.winnerId).length || 0;
  const bracketProgress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

  return (
    <Link href={`/competitions/cups/${cup.id}`} className="block group">
      <div
        className={cn(
          'relative rounded-2xl border border-border border-l-4 border-l-amber-500 bg-card',
          'overflow-hidden transition-all duration-300',
          'hover:-translate-y-1.5 hover:shadow-lg hover:shadow-amber-500/10',
        )}
      >
        <div className="p-5 space-y-4">
          {/* Header: icon + name + status badge */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center',
                cup.logoUrl
                  ? 'bg-muted/30 border border-border'
                  : 'bg-amber-500/10',
              )}
            >
              {cup.logoUrl ? (
                <img src={cup.logoUrl} alt={cup.name} className="w-full h-full object-contain" />
              ) : (
                <Trophy className="h-7 w-7 text-amber-500" strokeWidth={1.5} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-tight">
                  {cup.name}
                </h3>
                <span className="shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold sport-text uppercase tracking-widest">
                  ● {statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <span>{cup.teams.length} equipos</span>
                <span>·</span>
                <span>Eliminación Directa</span>
              </div>
            </div>
          </div>

          {/* Bracket progress bar */}
          {cup.status === 'in_progress' && totalMatches > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progreso del bracket</span>
                <span className="font-medium tabular-nums">
                  {completedMatches}/{totalMatches} partidos
                </span>
              </div>
              <Progress
                value={bracketProgress}
                className="h-2 bg-muted [&>div]:bg-amber-500"
              />
            </div>
          )}

          {/* Current Round */}
          {cup.status === 'in_progress' && cup.currentRound && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border">
              <Target className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ronda Actual</p>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {getRoundName(cup.currentRound)}
                </p>
              </div>
            </div>
          )}

          {/* Champion */}
          {isCompleted && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border">
              <Crown className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Campeón</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 truncate">
                  {cup.championTeamName}
                </p>
              </div>
            </div>
          )}

          {/* Draft state */}
          {cup.status === 'draft' && (
            <div className="p-3 rounded-xl bg-muted/30 border border-dashed text-center">
              <p className="text-xs text-muted-foreground">Copa en borrador — Lista para iniciar</p>
            </div>
          )}

          {/* Open for applications */}
          {cup.status === 'open_for_applications' && cup.isPublic && (
            <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 text-center">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Aceptando postulaciones de equipos
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex items-center justify-end">
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-semibold sport-text group-hover:gap-2 transition-all',
              isCompleted ? 'text-amber-500' : 'text-amber-600 dark:text-amber-400',
            )}
          >
            {isCompleted ? 'Ver Campeón' : 'Ver Copa'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}
