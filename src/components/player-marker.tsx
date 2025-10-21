

'use client';

import { useMemo } from 'react';
import { MarkerF, InfoWindowF } from '@react-google-maps/api';
import type { AvailablePlayer } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { PlayerCard } from './player-card';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';

interface PlayerMarkerProps {
  player: AvailablePlayer;
  activeMarker: string | null;
  handleMarkerClick: (playerId: string) => void;
}

const positionBadgeStyles: Record<AvailablePlayer['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};


export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {

  const isUserLocationMarker = player.uid === 'user-location';
  const playerName = player.displayName || player.name;

  const icon = useMemo(() => {
    if (isUserLocationMarker) {
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        strokeColor: '#000000',
        strokeWeight: 2,
      };
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;

    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.replace('currentColor', '#1D4ED8')),
        scaledSize: new window.google.maps.Size(32, 32),
    };
  }, [isUserLocationMarker]);
  
  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }

  return (
    <MarkerF
      position={player.location}
      onClick={() => handleMarkerClick(player.uid)}
      icon={icon}
      zIndex={activeMarker === player.uid ? 5 : 1}
    >
      {activeMarker === player.uid && (
        <InfoWindowF onCloseClick={() => handleMarkerClick('')}>
            <div className="space-y-2 p-1 w-48">
                <h3 className="font-bold text-base leading-tight truncate">{playerName}</h3>
                <div className="flex items-center justify-between">
                    <Badge variant="default" className="text-sm font-bold bg-primary/20 text-primary border border-primary/50">{player.ovr}</Badge>
                    <Badge variant="outline" className={cn("text-sm font-semibold", positionBadgeStyles[player.position])}>{player.position}</Badge>
                </div>
                 <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="link" className="p-0 h-auto text-xs">Ver Atributos</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm p-0 border-0 bg-transparent shadow-none">
                        <PlayerCard player={player as any} isLink={false} />
                    </DialogContent>
                </Dialog>
            </div>
        </InfoWindowF>
      )}
    </MarkerF>
  );
}
