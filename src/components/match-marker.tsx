
'use client';

import { useState, useMemo } from 'react';
import { MarkerF, InfoWindowF } from '@react-google-maps/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Match, Player } from '@/lib/types';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, LogOut } from 'lucide-react';

interface MatchMarkerProps {
  match: Match;
  activeMarker: string | null;
  handleMarkerClick: (matchId: string) => void;
}

export function MatchMarker({ match, activeMarker, handleMarkerClick }: MatchMarkerProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);

  const isUserInMatch = useMemo(() => {
    if (!user) return false;
    return match.players.some((p: any) => p.uid === user.uid);
  }, [match.players, user]);

  const isMatchFull = useMemo(() => {
    return match.players.length >= match.matchSize;
  }, [match.players, match.matchSize]);

  const handleJoinOrLeaveMatch = async () => {
    if (!firestore || !user) return;
    setIsJoining(true);

    try {
        if (isUserInMatch) {
            const playerToRemove = match.players.find((p: any) => p.uid === user.uid);
            if (playerToRemove) {
                await updateDoc(doc(firestore, 'matches', match.id), {
                    players: arrayRemove(playerToRemove),
                });
            }
            toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${match.title}".` });
        } else {
            if (isMatchFull) {
                toast({ variant: 'destructive', title: 'Partido Lleno', description: 'No quedan plazas disponibles en este partido.' });
                setIsJoining(false);
                return;
            }

            // Fetch the user's own player profile directly, regardless of group
            const playerRef = doc(firestore, 'players', user.uid);
            const playerSnap = await getDoc(playerRef);

            if (!playerSnap.exists()) {
                 toast({ variant: 'destructive', title: 'Error', description: 'No se encontró tu perfil de jugador global.' });
                 setIsJoining(false);
                 return;
            }
            const playerProfile = playerSnap.data() as Player;

             const playerPayload = {
                uid: user.uid,
                displayName: playerProfile!.name,
                ovr: playerProfile!.ovr,
                position: playerProfile!.position,
                photoUrl: playerProfile!.photoUrl || '',
              };

            await updateDoc(doc(firestore, 'matches', match.id), {
                players: arrayUnion(playerPayload),
            });
            toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${match.title}".` });
        }
    } catch (error) {
      console.error('Error joining/leaving match: ', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la operación.' });
    } finally {
      setIsJoining(false);
    }
  };

  // Safety check to ensure we have valid coordinates before rendering the marker
  if (!match.location || typeof match.location.lat !== 'number' || typeof match.location.lng !== 'number') {
    return null;
  }

  return (
    <MarkerF
      position={{ lat: match.location.lat, lng: match.location.lng }}
      onClick={() => handleMarkerClick(match.id)}
      icon={{
        path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.09 5.5h2.18c.24 1.14.79 2.15 1.57 3h-5.32c.78-.85 1.33-1.86 1.57-3zm-2.18 4h-3.3c-.1-.58-.15-1.19-.15-1.85s.05-1.27.15-1.85h3.3c-.18.61-.28 1.25-.28 1.85s.1 1.24.28 1.85zm.28 2.35h5.32c-.78.85-1.33 1.86-1.57 3h-2.18c-.24-1.14-.79-2.15-1.57-3zm2.18-2.35c.18-.61.28-1.25.28-1.85s-.1-1.24-.28-1.85h2.18c.1.58.15 1.19.15 1.85s-.05 1.27-.15 1.85h-2.18zM4.1 13.85h3.3c.18.61.28 1.25.28 1.85s-.1 1.24-.28 1.85h-3.3c.1-.58.15-1.19.15-1.85s-.05-1.27-.15-1.85zm5.62 1.85c.24 1.14.79 2.15 1.57 3h-2.18c.24-1.14.79-2.15 1.57-3zM12 4.04c.85 0 1.67.17 2.4.49h-4.8c.73-.32 1.55-.49 2.4-.49zm-1.85 5.46h3.7c-.18.61-.28 1.25-.28 1.85s.1 1.24.28 1.85h-3.7c.18-.61.28-1.25.28-1.85s-.1-1.24-.28-1.85zM9.72 4.53c-.78.85-1.33 1.86-1.57 3H6.02c.73-.32 1.55-.49 2.4-.49zm6.85 3c-.24-1.14-.79-2.15-1.57-3h1.29c.85 0 1.67.17 2.4.49h-2.12zm1.33 4.15h-3.3c-.18-.61-.28-1.25-.28-1.85s.1-1.24.28-1.85h3.3c-.1.58-.15 1.19-.15 1.85s.05 1.27.15 1.85zm-5.62-1.85c-.24-1.14-.79-2.15-1.57-3h2.18c-.24 1.14-.79 2.15-1.57 3z',
        fillColor: 'hsl(var(--primary))',
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: 'hsl(var(--primary-foreground))',
        rotation: 0,
        scale: 1.5,
        anchor: new window.google.maps.Point(12, 12),
      }}
    >
      {activeMarker === match.id && (
        <InfoWindowF onCloseClick={() => handleMarkerClick(match.id)}>
            <div className='p-2 w-64'>
                <h3 className="font-bold text-lg">{match.title}</h3>
                <p className="text-sm text-muted-foreground">{format(new Date(match.date), "d MMM, HH:mm'hs'", { locale: es })}</p>
                <p className="text-sm text-muted-foreground truncate">{match.location.address}</p>
                <p className="text-sm font-semibold mt-2">Plazas: {match.players.length} / {match.matchSize}</p>
                <Button
                    variant={isUserInMatch ? 'secondary' : 'default'}
                    size="sm"
                    onClick={handleJoinOrLeaveMatch}
                    disabled={isJoining || (isMatchFull && !isUserInMatch)}
                    className="w-full mt-4"
                >
                    {isJoining ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isUserInMatch ? (
                        <><LogOut className="mr-2 h-4 w-4" /> Darse de baja</>
                    ) : (
                       <><UserPlus className="mr-2 h-4 w-4" /> Apuntarse</>
                    )}
                </Button>
            </div>
        </InfoWindowF>
      )}
    </MarkerF>
  );
}
