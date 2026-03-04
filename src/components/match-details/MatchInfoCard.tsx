'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
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

function MatchCountdown({ matchDate, matchTime, isLight }: { matchDate: string; matchTime: string; isLight: boolean }) {
  const [cd, setCd] = useState<CountdownValues | null>(() => calculateCountdown(matchDate, matchTime));
  useEffect(() => {
    const id = setInterval(() => setCd(calculateCountdown(matchDate, matchTime)), 1000);
    return () => clearInterval(id);
  }, [matchDate, matchTime]);
  if (!cd) return null;

  const Unit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center min-w-[2.5rem]">
      <span className={cn(
        'text-2xl sm:text-3xl font-black tabular-nums leading-none',
        isLight ? 'text-foreground' : 'text-white game:text-[#aafe48]'
      )}>
        {String(value).padStart(2, '0')}
      </span>
      <span className={cn(
        'text-[9px] uppercase tracking-widest font-semibold mt-0.5',
        isLight ? 'text-muted-foreground' : 'text-white/40'
      )}>{label}</span>
    </div>
  );
  const Sep = () => (
    <span className={cn(
      'text-xl font-bold self-start mt-0.5',
      isLight ? 'text-muted-foreground/40' : 'text-white/20'
    )}>:</span>
  );

  return (
    <div className={cn(
      'flex items-center justify-center gap-2 sm:gap-3 py-3 px-4 rounded-2xl w-fit mx-auto',
      isLight
        ? 'bg-muted/60 border border-border text-foreground'
        : 'bg-white/5 border border-white/10 backdrop-blur-md text-white'
    )}>
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
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before mount (SSR): render dark (server-safe, same as before)
  const isLight = mounted && theme === 'light';
  const isGame = mounted && theme === 'game';

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
    <Card className={cn(
      'group relative overflow-hidden rounded-3xl w-full isolate',
      isLight
        ? 'bg-card text-foreground border border-border/50 shadow-xl'
        : 'bg-black text-white border-0 shadow-2xl'
    )}>

      {/* ── Background layers — all themes ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={matchPhoto}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-center',
            isLight ? 'opacity-20' : 'opacity-50'
          )}
        />
        {/* Bottom gradient */}
        <div className={cn(
          'absolute inset-0 z-[1]',
          isLight
            ? 'bg-gradient-to-t from-white/95 via-white/70 to-white/20'
            : 'bg-gradient-to-t from-black via-black/65 to-black/10'
        )} />
        {/* Side fades */}
        <div className={cn(
          'absolute inset-0 z-[1]',
          isLight
            ? 'bg-gradient-to-r from-white/50 via-transparent to-white/50'
            : 'bg-gradient-to-r from-black/50 via-transparent to-black/50'
        )} />
        {/* Match-type color wash */}
        <div className={cn(
          'absolute inset-0 z-[2] mix-blend-overlay',
          matchTheme.bannerOverlay,
          isLight ? 'opacity-10' : 'opacity-25'
        )} />
      </div>

      {/* ── Scanlines overlay — only in game ── */}
      {isGame && (
        <div
          className="absolute inset-0 z-[3] pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)' }}
        />
      )}

      {/* ── Color stripe top — only in light ── */}
      {isLight && <div className={cn('h-1.5 w-full relative z-10', matchTheme.badgeColor)} />}

      {/* ── League-final ribbon ── */}
      {match.type === 'league_final' && (
        <div className="absolute top-0 left-0 right-0 z-20 py-2.5 px-4 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-white animate-pulse">⚡ PARTIDO DEFINITORIO — el ganador es CAMPEÓN ⚡</p>
        </div>
      )}

      {/* ── League / Cup context strip ── */}
      {(match.type === 'league' || match.type === 'cup') && match.leagueInfo && (
        <div className={cn(
          'absolute top-0 left-0 right-0 z-20 px-4 py-2 flex items-center justify-center gap-2',
          isLight
            ? 'bg-muted/80 border-b border-border backdrop-blur-sm'
            : 'bg-black/50 backdrop-blur-md border-b border-white/10'
        )}>
          <span className={cn('text-xs font-bold', match.type === 'league' ? 'text-amber-500' : 'text-red-500')}>
            {match.type === 'league' ? '🏆 Liga' : '🏆 Copa'}
          </span>
          {match.type === 'league' && (
            <span className={cn('text-xs', isLight ? 'text-muted-foreground' : 'text-white/70')}>
              · Fecha {match.leagueInfo.round}
            </span>
          )}
          {match.type === 'cup' && (
            <span className={cn('text-xs', isLight ? 'text-muted-foreground' : 'text-white/70')}>
              · {match.leagueInfo.round === 1 ? 'FINAL' : match.leagueInfo.round === 2 ? 'SEMIFINAL' : match.leagueInfo.round === 3 ? 'CUARTOS' : `Ronda ${match.leagueInfo.round}`}
            </span>
          )}
        </div>
      )}

      {/* ── LIVE badge ── */}
      {isLive && (
        <div className={cn(
          'absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white',
          isLight
            ? 'bg-red-500 shadow-lg'
            : 'bg-red-600 shadow-[0_0_16px_rgba(239,68,68,0.5)] game:shadow-[0_0_24px_rgba(239,68,68,0.8)]'
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider">En Vivo</span>
          {match.currentMinute != null && (
            <span className="text-[10px] font-bold text-white/80">{match.currentMinute}&apos;</span>
          )}
        </div>
      )}

      {/* ── Evaluated badge ── */}
      {isEvaluated && (
        <div className={cn(
          'absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full',
          isLight
            ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-300'
            : 'bg-emerald-600/80 text-white backdrop-blur-md border border-emerald-400/30 game:border-[#aafe48]/40 game:bg-[#aafe48]/15 game:text-[#aafe48]'
        )}>
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
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-md',
            isLight
              ? matchTheme.badge
              : 'border-white/15 bg-black/50 backdrop-blur-md text-white'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full shrink-0',
              matchTheme.badgeColor,
              isGame && 'game:shadow-[0_0_10px_currentColor]'
            )} />
            {matchTheme.label}
          </div>

          {ownerProfile && (
            <div className={cn(
              'flex items-center gap-2 px-2.5 py-1 rounded-full border shadow-md',
              isLight
                ? 'bg-muted text-foreground border-border'
                : 'bg-black/50 backdrop-blur-md border-white/10 text-white'
            )}>
              <Avatar className={cn('h-5 w-5 border', isLight ? 'border-border' : 'border-white/20')}>
                <AvatarImage src={ownerProfile.photoURL || ''} />
                <AvatarFallback className={cn('text-[8px]', isLight ? 'bg-muted-foreground/20' : 'bg-white/20 text-white')}>
                  {ownerProfile.displayName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className={cn(
                'text-xs font-semibold max-w-[120px] truncate',
                isLight ? 'text-foreground' : 'text-white/85'
              )}>{ownerProfile.displayName}</span>
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
                  className={cn(
                    'w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36',
                    isLight ? 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.15)]' : 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]'
                  )}
                />
                <span className={cn(
                  'font-black text-sm sm:text-lg md:text-xl text-center text-balance leading-tight line-clamp-2',
                  isLight ? 'text-foreground' : 'text-white drop-shadow-md'
                )}>
                  {match.teams![0].name}
                </span>
              </div>

              {/* Center: score / VS */}
              <div className="flex flex-col items-center justify-center shrink-0 gap-1">
                {hasScore ? (
                  <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
                    <span className={cn(
                      'text-5xl sm:text-7xl md:text-8xl font-black tabular-nums leading-none',
                      isLight
                        ? 'text-foreground'
                        : 'text-white drop-shadow-lg game:text-[#aafe48] game:drop-shadow-[0_0_20px_rgba(170,254,72,0.5)]'
                    )}>
                      {match.finalScore!.team1}
                    </span>
                    <span className={cn(
                      'text-2xl sm:text-3xl font-bold',
                      isLight ? 'text-muted-foreground/40' : 'text-white/25'
                    )}>—</span>
                    <span className={cn(
                      'text-5xl sm:text-7xl md:text-8xl font-black tabular-nums leading-none',
                      isLight
                        ? 'text-foreground'
                        : 'text-white drop-shadow-lg game:text-[#aafe48] game:drop-shadow-[0_0_20px_rgba(170,254,72,0.5)]'
                    )}>
                      {match.finalScore!.team2}
                    </span>
                  </div>
                ) : (
                  <span className={cn(
                    'text-3xl sm:text-5xl md:text-6xl font-black italic tracking-tight',
                    isLight ? 'text-muted-foreground/40' : 'text-white/20'
                  )}>VS</span>
                )}
                {isCompleted && hasScore && (
                  <span className={cn(
                    'text-[10px] uppercase tracking-widest font-bold mt-1',
                    isLight ? 'text-muted-foreground' : 'text-white/35'
                  )}>Resultado final</span>
                )}
              </div>

              {/* Team B */}
              <div className="flex flex-col items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
                <JerseyPreview
                  jersey={match.teams![1].jersey}
                  size="lg"
                  className={cn(
                    'w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36',
                    isLight ? 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.15)]' : 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]'
                  )}
                />
                <span className={cn(
                  'font-black text-sm sm:text-lg md:text-xl text-center text-balance leading-tight line-clamp-2',
                  isLight ? 'text-foreground' : 'text-white drop-shadow-md'
                )}>
                  {match.teams![1].name}
                </span>
              </div>
            </div>
          ) : (
            /* ── Non-team match title ── */
            <div className="flex flex-col items-center gap-3 text-center px-2 max-w-2xl mx-auto">
              <h2 className={cn(
                'text-3xl sm:text-5xl md:text-6xl font-black text-balance leading-[1.05]',
                isLight ? 'text-foreground' : 'text-white drop-shadow-lg'
              )}>
                {match.title}
              </h2>
              {spotsLeft > 0 && match.status === 'upcoming' && (
                <div className={cn(
                  'flex items-center gap-1.5',
                  isLight ? 'text-muted-foreground' : 'text-white/50'
                )}>
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
            <MatchCountdown matchDate={match.date} matchTime={match.time} isLight={isLight} />
          </div>
        )}

        {/* Row 3: Info bar + Actions */}
        <div className="space-y-2.5 sm:space-y-3">

          {/* Info strip */}
          <div className={cn(
            'flex items-stretch rounded-2xl overflow-hidden border divide-x',
            isLight
              ? 'bg-muted/50 border-border/70 divide-border text-foreground'
              : 'bg-white/5 border-white/10 game:border-[#aafe48]/15 backdrop-blur-xl divide-white/10 text-white'
          )}>
            <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3">
              <Calendar className={cn('h-3.5 w-3.5 shrink-0', isLight ? 'text-muted-foreground' : 'text-white/50')} />
              <span className="text-[11px] sm:text-xs font-semibold truncate">
                {match.status === 'planning' || !match.date
                  ? 'A definir'
                  : format(new Date(match.date), 'EEE d MMM', { locale: es })}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3">
              <Clock className={cn('h-3.5 w-3.5 shrink-0', isLight ? 'text-muted-foreground' : 'text-white/50')} />
              <span className="text-[11px] sm:text-xs font-semibold">
                {match.status === 'planning' || !match.time ? 'A definir' : `${match.time} hs`}
              </span>
            </div>

            <div className="flex-[1.5] hidden md:flex items-center justify-center gap-2 py-3 px-3">
              <MapPin className={cn('h-3.5 w-3.5 shrink-0', isLight ? 'text-muted-foreground' : 'text-white/50')} />
              <span className="text-xs font-semibold truncate max-w-[150px]">
                {match.location?.name || 'A definir'}
              </span>
            </div>

            {WeatherIcon && match.weather && (
              <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3">
                <WeatherIcon className={cn('h-3.5 w-3.5 shrink-0', isLight ? 'text-muted-foreground' : 'text-white/50')} />
                <span className="text-[11px] sm:text-xs font-semibold">{match.weather.temperature}°</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 sm:gap-2.5">
            <Button
              asChild
              variant="outline"
              className={cn(
                'flex-1 rounded-xl h-11 text-xs sm:text-sm gap-1.5',
                !isLight && 'bg-white/5 hover:bg-white/10 border-white/10 text-white backdrop-blur-md'
              )}
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
                  <Button disabled className={cn(
                    'w-full border-0 rounded-xl h-11 text-xs sm:text-sm font-bold',
                    isLight ? 'bg-muted text-muted-foreground' : 'bg-white/10 text-white/50'
                  )}>
                    Lleno
                  </Button>
                ) : isUserPendingRequest ? (
                  <Button disabled className={cn(
                    'w-full rounded-xl h-11 text-xs sm:text-sm font-bold gap-1.5',
                    isLight ? 'bg-muted text-muted-foreground border-border' : 'bg-white/10 text-white/50 border border-white/15'
                  )}>
                    <Hourglass className="h-3.5 w-3.5 shrink-0" />
                    Solicitud enviada
                  </Button>
                ) : (
                  <Button
                    onClick={onJoinOrLeave}
                    disabled={isJoining}
                    className={cn(
                      'w-full h-11 rounded-xl text-xs sm:text-sm font-bold transition-transform active:scale-95 gap-1.5',
                      !isUserInMatch
                        ? matchTheme.button
                        : isLight
                          ? 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                          : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
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
