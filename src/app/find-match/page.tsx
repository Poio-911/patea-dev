
'use client';

import { useState, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, MapPin, Calendar, Users, LocateFixed } from 'lucide-react';
import { MatchMarker } from '@/components/match-marker';
import { libraries } from '@/lib/google-maps';
import { mapStyles } from '@/lib/map-styles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -34.9011, // Montevideo
  lng: -56.1645
};

// Function to calculate distance between two lat/lng points in km
const getDistance = (pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


const CompactMatchCard = ({ match, onHover, isActive }: { match: Match, onHover: (id: string | null) => void, isActive: boolean }) => {
    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200",
                isActive ? "border-primary shadow-lg" : "hover:border-muted-foreground/50"
            )}
            onMouseEnter={() => onHover(match.id)}
            onMouseLeave={() => onHover(null)}
        >
            <div className="p-3">
                <h3 className="font-bold truncate">{match.title}</h3>
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(match.date), "d MMM, yyyy", { locale: es })} - {match.time}hs</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{match.location.address}</span>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <SoccerPlayerIcon className="h-4 w-4" />
                        <span>{match.players.length} / {match.matchSize}</span>
                    </div>
                    <Button asChild variant="default" size="sm" className="h-7 px-2 text-xs">
                        <Link href={`/matches`}>
                           Ver Detalles
                        </Link>
                    </Button>
                </div>
            </div>
        </Card>
    )
}

export default function FindMatchPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  
  const [searchRadius, setSearchRadius] = useState(7); // Default 7km
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [nearbyMatches, setNearbyMatches] = useState<Match[]>([]);
  const [searchCompleted, setSearchCompleted] = useState(false);


  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const publicMatchesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'matches'),
      where('isPublic', '==', true),
      where('status', '==', 'upcoming')
    );
  }, [firestore]);

  const { data: allPublicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);

  const handleMarkerClick = (matchId: string) => {
    setActiveMarker(activeMarker === matchId ? null : matchId);
     const element = document.getElementById(`match-card-${matchId}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSearchNearby = useCallback(() => {
    setIsSearching(true);
    setSearchCompleted(false);

    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Error de Geolocalización', description: 'Tu navegador no soporta esta función.' });
      setIsSearching(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentUserLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(currentUserLocation);
        
        if (allPublicMatches) {
            const filteredMatches = allPublicMatches.filter(match => {
                if (!match.location?.lat || !match.location?.lng) return false;
                const distance = getDistance(currentUserLocation, match.location);
                return distance <= searchRadius;
            }).sort((a,b) => getDistance(currentUserLocation, a.location) - getDistance(currentUserLocation, b.location));

            setNearbyMatches(filteredMatches);
        }

        setIsSearching(false);
        setSearchCompleted(true);
      },
      (error) => {
        toast({ variant: 'destructive', title: 'Error de Ubicación', description: 'No se pudo obtener tu ubicación. Asegúrate de haber dado los permisos necesarios.' });
        setIsSearching(false);
      }
    );
  }, [allPublicMatches, searchRadius, toast]);


  const loading = matchesLoading || !isLoaded;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )
    }

    if (!searchCompleted) {
      return (
        <Card className="max-w-lg mx-auto mt-8">
            <CardHeader>
                <CardTitle className="text-center">Encuentra Partidos Cerca Tuyo</CardTitle>
                <CardDescription className="text-center">
                    Ajusta el radio de búsqueda y presiona el botón para encontrar partidos públicos.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-8">
                <div className="w-full px-4">
                    <div className="flex justify-between font-medium">
                        <span>Radio de Búsqueda:</span>
                        <span className="text-primary">{searchRadius} km</span>
                    </div>
                    <Slider
                        value={[searchRadius]}
                        onValueChange={(value) => setSearchRadius(value[0])}
                        max={50}
                        step={1}
                        className="mt-2"
                        disabled={isSearching}
                    />
                </div>
                <Button onClick={handleSearchNearby} disabled={isSearching} size="lg">
                    {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LocateFixed className="mr-2 h-5 w-5" />}
                    {isSearching ? 'Buscando...' : 'Buscar Partidos Cercanos'}
                </Button>
            </CardContent>
        </Card>
      );
    }
    
    // Search is completed
    return (
        <div className="space-y-4 lg:hidden">
            <Card>
                <CardHeader className="p-3">
                    <CardTitle className="text-lg">Partidos Encontrados ({nearbyMatches.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-1 max-h-64 overflow-y-auto">
                     <div className="space-y-2 p-1">
                        {nearbyMatches.length > 0 ? nearbyMatches.map((match) => (
                           <div id={`match-card-${match.id}`} key={match.id}>
                             <CompactMatchCard
                                match={match}
                                onHover={setActiveMarker}
                                isActive={activeMarker === match.id}
                            />
                           </div>
                        )) : (
                            <Alert className="m-2">
                                <AlertTitle>Sin Resultados</AlertTitle>
                                <AlertDescription>
                                    No se encontraron partidos públicos en esta área. Intenta aumentar el radio de búsqueda.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>
            <div className="h-96 w-full">
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={userLocation || defaultCenter}
                    zoom={12}
                    options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true, }}
                >
                     {nearbyMatches.map((match) => ( <MatchMarker key={match.id} match={match} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} /> ))}
                    {userLocation && ( <MatchMarker match={{ id: 'user-location', title: 'Tu Ubicación', location: userLocation } as any} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} /> )}
                </GoogleMap>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="Buscar Partido"
        description="Encuentra partidos públicos cerca de ti y únete."
      />
      <div className="flex-grow">
        {renderContent()}

        {searchCompleted && (
            <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                <Card className="lg:col-span-1 h-full flex flex-col">
                    <CardHeader className="p-4">
                        <CardTitle className="text-lg">Partidos Encontrados</CardTitle>
                        <CardDescription className="text-xs">Se encontraron {nearbyMatches.length} partidos en un radio de {searchRadius}km.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow p-2">
                        <ScrollArea className="h-full">
                            <div className="space-y-2 p-1">
                                {nearbyMatches.length > 0 ? nearbyMatches.map((match) => (
                                <div id={`match-card-${match.id}-desktop`} key={match.id}>
                                    <CompactMatchCard
                                        match={match}
                                        onHover={setActiveMarker}
                                        isActive={activeMarker === match.id}
                                    />
                                </div>
                                )) : (
                                    <Alert className="m-2">
                                        <AlertTitle>Sin Resultados</AlertTitle>
                                        <AlertDescription>
                                            No se encontraron partidos públicos en esta área. Intenta aumentar el radio de búsqueda.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                <div className="lg:col-span-2 h-full min-h-[400px] lg:min-h-0">
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={userLocation || defaultCenter}
                        zoom={12}
                        options={{
                            styles: mapStyles,
                            disableDefaultUI: true,
                            zoomControl: true,
                        }}
                    >
                        {nearbyMatches.map((match) => (
                            <MatchMarker
                                key={match.id}
                                match={match}
                                activeMarker={activeMarker}
                                handleMarkerClick={handleMarkerClick}
                            />
                        ))}
                        {userLocation && (
                            <MatchMarker
                                match={{
                                    id: 'user-location',
                                    title: 'Tu Ubicación',
                                    location: userLocation
                                } as any}
                                activeMarker={activeMarker}
                                handleMarkerClick={handleMarkerClick}
                            />
                        )}
                    </GoogleMap>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
