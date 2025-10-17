
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
import { Loader2, UserPlus, LogOut, MapPin } from 'lucide-react';

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
  
  const matchIconConfig = {
      path: 'M57.418,21.295c0.931,0.253,1.888,0.381,2.845,0.381c4.876,0,9.175-3.289,10.453-7.998 c0.759-2.793,0.384-5.714-1.054-8.226C68.223,2.941,65.893,1.14,63.1,0.381C62.169,0.128,61.211,0,60.254,0 c-4.875,0-9.172,3.289-10.451,7.997C48.235,13.762,51.651,19.728,57.418,21.295z M59.083,58.702l4.782-17.602l0.098,0.162c0.484,0.798,0.959,2.318,1.017,3.25l0.512,8.287 c0.1,1.603,1.436,2.858,3.042,2.858l1.371-0.051c1.641-0.064,2.953-1.452,2.925-3.094l-0.177-10.144 c-0.021-1.239-0.446-3.092-0.967-4.217l-4.753-10.272c-0.013-0.027-0.032-0.052-0.046-0.079c-0.328-0.873-1.049-1.584-2.015-1.847 L48.63,21.542c-0.005-0.001-0.009-0.001-0.014-0.002l-0.555-0.15c-1.415-0.383-3.309,0.198-4.264,1.285l-18.64,21.215 c-0.56,0.637-0.785,1.429-0.618,2.173c0.167,0.744,0.709,1.365,1.487,1.701l2.065,0.894c0.426,0.185,0.897,0.278,1.4,0.278 c1.117,0,2.229-0.479,2.902-1.25l8.747-10.017l-4.221,15.538c-0.056,0.207-0.087,0.415-0.098,0.622l-6.478,25.147 c-0.686,2.663,0.915,5.416,3.568,6.136l0.339,0.092c0.425,0.116,0.862,0.174,1.299,0.174c2.256,0,4.226-1.527,4.789-3.714 l5.879-22.823l1.957,0.532l-8.523,31.374c-0.723,2.66,0.854,5.413,3.515,6.136l0.338,0.091c0.426,0.116,0.865,0.175,1.305,0.175 c2.254,0,4.241-1.517,4.831-3.689l9.441-34.754C59.083,58.705,59.083,58.704,59.083,58.702z M68.535,54.651L68.535,54.651v0.006 V54.651z M64.052,80.544c-4.624,0-8.385,3.762-8.385,8.386s3.762,8.386,8.385,8.386c4.624,0,8.386-3.762,8.386-8.386 S68.676,80.544,64.052,80.544z',
      fillColor: 'hsl(var(--primary))',
      fillOpacity: 1,
      strokeWeight: 0,
      rotation: 0,
      scale: 0.5,
      anchor: new window.google.maps.Point(48, 48),
  };

  return (
    <MarkerF
      position={{ lat: match.location.lat, lng: match.location.lng }}
      onClick={() => handleMarkerClick(match.id)}
      icon={!isUserLocationMarker ? matchIconConfig : undefined}
      zIndex={isUserLocationMarker ? 10 : (activeMarker === match.id ? 5 : 1)}
    >
      {activeMarker === match.id && !isUserLocationMarker && (
        <InfoWindowF onCloseClick={() => handleMarkerClick(match.id)}>
            <div className="p-1 w-64 space-y-1">
                <h3 className="font-bold text-base leading-tight">{match.title}</h3>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{match.location.address}</span>
                </div>
                <p className="text-sm text-muted-foreground">{format(new Date(match.date), "d MMM, HH:mm'hs'", { locale: es })}</p>
                
                <p className="text-sm font-semibold pt-1">Plazas: {match.players.length} / {match.matchSize}</p>
                <Button
                    variant={isUserInMatch ? 'secondary' : 'default'}
                    size="sm"
                    onClick={handleJoinOrLeaveMatch}
                    disabled={isJoining || (isMatchFull && !isUserInMatch)}
                    className="w-full mt-1"
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

    