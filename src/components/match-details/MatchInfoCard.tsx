
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
import { getMatchTheme } from '@/lib/match-theme';
import { cn } from '@/lib/utils';

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

  return (
    <Card className={cn(
      "group relative overflow-hidden border-2 rounded-xl shadow-md glass hover:shadow-lg transition-all duration-300 text-foreground hero-match-banner",
      // Type-specific top border
      match.type === 'manual' && "border-t-4 border-t-blue-500",
      match.type === 'collaborative' && "border-t-4 border-t-violet-500",
      match.type === 'by_teams' && "border-t-4 border-t-emerald-500",
      match.type === 'league' && "border-t-4 border-t-amber-500",
      match.type === 'cup' && "border-t-4 border-t-red-500",
      match.type === 'league_final' && "border-t-4 border-t-amber-400 shadow-2xl shadow-amber-500/50",
      match.type === 'intergroup_friendly' && "border-t-4 border-t-teal-500"
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
          "absolute inset-0 game-banner-overlay",
          // Type-specific gradient overlay
          match.type === 'manual' && "bg-gradient-to-br from-primary/40 via-primary/30 to-background/50",
          match.type === 'collaborative' && "bg-gradient-to-br from-accent/40 via-accent/30 to-background/50",
          match.type === 'by_teams' && "bg-gradient-to-br from-success/40 via-success/30 to-background/50",
          match.type === 'league' && "bg-gradient-to-br from-warning/50 via-warning/40 to-background/50",
          match.type === 'cup' && "bg-gradient-to-br from-destructive/50 via-destructive/40 to-background/50",
          match.type === 'league_final' && "bg-gradient-to-br from-amber-400/60 via-orange-500/50 to-red-500/40",
          match.type === 'intergroup_friendly' && "bg-gradient-to-br from-info/40 via-info/30 to-background/50"
        )} />
      </div>

      <CardContent className="relative z-10 p-8 pt-8 space-y-6 bg-transparent transition-all duration-300">
        {/* Special header for league_final */}
        {match.type === 'league_final' && (
          <div className="-mx-8 -mt-8 mb-6 p-6 bg-gradient-to-r from-warning via-warning to-warning text-center">
            <h2 className="text-2xl font-black uppercase tracking-wider text-foreground animate-pulse">
              ⚡ PARTIDO DEFINITORIO ⚡
            </h2>
            <p className="text-sm font-semibold text-foreground/90 mt-1">
              El ganador se corona CAMPEÓN
            </p>
          </div>
        )}

        {/* League/Cup context */}
        {(match.type === 'league' || match.type === 'cup') && match.leagueInfo && (
          <div className="-mx-8 -mt-8 mb-6 p-4 bg-background/30 border-b border-border">
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-bold text-amber-400">
                {match.type === 'league' ? '🏆 Liga' : '🏆 Copa'}
              </span>
              {match.type === 'league' && (
                <span className="text-sm text-foreground/80">• Fecha {match.leagueInfo.round}</span>
              )}
              {match.type === 'cup' && (
                <span className="text-sm text-foreground/80">
                  • {match.leagueInfo.round === 1 ? 'FINAL' :
                    match.leagueInfo.round === 2 ? 'SEMIFINAL' :
                      match.leagueInfo.round === 3 ? 'CUARTOS' :
                        `Ronda ${match.leagueInfo.round}`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fecha y organizador */}
        <div className="flex flex-col sm:flex-row gap-6 justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-lg">
              <Calendar className="h-5 w-5 icon-with-circle" aria-hidden="true" />
              <span className="font-semibold">
                {format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}
              </span>
            </div>
            {ownerProfile && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ownerProfile.photoURL || ''} alt={ownerProfile.displayName || ''} />
                  <AvatarFallback className="text-xs">{ownerProfile.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="text-sm text-white/90">{`Organizado por ${ownerProfile.displayName}`}</p>
              </div>
            )}
          </div>

          {/* Hora y clima */}
          <div className="space-y-4 text-left sm:text-right">
            <div className="flex items-center gap-3 text-lg justify-start sm:justify-end">
              <Clock className="h-5 w-5 icon-with-circle" aria-hidden="true" />
              <span className="font-semibold">{match.time} hs</span>
              {WeatherIcon && match.weather && (
                <span className="flex items-center gap-1.5 text-sm text-white/90">
                  <WeatherIcon className="h-4 w-4 text-white" aria-hidden="true" />
                  <span>({match.weather.temperature}°C)</span>
                </span>
              )}
            </div>
            <div className="flex justify-start sm:justify-end">
              <Badge variant="outline" className="capitalize text-sm bg-foreground/10 border-foreground/30 text-white badge">
                {match.type === 'by_teams' ? 'Por Equipos' : match.type}
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="bg-foreground/20" />

        {/* Ubicación y acciones */}
        <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0 icon-with-circle" aria-hidden="true" />
            <p className="font-semibold">{match.location.name}</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Button asChild variant="default" size="sm" className="game-theme-button">
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
                asChild
                className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90 text-[hsl(var(--whatsapp-foreground))] border-0"
              >
                <a
                  href={`https://wa.me/?text=${whatsAppShareText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Compartir partido por WhatsApp"
                >
                  <WhatsAppIcon className="mr-2 h-4 w-4" />
                  Compartir
                </a>
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
                className="w-full min-h-[48px] font-semibold"
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
});
