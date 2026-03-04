'use client';

import Image from 'next/image';
import type { Cup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveDropdownMenu,
  ResponsiveDropdownMenuContent,
  ResponsiveDropdownMenuItem,
  ResponsiveDropdownMenuSeparator,
  ResponsiveDropdownMenuTrigger,
} from '@/components/ui/responsive-dropdown-menu';
import { Trophy, Play, Trash2, Target, MoreVertical } from 'lucide-react';
import { getRoundName } from '@/lib/utils/cup-bracket';
import { BackButton } from '@/components/navigation/back-button';
import { cn } from '@/lib/utils';

export type CupTab = 'bracket' | 'teams' | 'applications';

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

        <div className="flex flex-row items-start gap-4">
          {/* Logo or Trophy icon */}
          <div
            className={cn(
              'w-16 h-16 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center relative',
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
              <Trophy className="h-8 w-8 md:h-10 md:w-10 text-amber-500" strokeWidth={1.5} />
            )}
          </div>

          <div className="flex-1 space-y-2.5 min-w-0">
            {/* Title + owner actions */}
            <div className="flex flex-row items-start justify-between gap-2">
              <h1 className="text-2xl md:text-3xl font-black sport-text leading-tight text-foreground">
                {cup.name}
              </h1>

              {isOwner && (
                <div className="flex items-center gap-2 shrink-0">
                  {(cup.status === 'draft' || cup.status === 'open_for_applications') && (
                    <Button onClick={onStartCup} size="sm" className="gap-1.5">
                      <Play className="h-3.5 w-3.5" />
                      Iniciar Copa
                    </Button>
                  )}
                  <ResponsiveDropdownMenu>
                    <ResponsiveDropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </ResponsiveDropdownMenuTrigger>
                    <ResponsiveDropdownMenuContent align="end">
                      {(cup.status === 'draft' || cup.status === 'open_for_applications') && (
                        <ResponsiveDropdownMenuItem onClick={onStartCup} className="gap-2">
                          <Play className="h-4 w-4 text-amber-500" />
                          Iniciar Copa
                        </ResponsiveDropdownMenuItem>
                      )}
                      {(cup.status === 'draft' || cup.status === 'open_for_applications') && (
                        <ResponsiveDropdownMenuSeparator />
                      )}
                      <ResponsiveDropdownMenuItem
                        onClick={onDeleteCup}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar Copa
                      </ResponsiveDropdownMenuItem>
                    </ResponsiveDropdownMenuContent>
                  </ResponsiveDropdownMenu>
                </div>
              )}
            </div>

            {/* Status + meta badges */}
            <div className="flex flex-wrap items-center gap-2 justify-start">
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
              <div className="flex items-center gap-2 justify-start pt-1">
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
          {isOwner && cup.status === 'open_for_applications' && (
            <TabsTrigger
              value="applications"
              className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
            >
              Postulaciones
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
}
