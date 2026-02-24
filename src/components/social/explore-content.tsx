'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, AlertCircle, MapPin, Send, Trophy, Calendar, Search } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { getAvailableLocalPlayersAction } from '@/lib/actions/recruitment-actions';
import type { AvailablePlayer, Match, DayOfWeek, TimeOfDay } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerPositionBadge } from '@/components/player-styles';
import { parseISO, getDay } from 'date-fns';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase';
import type { Player, UserProfile } from '@/lib/types';
import { AvailabilityCard } from '@/components/availability/availability-card';

export function ExploreContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [availablePlayers, setAvailablePlayers] = useState<(AvailablePlayer & { matchScore?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');

  // Get ALL user's upcoming matches (owned OR participating) that have open spots
  const matchesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'matches'),
      where('playerUids', 'array-contains', user.uid),
      where('status', '==', 'upcoming')
    );
  }, [firestore, user]);

  const { data: allUserMatches } = useCollection<Match>(matchesQuery);

  // Incomplete matches for the Context Selector
  const incompleteMatches = useMemo(() => {
    if (!allUserMatches) return [];
    return allUserMatches.filter(m => (m.players?.length || 0) < m.matchSize);
  }, [allUserMatches]);

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId || !incompleteMatches) return null;
    return incompleteMatches.find(m => m.id === selectedMatchId) || null;
  }, [selectedMatchId, incompleteMatches]);

  // Auto-select first incomplete match
  useEffect(() => {
    if (incompleteMatches.length > 0 && !selectedMatchId) {
      setSelectedMatchId(incompleteMatches[0].id);
    } else if (incompleteMatches.length === 0 && selectedMatchId) {
      setSelectedMatchId('');
    }
  }, [incompleteMatches, selectedMatchId]);

  // Load Free Agents based on Match criteria
  useEffect(() => {
    if (!selectedMatch) {
      setAvailablePlayers([]);
      return;
    }

    const loadPlayers = async () => {
      setIsLoading(true);

      try {
        // Parse date for Availability matching
        const d = parseISO(selectedMatch.date);
        const dayNum = getDay(d);
        const dayOfWeekMap: Record<number, DayOfWeek> = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado' };
        const dayOfWeek = dayOfWeekMap[dayNum];

        // Parse time
        const hour = parseInt(selectedMatch.time.split(':')[0], 10);
        let timeOfDay: TimeOfDay = 'tarde';
        if (hour < 12) timeOfDay = 'mañana';
        else if (hour >= 18) timeOfDay = 'noche';

        const result = await getAvailableLocalPlayersAction({
          lat: selectedMatch.location.lat,
          lng: selectedMatch.location.lng,
          radiusInKm: 15, // A generous radius for local recruitment
          dayOfWeek,
          timeOfDay
        });

        if (result.success && result.players) {
          setAvailablePlayers(result.players);
        } else {
          setAvailablePlayers([]);
        }
      } catch (e) {
        console.error("Failed to load free agents", e);
        setAvailablePlayers([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlayers();
  }, [selectedMatch]);

  if (!user) {
    return (
      <div className="border border-border rounded-lg p-10 text-center">
        <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Iniciá sesión para usar el Mercado de Fichajes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {incompleteMatches.length === 0 ? (
        <div className="border border-border rounded-xl p-10 text-center bg-card shadow-sm mt-4">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-bold mb-2">Plantel Completo</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            El mercado de reclutamiento se abrirá cuando organices un partido al que le falten jugadores. ¡Tu equipo está completo por ahora!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Required Match Selector Header */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  Mercado de Fichajes
                </h2>
                <p className="text-sm text-muted-foreground">
                  Buscando agentes libres disponibles para tu partido.
                </p>
              </div>
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger className="w-full sm:w-[280px] bg-background">
                  <SelectValue placeholder="Seleccioná un partido..." />
                </SelectTrigger>
                <SelectContent>
                  {incompleteMatches.map(match => {
                    const spotsLeft = match.matchSize - (match.players?.length || 0);
                    return (
                      <SelectItem key={match.id} value={match.id}>
                        {match.title} (faltan {spotsLeft})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedMatch && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-background/50 p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {selectedMatch.date} a las {selectedMatch.time}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedMatch.location.name}
                </div>
              </div>
            )}
          </div>

          {/* Free Agents Grid */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              Agentes Libres Disponibles
              {availablePlayers.length > 0 && !isLoading && (
                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {availablePlayers.length} encontrados
                </span>
              )}
            </h3>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex gap-4 p-4 border rounded-xl">
                    <Skeleton className="w-14 h-14 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : availablePlayers.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <h4 className="font-medium">Nadie disponible en la zona</h4>
                <p className="text-sm text-muted-foreground mt-1 px-4">
                  No encontramos jugadores libres para esa fecha, horario y ubicación geográfica.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availablePlayers.map(player => (
                  <div key={player.uid} className="flex flex-col p-4 border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="w-14 h-14 ring-2 ring-primary/10">
                        <AvatarImage src={player.photoURL || undefined} />
                        <AvatarFallback className="text-lg">{(player.displayName || 'U')[0].toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-base truncate">{player.displayName}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {player.position && <PlayerPositionBadge position={player.position} size="sm" />}
                          {player.ovr && (
                            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                              <Trophy className="w-3 h-3" />
                              {player.ovr} OVR
                            </span>
                          )}
                          {player.matchScore === 0 && (
                            <span className="flex items-center gap-1 text-xs font-medium text-destructive dark:text-red-400 bg-destructive/10 px-2 py-0.5 rounded-md">
                              <AlertCircle className="w-3 h-3" />
                              Horario Incompatible
                            </span>
                          )}
                          {player.matchScore === 1 && (
                            <span className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                              <AlertCircle className="w-3 h-3" />
                              Día Diferente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <InvitePlayerDialog
                      playerToInvite={player}
                      userMatches={incompleteMatches}
                      match={selectedMatch!}
                    >
                      <Button className="w-full font-semibold gap-2" variant="default">
                        <Send className="w-4 h-4" />
                        Convocar para el partido
                      </Button>
                    </InvitePlayerDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExploreContent;
