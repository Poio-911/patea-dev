
'use client';

import { useMemo, useState } from 'react';
import { InfoWindowF, OverlayView } from '@react-google-maps/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, arrayUnion, arrayRemove, getDoc, writeBatch, collection } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import type { AvailablePlayer } from '@/lib/types';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, LogOut, X } from 'lucide-react';
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


export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);

  const playerName = player.displayName || (player as any).name;

  if (!player.location || typeof player.location.lat !== 'number' || typeof player.location.lng !== 'number') {
    return null;
  }

  const getPixelPositionOffset = (width: number, height: number) => ({
    x: -(width / 2),
    y: -(height / 2),
  });
  
  return (
    <>
       <OverlayView
        position={player.location}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        getPixelPositionOffset={getPixelPositionOffset}
      >
        <button type="button" onClick={() => handleMarkerClick(player.uid)} className="cursor-pointer border-none bg-transparent p-0">
          <PlayerMarkerIcon className="h-8 w-8 text-amber-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
        </button>
      </OverlayView>

      {activeMarker === player.uid && (
         <InfoWindowF
            position={player.location}
            onCloseClick={() => handleMarkerClick('')}
            options={{
                pixelOffset: new window.google.maps.Size(0, -40),
                disableAutoPan: true,
            }}
        >
            <div className="w-48">
                 <div className="flex justify-between items-center pb-2">
                    <h3 className="font-bold text-base leading-tight truncate">{playerName}</h3>
                </div>
                <div className="flex items-center justify-start gap-2">
                    <Badge variant="default" className={cn("text-sm font-bold", player.ovr > 80 ? "bg-green-500/80" : "bg-primary")}>{player.ovr}</Badge>
                    <Badge variant="outline" className={cn("text-sm font-semibold", positionBadgeStyles[player.position])}>{player.position}</Badge>
                </div>
            </div>
        </InfoWindowF>
      )}
    </>
  );
}

