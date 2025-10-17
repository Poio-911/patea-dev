
'use client';

import { useState, useMemo, useEffect } from 'react';
import { MarkerF, InfoWindowF, PinElement } from '@react-google-maps/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Match, Player } from '@/lib/types';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, LogOut, MapPin } from 'lucide-react';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';

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
  const [pinElement, setPinElement] = useState<PinElement | null>(null);

  const isUserInMatch = useMemo(() => {
    if (!user || !match.players) return false;
    return match.players.some((p: any) => p.uid === user.uid);
  }, [match.players, user]);

  const isMatchFull = useMemo(() => {
    if (!match.players) return false;
    return match.players.length >= match.matchSize;
  }, [match.players, match.matchSize]);

  const isUserLocationMarker = match.id === 'user-location';
  
  useEffect(() => {
    if (window.google) {
        const pin = new google.maps.marker.PinElement({
          background: 'hsl(var(--primary))',
          borderColor: 'hsl(var(--primary-foreground))',
          glyphColor: 'hsl(var(--primary-foreground))',
        });
        setPinElement(pin);
    }
  }, []);


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

  if (!match.location || typeof match.location.lat !== 'number' || typeof match.location.lng !== 'number') {
    return null;
  }

  return (
    <MarkerF
      position={{ lat: match.location.lat, lng: match.location.lng }}
      onClick={() => handleMarkerClick(match.id)}
      icon={!isUserLocationMarker ? pinElement?.element : undefined}
      zIndex={isUserLocationMarker ? 10 : (activeMarker === match.id ? 5 : 1)}
    >
      {activeMarker === match.id && !isUserLocationMarker && (
        <InfoWindowF onCloseClick={() => handleMarkerClick(match.id)}>
            <div className="space-y-2 p-1">
                <div className="space-y-1">
                    <h3 className="font-bold text-base leading-tight">{match.title}</h3>
                     <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="truncate">{match.location.address}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{format(new Date(match.date), "d MMM, HH:mm'hs'", { locale: es })}</p>
                </div>
                <div className='flex justify-between items-center pt-1'>
                    <p className="text-sm font-semibold">Plazas: {match.players.length} / {match.matchSize}</p>
                    <Button
                        variant={isUserInMatch ? 'secondary' : 'default'}
                        size="sm"
                        onClick={handleJoinOrLeaveMatch}
                        disabled={isJoining || (isMatchFull && !isUserInMatch)}
                        className="h-8 text-xs"
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
            </div>
        </InfoWindowF>
      )}
       {activeMarker === match.id && isUserLocationMarker && (
         <InfoWindowF
            onCloseClick={() => handleMarkerClick(match.id)}
            position={{ lat: match.location.lat, lng: match.location.lng }}
          >
           <div className='p-1'>
            <p className="font-bold text-base">Tu Ubicación</p>
           </div>
         </InfoWindowF>
       )}
    </MarkerF>
  );
}
