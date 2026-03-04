'use client';

import React, { useState, useEffect } from 'react';
import type { Match, UserProfile } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Calendar, Clock, MapPin, UserPlus, LogOut, Loader2,
  Share2, Navigation, Hourglass, CheckCircle2, Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNativeShare } from '@/hooks/use-native-share';
import { useHaptics } from '@/hooks/use-haptics';
import { getMatchTheme, getMatchBackgroundImage } from '@/lib/match-theme';
import { cn } from '@/lib/utils';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';

interface MatchInfoCardProps {
  match: Match;
  ownerProfile: UserProfile | null;
  googleMapsUrl: string;
  whatsAppShareText: string;
  weatherIcon?: React.ElementType;
  isOwner: boolean;
  isUserInMatch: boolean;
  isMatchFull: boolean;
  isJoining: boolean;
  isUserPendingRequest?: boolean;
  onJoinOrLeave?: () => void;
}

// --- Countdown ---
interface CountdownValues { days: number; hours: number; minutes: number; seconds: number; }

function parseMatchDateTime(date: string, time: string): Date {
  const cleanTime = time.replace(' hs', '').replace('hs', '').trim();
  let d = new Date(`${date}T${cleanTime}`);
  if (isNaN(d.getTime())) d = new Date(`${date}T${cleanTime}:00`);
  if (isNaN(d.getTime())) {
    const dp = date.split('-'), tp = cleanTime.split(':');
    if (dp.length >= 3 && tp.length >= 2)
      d = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1], tp[2] ? +tp[2] : 0);
  }
  return d;
}

function calculateCountdown(matchDate: string, matchTime: string): CountdownValues | null {
  const diff = parseMatchDateTime(matchDate, matchTime).getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function MatchCountdown({ matchDate, matchTime }: { matchDate: string; matchTime: string }) {
  const [cd, setCd] = useState<CountdownValues | null>(() => calculateCountdown(matchDate, matchTime));
  useEffect(() => {
    const id = setInterval(() => setCd(calculateCountdown(matchDate, matchTime)), 1000);
    return () => clearInterval(id);
  }, [matchDate, matchTime]);
  if (!cd) return null;

  const Unit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center min-w-[2.5rem]">
      <span className="text-2xl sm:text-3xl font-black tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold mt-0.5">{label}</span>
    </div>
  );
  const Sep = () => <span className="text-xl font-bold text-white/20 self-start mt-0.5">:</span>;

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 py-3 px-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md w-fit mx-auto">
      {cd.days > 0 && <><Unit value={cd.days} label="días" /><Sep /></>}
      <Unit value={cd.hours} label="horas" /><Sep />
      <Unit value={cd.minutes} label="min" /><Sep />
      <Unit value={cd.seconds} label="seg" />
    </div>
  );
}
// -----------------

export const MatchInfoCard = React.memo(function MatchInfoCard({
  match,
  ownerProfile,
  googleMapsUrl,
  whatsAppShareText,
  weatherIcon: WeatherIcon,
  isOwner,
  isUserInMatch,
  isMatchFull,
  isJoining,
  isUserPendingRequest,
  onJoinOrLeave,
}: MatchInfoCardProps) {
  const matchTheme = getMatchTheme(match.type);
  const { share } = useNativeShare();
  const { tap } = useHaptics();

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    tap();
    share({
      title: `⚽ Partido: ${match.title}`,
      text: decodeURIComponent(whatsAppShareText),
      url: `${window.location.origin}/matches/${match.id}`,
    });
  };

  const matchPhoto = getMatchBackgroundImage(match.id);
  const isTeamMatch = match.type === 'by_teams' && match.teams && match.teams.length === 2;
  const hasScore = !!(match.finalScore && match.status !== 'upcoming' && match.status !== 'planning');
  const isLive = match.status === 'active';
  const isEvaluated = match.status === 'evaluated';
  const isCompleted = match.status === 'completed' || isEvaluated;
  const spotsLeft = match.matchSize - (match.players?.length || 0);

  return (
    <Card className="group relative overflow-hidden rounded-3xl border-0 shadow-2xl isolate bg-black text-white w-full">

      {/* ── Background layers ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Photo */}
        <img
          src={matchPhoto}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-50"
        />
        {/* Vignette: bottom-heavy gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/10 z-[1]" />
        {/* Side fades */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 z-[1]" />
        {/* Match-type color wash */}
        <div className={cn('absolute inset-0 z-[2] opacity-25 mix-blend-overlay', matchTheme.bannerOverlay)} />
      </div>

      {/* ── League-final ribbon ── */}
      {match.type === 'league_final' && (
        <div className="absolute top-0 left-0 right-0 z-20 py-2.5 px-4 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-white animate-pulse">⚡ PARTIDO DEFINITORIO — el ganador es CAMPEÓN ⚡</p>
        </div>
      )}

      {/* ── League / Cup context strip ── */}
      {(match.type === 'league' || match.type === 'cup') && match.leagueInfo && (
        <div className="absolute top-0 left-0 right-0 z-20 px-4 py-2 bg-black/50 backdrop-blur-md border-b border-white/10 flex items-center justify-center gap-2">
          <span className={cn('text-xs font-bold', match.type === 'league' ? 'text-amber-400' : 'text-red-400')}>
            {match.type === 'league' ? '🏆 Liga' : '🏆 Copa'}
          </span>
          {match.type === 'league' && <span className="text-xs text-white/70">· Fecha {match.leagueInfo.round}</span>}
          {match.type === 'cup' && (
            <span className="text-xs text-white/70">
              · {match.leagueInfo.round === 1 ? 'FINAL' : match.leagueInfo.round === 2 ? 'SEMIFINAL' : match.leagueInfo.round === 3 ? 'CUARTOS' : `Ronda ${match.leagueInfo.round}`}
            </span>
          )}
        </div>
      )}

      {/* ── LIVE badge ── */}
      {isLive && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 bg-red-600 rounded-full shadow-[0_0_16px_rgba(239,68,68,0.5)]">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider">En Vivo</span>
          {match.currentMinute != null && (
            <span className="text-[10px] font-bold text-white/80">{match.currentMinute}&apos;</span>
          )}
        </div>
      )}

      {/* ── Evaluated badge ── */}
      {isEvaluated && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/80 backdrop-blur-md border border-emerald-400/30 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          <span className="text-[10px] font-black uppercase tracking-wider">Evaluado</span>
        </div>
      )}

      {/* ── Main content ── */}
      <CardContent
        className={cn(
          'relative z-10 flex flex-col gap-5 px-4 sm:px-6 md:px-8 pb-5 sm:pb-7',
          (match.type === 'league_final') ? 'pt-16 sm:pt-20' :
          ((match.type === 'league' || match.type === 'cup') && match.leagueInfo) ? 'pt-12 sm:pt-14' : 'pt-5 sm:pt-7'
        )}
      >

        {/* Row 1: Match type badge + Owner */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/15 bg-black/50 backdrop-blur-md shadow-md">
            <span className={cn('w-2 h-2 rounded-full shrink-0', matchTheme.badgeColor)} />
            {matchTheme.label}
          </div>

          {ownerProfile && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-md">
              <Avatar className="h-5 w-5 border border-white/20">
                <AvatarImage src={ownerProfile.photoURL || ''} />
                <AvatarFallback className="text-[8px] bg-white/20 text-white">{ownerProfile.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-white/85 max-w-[120px] truncate">{ownerProfile.displayName}</span>
            </div>
          )}
        </div>

        {/* Row 2: Hero — teams or title */}
        <div className="flex-grow py-4 sm:py-6 md:py-8 flex items-center justify-center">
          {isTeamMatch ? (
            /* ── By-teams display ── */
            <div className="w-full flex items-center justify-between gap-2 sm:gap-6 md:gap-10">

              {/* Team A */}
              <div className="flex flex-col items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
                <JerseyPreview
                  jersey={match.teams![0].jersey}
                  size="lg"
                  className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                />
                <span className="font-black text-sm sm:text-lg md:text-xl text-center text-balance leading-tight line-clamp-2 drop-shadow-md">
                  {match.teams![0].name}
                </span>
              </div>

              {/* Center: score / VS */}
              <div className="flex flex-col items-center justify-center shrink-0 gap-1">
                {hasScore ? (
                  <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
                    <span className="text-5xl sm:text-7xl md:text-8xl font-black tabular-nums leading-none drop-shadow-lg">
                      {match.finalScore!.team1}
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold text-white/25">—</span>
                    <span className="text-5xl sm:text-7xl md:text-8xl font-black tabular-nums leading-none drop-shadow-lg">
                      {match.finalScore!.team2}
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl sm:text-5xl md:text-6xl font-black text-white/20 italic tracking-tight">VS</span>
                )}
                {isCompleted && hasScore && (
                  <span className="text-[10px] uppercase tracking-widest text-white/35 font-bold mt-1">Resultado final</span>
                )}
              </div>

              {/* Team B */}
              <div className="flex flex-col items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
                <JerseyPreview
                  jersey={match.teams![1].jersey}
                  size="lg"
                  className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                />
                <span className="font-black text-sm sm:text-lg md:text-xl text-center text-balance leading-tight line-clamp-2 drop-shadow-md">
                  {match.teams![1].name}
                </span>
              </div>
            </div>
          ) : (
            /* ── Non-team match title ── */
            <div className="flex flex-col items-center gap-3 text-center px-2 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-balance leading-[1.05] drop-shadow-lg">
                {match.title}
              </h2>
              {spotsLeft > 0 && match.status === 'upcoming' && (
                <div className="flex items-center gap-1.5 text-white/50">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">
                    {match.players?.length || 0} / {match.matchSize} jugadores
                    {spotsLeft > 0 && ` · ${spotsLeft} lugar${spotsLeft !== 1 ? 'es' : ''} disponible${spotsLeft !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Countdown */}
        {match.status === 'upcoming' && !hasScore && match.date && match.time && (
          <div className="flex justify-center">
            <MatchCountdown matchDate={match.date} matchTime={match.time} />
          </div>
        )}

        {/* Row 3: Info bar + Actions */}
        <div className="space-y-2.5 sm:space-y-3">

          {/* Info strip */}
          <div className="flex items-stretch rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl divide-x divide-white/10">
            <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3">
              <Calendar className="h-3.5 w-3.5 text-white/50 shrink-0" />
              <span className="text-[11px] sm:text-xs font-semibold truncate">
                {match.status === 'planning' || !match.date
                  ? 'A definir'
                  : format(new Date(match.date), 'EEE d MMM', { locale: es })}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3">
              <Clock className="h-3.5 w-3.5 text-white/50 shrink-0" />
              <span className="text-[11px] sm:text-xs font-semibold">
                {match.status === 'planning' || !match.time ? 'A definir' : `${match.time} hs`}
              </span>
            </div>

            <div className="flex-[1.5] hidden md:flex items-center justify-center gap-2 py-3 px-3">
              <MapPin className="h-3.5 w-3.5 text-white/50 shrink-0" />
              <span className="text-xs font-semibold truncate max-w-[150px]">
                {match.location?.name || 'A definir'}
              </span>
            </div>

            {WeatherIcon && match.weather && (
              <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3">
                <WeatherIcon className="h-3.5 w-3.5 text-white/50 shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold">{match.weather.temperature}°</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 sm:gap-2.5">
            <Button
              asChild
              variant="outline"
              className="flex-1 bg-white/5 hover:bg-white/10 border-white/10 text-white backdrop-blur-md rounded-xl h-11 text-xs sm:text-sm gap-1.5"
            >
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-3.5 w-3.5 shrink-0" />
                Cómo llegar
              </a>
            </Button>

            {isOwner && match.status === 'upcoming' && (
              <Button
                onClick={handleShare}
                className="flex-1 bg-[#25D366]/90 hover:bg-[#25D366] text-black border-0 rounded-xl h-11 text-xs sm:text-sm font-bold shadow-lg gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5 shrink-0" />
                Compartir
              </Button>
            )}

            {(match.type === 'collaborative' || match.type === 'manual') && match.status === 'upcoming' && !isOwner && (
              <div className="flex-[1.2] sm:flex-[1.5]">
                {isMatchFull && !isUserInMatch && !isUserPendingRequest ? (
                  <Button disabled className="w-full bg-white/10 text-white/50 border-0 rounded-xl h-11 text-xs sm:text-sm font-bold">
                    Lleno
                  </Button>
                ) : isUserPendingRequest ? (
                  <Button disabled className="w-full bg-white/10 text-white/50 border border-white/15 rounded-xl h-11 text-xs sm:text-sm font-bold gap-1.5">
                    <Hourglass className="h-3.5 w-3.5 shrink-0" />
                    Solicitud enviada
                  </Button>
                ) : (
                  <Button
                    onClick={onJoinOrLeave}
                    disabled={isJoining}
                    className={cn(
                      'w-full h-11 rounded-xl text-xs sm:text-sm font-bold transition-transform active:scale-95 gap-1.5',
                      !isUserInMatch ? matchTheme.button : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                    )}
                  >
                    {isJoining
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : isUserInMatch
                        ? <LogOut className="h-3.5 w-3.5 shrink-0" />
                        : <UserPlus className="h-3.5 w-3.5 shrink-0" />}
                    {isUserInMatch ? 'Baja' : match.type === 'manual' ? 'Solicitar unirse' : 'Apuntarse'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
});
