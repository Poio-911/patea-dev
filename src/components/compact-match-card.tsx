'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, ChevronRight, Trophy, UserCheck, Users, UsersRound, Handshake, Shirt, Globe } from 'lucide-react';
import { cn, formatVenueName } from '@/lib/utils';
import type { Match, MatchStatus } from '@/lib/types';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { getMatchTheme, getMatchBackgroundImage } from '@/lib/match-theme';
import { matchStatusConfig } from '@/lib/match-status-config';



interface CompactMatchCardProps {
  match: Match;
  className?: string;
  distance?: string;
}

function MiniAvatarStack({ players, maxVisible = 3 }: {
  players: { uid: string; displayName: string; photoURL: string }[];
  maxVisible?: number;
}) {
  if (!players || players.length === 0) return null;

  // Fix: Filter duplicates
  const uniquePlayers = Array.from(new Map(players.map(p => [p.uid, p])).values());
  const visible = uniquePlayers.slice(0, maxVisible);
  const extra = uniquePlayers.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1">
        {visible.map(p => (
          <div key={p.uid} className="w-4 h-4 rounded-full border border-background dark:border-white/10 overflow-hidden flex-shrink-0">
            {p.photoURL
              ? <img src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-muted flex items-center justify-center text-[6px] font-bold text-muted-foreground">
                {p.displayName?.[0]?.toUpperCase()}
              </div>
            }
          </div>
        ))}
      </div>
      {extra > 0 && <span className="text-[9px] text-muted-foreground">+{extra}</span>}
    </div>
  );
}

export function CompactMatchCard({ match, className, distance }: CompactMatchCardProps) {
  const matchTheme = getMatchTheme(match.type);
  const dateObj = new Date(match.date);
  const isPlanning = match.status === 'planning' || !match.date;
  const fecha = isPlanning
    ? 'Fecha por confirmar'
    : dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const hora = isPlanning ? 'Por votar' : (match.time || '').replace(' hs', '').replace('hs', '').trim();
  const locationName = formatVenueName(match.location.name, match.location.address);
  const statusInfo = matchStatusConfig[match.status];

  const isByTeams = match.type === 'by_teams' && match.teams?.length === 2;
  const hasScore = match.finalScore && (match.status === 'completed' || match.status === 'evaluated');

  const team1 = match.teams?.[0];
  const team2 = match.teams?.[1];

  // Compute unique players once for the whole component
  const uniquePlayers = React.useMemo(() => {
    if (!match.players) return [];
    return Array.from(new Map(match.players.map(p => [p.uid, p])).values());
  }, [match.players]);

  const showAvatars = !isByTeams && uniquePlayers.length > 0;

  return (
    <Link href={`/matches/${match.id}`} className="block">
      <div
        className={cn(
          'group relative flex flex-col gap-2 p-3 rounded-lg overflow-hidden transition-all',
          'bg-gradient-to-br',
          matchTheme.gradient,
          matchTheme.border,
          'border shadow-md',
          'hover:shadow-lg hover:brightness-105',
          className
        )}
      >
        {/* Background Image Overlay (Tema Game) - Hidden in Light mode, visible in Dark/Game */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-lg hidden dark:block game:block bg-card/90 backdrop-blur-sm">
          <img
            src={getMatchBackgroundImage(match.id)}
            alt=""
            className="w-full h-full object-cover opacity-25 grayscale brightness-110 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        </div>
        {/* Border accent for match type */}
        <div className={cn("absolute top-0 left-0 w-1 h-full z-10 opacity-40", `bg-${matchTheme.brandColor}`)} />
        {/* Glow orb */}
        <div
          className={cn(
            "absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-10 dark:opacity-30 pointer-events-none z-0",
            matchTheme.glow
          )}
        />

        {/* Header with type badge and status */}
        <div className="relative z-10 space-y-2">
          {/* Top row: type and status badges */}
          <div className="flex items-center justify-between gap-1">
            {/* Type Indicator - Stylized Tag */}
            {/* Type Indicator - Stylized Glow Dot */}
            <div className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border shadow-sm flex-shrink-0',
              'bg-background/80 dark:bg-black/50 game:bg-black/50 backdrop-blur-md border-border/50 dark:border-white/10 game:border-white/10 text-foreground'
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0 bg-current shadow-[0_0_6px_currentColor] brightness-125",
                matchTheme.badgeColor.replace('bg-', 'text-')
              )} />
              <span className="hidden xs:inline text-foreground/90">{matchTheme.label}</span>
            </div>

            {/* Status Badge */}
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border flex-shrink-0',
                statusInfo.className
              )}
            >
              {match.status === 'active' && (
                <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse mr-1" />
              )}
              {statusInfo.label}
            </span>
          </div>
          {isByTeams && team1 && team2 ? (
            // Layout para partidos por equipos
            <div className="space-y-2">
              {/* Jerseys row */}
              <div className="flex items-center justify-around gap-1 min-w-0">
                <JerseyPreview jersey={team1.jersey} size="sm" />
                <div className="flex-1 flex justify-center px-1">
                  {hasScore ? (
                    <span className="font-bold text-xs tabular-nums whitespace-nowrap bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                      {match.finalScore!.team1} - {match.finalScore!.team2}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase opacity-60">vs</span>
                  )}
                </div>
                <JerseyPreview jersey={team2.jersey} size="sm" />
              </div>

              {/* Team names row */}
              <div className="flex items-start justify-between gap-1 w-full overflow-hidden">
                <span className="text-[10px] font-bold leading-tight line-clamp-2 text-center flex-1">
                  {team1.name}
                </span>
                <span className="text-[10px] font-bold leading-tight line-clamp-2 text-center flex-1">
                  {team2.name}
                </span>
              </div>

              {/* Date/Time/Location row - Stacked for 2-column mobile layout */}
              <div className="flex flex-col items-start gap-1 text-[9px] text-muted-foreground w-full">
                <span className="flex items-center gap-1.5 min-w-0 w-full">
                  <Calendar className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{fecha}</span>
                </span>

                <span className="flex items-center gap-1.5 min-w-0 w-full">
                  <Clock className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{hora} hs</span>
                  {match.weather?.temperature !== undefined && (
                    <span className="opacity-80 shrink-0">
                      · {match.weather.icon ?? '🌡️'} {match.weather.temperature}°
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-1.5 min-w-0 w-full">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{locationName}</span>
                </span>
                {distance && <span className="pl-4 text-[8px] opacity-70 truncate w-full">a {distance}</span>}
              </div>
            </div>
          ) : (
            // Layout para otros tipos de partido
            <div className="space-y-2">
              <h3 className="font-semibold text-sm line-clamp-2 text-center min-h-[2.5em] flex items-center justify-center">
                {match.title || locationName}
              </h3>
              {/* Player count row */}
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                <Users className="h-2.5 w-2.5" />
                <span>{uniquePlayers.length}/{match.matchSize} jugadores</span>
              </div>
              {/* Date/Time/Location row - Stacked for 2-column mobile layout */}
              <div className="flex flex-col items-start gap-1 text-[9px] text-muted-foreground w-full">
                <span className="flex items-center gap-1.5 min-w-0 w-full">
                  <Calendar className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{fecha}</span>
                </span>

                <span className="flex items-center gap-1.5 min-w-0 w-full">
                  <Clock className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{hora} hs</span>
                  {match.weather?.temperature !== undefined && (
                    <span className="opacity-80 shrink-0">
                      · {match.weather.icon ?? '🌡️'} {match.weather.temperature}°
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-1.5 min-w-0 w-full">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{locationName}</span>
                </span>
                {distance && <span className="pl-4 text-[8px] opacity-70 truncate w-full">a {distance}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer row: avatars + arrow */}
        <div className="relative z-10 flex items-center justify-between">
          {showAvatars ? (
            <MiniAvatarStack players={match.players} maxVisible={3} />
          ) : (
            <div />
          )}
          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>
    </Link>
  );
}
