'use client';

import { Card, CardContent } from '@/components/ui/card';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Medal } from 'lucide-react';
import type { Jersey } from '@/lib/types';

type ChampionCelebrationProps = {
  championName: string;
  championJersey?: Jersey;
  runnerUpName: string;
  runnerUpJersey?: Jersey;
};

export function ChampionCelebration({
  championName,
  championJersey,
  runnerUpName,
  runnerUpJersey,
}: ChampionCelebrationProps) {
  return (
    <Card className="border-2 border-yellow-500 bg-gradient-to-br from-yellow-50/50 via-white to-yellow-50/50 dark:from-yellow-950/20 dark:via-background dark:to-yellow-950/20">
      <CardContent className="p-8">
        <div className="text-center space-y-6">
          {/* Trophy Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <Trophy className="h-20 w-20 text-yellow-500" strokeWidth={1.5} />
            </div>
          </div>

          {/* Champion */}
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">
              ¡Campeón!
            </h2>
            <div className="flex items-center justify-center gap-4">
              {championJersey && (
                <JerseyPreview jersey={championJersey} size="lg" />
              )}
              <div>
                <p className="text-2xl font-bold">{championName}</p>
                <p className="text-sm text-muted-foreground">1er Lugar</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-muted" />
            <Medal className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 border-t border-muted" />
          </div>

          {/* Runner-up */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Subcampeón</p>
            <div className="flex items-center justify-center gap-3">
              {runnerUpJersey && (
                <JerseyPreview jersey={runnerUpJersey} size="sm" />
              )}
              <div>
                <p className="text-lg font-semibold">{runnerUpName}</p>
                <p className="text-xs text-muted-foreground">2do Lugar</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
