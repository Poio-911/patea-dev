'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, MapPin, UserPlus, Calendar, Search, Sparkles } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { getAvailableLocalPlayersAction } from '@/lib/actions/recruitment-actions';
import { findBestFitPlayerAction } from '@/lib/actions/ai-scouting-actions';
import type { AvailablePlayer, Match, DayOfWeek, TimeOfDay, Player } from '@/lib/types';
import { collection, query, where, getDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerPhoto } from '@/components/player-styles';
import { getOvrLevel, getOvrColorClass } from '@/lib/player-utils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { parseISO, getDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function FreeAgentCard({
  player,
  selectedMatch,
  incompleteMatches,
  aiRecommendation
}: {
  player: AvailablePlayer & { matchScore?: number; isCurrentUser?: boolean; distanceKm?: number };
  selectedMatch: Match;
  incompleteMatches: Match[];
  aiRecommendation?: { reason: string };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [playerInfo, setPlayerInfo] = useState<Player | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const firestore = useFirestore();

  const ovrLevel = getOvrLevel(player.ovr || 0);
  const ovrColor = getOvrColorClass(player.ovr || 0);

  // Load stats lazily when drawer opens
  useEffect(() => {
    if (!isOpen || playerInfo || isLoadingStats || !firestore) return;
    setIsLoadingStats(true);
    getDoc(doc(firestore, 'players', player.uid))
      .then(snap => { if (snap.exists()) setPlayerInfo({ id: snap.id, ...snap.data() } as Player); })
      .catch(console.error)
      .finally(() => setIsLoadingStats(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const matchDate = parseISO(selectedMatch.date);
  const rawDay = format(matchDate, 'EEE', { locale: es });
  const dayLabel = (rawDay.charAt(0).toUpperCase() + rawDay.slice(1)).replace('.', '');
  const matchHour = parseInt(selectedMatch.time.split(':')[0], 10);
  const timeLabel = matchHour < 12 ? 'Mañana' : matchHour >= 18 ? 'Noche' : 'Tarde';

  const availChip = player.matchScore === 2
    ? { label: `${dayLabel} · ${timeLabel}`, chipCn: 'bg-success/10 text-success border-success/20' }
    : player.matchScore === 1
    ? { label: dayLabel, chipCn: 'bg-amber-500/10 text-amber-600 border-amber-500/20' }
    : { label: 'No coincide', chipCn: 'bg-destructive/10 text-destructive border-destructive/20' };

  return (
    <>
      {/* Collapsed card */}
      <div
        className={cn(
          "relative overflow-hidden cursor-pointer select-none",
          "rounded-2xl border bg-card flex flex-col",
          "transition-all duration-200 shadow-sm hover:shadow-md hover:border-primary/30 active:scale-[0.98]",
          `aura-${ovrLevel}`,
          aiRecommendation && "border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card"
        )}
        onClick={() => setIsOpen(true)}
      >
        {/* AI Badge — full-width top bar */}
        {aiRecommendation && (
          <div className="w-full bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 fill-current shrink-0" />
            <span>Recomendado IA</span>
          </div>
        )}

        {/* "TÚ" badge */}
        {player.isCurrentUser && (
          <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded-md z-10 uppercase tracking-wider">
            TÚ
          </div>
        )}

        {/* OVR + Position */}
        <div className={cn("flex justify-between items-start px-3", aiRecommendation ? "pt-2" : "pt-3")}>
          <span className={cn("text-3xl font-headline font-black leading-none", ovrColor)}>
            {player.ovr}
          </span>
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">
            {player.position}
          </span>
        </div>

        {/* Photo */}
        <div className="flex justify-center my-2">
          <PlayerPhoto
            player={player as unknown as Player}
            size="standard"
            className="ring-4 ring-background shadow-lg"
          />
        </div>

        {/* Name + quick stats */}
        <div className="px-3 pb-2 text-center flex flex-col items-center gap-0.5">
          <h4 className="font-bold text-sm truncate w-full uppercase tracking-tight">
            {player.displayName}
          </h4>
          <div className="flex items-center justify-center gap-2.5 text-xs text-muted-foreground">
            <span>⭐ {playerInfo?.stats?.averageRating?.toFixed(1) ?? '—'}</span>
            <span>🎮 {playerInfo?.stats?.matchesPlayed ?? '—'}</span>
          </div>
          {player.distanceKm !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>{player.distanceKm.toFixed(1)} km</span>
            </div>
          )}
        </div>

        {/* Availability chip */}
        <div className="px-3 pb-3 flex justify-center">
          <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", availChip.chipCn)}>
            {availChip.label}
          </span>
        </div>
      </div>

      {/* Detail Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <div className="overflow-y-auto">
            <DrawerHeader className="text-left">
              <div className="flex items-center gap-4">
                <PlayerPhoto
                  player={player as unknown as Player}
                  size="profile"
                  className="ring-4 ring-background shadow-lg shrink-0"
                />
                <div className="min-w-0">
                  <DrawerTitle className="truncate">{player.displayName}</DrawerTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {player.position} · OVR {player.ovr}
                  </p>
                  {player.distanceKm !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{player.distanceKm.toFixed(1)} km</span>
                    </div>
                  )}
                </div>
              </div>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Partidos', value: isLoadingStats ? null : (playerInfo?.stats?.matchesPlayed ?? 0) },
                  { label: 'Goles', value: isLoadingStats ? null : (playerInfo?.stats?.goals ?? 0) },
                  { label: 'Nota', value: isLoadingStats ? null : (playerInfo?.stats?.averageRating?.toFixed(1) ?? '—') },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center p-2.5 rounded-xl bg-muted/50 border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</span>
                    <span className="text-xl font-headline font-black mt-0.5">
                      {value === null ? <Skeleton className="h-7 w-8 mt-1" /> : value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Availability */}
              {player.availability && Object.keys(player.availability).length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold flex items-center gap-2">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      player.matchScore === 2 ? "bg-success" : player.matchScore === 1 ? "bg-amber-500" : "bg-destructive"
                    )} />
                    Disponibilidad
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(player.availability).map(([day, times]) => (
                      <div key={day} className="flex items-center gap-1 bg-muted/50 border border-border/40 rounded-lg px-2.5 py-1">
                        <span className="text-xs font-semibold capitalize">
                          {(day.charAt(0).toUpperCase() + day.slice(1, 3))}
                        </span>
                        <span className="text-[10px] text-muted-foreground">· {(times as string[]).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Reasoning */}
              {aiRecommendation && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-foreground/80 leading-snug">
                    "{aiRecommendation.reason}"
                  </p>
                </div>
              )}

              {/* Action */}
              {player.isCurrentUser ? (
                <div className="w-full text-center py-3 text-xs text-muted-foreground border border-dashed rounded-xl font-bold tracking-wider uppercase">
                  Tu Perfil de Pase Libre
                </div>
              ) : (
                <InvitePlayerDialog
                  playerToInvite={player}
                  userMatches={incompleteMatches}
                  match={selectedMatch}
                >
                  <Button className="w-full font-black gap-2 uppercase text-sm h-11 shadow-lg" variant="default">
                    <UserPlus className="w-4 h-4" />
                    Invitar a mi partido
                  </Button>
                </InvitePlayerDialog>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function ExploreContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [availablePlayers, setAvailablePlayers] = useState<(AvailablePlayer & { matchScore?: number; isCurrentUser?: boolean; distanceKm?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');

  // New States: Filters & AI
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [isAiScouting, setIsAiScouting] = useState(false);
  const [recommendations, setRecommendations] = useState<Record<string, { reason: string }>>({});

  const positions = ['POR', 'DEF', 'MED', 'DEL'];

  const handleAiScouting = async () => {
    if (!selectedMatch || availablePlayers.length === 0) return;

    setIsAiScouting(true);
    try {
      const result = await findBestFitPlayerAction({
        match: selectedMatch,
        availablePlayers: availablePlayers.filter(p => !p.isCurrentUser)
      });

      if (result.success && result.recommendations) {
        const recMap: Record<string, { reason: string }> = {};
        result.recommendations.forEach(r => {
          recMap[r.playerId] = { reason: r.reason };
        });
        setRecommendations(recMap);
        toast({
          title: "Analizado por el DT",
          description: "Ya tenés las mejores opciones resaltadas.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo realizar el scouting."
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiScouting(false);
    }
  };

  const filteredPlayers = useMemo(() => {
    let list = availablePlayers;
    if (selectedPosition) {
      list = list.filter(p => p.position === selectedPosition);
    }
    return list;
  }, [availablePlayers, selectedPosition]);

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
        const matchLat = selectedMatch.location?.lat;
        const matchLng = selectedMatch.location?.lng;

        // Guard: match must have valid coordinates
        if (!matchLat || !matchLng) {
          console.warn('[Mercado] El partido no tiene coordenadas GPS válidas. location:', selectedMatch.location);
          setAvailablePlayers([]);
          setIsLoading(false);
          return;
        }

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

        console.log('[Mercado] Buscando jugadores para partido en', { lat: matchLat, lng: matchLng, dayOfWeek, timeOfDay });

        const result = await getAvailableLocalPlayersAction({
          lat: matchLat,
          lng: matchLng,
          radiusInKm: 50, // Radio amplio para cubrir toda el área metropolitana
          dayOfWeek,
          timeOfDay,
          matchPlayerUids: selectedMatch.playerUids ?? [],
        });

        console.log('[Mercado] Resultado:', result);

        if (result.success && result.players) {
          setAvailablePlayers(result.players);
        } else {
          console.error('[Mercado] Error del servidor:', result.error);
          setAvailablePlayers([]);
        }
      } catch (e) {
        console.error('[Mercado] Error inesperado al cargar agentes libres:', e);
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
                  <Users className="w-5 h-5 text-primary" />
                  Pase Libre
                </h2>
                <p className="text-sm text-muted-foreground">
                  Buscando refuerzos para tu partido.
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
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground bg-background/50 p-3 rounded-lg border border-border/50 mt-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground capitalize">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {format(parseISO(selectedMatch.date), "EEEE d 'de' MMMM", { locale: es })} • {selectedMatch.time} hs
                </div>
                <div className="flex items-center gap-1.5 truncate max-w-[200px]" title={selectedMatch.location.address}>
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedMatch.location.name}
                </div>
              </div>
            )}
          </div>

          {/* Free Agents Grid */}
          {/* Filters & AI Scouting Button */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Position Chips */}
              <div className="flex gap-2 w-full overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setSelectedPosition(null)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap",
                    !selectedPosition ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  Todos
                </button>
                {positions.map(pos => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos === selectedPosition ? null : pos)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap",
                      selectedPosition === pos ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              {/* AI Scouting Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAiScouting}
                disabled={isAiScouting || isLoading || availablePlayers.length === 0}
                className={cn(
                  "gap-2 font-bold text-xs h-9 rounded-full shrink-0 border-primary/20 hover:bg-primary/5",
                  Object.keys(recommendations).length > 0 && "bg-primary/10 border-primary/50 text-primary"
                )}
              >
                {isAiScouting ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary" />
                )}
                Sugerencia del DT
              </Button>
            </div>

            <h3 className="font-semibold text-lg flex items-center gap-2">
              Jugadores Disponibles
              {filteredPlayers.length > 0 && !isLoading && (
                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {filteredPlayers.length}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredPlayers.map(player => (
                  <FreeAgentCard
                    key={player.uid}
                    player={player}
                    selectedMatch={selectedMatch!}
                    incompleteMatches={incompleteMatches}
                    aiRecommendation={recommendations[player.uid]}
                  />
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
