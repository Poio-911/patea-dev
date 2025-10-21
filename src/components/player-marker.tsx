
'use client';

import { useMemo } from 'react';
import { MarkerF, InfoWindowF } from '@react-google-maps/api';
import type { AvailablePlayer } from '@/lib/types';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { PlayerMarkerIcon } from './icons/player-marker-icon';

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
  const playerName = player.displayName || (player as any).name;

  const icon = useMemo(() => {
    return {
      path: 'M8 0C3.58 0 0 3.58 0 8c0 7 8 16 8 16s8-9 8-16c0-4.42-3.58-8-8-8zm0 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z',
      fillColor: '#FBBF24', // amber-400
      fillOpacity: 1,
      strokeWeight: 1,
      strokeColor: '#000',
      scale: 1.5,
      anchor: new google.maps.Point(8, 24),
    };
  }, []);

  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }
  
  return (
    <>
      <MarkerF
        position={player.location}
        onClick={() => handleMarkerClick(player.uid)}
        icon={icon}
        zIndex={activeMarker === player.uid ? 5 : 1}
      />

      {activeMarker === player.uid && (
         <InfoWindowF
            position={player.location}
            onCloseClick={() => handleMarkerClick('')}
            options={{
                pixelOffset: new window.google.maps.Size(0, -40),
                disableAutoPan: true,
            }}
        >
            <div className="bg-background rounded-xl w-48 p-0 m-0">
                <div className="flex justify-between items-center p-2 border-b">
                    <h3 className="font-bold text-base leading-tight truncate pl-2">{playerName}</h3>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-start gap-2">
                        <Badge variant="default" className={cn("text-sm font-bold", player.ovr > 80 ? "bg-green-500/80" : "bg-primary")}>{player.ovr}</Badge>
                        <Badge variant="outline" className={cn("text-sm font-semibold", positionBadgeStyles[player.position])}>{player.position}</Badge>
                    </div>
                </div>
            </div>
        </InfoWindowF>
      )}
    </>
  );
}
