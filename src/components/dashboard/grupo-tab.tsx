'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Shield, Newspaper, PlusCircle, LogIn, Users2, Trophy, MessageSquare, History, Medal, BarChart3, ChevronRight, Calendar, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GroupHeroCard } from '@/components/groups/group-hero-card';
import { TeamList } from '@/components/team-builder/team-list';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { CreateGroupDialog, JoinGroupDialog } from '@/components/groups/group-dialogs';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { motion } from 'framer-motion';
import { cn, formatVenueName } from '@/lib/utils';
import { getMatchTheme } from '@/lib/match-theme';
import type { Group, Player, Match, GenerateMatchChronicleOutput } from '@/lib/types';

interface GrupoTabProps {
  activeGroup?: Group | null;
  groupPlayers: Player[];
  upcomingMatches: Match[];
  friendlyMatches: Match[];
  groupRecentMatches: Match[];
  totalGroupMatchesCount: number;
  groupId?: string;
  userId?: string;
}

function EvaluatedMatchCard({ match, index }: { match: Match; index: number }) {
  const chronicle = match.chronicle as GenerateMatchChronicleOutput | undefined;
  const matchTheme = getMatchTheme(match.type);
  const dateObj = new Date(match.date);
  const fecha = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  const hora = (match.time || '').replace(' hs', '').replace('hs', '').trim();
  const locationName = formatVenueName(match.location.name, match.location.address);

  const isByTeams = match.type === 'by_teams' && match.teams?.length === 2;
  const hasScore = !!(match.finalScore && (match.status === 'completed' || match.status === 'evaluated'));
  const team1 = match.teams?.[0];
  const team2 = match.teams?.[1];
  const playerCount = match.players ? new Set(match.players.map((p: { uid: string }) => p.uid)).size : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.07 }}
    >
      <Link href={`/matches/${match.id}`} className="block">
        <div className={cn(
          'group relative flex flex-col rounded-xl overflow-hidden transition-all',
          'bg-gradient-to-br',
          matchTheme.gradient,
          matchTheme.border,
          'border shadow-sm hover:shadow-md hover:brightness-105',
        )}>
          {/* Left type accent */}
          <div className={cn('absolute top-0 left-0 w-0.5 h-full opacity-40', `bg-${matchTheme.brandColor}`)} />

          {/* Glow orb */}
          <div className={cn(
            'absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-10 dark:opacity-20 pointer-events-none',
            matchTheme.glow,
          )} />

          {/* Body */}
          <div className="relative z-10 p-3 space-y-2">
            {/* Top row: type indicator + evaluated badge */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-card/40 backdrop-blur-xl border border-border/40 text-foreground/70">
                <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', matchTheme.badgeColor)} />
                {matchTheme.label}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                ✓ Evaluado
              </span>
            </div>

            {/* Match visual — teams or title */}
            {isByTeams && team1 && team2 ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <JerseyPreview jersey={team1.jersey} size="sm" />
                  <span className="text-[10px] font-bold truncate">{team1.name}</span>
                </div>
                <div className="flex-shrink-0 text-center px-1">
                  {hasScore ? (
                    <span className="font-black text-sm tabular-nums px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 tracking-tight">
                      {match.finalScore!.team1}–{match.finalScore!.team2}
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-muted-foreground">vs</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="text-[10px] font-bold truncate text-right">{team2.name}</span>
                  <JerseyPreview jersey={team2.jersey} size="sm" />
                </div>
              </div>
            ) : (
              <div className="text-center space-y-0.5">
                <h3 className="font-semibold text-sm truncate">{match.title || locationName}</h3>
                <span className="text-[9px] text-muted-foreground">{playerCount} jugadores</span>
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="h-2.5 w-2.5 shrink-0" />
                {fecha}{hora ? ` · ${hora}` : ''}
              </span>
              <span className="flex items-center gap-1 truncate min-w-0">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{locationName}</span>
              </span>
            </div>
          </div>

          {/* Chronicle zone — editorial, integrated */}
          {chronicle?.headline && (
            <div className="relative z-10 mx-3 mb-3">
              <div className="relative border-t border-dashed border-primary/20 pt-2.5">
                <span className="absolute -top-[8px] left-1 bg-card text-[7px] font-black uppercase tracking-[0.18em] text-primary/40 px-1.5 py-px rounded-sm border border-primary/15">
                  relato
                </span>
                <p className="italic font-bold text-[10px] text-foreground/85 line-clamp-1 leading-relaxed">
                  &ldquo;{chronicle.headline}&rdquo;
                </p>
                {chronicle.story && (
                  <p className="mt-1 text-[11px] text-muted-foreground/80 font-serif leading-snug line-clamp-2">
                    {chronicle.story}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function GrupoTab({
  activeGroup,
  groupPlayers,
  upcomingMatches,
  friendlyMatches,
  groupRecentMatches,
  totalGroupMatchesCount,
  groupId,
  userId,
}: GrupoTabProps) {
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);

  const topMVPPlayer = useMemo(() => (
    [...groupPlayers]
      .filter(p => (p.stats?.mvpVotes || 0) > 0)
      .sort((a, b) => (b.stats?.mvpVotes || 0) - (a.stats?.mvpVotes || 0))[0] ?? null
  ), [groupPlayers]);

  if (!groupId || !activeGroup) {
    return (
      <div className="space-y-4">
        <Alert className="text-center py-10">
          <Users2 className="h-6 w-6 mx-auto mb-2" />
          <AlertTitle>No hay un grupo activo</AlertTitle>
          <AlertDescription>Creá un grupo o unite a uno para empezar.</AlertDescription>
        </Alert>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => setJoinGroupOpen(true)} variant="outline">
            <LogIn className="mr-2 h-4 w-4" />
            Unirse a Grupo
          </Button>
          <Button onClick={() => setCreateGroupOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Grupo
          </Button>
        </div>
        <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
          <div />
        </CreateGroupDialog>
        <JoinGroupDialog open={joinGroupOpen} onOpenChange={setJoinGroupOpen}>
          <div />
        </JoinGroupDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GroupHeroCard group={activeGroup} compact={true} />


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Columna Izquierda (Principal - Equipos y Últimos Partidos) */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Equipos */}
          <div className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5">
            <div className="p-4 sm:p-5 border-b border-border/40 flex items-center gap-2 text-base uppercase tracking-widest text-primary font-black drop-shadow-sm bg-primary/5">
              <Shield className="h-5 w-5" />
              Equipos Guardados
            </div>
            <div className="p-4 sm:p-5">
              <TeamList groupId={groupId} players={groupPlayers} currentUserId={userId || ''} compact={false} />
            </div>
          </div>

          {/* Últimos Partidos Evaluados */}
          {groupRecentMatches.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5">
              <div className="p-4 sm:p-5 border-b border-border/40 flex items-center gap-2 text-base uppercase tracking-widest text-primary font-black drop-shadow-sm bg-primary/5">
                <History className="h-5 w-5" />
                Últimos Partidos
              </div>
              <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groupRecentMatches.map((match, i) => (
                  <EvaluatedMatchCard key={match.id} match={match} index={i} />
                ))}
              </div>

              <div className="px-4 pb-4">
                <Link href="/matches" className="text-sm font-semibold text-primary hover:text-primary/80 flex items-center justify-center group">
                  Ver todo el historial <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha (Próximos Partidos y Mini Stats) */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">

          {/* Quick Stats Group */}
          <div className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8 opacity-70 pointer-events-none" />
            <div className="p-4 sm:p-5 flex flex-col gap-4">
              <h3 className="font-headline text-sm uppercase tracking-widest text-primary font-black drop-shadow-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> La Lupa
              </h3>

              <div className="grid grid-cols-2 gap-3 relative z-10">
                {/* Box 1: Partidos Jugados */}
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1 shadow-sm hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <History className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center leading-tight">Partidos<br />Totales</span>
                  <span className="text-2xl font-black font-headline text-primary mt-1">{totalGroupMatchesCount}</span>
                </div>

                {/* Box 2: Top MVP (jugador con más votos en el grupo) */}
                <div className="bg-muted/30 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.05)] hover:border-amber-500/50 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-full blur-md -mr-4 -mt-4 opacity-50" />

                  {topMVPPlayer ? (
                    <>
                      <Avatar className="h-6 w-6 border border-amber-500/50 mb-1 z-10">
                        <AvatarImage src={topMVPPlayer.photoUrl} alt={topMVPPlayer.name} />
                        <AvatarFallback className="text-[8px] bg-amber-500/20 text-amber-700">{topMVPPlayer.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center z-10 leading-tight">Top<br />MVP</span>
                      <span className="text-sm font-bold text-amber-500 truncate w-full px-1 z-10 leading-tight mt-1">{topMVPPlayer.name.split(' ')[0]}</span>
                      <span className="text-[9px] text-amber-500/70 z-10">{topMVPPlayer.stats?.mvpVotes}x</span>
                    </>
                  ) : (
                    <>
                      <Medal className="h-5 w-5 text-muted-foreground/50 mb-1 z-10" />
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center z-10 leading-tight">Top<br />MVP</span>
                      <span className="text-xs font-semibold text-muted-foreground mt-1.5 z-10 border-t border-border/50 pt-1 w-full text-center">-</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Próximos Partidos */}
          <div className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl transition-all">
            <div className="p-4 sm:p-5 border-b border-border/40 flex items-center gap-2 text-base uppercase tracking-widest text-primary font-black drop-shadow-sm bg-primary/5">
              <Newspaper className="h-5 w-5" />
              En Agenda
            </div>
            <div className="p-4 sm:p-5">
              <UpcomingMatchesFeed matches={upcomingMatches} compact={true} />
            </div>
          </div>

          {/* Amistosos */}
          {friendlyMatches.length > 0 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-headline text-lg uppercase tracking-widest text-primary font-black drop-shadow-sm px-1">
                Amistosos Intergrupos
              </h3>
              <div className="space-y-3">
                {friendlyMatches.map(match => (
                  <FriendlyMatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
