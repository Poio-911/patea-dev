
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
import { KickerIconPath } from './icons/soccer-player-icon';

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
  const [primaryColor, setPrimaryColor] = useState('#29ABE2'); // Default primary color

  useEffect(() => {
    // On the client, read the CSS variable for the primary color
    if (typeof window !== 'undefined') {
        const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        if (color) {
            setPrimaryColor(`hsl(${color})`);
        }
    }
  }, []);

  const isUserInMatch = useMemo(() => {
    if (!user || !match.players) return false;
    return match.players.some((p: any) => p.uid === user.uid);
  }, [match.players, user]);

  const isMatchFull = useMemo(() => {
    if (!match.players) return false;
    return match.players.length >= match.matchSize;
  }, [match.players, match.matchSize]);

  const isUserLocationMarker = match.id === 'user-location';

  const customIcon = useMemo(() => {
    if (isUserLocationMarker) {
        // Default Google Maps icon for user location
        return undefined;
    }

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 97.316 97.316" width="32px" height="32px" fill="${encodeURIComponent(primaryColor)}"><path d="${KickerIconPath}"/></svg>`;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${svgString}`,
      scaledSize: new window.google.maps.Size(32, 32),
      anchor: new window.google.maps.Point(16, 16),
    };
  }, [isUserLocationMarker, primaryColor]);


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
      icon={customIcon}
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

    