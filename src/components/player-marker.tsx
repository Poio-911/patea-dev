
'use client';

import { useMemo, useState } from 'react';
import { MarkerF, OverlayView, InfoWindowF } from '@react-google-maps/api';
import type { AvailablePlayer } from '@/lib/types';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { PlayerMarkerIcon } from './icons/player-marker-icon';
import { X } from 'lucide-react';
import { Button } from './ui/button';

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

// This function tells the OverlayView how to position the popup relative to the marker
const getPixelPositionOffset = (width: number, height: number) => ({
  x: -(width / 2),
  y: -(height + 30), // Position it above the marker
});

export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const isUserLocationMarker = player.uid === 'user-location';
  const playerName = player.displayName || (player as any).name;

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
    const svgIcon = {
      path: "M8.00001 3C8.82844 3 9.50001 2.32843 9.50001 1.5C9.50001 0.671573 8.82844 0 8.00001 0C7.17158 0 6.50001 0.671573 6.50001 1.5C6.50001 2.32843 7.17158 3 8.00001 3ZM12 4V2H14V4C14 5.10457 13.1045 6 12 6H10.5454L10.9897 16H8.98773L8.76557 11H7.23421L7.01193 16H5.00995L5.42014 6.77308L3.29995 9.6L1.69995 8.4L4.99995 4H12Z",
      fillColor: '#FBBF24', // Yellow color
      fillOpacity: 1,
      strokeWeight: 0,
      rotation: 0,
      scale: 1.5,
      anchor: new window.google.maps.Point(8, 8),
    };
    return svgIcon;
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
      {activeMarker === player.uid && !isUserLocationMarker && (
         <OverlayView
            position={player.location}
            mapPaneName={OverlayView.FLOAT_PANE}
            getPixelPositionOffset={getPixelPositionOffset}
        >
            <div className="bg-background border rounded-lg shadow-lg p-3 w-48 animate-in fade-in-0 zoom-in-95">
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
    </MarkerF>
  );
}

