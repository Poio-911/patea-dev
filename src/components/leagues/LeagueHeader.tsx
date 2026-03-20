'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { League, CompetitionStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveDropdownMenu,
  ResponsiveDropdownMenuContent,
  ResponsiveDropdownMenuItem,
  ResponsiveDropdownMenuSeparator,
  ResponsiveDropdownMenuTrigger,
} from '@/components/ui/responsive-dropdown-menu';
import { ChevronLeft, Play, Trophy, Trash2, MoreVertical, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerPhoto } from '@/lib/player-photo';

type LeagueTab = 'standings' | 'fixture' | 'teams' | 'scorers' | 'applications' | 'my-team';

type LeagueHeaderProps = {
  league: League;
  activeTab: LeagueTab;
  onTabChange: (tab: LeagueTab) => void;
  isOwner: boolean;
  onStartLeague?: () => void;
  onCompleteLeague?: () => void;
  onDeleteLeague?: () => void;
  organizer?: any; // UserProfile
  hasUserTeam?: boolean;
};

const statusLabels: Record<CompetitionStatus, string> = {
  draft: 'Borrador',
  open_for_applications: 'Abierta',
  in_progress: 'En Curso',
  completed: 'Finalizada',
};

export function LeagueHeader({
  league,
  activeTab,
  onTabChange,
  isOwner,
  onStartLeague,
  onCompleteLeague,
  onDeleteLeague,
  organizer,
  hasUserTeam,
}: LeagueHeaderProps) {
  const statusLabel = statusLabels[league.status];

  return (
    <div className="space-y-0">
      {/* Editorial header — no gradient banner */}
      <div className="pb-0 pt-2 space-y-5 mb-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/competitions"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Competiciones
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">{league.name}</span>
        </div>

        <div className="flex flex-row items-start gap-4">
          {/* Logo or Shield icon */}
          <div
            className={cn(
              'w-16 h-16 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center relative',
              league.logoUrl ? 'bg-muted/30 border border-border' : 'bg-blue-500/10',
            )}
          >
            {league.logoUrl ? (
              <Image
                src={league.logoUrl}
                alt={league.name}
                fill
                className="object-contain p-1"
                sizes="96px"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <svg viewBox="0 0 24 24" className="h-10 w-10 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2.5 min-w-0">
            {/* Title + owner actions */}
            <div className="flex flex-row items-start justify-between gap-2">
              <h1 className="text-2xl md:text-3xl font-black sport-text leading-tight text-foreground">
                {league.name}
              </h1>

              {isOwner && (
                <div className="flex items-center gap-2 shrink-0">
                  {(league.status === 'draft' || league.status === 'open_for_applications') && (
                    <Button onClick={onStartLeague} size="sm" className="gap-1.5">
                      <Play className="h-3.5 w-3.5" />
                      Iniciar Liga
                    </Button>
                  )}
                  {league.status === 'in_progress' && (
                    <Button onClick={onCompleteLeague} size="sm" className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Finalizar
                    </Button>
                  )}

                  <ResponsiveDropdownMenu>
                    <ResponsiveDropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </ResponsiveDropdownMenuTrigger>
                    <ResponsiveDropdownMenuContent align="end">
                      {(league.status === 'draft' || league.status === 'open_for_applications') && (
                        <ResponsiveDropdownMenuItem onClick={onStartLeague} className="gap-2">
                          <Play className="h-4 w-4 text-blue-600" />
                          Iniciar Liga
                        </ResponsiveDropdownMenuItem>
                      )}
                      {league.status === 'in_progress' && (
                        <ResponsiveDropdownMenuItem onClick={onCompleteLeague} className="gap-2">
                          <Trophy className="h-4 w-4 text-blue-600" />
                          Finalizar Liga
                        </ResponsiveDropdownMenuItem>
                      )}
                      <ResponsiveDropdownMenuSeparator />
                      <ResponsiveDropdownMenuItem
                        onClick={onDeleteLeague}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar Liga
                      </ResponsiveDropdownMenuItem>
                    </ResponsiveDropdownMenuContent>
                  </ResponsiveDropdownMenu>
                </div>
              )}
            </div>

            {/* Status badge + meta */}
            <div className="flex flex-wrap items-center gap-2 justify-start">
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-bold sport-text uppercase tracking-widest">
                ● {statusLabel}
              </span>
              <span className="text-sm text-muted-foreground">{league.teams.length} equipos</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-sm text-muted-foreground">
                {league.format === 'round_robin' ? 'Todos vs Todos' : 'Ida y Vuelta'}
              </span>
            </div>

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

      {/* Tabs — blue underline style */}
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as LeagueTab)} className="w-full">
        <TabsList className="bg-transparent p-0 border-b w-full justify-start h-auto rounded-none space-x-6 overflow-x-auto scrollbar-hide">
          {hasUserTeam && (
            <TabsTrigger
              value="my-team"
              className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 text-emerald-600 dark:text-emerald-400"
            >
              Mi Equipo
            </TabsTrigger>
          )}
          <TabsTrigger
            value="standings"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
          >
            Tabla
          </TabsTrigger>
          <TabsTrigger
            value="fixture"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
          >
            Fixture
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
          >
            Equipos
          </TabsTrigger>
          <TabsTrigger
            value="scorers"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
          >
            Goleadores
          </TabsTrigger>
          {isOwner && league.status === 'open_for_applications' && (
            <TabsTrigger
              value="applications"
              className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
            >
              Solicitudes
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
}
