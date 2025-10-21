
'use client';

import { useMemo } from 'react';
import { OverlayView } from '@react-google-maps/api';
import type { AvailablePlayer } from '@/lib/types';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
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

const MARKER_ICON_HEIGHT = 32; // Approx height of the PlayerMarkerIcon
const MARKER_ICON_WIDTH = 32;

// This component handles the custom HTML marker icon
const CustomMarker = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="transform -translate-x-1/2 -translate-y-full">
        <PlayerMarkerIcon className="h-8 w-8 text-amber-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
    </button>
);


export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const playerName = player.displayName || (player as any).name;
  const isUserLocationMarker = player.uid === 'user-location';
  const isActive = activeMarker === player.uid;

  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }
  
  if (isUserLocationMarker) {
      // Special case for user's own location marker
      return (
        <OverlayView
            position={player.location}
            mapPaneName={OverlayView.FLOAT_PANE}
            getPixelPositionOffset={(width, height) => ({
                x: -(width / 2),
                y: -(height / 2),
            })}
        >
            <div className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-md" />
        </OverlayView>
      )
  }

  return (
    <>
        {/* The Icon Marker */}
        <OverlayView
            position={player.location}
            mapPaneName={OverlayView.MARKER_LAYER}
            getPixelPositionOffset={(width, height) => ({
                x: -(width / 2),
                y: -height,
            })}
        >
            <CustomMarker onClick={() => handleMarkerClick(player.uid)} />
        </OverlayView>

        {/* The Custom InfoWindow (Popup) */}
        {isActive && (
            <OverlayView
                position={player.location}
                mapPaneName={OverlayView.FLOAT_PANE}
                getPixelPositionOffset={(width, height) => ({
                    // Center horizontally, and position it above the marker icon
                    x: -(width / 2),
                    y: -(height + MARKER_ICON_HEIGHT + 10), // popup height + icon height + 10px margin
                })}
            >
                <div className="relative w-48 rounded-xl border bg-background shadow-lg animate-in fade-in-0 zoom-in-95">
                    <div className="flex items-center justify-between border-b p-2">
                         <h3 className="pl-2 text-base font-bold leading-tight truncate">{playerName}</h3>
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

