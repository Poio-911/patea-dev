
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, getDoc, writeBatch } from 'firebase/firestore';
import type { Match, AvailablePlayer, Player, Invitation, Notification } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, MapPin, Calendar, Users, LocateFixed, Search, SlidersHorizontal, Sparkles, AlertCircle, Send, Check } from 'lucide-react';
import { MatchMarker } from '@/components/match-marker';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';

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
  const { toast } = useToast();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [matchSearchCompleted, setMatchSearchCompleted] = useState(false);
  const [matchDateFilter, setMatchDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [matchSizeFilter, setMatchSizeFilter] = useState<string[]>([]);
  const [searchRadius, setSearchRadius] = useState(7);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const publicMatchesQuery = useMemo(() => firestore ? query(collection(firestore, 'matches'), where('isPublic', '==', true), where('status', '==', 'upcoming')) : null, [firestore]);
  const { data: allPublicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);

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
  
  useEffect(() => { if (userLocation) { applyMatchFilters(); } }, [userLocation, applyMatchFilters]);

  const loading = userLoading || matchesLoading || !isLoaded;

  const renderContent = () => {
    if (loading && !matchSearchCompleted) return <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!matchSearchCompleted) return <Card><CardHeader className="p-4"><CardTitle className="text-center">Encontrá Partidos Cerca Tuyo</CardTitle><CardDescription className="text-center text-xs sm:text-sm">Ajustá los filtros y dale al botón para encontrar partidos públicos.</CardDescription></CardHeader><CardContent className="p-4 space-y-4"><div className="w-full space-y-4"><div><div className="flex justify-between font-medium mb-1"><Label>Radio de Búsqueda:</Label><span className="text-primary">{searchRadius} km</span></div><Slider value={[searchRadius]} onValueChange={(value) => setSearchRadius(value[0])} max={50} step={1} disabled={isSearching} /></div><div><Label className="font-medium">Fecha del Partido</Label><Input type="date" value={matchDateFilter} onChange={e => setMatchDateFilter(e.target.value)} /></div><div><Label className="font-medium">Tamaño del Partido</Label><ToggleGroup type="multiple" value={matchSizeFilter} onValueChange={setMatchSizeFilter} variant="outline" className="justify-start mt-1"><ToggleGroupItem value="10">Fútbol 5</ToggleGroupItem><ToggleGroupItem value="14">Fútbol 7</ToggleGroupItem><ToggleGroupItem value="22">Fútbol 11</ToggleGroupItem></ToggleGroup></div></div>{locationError && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error de Ubicación</AlertTitle><AlertDescription>{locationError}<Button variant="link" className="p-0 h-auto ml-1 text-destructive" onClick={handleSearchNearby}>Reintentar</Button></AlertDescription></Alert>)}</CardContent><CardFooter className="p-4 border-t"><Button onClick={handleSearchNearby} disabled={isSearching} size="lg" className="w-full">{isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LocateFixed className="mr-2 h-5 w-5" />}{isSearching ? 'Buscando...' : 'Buscar Partidos Cercanos'}</Button></CardFooter></Card>;
    
    return <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full"><div className="lg:col-span-1 h-full flex flex-col gap-4"><Card className="flex-grow flex flex-col"><CardHeader className="p-4 flex-row items-center justify-between"><CardTitle className="text-lg">Partidos ({filteredMatches.length})</CardTitle><Button variant="ghost" size="icon" onClick={() => {setMatchSearchCompleted(false); setLocationError(null);}}><SlidersHorizontal className="h-4 w-4" /></Button></CardHeader><CardContent className="p-2 flex-grow overflow-hidden"><ScrollArea className="h-full"><div className="space-y-2 p-1">{filteredMatches.length > 0 ? filteredMatches.map((match) => <div id={`match-card-${match.id}`} key={match.id}><Card className={cn("cursor-pointer transition-all duration-200", activeMarker === match.id ? "border-primary shadow-lg" : "hover:border-muted-foreground/50")} onMouseEnter={() => setActiveMarker(match.id)} onMouseLeave={() => setActiveMarker(null)}><div className="p-4 grid grid-cols-3 gap-4 items-center"><div className="col-span-2 space-y-2"><h3 className="font-bold leading-tight">{match.title}</h3><div className="text-xs text-muted-foreground flex items-center gap-2"><Calendar className="h-3 w-3" /><span>{format(new Date(match.date), "d MMM, yyyy", { locale: es })} - {match.time}hs</span></div></div><div className="col-span-1 flex flex-col items-end justify-center gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /><span>{match.players.length}/{match.matchSize}</span></div></div></div></Card></div>) : <Alert className="m-2"><AlertTitle>Sin Resultados</AlertTitle><AlertDescription>No se encontraron partidos con esos filtros. Intenta ampliar tu búsqueda.</AlertDescription></Alert>}</div></ScrollArea></CardContent></Card></div><div className="h-[400px] lg:h-full w-full rounded-lg overflow-hidden lg:col-span-2"><GoogleMap mapContainerStyle={containerStyle} center={userLocation || defaultCenter} zoom={12} options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true, }}>{filteredMatches.map((match) => ( <MatchMarker key={match.id} match={match} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} /> ))}</GoogleMap></div></div>;
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] pb-16 md:pb-0">
        <FirstTimeInfoDialog
            featureKey="hasSeenFindMatchInfo"
            title="Sección de Búsqueda de Partidos"
            description="Acá podés encontrar partidos públicos que hayan creado otros organizadores cerca de tu zona. Ajustá los filtros, buscá y ¡sumate a jugar!"
        />
        <PageHeader
            title="Buscar Partidos"
            description="Encontrá partidos públicos y sumate a la acción."
        />
        {renderContent()}
    </div>
  );
}
