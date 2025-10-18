
'use client';

import { useState } from 'react';
import { MarkerF, InfoWindowF } from '@react-google-maps/api';
import type { AvailablePlayer, Match } from '@/lib/types';
import { Button } from './ui/button';
import { UserPlus } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { InvitePlayerDialog } from './invite-player-dialog'; 

interface PlayerMarkerProps {
  player: AvailablePlayer;
  activeMarker: string | null;
  handleMarkerClick: (playerId: string) => void;
}

export function PlayerMarker({ player, activeMarker, handleMarkerClick }: PlayerMarkerProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const incompleteMatchesQuery = firestore && user?.uid ? query(
    collection(firestore, 'matches'),
    where('ownerUid', '==', user.uid),
    where('status', '==', 'upcoming'),
    // where('isFull', '==', false) // We'll filter client-side for now
  ) : null;

  const { data: userMatches } = useCollection<Match>(incompleteMatchesQuery);

  const availableMatchesForInvite = userMatches?.filter(m => m.players.length < m.matchSize) || [];
  
  const icon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.00001 3C8.82844 3 9.50001 2.32843 9.50001 1.5C9.50001 0.671573 8.82844 0 8.00001 0C7.17158 0 6.50001 0.671573 6.50001 1.5C6.50001 2.32843 7.17158 3 8.00001 3Z" fill="%23FBBF24"/>
        <path d="M12 4V2H14V4C14 5.10457 13.1045 6 12 6H10.5454L10.9897 16H8.98773L8.76557 11H7.23421L7.01193 16H5.00995L5.42014 6.77308L3.29995 9.6L1.69995 8.4L4.99995 4H12Z" fill="%23FBBF24"/>
      </svg>
    `),
    scaledSize: new window.google.maps.Size(32, 32),
  };

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
            <div className="space-y-2 p-1 w-60">
                <h3 className="font-bold text-base leading-tight">{player.displayName}</h3>
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">OVR: {player.ovr}</span>
                    <span className="font-semibold text-sm">{player.position}</span>
                </div>
                
                <InvitePlayerDialog 
                  playerToInvite={player} 
                  userMatches={availableMatchesForInvite}
                >
                  <Button size="sm" className="w-full h-8 text-xs" disabled={!user || availableMatchesForInvite.length === 0}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invitar a Partido
                  </Button>
                </InvitePlayerDialog>

            </div>
        </InfoWindowF>
      )}
    </MarkerF>
  );
}
