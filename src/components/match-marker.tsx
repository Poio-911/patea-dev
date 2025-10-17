
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
    if (!user || !match.players) return false;
    return match.players.some((p: any) => p.uid === user.uid);
  }, [match.players, user]);

  const isMatchFull = useMemo(() => {
    if (!match.players) return false;
    return match.players.length >= match.matchSize;
  }, [match.players, match.matchSize]);

  const isUserLocationMarker = match.id === 'user-location';


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
  
  // Use standard Google Maps pin for matches, customized with app's accent color
  const matchIconConfig = {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: 'hsl(var(--accent))',
      fillOpacity: 0.9,
      strokeColor: 'hsl(var(--card-foreground))',
      strokeWeight: 1.5,
      scale: 7
  };

  return (
    <MarkerF
      position={{ lat: match.location.lat, lng: match.location.lng }}
      onClick={() => handleMarkerClick(match.id)}
      // Don't set icon for user location to use the default blue dot
      icon={!isUserLocationMarker ? matchIconConfig : undefined}
      zIndex={isUserLocationMarker ? 10 : (activeMarker === match.id ? 5 : 1)}
    >
      {activeMarker === match.id && !isUserLocationMarker && (
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

    
