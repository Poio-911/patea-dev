'use client';

import { useMemo } from 'react';
import { OverlayView } from '@react-google-maps/api';
import type { AvailablePlayer } from '@/lib/types';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { PlayerMarkerIcon } from '@/components/icons/player-marker-icon';

interface PlayerMarkerProps {
  player: AvailablePlayer;
  activeMarker: string | null;
  handleMarkerClick: (playerId: string) => void;
}

const positionBadgeStyles: Record<AvailablePlayer['position'], string> = {
    DEL: 'bg-red-100 text-red-800',
    MED: 'bg-green-100 text-green-800',
    DEF: 'bg-blue-100 text-blue-800',
    POR: 'bg-orange-100 text-orange-800',
};

// Componente del marcador personalizado
const CustomMarker = ({ onClick }: { onClick: () => void }) => (
    <button 
        onClick={onClick} 
        className="relative flex items-center justify-center"
        style={{ width: '32px', height: '32px' }}
    >
        <PlayerMarkerIcon className="h-8 w-8 text-amber-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
    </button>
);

// Componente del popup
const PlayerPopup = ({ player }: { player: AvailablePlayer }) => {
    const playerName = player.displayName || (player as any).name;
    
    return (
        <div className="relative">
            {/* El popup principal */}
            <div className="w-48 rounded-xl border bg-background shadow-lg animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between border-b p-2">
                    <h3 className="pl-2 text-base font-bold leading-tight truncate">{playerName}</h3>
                </div>
                <div className="p-2">
                    <div className="flex items-center justify-start gap-2">
                        <Badge 
                            variant="default" 
                            className={cn("text-sm font-bold", player.ovr > 80 ? "bg-green-500/80" : "bg-primary")}
                        >
                            {player.ovr}
                        </Badge>
                        <Badge 
                            variant="outline" 
                            className={cn("text-sm font-semibold", positionBadgeStyles[player.position])}
                        >
                            {player.position}
                        </Badge>
                    </div>
                </div>
            </div>
            
            {/* Flecha que apunta hacia abajo */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="w-4 h-4 bg-background border-r border-b border-gray-200 transform rotate-45 shadow-sm"></div>
            </div>
        </div>
    );
};

export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const isUserLocationMarker = player.uid === 'user-location';
  const isActive = activeMarker === player.uid;

  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }
  
  // Marcador especial para la ubicación del usuario
  if (isUserLocationMarker) {
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
        {/* Marcador del jugador */}
        <OverlayView
            position={player.location}
            mapPaneName={OverlayView.MARKER_LAYER}
            getPixelPositionOffset={() => ({
                x: -16, // Centrar horizontalmente (32px / 2)
                y: -32, // Posicionar en la base del marcador
            })}
        >
            <CustomMarker onClick={() => handleMarkerClick(player.uid)} />
        </OverlayView>

        {/* Popup de información */}
        {isActive && (
            <OverlayView
                position={player.location}
                mapPaneName={OverlayView.FLOAT_PANE}
                getPixelPositionOffset={() => ({
                    x: -96, // Centrar el popup (192px / 2)
                    y: -110, // Posicionar arriba del marcador con margen
                })}
            >
                <PlayerPopup player={player} />
            </OverlayView>
        )}
    </>
  );
}