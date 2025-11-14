
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
  onJoinOrLeave: () => void;
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
  return (
    <Card className="group relative overflow-hidden border-2 border-t-4 border-t-primary text-foreground dark:text-white rounded-xl shadow-md glass hover:shadow-lg transition-all duration-300">
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
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/50" />
        <div className="absolute inset-0 gradient-primary opacity-40" />
      </div>

      <CardContent className="relative z-10 p-8 pt-8 space-y-6 bg-transparent text-white [text-shadow:0_2px_4px_rgb(0_0_0_/_0.6)] transition-all duration-300">
        {/* Fecha y organizador */}
        <div className="flex flex-col sm:flex-row gap-6 justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-lg">
              <Calendar className="h-5 w-5 text-white/90" aria-hidden="true" />
              <span className="font-semibold text-white">
                {format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}
              </span>
            </div>
            {ownerProfile && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ownerProfile.photoURL || ''} alt={ownerProfile.displayName || ''} />
                  <AvatarFallback className="text-xs">{ownerProfile.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="text-sm text-white/80">{`Organizado por ${ownerProfile.displayName}`}</p>
              </div>
            )}
          </div>

          {/* Hora y clima */}
          <div className="space-y-4 text-left sm:text-right">
            <div className="flex items-center gap-3 text-lg justify-start sm:justify-end">
              <Clock className="h-5 w-5 text-white/90" aria-hidden="true" />
              <span className="font-semibold text-white">{match.time} hs</span>
              {WeatherIcon && match.weather && (
                <span className="flex items-center gap-1.5 text-sm text-white/80">
                  <WeatherIcon className="h-4 w-4 text-blue-300" aria-hidden="true" />
                  <span>({match.weather.temperature}°C)</span>
                </span>
              )}
            </div>
            <div className="flex justify-start sm:justify-end">
              <Badge variant="outline" className="capitalize text-sm bg-white/10 border-white/30 text-white">
                {match.type === 'by_teams' ? 'Por Equipos' : match.type}
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="bg-white/20" />

        {/* Ubicación y acciones */}
        <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0 text-white/90" aria-hidden="true" />
            <p className="font-semibold text-white">{match.location.name}</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Button asChild variant="secondary" size="sm">
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
                variant="outline"
                size="sm"
                asChild
                className="bg-white/10 border-white/30 hover:bg-white/20 text-white"
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
          <div className="border-t pt-4 border-white/20">
            {isMatchFull && !isUserInMatch ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full font-bold text-base bg-white/5 border-white/20 text-white/60"
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
