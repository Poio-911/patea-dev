'use client';

import { Card } from '@/components/ui/card';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Medal, Star, Crown } from 'lucide-react';
import type { Jersey } from '@/lib/types';
import { cn } from '@/lib/utils';

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
    <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/5 shadow-xl">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative pt-16 p-8 md:p-12 flex flex-col items-center text-center">

        {/* Champion Section */}
        <div className="mb-8 relative">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 animate-pulse">
            <Crown className="h-12 w-12 text-amber-500 fill-amber-500/20" />
          </div>

          <div className="relative z-10 transform transition-transform hover:scale-105 duration-500">
            {championJersey ? (
              <div className="drop-shadow-[0_0_25px_rgba(245,158,11,0.4)]">
                <JerseyPreview jersey={championJersey} size="xl" />
              </div>
            ) : (
              <div className="h-48 w-48 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center border-4 border-amber-500/30">
                <Trophy className="h-24 w-24 text-amber-500" />
              </div>
            )}

            {/* Winner Badge */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-6 py-1.5 rounded-full font-bold text-sm shadow-lg border border-yellow-400/50 whitespace-nowrap flex items-center gap-2">
              <Star className="h-3.5 w-3.5 fill-current" />
              CAMPEÓN
              <Star className="h-3.5 w-3.5 fill-current" />
            </div>
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent mt-4 mb-2">
          {championName}
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
          ¡Felicitaciones por la victoria! El trofeo es suyo.
        </p>

        {/* Runner Up Section */}
        <div className="flex items-center justify-center gap-6 md:gap-12 w-full max-w-2xl border-t border-border/50 pt-8 mt-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Subcampeón</span>
            <div className="flex items-center gap-4 bg-card/50 p-3 pr-6 rounded-full border border-border/50 backdrop-blur-sm">
              <div className="relative">
                {runnerUpJersey ? (
                  <JerseyPreview jersey={runnerUpJersey} size="sm" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Medal className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-muted-foreground text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-background">
                  2
                </div>
              </div>
              <span className="font-semibold text-lg">{runnerUpName}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
