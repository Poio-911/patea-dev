'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, AlertCircle, MapPin, UserPlus, Calendar, Search, Sparkles, Filter, Check } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';
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
  player: AvailablePlayer & { matchScore?: number; isCurrentUser?: boolean };
  selectedMatch: Match;
  incompleteMatches: Match[];
  aiRecommendation?: { reason: string };
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playerInfo, setPlayerInfo] = useState<Player | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const firestore = useFirestore();

  const ovrLevel = getOvrLevel(player.ovr || 0);
  const ovrColor = getOvrColorClass(player.ovr || 0);

  const handleToggle = async () => {
    if (!isExpanded && !playerInfo && !isLoadingStats && firestore) {
      setIsLoadingStats(true);
      try {
        const playerRef = doc(firestore, 'players', player.uid);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          setPlayerInfo({ id: playerSnap.id, ...playerSnap.data() } as Player);
        }
      } catch (e) {
        console.error('Error loading player stats:', e);
      } finally {
        setIsLoadingStats(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      layout
      initial={false}
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-300 rounded-2xl border bg-card flex flex-col",
        `aura-${ovrLevel}`,
        isExpanded ? "shadow-xl border-primary/40 ring-1 ring-primary/20" : "shadow-sm border-border hover:border-primary/30",
        aiRecommendation && !isExpanded && "border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-[0_0_15px_rgba(var(--primary),0.05)]"
      )}
      onClick={handleToggle}
    >
      {/* AI Recommendation Badge (Option 1: Sutil & Integrado) */}
      {aiRecommendation && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[7px] font-black px-2.5 py-0.5 rounded-b-md shadow-sm z-10 uppercase tracking-widest flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 fill-current" />
          Recomendado
        </div>
      )}
      {/* Top Banner (Position + OVR) */}
      <div className="flex justify-between items-start p-3 w-full">
        <div className="flex flex-col items-center">
          <span className={cn("text-3xl font-headline font-black leading-none", ovrColor)}>
            {player.ovr}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            {player.position}
          </span>
        </div>

        {/* Availability Dot Indicator */}
        <div className="flex flex-col items-end">
          {player.matchScore === 2 && <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))]" title="Compatible" />}
          {player.matchScore === 1 && <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_hsl(var(--warning))]" title="Día diferente" />}
          {player.matchScore === 0 && <div className="w-2.5 h-2.5 rounded-full bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]" title="Horario incompatible" />}
        </div>
      </div>

      {/* Center - Photo */}
      <div className="flex justify-center -mt-2 mb-2">
        <PlayerPhoto
          player={player as unknown as Player}
          size="standard"
          className={cn(
            "ring-4 ring-background shadow-lg transition-transform",
            isExpanded ? "scale-110" : "hover:scale-105"
          )}
        />
      </div>

      {/* Bottom - Name & Info */}
      <div className="px-3 pb-4 text-center">
        <h4 className="font-bold text-sm truncate uppercase tracking-tight">{player.displayName}</h4>
        {!isExpanded && (
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase opacity-70"> Ver ficha completa </p>
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden bg-muted/30 border-t border-border/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-4">
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center p-2 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-xs text-muted-foreground uppercase font-semibold scale-90">Partidos</span>
                  <span className="text-lg font-headline font-black">
                    {isLoadingStats ? <Skeleton className="h-6 w-8 mt-1" /> : playerInfo?.stats?.matchesPlayed ?? 0}
                  </span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-xs text-muted-foreground uppercase font-semibold scale-90">Goles</span>
                  <span className="text-lg font-headline font-black">
                    {isLoadingStats ? <Skeleton className="h-6 w-8 mt-1" /> : playerInfo?.stats?.goals ?? 0}
                  </span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-xs text-muted-foreground uppercase font-semibold scale-90">Nota</span>
                  <span className="text-lg font-headline font-black">
                    {isLoadingStats ? <Skeleton className="h-6 w-8 mt-1" /> : (playerInfo?.stats?.averageRating?.toFixed(1) ?? '—')}
                  </span>
                </div>
              </div>

              {/* AI Reasoning (Sutil & Integrado Style) */}
              {aiRecommendation && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-foreground/80 leading-snug">"{aiRecommendation.reason}"</p>
                </div>
              )}

              {/* Recruitment Message / Badge */}
              {!player.isCurrentUser && !aiRecommendation && (
                <div className="text-center">
                  {player.matchScore === 0 && (
                    <p className="text-[10px] text-destructive font-bold uppercase mb-2">⚠️ Horario no coincide</p>
                  )}
                  {player.matchScore === 1 && (
                    <p className="text-[10px] text-amber-600 font-bold uppercase mb-2">⚠️ Juega otros días</p>
                  )}
                </div>
              )}

              {/* Action Button */}
              {player.isCurrentUser ? (
                <div className="w-full text-center py-2.5 text-[10px] text-muted-foreground border border-dashed rounded-xl uppercase font-bold tracking-wider">
                  Tu Perfil de Pase Libre
                </div>
              ) : (
                <InvitePlayerDialog
                  playerToInvite={player}
                  userMatches={incompleteMatches}
                  match={selectedMatch}
                >
                  <Button className="w-full font-black gap-2 uppercase text-xs h-10 shadow-lg" variant="default">
                    <UserPlus className="w-4 h-4" />
                    Invitar
                  </Button>
                </InvitePlayerDialog>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ExploreContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [availablePlayers, setAvailablePlayers] = useState<(AvailablePlayer & { matchScore?: number; isCurrentUser?: boolean })[]>([]);
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
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4">
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
