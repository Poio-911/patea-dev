
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, getDoc, writeBatch } from 'firebase/firestore';
import type { Match, AvailablePlayer, Player, Invitation, Notification } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, MapPin, Calendar, Users, LocateFixed, Search, SlidersHorizontal, Sparkles, AlertCircle, Send, Check } from 'lucide-react';
import { PlayerMarker } from '@/components/player-marker';
import { libraries } from '@/lib/google-maps';
import { mapStyles } from '@/lib/map-styles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MatchDetailsDialog } from '@/components/match-details-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { findBestFitPlayerAction } from '@/lib/actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerCard } from '@/components/player-card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -34.9011, // Montevideo
  lng: -56.1645
};

type RecommendedPlayer = AvailablePlayer & { reason: string };

const getDistance = (pos1: { lat: number; lng: number } | null, pos2: { lat: number; lng: number }) => {
  if (!pos1) return Infinity;
  const R = 6371; // Radius of the Earth in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};


const CompactPlayerCard = ({ player, distance, onInvite, isAlreadyInvited }: { player: AvailablePlayer, distance: number, onInvite: (player: AvailablePlayer) => void, isAlreadyInvited: boolean }) => {
    const playerName = player.displayName || (player as any).name;

    return (
        <Dialog>
             <DialogTrigger asChild>
                <Card className="cursor-pointer transition-all duration-200 overflow-hidden hover:border-primary/50">
                    <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-14 w-14 border">
                                <AvatarImage src={player.photoUrl} alt={playerName} />
                                <AvatarFallback>{playerName ? playerName.charAt(0) : 'J'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1 overflow-hidden">
                                <h3 className="font-bold truncate">{playerName}</h3>
                                <div className='flex items-center gap-1.5'>
                                    <Badge className={cn("text-base font-bold", player.ovr > 80 ? "bg-green-500/20 text-green-500 border-green-500/50" : "bg-primary/20 text-primary border-primary/50")}>{player.ovr}</Badge>
                                    <Badge variant="outline" className={cn("text-base font-semibold", positionBadgeStyles[player.position])}>{player.position}</Badge>
                                     {distance !== Infinity && (
                                        <Badge variant="secondary" className="hidden sm:inline-flex items-center gap-1">
                                            <MapPin className="h-3 w-3"/>
                                            {distance.toFixed(1)} km
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <Button 
                                variant={isAlreadyInvited ? "secondary" : "default"} 
                                size="sm" 
                                className="h-8 text-xs rounded-full px-3" 
                                disabled={isAlreadyInvited}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isAlreadyInvited) onInvite(player);
                                }}
                            >
                                {isAlreadyInvited ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                                {isAlreadyInvited ? 'Invitado' : 'Invitar'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
             </DialogTrigger>
             <DialogContent className="sm:max-w-sm p-0 border-0 bg-transparent shadow-none">
                 <PlayerCard player={player as unknown as Player} isLink={false} />
            </DialogContent>
        </Dialog>
    )
}

export default function FindMatchPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isFindingBestFit, setIsFindingBestFit] = useState(false);


  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [matchSearchCompleted, setMatchSearchCompleted] = useState(false);
  const [matchDateFilter, setMatchDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [matchSizeFilter, setMatchSizeFilter] = useState<string[]>([]);
  const [searchRadius, setSearchRadius] = useState(7);

  const [playerSearchMatchId, setPlayerSearchMatchId] = useState<string | null>(null);
  const [filteredPlayers, setFilteredPlayers] = useState<AvailablePlayer[]>([]);
  const [recommendedPlayers, setRecommendedPlayers] = useState<RecommendedPlayer[]>([]);
  const [playerSearchCompleted, setPlayerSearchCompleted] = useState(false);
  const [playerPositionFilter, setPlayerPositionFilter] = useState<string[]>([]);
  const [playerOvrFilter, setPlayerOvrFilter] = useState<[number, number]>([40, 99]);
  const [sentInvitations, setSentInvitations] = useState<Set<string>>(new Set());

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const publicMatchesQuery = useMemo(() => firestore ? query(collection(firestore, 'matches'), where('isPublic', '==', true), where('status', '==', 'upcoming')) : null, [firestore]);
  const { data: allPublicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);
  
  const groupPlayersQuery = useMemo(() => firestore && user?.activeGroupId ? query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId)) : null, [firestore, user?.activeGroupId]);
  const { data: groupPlayers } = useCollection<Player>(groupPlayersQuery);
  const groupPlayerIds = useMemo(() => new Set(groupPlayers?.map(p => p.id) || []), [groupPlayers]);

  const availablePlayersQuery = useMemo(() => firestore ? collection(firestore, 'availablePlayers') : null, [firestore]);
  const { data: allAvailablePlayers, loading: playersLoading } = useCollection<AvailablePlayer>(availablePlayersQuery);

  const userMatchesQuery = useMemo(() => firestore && user?.uid ? query(collection(firestore, 'matches'), where('ownerUid', '==', user.uid), where('status', '==', 'upcoming')) : null, [firestore, user?.uid]);
  const { data: userMatchesData } = useCollection<Match>(userMatchesQuery);

  const invitationsQuery = useMemo(() => {
    if (!firestore || !playerSearchMatchId) return null;
    return collection(firestore, 'matches', playerSearchMatchId, 'invitations');
  }, [firestore, playerSearchMatchId]);
  const { data: existingInvitations } = useCollection<Invitation>(invitationsQuery);


  const availableMatchesForInvite = useMemo(() => userMatchesData?.filter(m => m.players.length < m.matchSize) || [], [userMatchesData]);
  
  const selectedMatchForInvite = useMemo(() => playerSearchMatchId ? availableMatchesForInvite.find(m => m.id === playerSearchMatchId) || null : null, [playerSearchMatchId, availableMatchesForInvite]);

  useEffect(() => {
    if (existingInvitations) {
      setSentInvitations(new Set(existingInvitations.map(inv => inv.playerId)));
    }
  }, [existingInvitations]);


  const handleMarkerClick = (id: string) => {
    setActiveMarker(activeMarker === id ? null : id);
     const element = document.getElementById(`match-card-${id}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const applyMatchFilters = useCallback(() => {
    if (!allPublicMatches || !userLocation) return;
    const filtered = allPublicMatches.filter(match => {
        if (!match.location?.lat || !match.location?.lng) return false;
        const distance = getDistance(userLocation, match.location);
        if (distance > searchRadius) return false;
        if (matchDateFilter && !isSameDay(new Date(match.date), parseISO(matchDateFilter))) return false;
        if (matchSizeFilter.length > 0 && !matchSizeFilter.includes(String(match.matchSize))) return false;
        return true;
    }).sort((a,b) => getDistance(userLocation, a.location) - getDistance(userLocation, b.location));
    setFilteredMatches(filtered);
    setMatchSearchCompleted(true);
  }, [allPublicMatches, userLocation, searchRadius, matchDateFilter, matchSizeFilter]);

  const applyPlayerFilters = useCallback(async () => {
    if (!allAvailablePlayers || !playerSearchMatchId || !firestore) return;
    const matchRef = doc(firestore, 'matches', playerSearchMatchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
        toast({variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el partido seleccionado.'});
        return;
    }
    const selectedMatch = matchSnap.data() as Match;
    const playerUidsInMatch = new Set(selectedMatch.playerUids || []);
    const filtered = allAvailablePlayers.filter(player => {
        if (player.uid === user?.uid) return false;
        if (groupPlayerIds.has(player.uid)) return false;
        if (playerUidsInMatch.has(player.uid)) return false;
        if (playerPositionFilter.length > 0 && !playerPositionFilter.includes(player.position)) return false;
        if (player.ovr < playerOvrFilter[0] || player.ovr > playerOvrFilter[1]) return false;
        return true;
    }).sort((a,b) => getDistance(userLocation, a.location) - getDistance(userLocation, b.location));
    setFilteredPlayers(filtered);
    setPlayerSearchCompleted(true);
  }, [allAvailablePlayers, playerPositionFilter, playerOvrFilter, user?.uid, playerSearchMatchId, firestore, groupPlayerIds, toast, userLocation]);

  const handleFindBestFit = useCallback(async () => {
    if (!playerSearchMatchId) return;

    const selectedMatch = userMatchesData?.find(m => m.id === playerSearchMatchId);
    if (!selectedMatch) return;
    
    setIsFindingBestFit(true);
    setRecommendedPlayers([]);

    const simpleAvailablePlayers = filteredPlayers.map(p => ({
        uid: p.uid,
        displayName: p.displayName,
        ovr: p.ovr,
        position: p.position,
    }));
    
    const result = await findBestFitPlayerAction({ match: selectedMatch, availablePlayers: simpleAvailablePlayers });

    if (result && 'recommendations' in result && result.recommendations) {
        const foundPlayers: RecommendedPlayer[] = result.recommendations.map(rec => {
            const playerDetails = allAvailablePlayers?.find(p => p.uid === rec.playerId);
            return playerDetails ? { ...playerDetails, reason: rec.reason } : null;
        }).filter((p): p is RecommendedPlayer => p !== null);

        setRecommendedPlayers(foundPlayers);
    }
    setIsFindingBestFit(false);
  }, [playerSearchMatchId, userMatchesData, filteredPlayers, allAvailablePlayers]);

  const handleSearchNearby = useCallback(() => {
    setIsSearching(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      setIsSearching(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(currentUserLocation);
        setIsSearching(false);
      },
      (error) => {
        const message = error.code === 1 ? 'Debes permitir el acceso a la ubicación en tu navegador para buscar.' : 'No se pudo obtener tu ubicación. Inténtalo de nuevo.';
        setLocationError(message);
        setIsSearching(false);
      }
    );
  }, []);
  
  const handlePlayerSearch = useCallback(() => {
    if (!userLocation) {
        // We need user location to calculate distance.
         if (!navigator.geolocation) {
          setLocationError('Tu navegador no soporta geolocalización.');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserLocation(currentUserLocation);
            applyPlayerFilters(); // Apply filters after getting location
            handleFindBestFit();
          },
          (error) => {
            const message = error.code === 1 ? 'Debes permitir el acceso a la ubicación para buscar jugadores.' : 'No se pudo obtener tu ubicación.';
            setLocationError(message);
          }
        );
    } else {
        applyPlayerFilters();
        handleFindBestFit();
    }
  }, [userLocation, applyPlayerFilters, handleFindBestFit]);

  useEffect(() => { if (userLocation) { applyMatchFilters(); } }, [userLocation, applyMatchFilters]);

  const handleInvitePlayer = async (playerToInvite: AvailablePlayer) => {
    if (!firestore || !user || !selectedMatchForInvite) return;

    try {
        const invitationRef = doc(collection(firestore, `matches/${selectedMatchForInvite.id}/invitations`));
        const notificationRef = doc(collection(firestore, `users/${playerToInvite.uid}/notifications`));
        const batch = writeBatch(firestore);

        batch.set(invitationRef, {
            matchId: selectedMatchForInvite.id,
            matchTitle: selectedMatchForInvite.title,
            matchDate: selectedMatchForInvite.date,
            playerId: playerToInvite.uid,
            status: 'pending',
            createdAt: new Date().toISOString()
        } as Omit<Invitation, 'id'>);

        batch.set(notificationRef, {
            type: 'match_invite',
            title: '¡Te han invitado a un partido!',
            message: `${user.displayName} te invita a unirte a "${selectedMatchForInvite.title}".`,
            link: `/matches`,
            isRead: false,
            createdAt: new Date().toISOString(),
        } as Omit<Notification, 'id'>);
        
        await batch.commit();

        toast({ title: `¡Invitación enviada a ${playerToInvite.displayName}!` });
        setSentInvitations(prev => new Set(prev).add(playerToInvite.uid));

    } catch (error) {
        console.error("Error sending invitation:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar la invitación.' });
    }
  }

  const loading = userLoading || matchesLoading || playersLoading || !isLoaded;

  const renderFindMatches = () => {
    if (loading && !matchSearchCompleted) return <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!matchSearchCompleted) return <Card><CardHeader className="p-4"><CardTitle className="text-center">Encontrá Partidos Cerca Tuyo</CardTitle><CardDescription className="text-center text-xs sm:text-sm">Ajustá los filtros y dale al botón para encontrar partidos públicos.</CardDescription></CardHeader><CardContent className="p-4 space-y-4"><div className="w-full space-y-4"><div><div className="flex justify-between font-medium mb-1"><Label>Radio de Búsqueda:</Label><span className="text-primary">{searchRadius} km</span></div><Slider value={[searchRadius]} onValueChange={(value) => setSearchRadius(value[0])} max={50} step={1} disabled={isSearching} /></div><div><Label className="font-medium">Fecha del Partido</Label><Input type="date" value={matchDateFilter} onChange={e => setMatchDateFilter(e.target.value)} /></div><div><Label className="font-medium">Tamaño del Partido</Label><ToggleGroup type="multiple" value={matchSizeFilter} onValueChange={setMatchSizeFilter} variant="outline" className="justify-start mt-1"><ToggleGroupItem value="10">Fútbol 5</ToggleGroupItem><ToggleGroupItem value="14">Fútbol 7</ToggleGroupItem><ToggleGroupItem value="22">Fútbol 11</ToggleGroupItem></ToggleGroup></div></div>{locationError && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error de Ubicación</AlertTitle><AlertDescription>{locationError}<Button variant="link" className="p-0 h-auto ml-1 text-destructive" onClick={handleSearchNearby}>Reintentar</Button></AlertDescription></Alert>)}</CardContent><CardFooter className="p-4 border-t"><Button onClick={handleSearchNearby} disabled={isSearching} size="lg" className="w-full">{isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LocateFixed className="mr-2 h-5 w-5" />}{isSearching ? 'Buscando...' : 'Buscar Partidos Cercanos'}</Button></CardFooter></Card>;
    
    return <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full"><div className="lg:col-span-1 h-full flex flex-col gap-4"><Card className="flex-grow flex flex-col"><CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-lg">Partidos ({filteredMatches.length})</CardTitle><Button variant="ghost" size="icon" onClick={() => {setMatchSearchCompleted(false); setLocationError(null);}}><SlidersHorizontal className="h-4 w-4" /></Button></CardHeader><CardContent className="p-2 flex-grow overflow-hidden"><ScrollArea className="h-full"><div className="space-y-2 p-1">{filteredMatches.length > 0 ? filteredMatches.map((match) => <div id={`match-card-${match.id}`} key={match.id}><Card className={cn("cursor-pointer transition-all duration-200", activeMarker === match.id ? "border-primary shadow-lg" : "hover:border-muted-foreground/50")} onMouseEnter={() => setActiveMarker(match.id)} onMouseLeave={() => setActiveMarker(null)}><div className="p-4 grid grid-cols-3 gap-4 items-center"><div className="col-span-2 space-y-2"><h3 className="font-bold leading-tight">{match.title}</h3><div className="text-xs text-muted-foreground flex items-center gap-2"><Calendar className="h-3 w-3" /><span>{format(new Date(match.date), "d MMM, yyyy", { locale: es })} - {match.time}hs</span></div></div><div className="col-span-1 flex flex-col items-end justify-center gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /><span>{match.players.length}/{match.matchSize}</span></div><MatchDetailsDialog match={match} isOwner={user?.uid === match.ownerUid}><Button variant="default" size="sm" className="h-8 text-xs w-full">Ver Detalles</Button></MatchDetailsDialog></div></div></Card></div>) : <Alert className="m-2"><AlertTitle>Sin Resultados</AlertTitle><AlertDescription>No se encontraron partidos con esos filtros. Intenta ampliar tu búsqueda.</AlertDescription></Alert>}</div></ScrollArea></CardContent></Card></div><div className="h-[400px] lg:h-full w-full rounded-lg overflow-hidden lg:col-span-2"><GoogleMap mapContainerStyle={containerStyle} center={userLocation || defaultCenter} zoom={12} options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true, }}>{filteredMatches.map((match) => ( <MatchMarker key={match.id} match={match} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} /> ))}{userLocation && ( <PlayerMarker player={{ uid: 'user-location', displayName: 'Tu Ubicación', location: userLocation } as any} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} /> )}</GoogleMap></div></div>;
  }

  const renderFindPlayers = () => {
    if (loading && !playerSearchCompleted) return <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    const initialView = <Card><CardHeader className="p-4"><CardTitle className="text-center">Encontrá Jugadores Libres</CardTitle><CardDescription className="text-center text-xs sm:text-sm">Seleccioná un partido y ajustá los filtros para encontrar el jugador que te falta.</CardDescription></CardHeader><CardContent className="p-4"><div className="w-full space-y-4"><div><Label htmlFor='match-select-player-search'>Partido a completar</Label><Select onValueChange={setPlayerSearchMatchId} value={playerSearchMatchId || ''}><SelectTrigger id="match-select-player-search" className='mt-1'><SelectValue placeholder="Elige un partido..." /></SelectTrigger><SelectContent>{availableMatchesForInvite.length > 0 ? availableMatchesForInvite.map(match => <SelectItem key={match.id} value={match.id}>{match.title} ({match.players.length}/{match.matchSize})</SelectItem>) : <div className="p-4 text-center text-sm text-muted-foreground">No tenés partidos que necesiten jugadores.</div>}</SelectContent></Select></div><div className={cn(!playerSearchMatchId && "opacity-50 pointer-events-none")}> <Label className="font-medium">Posición</Label><ToggleGroup type="multiple" value={playerPositionFilter} onValueChange={setPlayerPositionFilter} variant="outline" className="justify-start mt-1 flex-wrap"><ToggleGroupItem value="POR">POR</ToggleGroupItem><ToggleGroupItem value="DEF">DEF</ToggleGroupItem><ToggleGroupItem value="MED">MED</ToggleGroupItem><ToggleGroupItem value="DEL">DEL</ToggleGroupItem></ToggleGroup></div><div className={cn(!playerSearchMatchId && "opacity-50 pointer-events-none")}> <div className="flex justify-between font-medium mb-1"><Label>Rango de OVR:</Label><span className="text-primary">{playerOvrFilter[0]} - {playerOvrFilter[1]}</span></div><Slider value={playerOvrFilter} onValueChange={(value) => setPlayerOvrFilter(value as [number, number])} min={40} max={99} step={1} /></div></div></CardContent><CardFooter className="p-4 border-t"><div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2"><Button onClick={handlePlayerSearch} size="lg" disabled={isSearching || !playerSearchMatchId} className="w-full sm:flex-grow">{isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />} {isSearching ? 'Buscando...' : 'Buscar Jugadores'}</Button></div></CardFooter></Card>;
    if (!playerSearchCompleted) return initialView;

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex-shrink-0">
                <Button variant="ghost" onClick={() => setPlayerSearchCompleted(false)}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Ajustar Búsqueda
                </Button>
            </div>

            <div className="flex-grow overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="space-y-6 pr-4">
                        {isFindingBestFit ? (
                            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center animate-pulse">
                                <Sparkles className="h-10 w-10 text-amber-500" />
                                <p className="mt-4 font-semibold">Analizando los mejores fichajes para vos...</p>
                            </div>
                        ) : recommendedPlayers.length > 0 && (
                            <div>
                                <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-amber-500" />
                                    Recomendados
                                </h2>
                                <div className="space-y-4">
                                    {recommendedPlayers.map(player => (
                                        <Card key={player.uid} className="bg-gradient-to-br from-primary/10 to-transparent">
                                            <CardContent className="p-4 space-y-3">
                                                <p className="text-sm text-center italic text-foreground/80 border-l-4 border-primary pl-3">&ldquo;{player.reason}&rdquo;</p>
                                                <CompactPlayerCard 
                                                    player={player} 
                                                    distance={getDistance(userLocation, player.location)}
                                                    onInvite={handleInvitePlayer}
                                                    isAlreadyInvited={sentInvitations.has(player.uid)}
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {(recommendedPlayers.length > 0) && <Separator />}

                        <div>
                            <h2 className="text-xl font-bold mb-3">Todos los Jugadores ({filteredPlayers.length})</h2>
                            <div className="space-y-2">
                                {filteredPlayers.length > 0 ? (
                                    filteredPlayers.map(player => (
                                         <CompactPlayerCard 
                                            key={player.uid}
                                            player={player} 
                                            distance={getDistance(userLocation, player.location)}
                                            onInvite={handleInvitePlayer}
                                            isAlreadyInvited={sentInvitations.has(player.uid)}
                                        />
                                    ))
                                ) : (
                                    <Alert>
                                        <AlertTitle>Sin Resultados</AlertTitle>
                                        <AlertDescription>No hay jugadores disponibles que coincidan con tus filtros.</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] pb-16 md:pb-0">
        <PageHeader
            title="Buscar Partidos y Jugadores"
            description="Encontrá partidos públicos o jugadores libres para completar tu equipo."
        />
        <Tabs defaultValue="find-matches" className="flex flex-col flex-grow">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                 <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="find-matches">
                        <Search className="mr-2 h-4 w-4"/>
                        Buscar Partidos
                    </TabsTrigger>
                    <TabsTrigger value="find-players">
                        <Users className="mr-2 h-4 w-4"/>
                        Buscar Jugadores
                    </TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="find-matches" className="flex-grow mt-4">
                {renderFindMatches()}
            </TabsContent>
            <TabsContent value="find-players" className="flex-grow mt-4">
                {renderFindPlayers()}
            </TabsContent>
        </Tabs>
    </div>
  );
}
