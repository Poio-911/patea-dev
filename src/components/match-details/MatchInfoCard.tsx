'use client';

import React, { useState, useEffect } from 'react';
import type { Match, UserProfile } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, UserPlus, LogOut, Loader2, Share2, Navigation, Hourglass } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNativeShare } from '@/hooks/use-native-share';
import { useHaptics } from '@/hooks/use-haptics';
import { getMatchTheme } from '@/lib/match-theme';
import { cn, formatVenueName } from '@/lib/utils';
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

// --- Helpers for Countdown ---
interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function parseMatchDateTime(date: string, time: string): Date {
  const cleanTime = time.replace(' hs', '').replace('hs', '').trim();
  let targetDate = new Date(`${date}T${cleanTime}`);
  if (isNaN(targetDate.getTime())) targetDate = new Date(`${date}T${cleanTime}:00`);
  if (isNaN(targetDate.getTime())) {
    const dateParts = date.split('-');
    const timeParts = cleanTime.split(':');
    if (dateParts.length >= 3 && timeParts.length >= 2) {
      targetDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), parseInt(timeParts[0]), parseInt(timeParts[1]), timeParts[2] ? parseInt(timeParts[2]) : 0);
    }
  }
  return targetDate;
}

function calculateCountdown(matchDate: string, matchTime: string): CountdownValues | null {
  const now = new Date().getTime();
  const target = parseMatchDateTime(matchDate, matchTime).getTime();
  if (isNaN(target)) return null;
  const diff = target - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function MatchCountdown({ matchDate, matchTime }: { matchDate: string; matchTime: string }) {
  const [countdown, setCountdown] = useState<CountdownValues | null>(() => calculateCountdown(matchDate, matchTime));
  useEffect(() => {
    const updateCountdown = () => setCountdown(calculateCountdown(matchDate, matchTime));
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [matchDate, matchTime]);

  if (!countdown) return null;

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <span className="text-3xl sm:text-4xl md:text-5xl font-black tabular-nums">{String(value).padStart(2, '0')}</span>
      <span className="text-[10px] sm:text-xs uppercase tracking-wider text-white/50 font-medium">{label}</span>
    </div>
  );

  const Separator = () => <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white/20 self-start mt-1">:</span>;

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mt-8">
      {countdown.days > 0 && <><TimeUnit value={countdown.days} label="días" /><Separator /></>}
      <TimeUnit value={countdown.hours} label="horas" /><Separator />
      <TimeUnit value={countdown.minutes} label="min" /><Separator />
      <TimeUnit value={countdown.seconds} label="seg" />
    </div>
  );
}
// -----------------------------

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
    const matchUrl = `${window.location.origin}/matches/${match.id}`;
    share({
      title: `⚽ Partido: ${match.title}`,
      text: decodeURIComponent(whatsAppShareText),
      url: matchUrl,
    });
  };

  const matchPhoto = `/images/backgrounds/fondo_${(Math.abs(match.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 12) + 1}.jpg`;
  const isTeamMatch = match.type === 'by_teams' && match.teams && match.teams.length === 2;
  const hasScore = match.finalScore && match.status !== 'upcoming' && match.status !== 'planning';

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-2xl transition-all duration-300 isolate bg-black text-white min-h-[400px] sm:min-h-[460px] md:min-h-[520px] flex flex-col justify-end w-full">
      {/* Background Image & Gradients */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <img src={matchPhoto} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-black/40 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-[#050510]/80 to-transparent z-[2]" />
        <div className={cn("absolute inset-0 z-[1] opacity-45 mix-blend-overlay", matchTheme.bannerOverlay)} />
      </div>

      {/* League_final ribbon */}
      {match.type === 'league_final' && (
        <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 text-center shadow-lg">
          <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-white animate-pulse">⚡ PARTIDO DEFINITORIO ⚡</h2>
          <p className="text-[10px] md:text-xs font-semibold text-white/90 mt-0.5">El ganador se corona CAMPEÓN</p>
        </div>
      )}

      {/* League/Cup context ribbon */}
      {(match.type === 'league' || match.type === 'cup') && match.leagueInfo && (
        <div className="absolute top-0 left-0 right-0 z-20 px-4 py-2 bg-black/50 backdrop-blur-md border-b border-white/10 flex items-center justify-center gap-2">
          <span className={cn("text-xs md:text-sm font-bold", match.type === 'league' ? 'text-amber-400' : 'text-red-400')}>
            {match.type === 'league' ? '🏆 Liga' : '🏆 Copa'}
          </span>
          {match.type === 'league' && <span className="text-[10px] md:text-xs text-white/80">• Fecha {match.leagueInfo.round}</span>}
          {match.type === 'cup' && (
            <span className="text-[10px] md:text-xs text-white/80">
              • {match.leagueInfo.round === 1 ? 'FINAL' : match.leagueInfo.round === 2 ? 'SEMIFINAL' : match.leagueInfo.round === 3 ? 'CUARTOS' : `Ronda ${match.leagueInfo.round}`}
            </span>
          )}
        </div>
      )}

      {/* Main Content Container */}
      <CardContent className={cn(
        "relative z-10 px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 flex flex-col h-full flex-grow",
        (match.type === 'league_final') ? 'pt-20 sm:pt-24' : ((match.type === 'league' || match.type === 'cup') && match.leagueInfo) ? 'pt-14 sm:pt-16' : 'pt-4 sm:pt-8'
      )}>

        {/* Badges Top Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-auto">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-white/20 bg-black/50 backdrop-blur-md shadow-lg">
            <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 bg-current shadow-[0_0_10px_currentColor] brightness-150", matchTheme.badgeColor.replace('bg-', 'text-'))} />
            <span>{matchTheme.label}</span>
          </div>

          {ownerProfile && (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-lg">
              <Avatar className="h-4 w-4 sm:h-5 sm:w-5 border border-white/20">
                <AvatarImage src={ownerProfile.photoURL || ''} />
                <AvatarFallback className="text-[8px] sm:text-[9px] bg-white/20 text-white">{ownerProfile.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-[10px] sm:text-xs font-bold text-white/90">{ownerProfile.displayName}</span>
            </div>
          )}
        </div>

        {/* Middle Section: Teams or Title */}
        <div className="mt-6 mb-4 sm:mt-8 sm:mb-6 flex flex-col items-center justify-center text-center">
          {isTeamMatch ? (
            <div className="flex flex-col gap-4 sm:gap-6 w-full items-center">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-white/80 max-w-[90%] mx-auto">{match.title}</h2>
              <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12 w-full">
                <div className="flex flex-col items-center gap-2 sm:gap-3 w-[80px] sm:w-[120px]">
                  <JerseyPreview jersey={match.teams![0].jersey} size="lg" className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 drop-shadow-2xl" />
                  <span className="font-bold text-xs sm:text-sm md:text-lg text-balance line-clamp-2">{match.teams![0].name}</span>
                </div>

                <div className="flex flex-col items-center justify-center shrink-0">
                  {hasScore ? (
                    <div className="flex items-center justify-center gap-2 sm:gap-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-black/50 border border-white/10 rounded-2xl backdrop-blur-md">
                      <span className="text-2xl sm:text-4xl md:text-5xl font-black">{match.finalScore!.team1}</span>
                      <span className="text-lg sm:text-2xl font-bold text-white/40">-</span>
                      <span className="text-2xl sm:text-4xl md:text-5xl font-black">{match.finalScore!.team2}</span>
                    </div>
                  ) : (
                    <span className="font-black text-xl sm:text-3xl md:text-4xl text-white/40 italic px-2">VS</span>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2 sm:gap-3 w-[80px] sm:w-[120px]">
                  <JerseyPreview jersey={match.teams![1].jersey} size="lg" className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 drop-shadow-2xl" />
                  <span className="font-bold text-xs sm:text-sm md:text-lg text-balance line-clamp-2">{match.teams![1].name}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:gap-6 px-2">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-balance leading-tight drop-shadow-md max-w-2xl">
                {match.title}
              </h2>
            </div>
          )}

          {/* Show countdown if upcoming */}
          {match.status === 'upcoming' && !hasScore && (
            <div className="mt-4 sm:mt-8 transform scale-[0.85] sm:scale-100 opacity-90">
              <MatchCountdown matchDate={match.date} matchTime={match.time} />
            </div>
          )}
        </div>

        {/* Bottom Control & Info Panel */}
        <div className="mt-auto space-y-3 sm:space-y-4">
          {/* Bottom Info Strip Glassmorphism */}
          <div className="flex divide-x divide-white/10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-xl">
            <div className="flex-1 py-2 sm:py-3 px-1 sm:px-3 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="bg-white/10 p-1.5 sm:p-2 rounded-lg shrink-0">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] sm:text-[10px] text-white/60 font-semibold uppercase tracking-wider hidden sm:block">Fecha</span>
                <span className="text-[10px] sm:text-xs md:text-sm font-bold truncate max-w-full">
                  {match.status === 'planning' || !match.date ? "A definir" : format(new Date(match.date), "EEE d MMM", { locale: es })}
                </span>
              </div>
            </div>

            <div className="flex-1 py-2 sm:py-3 px-1 sm:px-3 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-3 text-center sm:text-left">
              <div className="bg-white/10 p-1.5 sm:p-2 rounded-lg shrink-0">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] sm:text-[10px] text-white/60 font-semibold uppercase tracking-wider hidden sm:block">Hora</span>
                <span className="text-[10px] sm:text-xs md:text-sm font-bold truncate max-w-full">
                  {match.status === 'planning' || !match.time ? "A definir" : `${match.time} hs`}
                </span>
              </div>
            </div>

            <div className="flex-[1.5] py-2 sm:py-3 px-1 sm:px-3 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-3 text-center sm:text-left hidden md:flex">
              <div className="bg-white/10 p-2 rounded-lg shrink-0">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Lugar</span>
                <span className="text-xs md:text-sm font-bold truncate max-w-full">
                  {match.location?.name || 'A definir'}
                </span>
              </div>
            </div>

            {WeatherIcon && match.weather && (
              <div className="flex-[0.8] py-2 sm:py-3 px-1 sm:px-3 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-3 text-center sm:text-left">
                <div className="bg-white/10 p-1.5 sm:p-2 rounded-lg shrink-0">
                  <WeatherIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] sm:text-[10px] text-white/60 font-semibold uppercase tracking-wider hidden sm:block">Clima</span>
                  <span className="text-[10px] sm:text-xs md:text-sm font-bold truncate max-w-full">{match.weather.temperature}°C</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 sm:gap-3">
            <Button asChild variant="outline" className="flex-1 bg-white/5 hover:bg-white/10 border-white/10 text-white backdrop-blur-md rounded-xl h-10 sm:h-12 text-xs sm:text-sm">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Lugar
              </a>
            </Button>

            {isOwner && match.status === 'upcoming' && (
              <Button onClick={handleShare} className="flex-1 bg-[#25D366]/90 hover:bg-[#25D366] text-black border-0 rounded-xl h-10 sm:h-12 text-xs sm:text-sm shadow-lg font-bold">
                <Share2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Compartir
              </Button>
            )}

            {(match.type === 'collaborative' || match.type === 'manual') && match.status === 'upcoming' && !isOwner && (
              <div className="flex-[1.2] sm:flex-[1.5]">
                {isMatchFull && !isUserInMatch && !isUserPendingRequest ? (
                  <Button disabled className="w-full bg-white/10 text-white/60 border-0 rounded-xl h-10 sm:h-12 text-xs sm:text-sm font-bold">
                    Lleno
                  </Button>
                ) : isUserPendingRequest ? (
                  <Button disabled className="w-full bg-white/10 text-white/50 border border-white/15 rounded-xl h-10 sm:h-12 text-xs sm:text-sm font-bold">
                    <Hourglass className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Solicitud enviada
                  </Button>
                ) : (
                  <Button
                    onClick={onJoinOrLeave}
                    disabled={isJoining}
                    className={cn("w-full h-10 sm:h-12 rounded-xl text-xs sm:text-sm font-bold transition-transform active:scale-95",
                      !isUserInMatch ? matchTheme.button : "bg-white/15 hover:bg-white/25 text-white border border-white/20"
                    )}
                  >
                    {isJoining ? <Loader2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> :
                      isUserInMatch ? <LogOut className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <UserPlus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    {isUserInMatch ? 'Baja' : (match.type === 'manual' ? 'Solicitar unirse' : 'Apuntarse')}
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
