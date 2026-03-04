'use client';

import Image from 'next/image';
import type { Cup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Play, Trash2, Target } from 'lucide-react';
import { getRoundName } from '@/lib/utils/cup-bracket';
import { BackButton } from '@/components/navigation/back-button';
import { cn } from '@/lib/utils';

export type CupTab = 'bracket' | 'teams';

type CupHeaderProps = {
  cup: Cup;
  activeTab: CupTab;
  onTabChange: (tab: CupTab) => void;
  isOwner: boolean;
  organizer?: any;
  onStartCup?: () => void;
  onDeleteCup?: () => void;
};

const statusLabels = {
  draft: 'Borrador',
  open_for_applications: 'Abierta',
  in_progress: 'En Curso',
  completed: 'Finalizada',
};

export function CupHeader({
  cup,
  activeTab,
  onTabChange,
  isOwner,
  organizer,
  onStartCup,
  onDeleteCup,
}: CupHeaderProps) {
  const statusLabel = statusLabels[cup.status] || 'Borrador';

  return (
    <div className="space-y-0">
      {/* Editorial header — no gradient banner */}
      <div className="pb-0 pt-2 space-y-5 mb-0">
        <BackButton href="/competitions" label="Volver a Competiciones" className="mb-4" />

        <div className="flex flex-col md:flex-row items-start gap-5">
          {/* Logo or Trophy icon */}
          <div
            className={cn(
              'w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center mx-auto md:mx-0 relative',
              cup.logoUrl ? 'bg-muted/30 border border-border' : 'bg-amber-500/10',
            )}
          >
            {cup.logoUrl ? (
              <Image
                src={cup.logoUrl}
                alt={cup.name}
                fill
                className="object-contain p-1"
                sizes="96px"
              />
            ) : (
              <Trophy className="h-10 w-10 text-amber-500" strokeWidth={1.5} />
            )}
          </div>

          <div className="flex-1 space-y-2.5 text-center md:text-left">
            {/* Title + owner actions */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <h1 className="text-2xl md:text-3xl font-black sport-text leading-tight text-foreground">
                {cup.name}
              </h1>

              {isOwner && (
                <div className="flex items-center gap-2 justify-center md:justify-end shrink-0">
                  {cup.status === 'draft' && (
                    <Button onClick={onStartCup} size="sm" className="gap-1.5">
                      <Play className="h-3.5 w-3.5" />
                      Iniciar Copa
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDeleteCup}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Status + meta badges */}
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold sport-text uppercase tracking-widest">
                ● {statusLabel}
              </span>
              <span className="text-sm text-muted-foreground">{cup.teams.length} equipos</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-sm text-muted-foreground">Eliminación Directa</span>
            </div>

            {/* Current round chip */}
            {cup.currentRound && cup.status === 'in_progress' && (
              <div className="inline-flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full text-sm font-medium">
                <Target className="h-3.5 w-3.5 text-amber-500" />
                {getRoundName(cup.currentRound)}
              </div>
            )}

            {/* Organizer */}
            {organizer && (
              <div className="flex items-center gap-2 justify-center md:justify-start pt-1">
                <span className="text-muted-foreground text-sm">Organizado por</span>
                <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-full">
                  {organizer.photoURL || organizer.photoUrl ? (
                    <div className="relative w-4 h-4 rounded-full overflow-hidden">
                      <Image
                        src={organizer.photoURL || organizer.photoUrl}
                        alt={organizer.displayName || 'Organizador'}
                        fill
                        className="object-cover"
                        sizes="16px"
                      />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {organizer.displayName?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                    {organizer.displayName || 'Usuario'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — amber underline style */}
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as CupTab)} className="w-full">
        <TabsList className="bg-transparent p-0 border-b w-full justify-start h-auto rounded-none space-x-6 overflow-x-auto scrollbar-hide">
          <TabsTrigger
            value="bracket"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
          >
            Bracket
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
          >
            Equipos
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
