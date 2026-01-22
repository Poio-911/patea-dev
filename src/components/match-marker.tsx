
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, writeBatch, collection } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import type { Match, Player, Notification } from '@/lib/types';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, LogOut, MapPin, Clock } from 'lucide-react';

interface MatchMarkerProps {
  match: Match;
  activeMarker: string | null;
  handleMarkerClick: (matchId: string) => void;
}

export function MatchMarker({ match: initialMatch, activeMarker, handleMarkerClick }: MatchMarkerProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);

  const matchRef = useMemo(() => {
    if (!firestore || !initialMatch?.id || initialMatch.id === 'user-location') return null;
    return doc(firestore, 'matches', initialMatch.id);
  }, [firestore, initialMatch?.id]);

  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);
  const currentMatch = match || initialMatch;
  
  const isUserInMatch = useMemo(() => {
    if (!user || !currentMatch.playerUids) return false;
    return currentMatch.playerUids.includes(user.uid);
  }, [currentMatch.playerUids, user]);

  const isMatchFull = useMemo(() => {
    if (!currentMatch.players) return false;
    return currentMatch.players.length >= currentMatch.matchSize;
  }, [currentMatch.players, currentMatch.matchSize]);

  const isUserLocationMarker = currentMatch.id === 'user-location';


  const handleJoinOrLeaveMatch = async () => {
    if (!firestore || !user) return;
    setIsJoining(true);
    
    const batch = writeBatch(firestore);
    const matchRef = doc(firestore, 'matches', currentMatch.id);

    try {
        if (isUserInMatch) {
            const playerToRemove = currentMatch.players.find((p: any) => p.uid === user.uid);
            if (playerToRemove) {
                 batch.update(matchRef, {
                    players: arrayRemove(playerToRemove),
                    playerUids: arrayRemove(user.uid),
                });
            }
            toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${currentMatch.title}".` });
        } else {
            if (isMatchFull) {
                toast({ variant: 'destructive', title: 'Partido Lleno', description: 'No quedan plazas disponibles en este partido.' });
                setIsJoining(false);
                return;
            }

            const playerRef = doc(firestore, 'players', user.uid);
            const playerSnap = await getDoc(playerRef);

            if (!playerSnap.exists()) {
                 toast({ variant: 'destructive', title: 'Error', description: 'No se encontró tu perfil de jugador.' });
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
                playerUids: arrayUnion(user.uid),
            });
            
            if (currentMatch.ownerUid !== user.uid) {
                const notificationRef = doc(collection(firestore, `users/${currentMatch.ownerUid}/notifications`));
                const notification: Omit<Notification, 'id'> = {
                    type: 'new_joiner',
                    title: '¡Nuevo Jugador!',
                    message: `${user.displayName} se ha apuntado a tu partido "${currentMatch.title}".`,
                    link: `/matches`,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                };
                batch.set(notificationRef, notification);
            }
            
            toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${currentMatch.title}".` });
        }
        await batch.commit();
    } catch (error) {
      console.error('Error joining/leaving match: ', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la operación.' });
    } finally {
      setIsJoining(false);
    }
  };

  if (!currentMatch.location || typeof currentMatch.location.lat !== 'number' || typeof currentMatch.location.lng !== 'number') {
    return null;
  }

  return null;
}
