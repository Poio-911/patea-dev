'use client';

import Link from 'next/link';
import type { League, CompetitionStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Play, Trophy, Trash2 } from 'lucide-react';
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
  hasUserTeam
}: LeagueHeaderProps) {
  const status = statusConfig[league.status];

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/competitions" className="hover:text-foreground transition-colors">
          Competiciones
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{league.name}</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{league.name}</h1>
            <Badge variant={status.variant as any}>{status.label}</Badge>
          </div>
          {organizer && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <span>Organizado por {organizer.displayName || 'Usuario'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOwner && league.status === 'open_for_applications' && (
            <Button onClick={onStartLeague} className="gap-2">
              <Play className="h-4 w-4" /> Iniciar Liga
            </Button>
          )}
          {isOwner && league.status === 'in_progress' && (
            <Button onClick={onCompleteLeague} variant="outline" className="gap-2">
              <Trophy className="h-4 w-4" /> Finalizar
            </Button>
          )}
          {isOwner && (
            <Button onClick={onDeleteLeague} variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as LeagueTab)} className="w-full">
        <TabsList className="bg-transparent p-0 border-b w-full justify-start h-auto rounded-none space-x-6 overflow-x-auto scrollbar-hide">
          {hasUserTeam && (
            <TabsTrigger
              value="my-team"
              className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium text-emerald-600 dark:text-emerald-400"
            >
              Mi Equipo
            </TabsTrigger>
          )}
          <TabsTrigger
            value="standings"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
          >
            Tabla
          </TabsTrigger>
          <TabsTrigger
            value="fixture"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
          >
            Fixture
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
          >
            Equipos
          </TabsTrigger>
          <TabsTrigger
            value="scorers"
            className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
          >
            Goleadores
          </TabsTrigger>
          {isOwner && league.status === 'open_for_applications' && (
            <TabsTrigger
              value="applications"
              className="px-0 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
            >
              Solicitudes
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
}
