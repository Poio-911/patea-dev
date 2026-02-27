'use client';

import Image from 'next/image';
import type { Cup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const statusConfig = {
  draft: { label: 'Borrador', variant: 'secondary' as const },
  open_for_applications: { label: 'Abierta', variant: 'default' as const },
  in_progress: { label: 'En Curso', variant: 'default' as const },
  completed: { label: 'Finalizada', variant: 'outline' as const },
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
  const status = statusConfig[cup.status] || statusConfig.draft;

  return (
    <div className="space-y-0">
      {/* Amber gradient banner */}
      <div className="relative rounded-2xl overflow-hidden mb-0">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-400 dark:from-amber-900 dark:via-amber-800 dark:to-yellow-700" />
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* Top-to-transparent shine */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        <div className="relative p-5 md:p-8">
          <BackButton href="/competitions" label="Volver a Competiciones" className="mb-4 text-white/80 hover:text-white [&_svg]:text-white/80" />

          <div className="flex flex-col md:flex-row items-start gap-5">
            {/* Logo or Trophy icon */}
            <div
              className={cn(
                'w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center',
                'shadow-xl border-2 border-white/30 mx-auto md:mx-0 relative',
                cup.logoUrl ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/20 backdrop-blur-sm',
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
                <Trophy className="h-10 w-10 text-white drop-shadow-lg" strokeWidth={1.5} />
              )}
            </div>

            <div className="flex-1 space-y-2.5 text-center md:text-left">
              {/* Title + owner actions */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md leading-tight">
                  {cup.name}
                </h1>

                {isOwner && (
                  <div className="flex items-center gap-2 justify-center md:justify-end shrink-0">
                    {cup.status === 'draft' && (
                      <Button
                        onClick={onStartCup}
                        size="sm"
                        className="bg-white text-amber-700 hover:bg-white/90 shadow-lg font-semibold gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Iniciar Copa
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onDeleteCup}
                      className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/15"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Status + meta badges */}
              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                <Badge
                  variant="outline"
                  className="bg-white/20 text-white border-white/30 backdrop-blur-sm"
                >
                  {status.label}
                </Badge>
                <span className="text-white/70 text-sm">{cup.teams.length} equipos</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70 text-sm">Eliminación Directa</span>
              </div>

              {/* Current round chip */}
              {cup.currentRound && cup.status === 'in_progress' && (
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                  <Target className="h-3.5 w-3.5" />
                  {getRoundName(cup.currentRound)}
                </div>
              )}

              {/* Organizer */}
              {organizer && (
                <div className="flex items-center gap-2 justify-center md:justify-start pt-1">
                  <span className="text-white/60 text-sm">Organizado por</span>
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-2 py-1 rounded-full">
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
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">
                          {organizer.displayName?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-white/90 truncate max-w-[120px]">
                      {organizer.displayName || 'Usuario'}
                    </span>
                  </div>
                </div>
              )}
            </div>
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
