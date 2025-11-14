'use client';

import Link from 'next/link';
import type { League, CompetitionStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Play, Trophy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LeagueTab = 'standings' | 'fixture' | 'teams';

type LeagueHeaderProps = {
  league: League;
  activeTab: LeagueTab;
  onTabChange: (tab: LeagueTab) => void;
  isOwner: boolean;
  onStartLeague?: () => void;
  onCompleteLeague?: () => void;
  onDeleteLeague?: () => void;
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
        <Link href="/competitions?tab=leagues" className="hover:text-foreground transition-colors">
          Ligas
        </Link>
        <span>/</span>
        <span className="text-foreground">{league.name}</span>
      </div>

      {/* Title and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/competitions?tab=leagues">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          {league.logoUrl && (
            <div className="w-16 h-16 rounded-lg overflow-hidden border shrink-0 bg-muted/30">
              <img src={league.logoUrl} alt={league.name} className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{league.name}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {league.format === 'round_robin' ? 'Todos contra todos (Ida)' : 'Todos contra todos (Ida y Vuelta)'} · {league.teams.length} equipos
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {isOwner && (
          <div className="flex gap-2">
            {league.status === 'draft' && onStartLeague && (
              <Button onClick={onStartLeague} className="gap-2">
                <Play className="h-4 w-4" />
                Iniciar Liga
              </Button>
            )}
            {league.status === 'in_progress' && onCompleteLeague && (
              <Button onClick={onCompleteLeague} variant="outline" className="gap-2">
                <Trophy className="h-4 w-4" />
                Finalizar Liga
              </Button>
            )}
            {onDeleteLeague && (
              <Button onClick={onDeleteLeague} variant="destructive" size="icon" title="Eliminar Liga">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as LeagueTab)}>
        <TabsList>
          <TabsTrigger value="standings">Tabla de Posiciones</TabsTrigger>
          <TabsTrigger value="fixture">Fixture</TabsTrigger>
          <TabsTrigger value="teams">Equipos</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
