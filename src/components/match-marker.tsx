
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
  
  const iconConfig = isUserLocationMarker ? {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: 'hsl(var(--primary))',
    fillOpacity: 1,
    strokeColor: 'hsl(var(--primary-foreground))',
    strokeWeight: 2,
    scale: 8
  } : {
    path: 'M67,35.6c-51.3,0-93,41.7-93,93s41.7,93,93,93s93-41.7,93-93S118.3,35.6,67,35.6z M95,68.9L69.7,56v-6.7 c18.3,0.6,35.8,7.6,49.6,19.6H95z M125,74.4c8.3,8.9,14.3,19.4,17.9,31l-14.2,24.8l-20.9-3.2L88.8,94.2l7.6-19.9 C96.5,74.4,125,74.4,125,74.4z M82.7,97.9l18.3,31.8l-16.1,27.8H49.1L33,129.6l18.3-31.8H82.7z M64.3,56L39,68.9H14.6 c13.8-12.1,31.3-19,49.6-19.6V56z M37.5,74.4l7.6,19.9l-18.9,32.7l-20.8,3.2l-14.4-25c3.6-11.5,9.7-22,18.1-30.8 C9.1,74.4,37.5,74.4,37.5,74.4z M2.3,135.7l1.3,26.2l-6.7,4c-6.2-11.5-9.4-24.3-9.4-37.4c0-5.2,0.5-10.6,1.7-15.7L2.3,135.7z M6,166.9l22.9,14.6l12.6,22.3C24.2,198,9.3,186.2-0.4,170.6L6,166.9z M35.2,181.8l13.9-17.1h35.7l13.9,17.1l-13.9,24 c-5.9,1.4-11.8,2.1-17.9,2.2c-6.1,0-12-0.7-17.9-2.2L35.2,181.8z M92.5,203.6l12.6-22l22.9-14.6l6.3,3.7 C124.6,186.1,109.8,197.8,92.5,203.6z M130.3,161.9l1.3-26.2l13.2-22.8l0,0l0,0l0,0c1,5.1,1.6,10.3,1.7,15.6 c0,13.1-3.2,25.9-9.4,37.4L130.3,161.9z',
    fillColor: 'hsl(var(--accent))',
    fillOpacity: 1,
    strokeWeight: 1.5,
    strokeColor: 'hsl(var(--accent-foreground))',
    rotation: 0,
    scale: 0.15,
    anchor: new window.google.maps.Point(65, 128),
  }

  return (
    <MarkerF
      position={{ lat: match.location.lat, lng: match.location.lng }}
      onClick={() => handleMarkerClick(match.id)}
      icon={iconConfig}
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
       {isUserLocationMarker && (
         <InfoWindowF>
           <div className='p-1'>
            <p className="font-bold text-base">Tu Ubicación</p>
           </div>
         </InfoWindowF>
       )}
    </MarkerF>
  );
}

    