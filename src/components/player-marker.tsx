
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

// Helper to offset the marker and pop-up correctly
const getPixelPositionOffset = (width: number, height: number, yOffset = 0) => ({
  x: -(width / 2),
  y: -(height + yOffset),
});

export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const playerName = player.displayName || (player as any).name;

  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }
  
  return (
    <>
      {/* The actual marker icon */}
      <OverlayView
        position={player.location}
        mapPaneName={OverlayView.MARKER_LAYER}
        getPixelPositionOffset={(width, height) => getPixelPositionOffset(width, height)}
      >
        <div onClick={() => handleMarkerClick(player.uid)} className="cursor-pointer">
            <PlayerMarkerIcon className="h-8 w-8 text-amber-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
        </div>
      </OverlayView>

      {/* The pop-up InfoWindow, shown only when active */}
      {activeMarker === player.uid && (
         <OverlayView
            position={player.location}
            mapPaneName={OverlayView.FLOAT_PANE}
            getPixelPositionOffset={(width, height) => getPixelPositionOffset(width, height, 40)} // Increased yOffset to lift popup
        >
            <div className="bg-background border rounded-xl shadow-lg w-48 animate-in fade-in-0 zoom-in-95">
                <div className="flex justify-between items-center p-2 border-b">
                    <h3 className="font-bold text-base leading-tight truncate pl-2">{playerName}</h3>
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
