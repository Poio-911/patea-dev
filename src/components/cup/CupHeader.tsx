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
import { Trophy, Play, Trash2, MoreVertical } from 'lucide-react';
import { getRoundName } from '@/lib/utils/cup-bracket';
import { BackButton } from '@/components/navigation/back-button';
import { cn } from '@/lib/utils';
import { getPlayerPhoto } from '@/lib/player-photo';

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
              cup.logoUrl
                ? 'bg-muted/30 border border-border'
                : [
                    'bg-gradient-to-br from-amber-500/15 to-amber-600/5',
                    'border border-amber-500/25',
                    'shadow-[inset_0_0_20px_rgba(245,158,11,0.08)]',
                  ],
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
              <>
                {cup.status === 'in_progress' && (
                  <span className="absolute inset-0 rounded-2xl ring-2 ring-amber-400/30 animate-ping" />
                )}
                <Trophy className="h-8 w-8 md:h-10 md:w-10 text-amber-500 relative z-10" strokeWidth={1.5} />
              </>
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
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold sport-text uppercase tracking-widest border",
                cup.status === 'in_progress'
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                  : cup.status === 'completed'
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-muted/60 text-muted-foreground border-border/40"
              )}>
                {cup.status === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                {cup.status === 'completed' && <Trophy className="w-3 h-3" />}
                {statusLabel}
              </span>
              <span className="text-sm text-muted-foreground">{cup.teams.length} equipos</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-sm text-muted-foreground">Eliminación Directa</span>
            </div>

            {/* Current round chip */}
            {cup.currentRound && cup.status === 'in_progress' && (
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/70 sport-text">En Juego</span>
                <span className="w-px h-3 bg-amber-500/30" />
                <span className="text-xs font-bold text-amber-400 sport-text">{getRoundName(cup.currentRound)}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </div>
            )}

            {/* Organizer */}
            {organizer && (
              <div className="flex items-center gap-2 justify-start pt-1">
                <span className="text-muted-foreground text-sm">Organizado por</span>
                <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-full">
                  {getPlayerPhoto(organizer as any) ? (
                    <div className="relative w-4 h-4 rounded-full overflow-hidden">
                      <Image
                        src={getPlayerPhoto(organizer as any)!}
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
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold sport-text uppercase tracking-wider text-xs data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:[filter:drop-shadow(0_2px_6px_rgba(245,158,11,0.3))]"
          >
            Bracket
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold sport-text uppercase tracking-wider text-xs data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:[filter:drop-shadow(0_2px_6px_rgba(245,158,11,0.3))]"
          >
            Equipos
          </TabsTrigger>
          {isOwner && cup.status === 'open_for_applications' && (
            <TabsTrigger
              value="applications"
              className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold sport-text uppercase tracking-wider text-xs data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:[filter:drop-shadow(0_2px_6px_rgba(245,158,11,0.3))]"
            >
              Postulaciones
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
}
