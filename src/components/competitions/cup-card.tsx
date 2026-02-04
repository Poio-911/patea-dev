'use client';

import Link from 'next/link';
import type { Cup } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Target, ArrowRight, Crown } from 'lucide-react';
import { getRoundName, isTournamentComplete } from '@/lib/utils/cup-bracket';
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

  return (
    <Link href={`/competitions/cups/${cup.id}`} className="block group">
      <Card className={cn(
        "fifa-cup-card h-full transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1",
        "hover:bg-transparent"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* Trophy Icon or Logo */}
            <div className={cn(
              "w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center",
              cup.logoUrl ? "border bg-muted/30" : "bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30"
            )}>
              {cup.logoUrl ? (
                <img src={cup.logoUrl} alt={cup.name} className="w-full h-full object-contain" />
              ) : (
                <Trophy className="h-6 w-6 fifa-cup-icon fifa-cup-icon-animated" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-colors">
                  {cup.name}
                </CardTitle>
                <Badge className="shrink-0" variant={cup.status === 'in_progress' ? 'default' : status.variant}>
                  {cup.status === 'in_progress' ? 'En Curso' : status.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{cup.teams.length} equipos</span>
                <span>·</span>
                <span>Eliminación Directa</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-4">
          {/* Current Round */}
          {cup.status === 'in_progress' && cup.currentRound && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border border-yellow-500/20">
              <Target className="h-4 w-4 fifa-cup-icon shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Ronda Actual</p>
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-500">{getRoundName(cup.currentRound)}</p>
              </div>
            </div>
          )}

          {/* Champion */}
          {isCompleted && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
              <Crown className="h-5 w-5 text-yellow-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Campeón</p>
                <p className="text-sm font-bold text-yellow-700 dark:text-yellow-500 truncate">
                  {cup.championTeamName}
                </p>
              </div>
            </div>
          )}

          {/* Draft State Message */}
          {cup.status === 'draft' && (
            <div className="p-3 rounded-md bg-muted/30 border border-dashed">
              <p className="text-xs text-muted-foreground text-center">
                Copa en borrador - Lista para iniciar
              </p>
            </div>
          )}

          {/* Open for Applications */}
          {cup.status === 'open_for_applications' && cup.isPublic && (
            <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
              <p className="text-xs text-center font-medium">
                Aceptando postulaciones de equipos
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0">
          <Button
            variant="link"
            className={cn(
              "p-0 h-auto group-hover:gap-3 transition-all",
              isCompleted
                ? "trophy-shimmer"
                : "text-[hsl(var(--cup-primary))] hover:text-[hsl(var(--cup-secondary))]"
            )}
          >
            {isCompleted ? 'Ver Campeón' : 'Ver Copa'}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
