'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';
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

const statusConfig: Record<MatchStatus, { label: string; className: string }> = {
  upcoming: { label: 'Próximo', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  active: { label: 'En Vivo', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  completed: { label: 'Finalizado', className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' },
  evaluated: { label: 'Evaluado', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
};

interface CompactMatchCardProps {
  match: Match;
  className?: string;
}

export function CompactMatchCard({ match, className }: CompactMatchCardProps) {
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
          'group relative flex items-center gap-3 p-3 rounded-lg border transition-all',
          `bg-gradient-to-r ${matchTheme.gradient}`,
          matchTheme.border,
          'hover:brightness-95 dark:hover:brightness-110',
          className
        )}
      >
        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
              statusInfo.className
            )}
          >
            {match.status === 'active' && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1" />
            )}
            {statusInfo.label}
          </span>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 pt-4">
          {isByTeams && team1 && team2 ? (
            // Layout para partidos por equipos
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                {/* Team 1 */}
                <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                  <span className="font-semibold text-sm truncate">{team1.name}</span>
                  <JerseyPreview jersey={team1.jersey} size="xs" />
                </div>

                {/* Score or VS */}
                <div className="px-2 flex-shrink-0">
                  {hasScore ? (
                    <span className="font-bold text-base tabular-nums">
                      {match.finalScore!.team1} - {match.finalScore!.team2}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium">vs</span>
                  )}
                </div>

                {/* Team 2 */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <JerseyPreview jersey={team2.jersey} size="xs" />
                  <span className="font-semibold text-sm truncate">{team2.name}</span>
                </div>
              </div>

              {/* Date/Time/Location row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground justify-center flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {fecha}
                </span>
                {hora && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {hora}
                  </span>
                )}
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{locationName}</span>
                </span>
              </div>
            </div>
          ) : (
            // Layout para otros tipos de partido
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {typeLabel}
                </span>
              </div>
              <p className="font-semibold text-sm truncate">{match.title || locationName}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {fecha}
                </span>
                {hora && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {hora}
                  </span>
                )}
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{locationName}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Arrow indicator */}
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}
