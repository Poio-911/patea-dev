
'use client';

import { useMemo } from 'react';
import { OverlayView } from '@react-google-maps/api';
import type { AvailablePlayer } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { PlayerMarkerIcon } from './icons/player-marker-icon';
import { X } from 'lucide-react';

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

// This function calculates the offset to position the popup correctly above the marker
const getPixelPositionOffset = (width: number, height: number) => ({
  x: -(width / 2),
  y: -(height + 35), // Position popup 'height' pixels up + 35px for marker height and margin
});

export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const playerName = player.displayName || (player as any).name;
  const isUserLocationMarker = player.uid === 'user-location';
  const isActive = activeMarker === player.uid;

  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }
  
  return (
    <>
      <OverlayView
        position={player.location}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        getPixelPositionOffset={(width, height) => ({
            x: -(width / 2),
            y: -height, // This centers the icon on the geographical point
        })}
      >
        <button type="button" onClick={() => handleMarkerClick(player.uid)} className="cursor-pointer border-none bg-transparent p-0">
          <PlayerMarkerIcon className="h-8 w-8 text-amber-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
        </button>
      </OverlayView>

      {isActive && !isUserLocationMarker && (
        <OverlayView
          position={player.location}
          mapPaneName={OverlayView.FLOAT_PANE}
          getPixelPositionOffset={getPixelPositionOffset}
        >
            <div className="relative w-48 rounded-xl border bg-background shadow-lg animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between border-b p-2">
                    <h3 className="pl-2 text-base font-bold leading-tight truncate">{playerName}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMarkerClick('')}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-start gap-2">
                        <Badge variant="default" className={cn("text-sm font-bold", player.ovr > 80 ? "bg-green-500/80" : "bg-primary")}>{player.ovr}</Badge>
                        <Badge variant="outline" className={cn("text-sm font-semibold", positionBadgeStyles[player.position])}>{player.position}</Badge>
                    </div>
                </div>
            </div>
        </OverlayView>
      )}
    </>
  );
}
