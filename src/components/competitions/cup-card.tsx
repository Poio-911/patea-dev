'use client';

import Link from 'next/link';
import type { Cup } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, ArrowRight, Crown } from 'lucide-react';
import { getRoundName } from '@/lib/utils/cup-bracket';
import { cn } from '@/lib/utils';

type CupCardProps = {
  cup: Cup;
};

const statusConfig = {
  draft: { label: 'Borrador', variant: 'secondary' as const },
  open_for_applications: { label: 'Abierta', variant: 'default' as const },
  in_progress: { label: 'En Curso', variant: 'default' as const },
  completed: { label: 'Finalizada', variant: 'outline' as const },
};

export function CupCard({ cup }: CupCardProps) {
  const status = statusConfig[cup.status] || statusConfig.draft;
  const isCompleted = cup.status === 'completed' && cup.championTeamId;

  // Bracket progress from bracket data
  const totalMatches = cup.bracket?.length || 0;
  const completedMatches = cup.bracket?.filter((m) => m.winnerId).length || 0;
  const bracketProgress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

  return (
    <Link href={`/competitions/cups/${cup.id}`} className="block group">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border transition-all duration-300',
          'hover:shadow-xl hover:-translate-y-1.5 hover:shadow-amber-500/10 game:hover:shadow-amber-500/25',
          'bg-gradient-to-br from-amber-50 via-white to-yellow-50/50',
          'dark:from-amber-950/30 dark:via-card dark:to-yellow-950/20',
          'game:from-amber-900/50 game:via-amber-950/30 game:to-yellow-900/40',
          'border-amber-100 dark:border-amber-900/50 game:border-amber-500/50',
          'group-hover:border-amber-300 dark:group-hover:border-amber-700/60 game:group-hover:border-amber-400/70',
        )}
      >
        {/* Top accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400" />

        <div className="p-5 space-y-4">
          {/* Header: icon + name + status badge */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md',
                cup.logoUrl
                  ? 'border border-amber-100 dark:border-amber-900/50 bg-white dark:bg-amber-950/20'
                  : 'bg-gradient-to-br from-amber-500 to-yellow-500',
              )}
            >
              {cup.logoUrl ? (
                <img src={cup.logoUrl} alt={cup.name} className="w-full h-full object-contain" />
              ) : (
                <Trophy className="h-7 w-7 text-white" strokeWidth={1.5} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-tight">
                  {cup.name}
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 text-xs font-medium',
                    cup.status === 'in_progress' &&
                      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
                    cup.status === 'completed' && 'bg-muted text-muted-foreground',
                    cup.status === 'draft' && 'bg-muted text-muted-foreground',
                    cup.status === 'open_for_applications' &&
                      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300',
                  )}
                >
                  {cup.status === 'in_progress' ? 'En Curso' : status.label}
                </Badge>
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
                className="h-2 bg-amber-100 dark:bg-amber-950/50 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-yellow-400"
              />
            </div>
          )}

          {/* Current Round */}
          {cup.status === 'in_progress' && cup.currentRound && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
              <Target className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ronda Actual</p>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {getRoundName(cup.currentRound)}
                </p>
              </div>
            </div>
          )}

          {/* Champion */}
          {isCompleted && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800">
              <Crown className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Campeón</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400 truncate">
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
              'flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all',
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
