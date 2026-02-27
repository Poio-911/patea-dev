'use client';

import React from 'react';
import type { Match, UserProfile } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, MapPin, UserPlus, LogOut, Loader2 } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Share2 } from 'lucide-react';
import { useNativeShare } from '@/hooks/use-native-share';
import { useHaptics } from '@/hooks/use-haptics';
import { getMatchTheme } from '@/lib/match-theme';
import { cn, formatVenueName } from '@/lib/utils';

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
  onJoinOrLeave?: () => void;
}

/**
 * Componente que muestra la información principal del partido
 * Elimina el dual theme rendering usando clases CSS condicionales
 */
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

  return (
    <Card className={cn(
      "group relative overflow-hidden border-2 border-t-4 rounded-xl transition-all duration-300 text-foreground hero-match-banner bg-transparent border-white/10 shadow-none hover:shadow-none",
      matchTheme.topAccent
    )}>
      {/* Background video - visible en AMBOS temas */}
      <div className="absolute inset-0 -z-10 rounded-lg overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
          aria-hidden="true"
          key="unified-theme-video"
        >
          <source src="/videos/match-detail-bg-2.mp4" type="video/mp4" />
        </video>
        <div className={cn(
          "absolute inset-0 game-banner-overlay z-0 opacity-65",
          matchTheme.bannerOverlay
        )} />
        {/* Bottom gradient for text readability — doesn't blur/cover the video */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />
      </div>

      {/* League_final ribbon — absolute so it doesn't affect CardContent padding */}
      {match.type === 'league_final' && (
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 text-center">
          <h2 className="text-lg font-black uppercase tracking-wider text-white animate-pulse">
            ⚡ PARTIDO DEFINITORIO ⚡
          </h2>
          <p className="text-xs font-semibold text-white/90 mt-0.5">
            El ganador se corona CAMPEÓN
          </p>
        </div>
      )}

      {/* League/Cup context ribbon — absolute ribbon at top */}
      {(match.type === 'league' || match.type === 'cup') && match.leagueInfo && (
        <div className="absolute top-0 left-0 right-0 z-20 px-4 py-2 bg-black/50 backdrop-blur-sm border-b border-white/10 flex items-center justify-center gap-2">
          <span className={cn(
            "text-sm font-bold",
            match.type === 'league' ? 'text-amber-400' : 'text-red-400'
          )}>
            {match.type === 'league' ? '🏆 Liga' : '🏆 Copa'}
          </span>
          {match.type === 'league' && (
            <span className="text-xs text-white/80">• Fecha {match.leagueInfo.round}</span>
          )}
          {match.type === 'cup' && (
            <span className="text-xs text-white/80">
              • {match.leagueInfo.round === 1 ? 'FINAL' :
                match.leagueInfo.round === 2 ? 'SEMIFINAL' :
                  match.leagueInfo.round === 3 ? 'CUARTOS' :
                    `Ronda ${match.leagueInfo.round}`}
            </span>
          )}
        </div>
      )}

      <CardContent className={cn(
        "relative z-10 p-8 space-y-6 bg-transparent transition-all duration-300",
        // Add top padding when ribbon is present so content doesn't overlap
        (match.type === 'league_final') ? 'pt-24' :
          ((match.type === 'league' || match.type === 'cup') && match.leagueInfo) ? 'pt-14' : 'pt-8'
      )}>

        {/* Título del partido + badge de tipo */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black text-white leading-tight flex-1 min-w-0">
            {match.title}
          </h2>
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border shadow-none flex-shrink-0",
            "bg-white/15 border-white/25 text-white backdrop-blur-md"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full shrink-0 bg-current shadow-[0_0_10px_currentColor] brightness-150",
              matchTheme.badgeColor.replace('bg-', 'text-')
            )} />
            <span>{matchTheme.label}</span>
          </div>
        </div>

        {/* Fecha y organizador */}
        <div className="flex flex-col sm:flex-row gap-6 justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-lg">
              <Calendar className="h-5 w-5 text-white/65" aria-hidden="true" />
              <span className="font-semibold">
                {match.status === 'planning' || !match.date
                  ? "Fecha por definir"
                  : format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}
              </span>
            </div>
            {ownerProfile && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 border border-white/20">
                  <AvatarImage src={ownerProfile.photoURL || ''} alt={ownerProfile.displayName || ''} />
                  <AvatarFallback className="text-[10px] bg-white/20 text-white">{ownerProfile.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="text-sm text-white/90">{`Organizado por ${ownerProfile.displayName}`}</p>
              </div>
            )}
          </div>

          {/* Hora y clima en columna separada */}
          <div className="space-y-3 text-left sm:text-right">
            <div className="flex items-center gap-3 text-lg justify-start sm:justify-end">
              <Clock className="h-5 w-5 text-white/65" aria-hidden="true" />
              <span className="font-semibold">
                {match.status === 'planning' || !match.time ? "Hora por definir" : `${match.time} hs`}
              </span>
            </div>
            {WeatherIcon && match.weather && (
              <div className="flex items-center gap-1.5 text-sm text-white/90 justify-start sm:justify-end">
                <WeatherIcon className="h-4 w-4 text-white" aria-hidden="true" />
                <span>{match.weather.temperature}°C</span>
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-foreground/20" />

        {/* Ubicación y acciones */}
        <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0 text-white/65" aria-hidden="true" />
            <p className="font-semibold">{formatVenueName(match.location.name, match.location.address)}</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Button asChild size="sm" className={cn("game-theme-button !shadow-none", matchTheme.button)}>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir ubicación en Google Maps"
              >
                Ir a la cancha
              </a>
            </Button>
            {isOwner && match.status === 'upcoming' && (
              <Button
                size="sm"
                onClick={handleShare}
                className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90 text-[hsl(var(--whatsapp-foreground))] border-0 !shadow-none"
                aria-label="Compartir partido"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Compartir
              </Button>
            )}
          </div>
        </div>

        {/* Botón para apuntarse/darse de baja */}
        {match.type === 'collaborative' && match.status === 'upcoming' && (
          <div className="border-t pt-4 border-foreground/20">
            {isMatchFull && !isUserInMatch ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full font-bold text-base bg-foreground/5 border-foreground/20 text-foreground/60"
                disabled
                aria-label="Partido completo"
              >
                Partido Lleno
              </Button>
            ) : (
              <Button
                variant={isUserInMatch ? 'secondary' : 'default'}
                size="lg"
                onClick={onJoinOrLeave}
                disabled={isJoining}
                className={cn("w-full min-h-[48px] font-semibold !shadow-none game-theme-button", !isUserInMatch && matchTheme.button)}
                aria-label={isUserInMatch ? 'Darse de baja del partido' : 'Apuntarse al partido'}
              >
                {isJoining ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : isUserInMatch ? (
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isUserInMatch ? 'Darse de baja' : 'Apuntarse'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
);
