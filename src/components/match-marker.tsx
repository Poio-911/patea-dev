
'use client';

import { useState, useMemo, useEffect } from 'react';
import { MarkerF, InfoWindowF } from '@react-google-maps/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, writeBatch, collection } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Match, Player, Notification } from '@/lib/types';
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
  
  const icon = useMemo(() => {
    if (isUserLocationMarker) {
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
      };
    }

    return {
        path: 'M11,1.5C11,2.3284,10.3284,3,9.5,3S8,2.3284,8,1.5S8.6716,0,9.5,0S11,0.6716,11,1.5z M11,11c-0.5523,0-1,0.4477-1,1s0.4477,1,1,1s1-0.4477,1-1S11.5523,11,11,11z M12.84,6.09l-1.91-1.91l0,0C10.8399,4.0675,10.7041,4.0014,10.56,4H3.5C3.2239,4,3,4.2239,3,4.5S3.2239,5,3.5,5h2.7L3,11.3l0,0c-0.0138,0.066-0.0138,0.134,0,0.2c-0.058,0.2761,0.1189,0.547,0.395,0.605C3.6711,12.163,3.942,11.9861,4,11.71l0,0L5,10h2l-1.93,4.24l0,0C5.0228,14.3184,4.9986,14.4085,5,14.5c-0.0552,0.2761,0.1239,0.5448,0.4,0.6c0.2761,0.0552,0.5448-0.1239,0.6-0.4l0,0l4.7-9.38l1.44,1.48c0.211,0.1782,0.5264,0.1516,0.7046-0.0593C13.0037,6.5523,13.0018,6.2761,12.84,6.09z',
        fillColor: 'hsl(var(--primary))',
        fillOpacity: 1,
        strokeWeight: 0,
        rotation: 0,
        scale: 2,
        anchor: new google.maps.Point(7.5, 7.5),
    };
  }, [isUserLocationMarker]);


  const handleJoinOrLeaveMatch = async () => {
    if (!firestore || !user) return;
    setIsJoining(true);
    
    const batch = writeBatch(firestore);
    const matchRef = doc(firestore, 'matches', match.id);

    try {
        if (isUserInMatch) {
            const playerToRemove = match.players.find((p: any) => p.uid === user.uid);
            if (playerToRemove) {
                 batch.update(matchRef, {
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

            batch.update(matchRef, {
                players: arrayUnion(playerPayload),
            });
            
            // Notify the organizer
            const notificationRef = doc(collection(firestore, 'users', match.ownerUid, 'notifications'));
            const notification: Omit<Notification, 'id'> = {
                type: 'new_joiner',
                title: '¡Nuevo Jugador!',
                message: `${user.displayName} se ha apuntado a tu partido "${match.title}".`,
                link: `/matches/${match.id}`,
                isRead: false,
                createdAt: new Date().toISOString(),
            };
            batch.set(notificationRef, notification);
            
            toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${match.title}".` });
        }
        await batch.commit();
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
      icon={icon}
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
    
