'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, ChevronRight, Trophy, UserCheck, Users, UsersRound, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Match, MatchStatus } from '@/lib/types';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { getMatchTheme } from '@/lib/match-theme';

const typeLabels: Record<string, string> = {
  manual: 'Amistoso',
  collaborative: 'Colaborativo',
  by_teams: 'Por Equipos',
  intergroup_friendly: 'Intergrupos',
  league: 'Liga',
  cup: 'Copa',
  league_final: 'Final',
};

const statusConfig: Record<MatchStatus, { label: string; className: string; neonClass: string }> = {
  upcoming: { 
    label: 'Próximo', 
    className: 'bg-primary/10 text-primary border-primary/30 backdrop-blur-sm',
    neonClass: 'text-shadow-[0_0_6px_hsl(var(--primary))]'
  },
  active: { 
    label: 'En Vivo', 
    className: 'bg-green-500/10 text-green-600 border-green-500/30 backdrop-blur-sm',
    neonClass: 'text-shadow-[0_0_6px_rgb(34_197_94)]'
  },
  completed: { 
    label: 'Finalizado', 
    className: 'bg-muted/40 text-muted-foreground border-muted/50 backdrop-blur-sm',
    neonClass: 'text-shadow-[0_0_4px_hsl(var(--muted-foreground))]'
  },
  evaluated: { 
    label: 'Evaluado', 
    className: 'bg-card/60 text-foreground border-border backdrop-blur-sm',
    neonClass: 'text-shadow-[0_0_6px_hsl(var(--chart-2))]'
  },
};

interface CompactMatchCardProps {
  match: Match;
  className?: string;
  distance?: string;
}

export function CompactMatchCard({ match, className, distance }: CompactMatchCardProps) {
  const typeLabel = typeLabels[match.type] || match.type;
  const matchTheme = getMatchTheme(match.type);
  const dateObj = new Date(match.date);
  const fecha = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  const hora = (match.time || '').replace(' hs', '').replace('hs', '').trim();
  const locationName = match.location.name || match.location.address;
  const statusInfo = statusConfig[match.status];

  const isByTeams = match.type === 'by_teams' && match.teams?.length === 2;
  const hasScore = match.finalScore && (match.status === 'completed' || match.status === 'evaluated');

  const team1 = match.teams?.[0];
  const team2 = match.teams?.[1];

  return (
    <Link href={`/matches/${match.id}`} className="block">
      <div
        className={cn(
          'group relative flex flex-col gap-2 p-3 rounded-lg border transition-all',
          `bg-gradient-to-br ${matchTheme.gradient}`,
          matchTheme.border,
          'hover:shadow-lg hover:shadow-primary/10 hover:brightness-95 dark:hover:brightness-110',
          className
        )}
      >
        {/* Header with type badge and status */}
        <div className="space-y-2">
          {/* Top row: type and status badges */}
          <div className="flex items-center justify-between gap-1">
            {/* Type Badge with icon */}
            <div className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border flex-shrink-0',
              matchTheme.badge,
              matchTheme.badgeText,
              matchTheme.animate && "animate-pulse"
            )}>
              {matchTheme.icon === 'UserCheck' && <UserCheck className="mr-0.5 h-2.5 w-2.5" />}
              {matchTheme.icon === 'Users' && <Users className="mr-0.5 h-2.5 w-2.5" />}
              {matchTheme.icon === 'UsersRound' && <UsersRound className="mr-0.5 h-2.5 w-2.5" />}
              {matchTheme.icon === 'Trophy' && <Trophy className="mr-0.5 h-2.5 w-2.5" />}
              {matchTheme.icon === 'Handshake' && <Handshake className="mr-0.5 h-2.5 w-2.5" />}
              <span className="hidden sm:inline">{typeLabel}</span>
            </div>
            
            {/* Status Badge */}
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border flex-shrink-0',
                statusInfo.className
              )}
            >
              {match.status === 'active' && (
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse mr-1" />
              )}
              {statusInfo.label}
            </span>
          </div>
          {isByTeams && team1 && team2 ? (
            // Layout para partidos por equipos
            <div className="space-y-2">
              {/* Jerseys row */}
              <div className="flex items-center justify-center gap-3">
                <JerseyPreview jersey={team1.jersey} size="sm" />
                <div className="px-2">
                  {hasScore ? (
                    <span className="font-bold text-sm tabular-nums">
                      {match.finalScore!.team1} - {match.finalScore!.team2}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium">vs</span>
                  )}
                </div>
                <JerseyPreview jersey={team2.jersey} size="sm" />
              </div>
              
              {/* Team names row */}
              <div className="flex justify-between items-center gap-2">
                <span className={cn("font-semibold text-xs truncate text-center flex-1", statusInfo.neonClass)}>
                  {team1.name}
                </span>
                <span className={cn("font-semibold text-xs truncate text-center flex-1", statusInfo.neonClass)}>
                  {team2.name}
                </span>
              </div>

              {/* Date/Time/Location row */}
              <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  {fecha}
                  {hora && (
                    <>
                      <span className="mx-1">•</span>
                      <Clock className="h-2.5 w-2.5" />
                      {hora}
                    </>
                  )}
                </span>
                <span className="flex items-center gap-1 truncate max-w-full">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{locationName}</span>
                  {distance && <span className="shrink-0 text-primary font-medium">· {distance}</span>}
                </span>
              </div>
            </div>
          ) : (
            // Layout para otros tipos de partido
            <div className="space-y-2">
              <h3 className={cn("font-semibold text-sm truncate text-center", statusInfo.neonClass)}>
                {match.title || locationName}
              </h3>
              <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  {fecha}
                  {hora && (
                    <>
                      <span className="mx-1">•</span>
                      <Clock className="h-2.5 w-2.5" />
                      {hora}
                    </>
                  )}
                </span>
                <span className="flex items-center gap-1 truncate max-w-full">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{locationName}</span>
                  {distance && <span className="shrink-0 text-primary font-medium">· {distance}</span>}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Arrow indicator - positioned at bottom right */}
        <div className="flex justify-end">
          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Link>
  );
}
