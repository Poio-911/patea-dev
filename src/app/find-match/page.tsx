
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match, AvailablePlayer } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, MapPin, Search, SlidersHorizontal, Users, Calendar } from 'lucide-react';
import { MatchMarker } from '@/components/match-marker';
import { PlayerMarker } from '@/components/player-marker';
import { libraries } from '@/lib/google-maps';
import { mapStyles } from '@/lib/map-styles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayerCard } from '@/components/player-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -34.9011, // Montevideo
  lng: -56.1645
};

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

export default function FindMatchPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('matches');
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [searchRadius, setSearchRadius] = useState(7);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Match Filters
  const [matchDateFilter, setMatchDateFilter] = useState<string>('');
  const [matchSizeFilter, setMatchSizeFilter] = useState<string[]>([]);

  // Player Filters
  const [playerPositionFilter, setPlayerPositionFilter] = useState('all');
  const [playerOvrFilter, setPlayerOvrFilter] = useState([40, 99]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  // Data fetching
  const publicMatchesQuery = useMemo(() => firestore ? query(collection(firestore, 'matches'), where('isPublic', '==', true), where('status', '==', 'upcoming')) : null, [firestore]);
  const availablePlayersQuery = useMemo(() => firestore ? query(collection(firestore, 'availablePlayers'), where('uid', '!=', user?.uid || '')) : null, [firestore, user?.uid]);

  const { data: allPublicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);
  const { data: allAvailablePlayers, loading: playersLoading } = useCollection<AvailablePlayer>(availablePlayersQuery);

  const applyFilters = useCallback(() => {
    if (!userLocation) {
        setLocationError('Primero tienes que indicar tu ubicación para poder buscar.');
        return;
    }
    setFiltersApplied(true);
  }, [userLocation]);


  const filteredMatches = useMemo(() => {
    if (!allPublicMatches || !userLocation || !filtersApplied) return [];
    return allPublicMatches.filter(match => {
        if (!match.location?.lat || !match.location?.lng) return false;
        const distance = getDistance(userLocation, match.location);
        if (distance > searchRadius) return false;
        if (matchDateFilter && !isSameDay(new Date(match.date), parseISO(matchDateFilter))) return false;
        if (matchSizeFilter.length > 0 && !matchSizeFilter.includes(String(match.matchSize))) return false;
        return true;
    }).sort((a,b) => getDistance(userLocation, a.location) - getDistance(userLocation, b.location));
  }, [allPublicMatches, userLocation, searchRadius, matchDateFilter, matchSizeFilter, filtersApplied]);

  const filteredPlayers = useMemo(() => {
    if (!allAvailablePlayers || !userLocation || !filtersApplied) return [];
    return allAvailablePlayers.filter(player => {
        if (!player.location?.lat || !player.location?.lng) return false;
        const distance = getDistance(userLocation, player.location);
        if (distance > searchRadius) return false;
        if (playerPositionFilter !== 'all' && player.position !== playerPositionFilter) return false;
        if (player.ovr < playerOvrFilter[0] || player.ovr > playerOvrFilter[1]) return false;
        return true;
    }).sort((a,b) => getDistance(userLocation, a.location) - getDistance(userLocation, b.location));
  }, [allAvailablePlayers, userLocation, searchRadius, playerPositionFilter, playerOvrFilter, filtersApplied]);


  const handleMarkerClick = (id: string) => {
    setActiveMarker(activeMarker === id ? null : id);
     const element = document.getElementById(`card-${id}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSearchClick = useCallback(() => {
    setIsSearching(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      setIsSearching(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsSearching(false);
        setFiltersApplied(true);
      },
      (error) => {
        const message = error.code === 1 ? 'Debes permitir el acceso a la ubicación para buscar.' : 'No se pudo obtener tu ubicación.';
        setLocationError(message);
        setIsSearching(false);
      }
    );
  }, []);

  const itemsToDisplay = activeTab === 'matches' ? filteredMatches : filteredPlayers;
  
  if (userLoading || !isLoaded) {
    return <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] pb-16 md:pb-0">
      <FirstTimeInfoDialog
        featureKey="hasSeenFindMatchInfo"
        title="Sección de Búsqueda"
        description="Acá podés encontrar partidos públicos que hayan creado otros organizadores cerca de tu zona, o buscar jugadores libres para invitar a tus propios partidos."
      />
      <PageHeader title="Buscar" description="Encontrá partidos y jugadores cerca tuyo." />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        <div className="lg:col-span-1 h-full flex flex-col gap-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="matches">Partidos</TabsTrigger>
                  <TabsTrigger value="players">Jugadores</TabsTrigger>
                </TabsList>
                <TabsContent value="matches" className="space-y-4 pt-2">
                  <div><Label>Fecha</Label><Input type="date" value={matchDateFilter} onChange={e => setMatchDateFilter(e.target.value)} /></div>
                  <div><Label>Tamaño del Partido</Label><ToggleGroup type="multiple" value={matchSizeFilter} onValueChange={setMatchSizeFilter} variant="outline" className="justify-start mt-1"><ToggleGroupItem value="10">F5</ToggleGroupItem><ToggleGroupItem value="14">F7</ToggleGroupItem><ToggleGroupItem value="22">F11</ToggleGroupItem></ToggleGroup></div>
                </TabsContent>
                <TabsContent value="players" className="space-y-4 pt-2">
                   <div><Label>Posición</Label><Select value={playerPositionFilter} onValueChange={setPlayerPositionFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="POR">Portero</SelectItem><SelectItem value="DEF">Defensa</SelectItem><SelectItem value="MED">Medio</SelectItem><SelectItem value="DEL">Delantero</SelectItem></SelectContent></Select></div>
                   <div><Label>Rango de OVR: {playerOvrFilter[0]} - {playerOvrFilter[1]}</Label><Slider value={playerOvrFilter} onValueChange={setPlayerOvrFilter} min={40} max={99} step={1} /></div>
                </TabsContent>
              </Tabs>
              <div><Label>Radio de Búsqueda: {searchRadius} km</Label><Slider value={[searchRadius]} onValueChange={(v) => setSearchRadius(v[0])} max={50} step={1} /></div>
              {locationError && (<Alert variant="destructive"><AlertDescription>{locationError}</AlertDescription></Alert>)}
            </CardContent>
            <CardFooter className="p-4 border-t">
              <Button onClick={handleSearchClick} disabled={isSearching} size="lg" className="w-full">
                {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                {isSearching ? 'Buscando...' : 'Buscar'}
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="flex-grow flex flex-col">
            <CardHeader className="p-4"><CardTitle className="text-lg">Resultados ({itemsToDisplay.length})</CardTitle></CardHeader>
            <CardContent className="p-2 flex-grow overflow-hidden"><ScrollArea className="h-full">
              {filtersApplied && (
                <div className="space-y-2 p-1">
                  {itemsToDisplay.length > 0 ? itemsToDisplay.map((item: Match | AvailablePlayer) => (
                    <div id={`card-${(item as Match).id || (item as AvailablePlayer).uid}`} key={(item as Match).id || (item as AvailablePlayer).uid}>
                      {activeTab === 'matches' ? (
                          <Card className={cn("cursor-pointer", activeMarker === item.id ? "border-primary" : "")} onMouseEnter={() => setActiveMarker(item.id)} onMouseLeave={() => setActiveMarker(null)}>
                            <div className="p-3 grid grid-cols-3 gap-2 items-center"><div className="col-span-2 space-y-1"><h3 className="font-semibold text-sm leading-tight">{(item as Match).title}</h3><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /><span>{format(new Date((item as Match).date), "d MMM", { locale: es })} - {(item as Match).time}hs</span></div></div><div className="col-span-1 flex flex-col items-end gap-1"><Badge variant="secondary">{(item as Match).players.length}/{(item as Match).matchSize}</Badge><InvitePlayerDialog userMatches={[item as Match]} match={item as Match}><Button size="sm" variant="default" className="h-7 text-xs w-full">Invitar</Button></InvitePlayerDialog></div></div>
                          </Card>
                      ) : (
                          <div className="w-full" onMouseEnter={() => setActiveMarker((item as AvailablePlayer).uid)} onMouseLeave={() => setActiveMarker(null)}>
                            <PlayerCard player={item as any} />
                          </div>
                      )}
                    </div>
                  )) : <Alert><AlertDescription>No se encontraron {activeTab === 'matches' ? 'partidos' : 'jugadores'} con esos filtros.</AlertDescription></Alert>}
                </div>
              )}
            </ScrollArea></CardContent>
          </Card>
        </div>
        
        <div className="h-[400px] lg:h-full w-full rounded-lg overflow-hidden lg:col-span-2">
          <GoogleMap mapContainerStyle={containerStyle} center={userLocation || defaultCenter} zoom={13} options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true }}>
            {userLocation && <PlayerMarker player={{uid: 'user-location', location: userLocation} as AvailablePlayer} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} />}
            {filtersApplied && activeTab === 'matches' && filteredMatches.map((match) => <MatchMarker key={match.id} match={match} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} />)}
            {filtersApplied && activeTab === 'players' && filteredPlayers.map((player) => <PlayerMarker key={player.uid} player={player} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} />)}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
}
