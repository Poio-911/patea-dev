
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useUser } from '@/firebase';
import type { Match } from '@/lib/types';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, LogOut, MapPin, Clock } from 'lucide-react';
import { joinMatchAction, leaveMatchAction } from '@/lib/actions/match-actions';
import { isErrorResponse } from '@/lib/errors';

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
    if (!user) return;
    setIsJoining(true);

    try {
      if (isUserInMatch) {
        const result = await leaveMatchAction(currentMatch.id, user.uid);
        if (isErrorResponse(result) || !result.success) {
          throw new Error(result.error || 'No se pudo salir del partido.');
        }
        toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${currentMatch.title}".` });
      } else {
        if (isMatchFull) {
          toast({ variant: 'destructive', title: 'Partido Lleno', description: 'No quedan plazas disponibles en este partido.' });
          setIsJoining(false);
          return;
        }

        const result = await joinMatchAction(currentMatch.id, user.uid, user.displayName || 'Jugador');
        if (isErrorResponse(result)) {
          throw new Error(result.error || 'No se pudo unir al partido.');
        }
        if (!result.success) {
          throw new Error('No se pudo unir al partido.');
        }

        toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${currentMatch.title}".` });
      }
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
