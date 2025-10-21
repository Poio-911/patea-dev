
'use client';

import { useMemo } from 'react';
import { OverlayView } from '@react-google-maps/api';
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

const getPixelPositionOffset = (width: number, height: number) => ({
  x: -(width / 2),
  y: -(height + 10), // Position it above the marker
});

export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const isUserLocationMarker = player.uid === 'user-location';
  const playerName = player.displayName || (player as any).name;

  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }

  return (
    <>
      <div 
        style={{
          position: 'absolute',
          transform: `translate(${getPixelPositionOffset(30, 30).x}px, ${getPixelPositionOffset(30, 30).y}px)`
        }}
        onClick={() => handleMarkerClick(player.uid)}
      >
        <PlayerMarkerIcon className="h-8 w-8 text-amber-500 cursor-pointer" />
      </div>

      {activeMarker === player.uid && !isUserLocationMarker && (
         <OverlayView
            position={player.location}
            mapPaneName={OverlayView.FLOAT_PANE}
            getPixelPositionOffset={(width, height) => getPixelPositionOffset(width, height + 20)}
        >
            <div className="bg-background border rounded-xl shadow-lg p-3 w-48 animate-in fade-in-0 zoom-in-95">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-base leading-tight truncate">{playerName}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mr-1"
                        onClick={() => handleMarkerClick('')}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center justify-start gap-2">
                    <Badge variant="default" className={cn("text-sm font-bold", player.ovr > 80 ? "bg-green-500/80" : "bg-primary")}>{player.ovr}</Badge>
                    <Badge variant="outline" className={cn("text-sm font-semibold", positionBadgeStyles[player.position])}>{player.position}</Badge>
                </div>
            </div>
        </OverlayView>
      )}
    </>
  );
}
