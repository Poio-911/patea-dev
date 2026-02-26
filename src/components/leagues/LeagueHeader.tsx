'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { League, CompetitionStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronLeft, Play, Trophy, Trash2, MoreVertical, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const statusConfig: Record<CompetitionStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  open_for_applications: { label: 'Abierta', variant: 'default' },
  in_progress: { label: 'En Curso', variant: 'default' },
  completed: { label: 'Finalizada', variant: 'outline' },
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
  const status = statusConfig[league.status];

  return (
    <div className="space-y-0">
      {/* Blue gradient banner */}
      <div className="relative rounded-2xl overflow-hidden mb-0">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-500 dark:from-blue-950 dark:via-blue-900 dark:to-indigo-900" />
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* Top shine */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        <div className="relative p-5 md:p-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Link
              href="/competitions"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Competiciones
            </Link>
            <span>/</span>
            <span className="text-white/90 font-medium truncate max-w-[200px]">{league.name}</span>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-5">
            {/* Logo or Shield icon */}
            <div
              className={cn(
                'w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center',
                'shadow-xl border-2 border-white/30 mx-auto md:mx-0 relative',
                league.logoUrl ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/20 backdrop-blur-sm',
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
                  <svg viewBox="0 0 24 24" className="h-10 w-10 text-white drop-shadow-lg" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2.5 text-center md:text-left">
              {/* Title + owner actions */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md leading-tight">
                  {league.name}
                </h1>

                {/* Owner actions — grouped in DropdownMenu */}
                {isOwner && (
                  <div className="flex items-center gap-2 justify-center md:justify-end shrink-0">
                    {/* Primary action button (prominent) */}
                    {league.status === 'open_for_applications' && (
                      <Button
                        onClick={onStartLeague}
                        size="sm"
                        className="bg-white text-blue-700 hover:bg-white/90 shadow-lg font-semibold gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Iniciar Liga
                      </Button>
                    )}
                    {league.status === 'in_progress' && (
                      <Button
                        onClick={onCompleteLeague}
                        size="sm"
                        className="bg-white text-blue-700 hover:bg-white/90 shadow-lg font-semibold gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Finalizar
                      </Button>
                    )}

                    {/* More actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/15"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {league.status === 'open_for_applications' && (
                          <DropdownMenuItem onClick={onStartLeague} className="gap-2">
                            <Play className="h-4 w-4 text-blue-600" />
                            Iniciar Liga
                          </DropdownMenuItem>
                        )}
                        {league.status === 'in_progress' && (
                          <DropdownMenuItem onClick={onCompleteLeague} className="gap-2">
                            <Trophy className="h-4 w-4 text-blue-600" />
                            Finalizar Liga
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={onDeleteLeague}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar Liga
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {/* Status badge + meta */}
              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                <Badge
                  variant="outline"
                  className="bg-white/20 text-white border-white/30 backdrop-blur-sm"
                >
                  {status.label}
                </Badge>
                <span className="text-white/70 text-sm">{league.teams.length} equipos</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70 text-sm">
                  {league.format === 'round_robin' ? 'Todos vs Todos' : 'Ida y Vuelta'}
                </span>
              </div>

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
