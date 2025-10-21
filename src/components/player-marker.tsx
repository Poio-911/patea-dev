

'use client';

import { useMemo } from 'react';
import { MarkerF, InfoWindowF } from '@react-google-maps/api';
import type { AvailablePlayer } from '@/lib/types';
import { Button } from './ui/button';
import { Send } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { PlayerCard } from './player-card';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';

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

    return {
        path: 'M8 12.5C12.4183 12.5 16 9.14924 16 5C16 0.850759 12.4183 -2.5 8 -2.5C3.58172 -2.5 0 0.850759 0 5C0 9.14924 3.58172 12.5 8 12.5Z',
        fillColor: '#1a73e8',
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: '#FFFFFF',
        rotation: 0,
        scale: 1.5,
        anchor: new window.google.maps.Point(8, 8),
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
            <div className="space-y-2 p-1 w-64">
                <h3 className="font-bold text-base leading-tight">{player.displayName}</h3>
                <div className="flex items-center justify-between">
                    <Badge variant="default" className="text-base">{player.ovr}</Badge>
                    <Badge variant="outline" className={cn("text-base", positionBadgeStyles[player.position])}>{player.position}</Badge>
                </div>
                 <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="link" className="p-0 h-auto text-xs">Ver Atributos</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm p-0 border-0">
                        <PlayerCard player={player as any} isLink={false} />
                    </DialogContent>
                </Dialog>
            </div>
        </InfoWindowF>
      )}
    </MarkerF>
  );
}
