'use client';

import Link from 'next/link';
import type { Cup } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Target, ArrowRight, Crown } from 'lucide-react';
import { getRoundName, isTournamentComplete } from '@/lib/utils/cup-bracket';

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
      <Card className="hover:bg-muted/50 transition-all hover:shadow-md h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {cup.logoUrl && (
              <div className="w-12 h-12 rounded-lg overflow-hidden border shrink-0 bg-muted/30">
                <img src={cup.logoUrl} alt={cup.name} className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {cup.name}
                </CardTitle>
                <Badge variant={status.variant} className="shrink-0">
                  {status.label}
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
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Ronda Actual</p>
                <p className="text-sm font-semibold">{getRoundName(cup.currentRound)}</p>
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
          <Button variant="link" className="p-0 h-auto group-hover:gap-3 transition-all">
            Ver Copa <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
