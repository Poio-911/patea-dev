'use client';

import { useMemo } from 'react';
import type { AvailablePlayer } from '@/lib/types';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { PlayerMarkerIcon } from '@/components/icons/player-marker-icon';
import { PlayerPositionBadge } from '@/components/player-styles';

interface PlayerMarkerProps {
    player: AvailablePlayer;
    activeMarker: string | null;
    handleMarkerClick: (playerId: string) => void;
}


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
                        <PlayerPositionBadge position={player.position} size="sm" showIcon={false} />
                    </div>
                </div>
            </div>

            {/* Flecha que apunta hacia abajo */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="w-4 h-4 bg-background border-r border-b border-gray-200 dark:border-gray-700 transform rotate-45 shadow-sm"></div>
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
        return null;
    }

    return (
        <>
            {/* Marcador del jugador */}
            {/* Map integration removed; future OSM/Leaflet markers go here */}

            {/* Popup de información */}
            {isActive && (
                <div className="sr-only"><PlayerPopup player={player} /></div>
            )}
        </>
    );
}