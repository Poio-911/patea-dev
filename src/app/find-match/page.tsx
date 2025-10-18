
'use client';

import { useState, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match, AvailablePlayer, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, MapPin, Calendar, Users, LocateFixed, Search } from 'lucide-react';
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
import { MatchDetailsDialog } from '@/components/match-details-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerMarker } from '@/components/player-marker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { FindBestFitDialog } from '@/components/find-best-fit-dialog';


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
            <div className="p-3 grid grid-cols-3 gap-2 items-center">
                <div className="col-span-2 space-y-1">
                    <h3 className="font-bold truncate">{match.title}</h3>
                    <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(match.date), "d MMM, yyyy", { locale: es })} - {match.time}hs</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{match.location.name}</span>
                        </div>
                    </div>
                </div>
                <div className="col-span-1 flex flex-col items-end justify-between h-full gap-2">
                     <div className="flex items-center gap-2 text-sm font-semibold">
                        <SoccerPlayerIcon className="h-4 w-4" />
                        <span>{match.players.length} / {match.matchSize}</span>
                    </div>
                    <MatchDetailsDialog match={match}>
                       <Button variant="default" size="sm" className="h-7 px-2 text-xs w-full">
                           Ver Detalles
                       </Button>
                    </MatchDetailsDialog>
                </div>
            </div>
        </Card>
    )
}

const CompactPlayerCard = ({ player, onHover, isActive, userMatches }: { player: AvailablePlayer, onHover: (id: string | null) => void, isActive: boolean, userMatches: Match[] }) => {
    const { user } = useUser();
    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200",
                isActive ? "border-primary shadow-lg" : "hover:border-muted-foreground/50"
            )}
            onMouseEnter={() => onHover(player.uid)}
            onMouseLeave={() => onHover(null)}
        >
            <div className="p-3 flex gap-3 items-center">
                <Avatar className="h-12 w-12 border">
                    <AvatarImage src={player.photoUrl} alt={player.displayName} />
                    <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <h3 className="font-bold">{player.displayName}</h3>
                    <div className="text-xs text-muted-foreground">Disponible desde {format(new Date(player.availableSince), "dd/MM")}</div>
                </div>
                <div className="flex flex-col items-center gap-1">
                     <InvitePlayerDialog 
                        playerToInvite={player}
                        userMatches={userMatches}
                     >
                        <Button variant="default" size="sm" className="h-7 px-2 text-xs w-full" disabled={!user || userMatches.length === 0}>
                            Invitar
                        </Button>
                    </InvitePlayerDialog>
                    <div className='flex gap-1'>
                      <Badge>{player.ovr}</Badge>
                      <Badge variant="outline">{player.position}</Badge>
                    </div>
                </div>
            </div>
        </Card>
    )
}

export default function FindMatchPage() {
  const { user } = useUser();
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

  const availablePlayersQuery = useMemo(() => {
    if(!firestore) return null;
    return collection(firestore, 'availablePlayers');
  }, [firestore]);
  const { data: availablePlayers, loading: playersLoading } = useCollection<AvailablePlayer>(availablePlayersQuery);

  const userMatchesQuery = useMemo(() => 
    firestore && user?.uid ? query(
        collection(firestore, 'matches'),
        where('ownerUid', '==', user.uid),
        where('status', '==', 'upcoming'),
    ) : null, 
  [firestore, user?.uid]);
  
  const { data: userMatchesData } = useCollection<Match>(userMatchesQuery);

  const availableMatchesForInvite = useMemo(() => 
      userMatchesData?.filter(m => m.players.length < m.matchSize) || [],
  [userMatchesData]);


  const handleMarkerClick = (id: string) => {
    setActiveMarker(activeMarker === id ? null : id);
     const element = document.getElementById(`match-card-${id}`) || document.getElementById(`player-card-${id}`);
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


  const loading = matchesLoading || playersLoading || !isLoaded;

  const renderFindMatches = () => {
    if (loading && !searchCompleted) {
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            <div className="lg:col-span-1 h-full flex flex-col gap-4">
                <Card>
                    <CardHeader className="p-4">
                        <CardTitle className="text-lg">Partidos Encontrados ({nearbyMatches.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        <ScrollArea className="h-full max-h-[60vh] lg:max-h-full">
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
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2 h-[400px] lg:h-full w-full rounded-lg overflow-hidden">
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

  const renderFindPlayers = () => {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }
    return (
        <div className="flex flex-col h-full gap-4">
            <FindBestFitDialog userMatches={availableMatchesForInvite} availablePlayers={availablePlayers || []} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow">
                <div className="lg:col-span-1 h-full flex flex-col gap-4">
                    <Card>
                        <CardHeader className="p-4">
                            <CardTitle className="text-lg">Jugadores Disponibles ({availablePlayers?.length || 0})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            <ScrollArea className="h-full max-h-[60vh] lg:max-h-full">
                                <div className="space-y-2 p-1">
                                    {availablePlayers && availablePlayers.length > 0 ? availablePlayers.map((player) => (
                                    <div id={`player-card-${player.uid}`} key={player.uid}>
                                        <CompactPlayerCard
                                            player={player}
                                            onHover={setActiveMarker}
                                            isActive={activeMarker === player.uid}
                                            userMatches={availableMatchesForInvite}
                                        />
                                    </div>
                                    )) : (
                                        <Alert className="m-2">
                                            <AlertTitle>Nadie disponible</AlertTitle>
                                            <AlertDescription>
                                                Actualmente no hay jugadores buscando partido.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 h-[400px] lg:h-full w-full rounded-lg overflow-hidden">
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={defaultCenter}
                            zoom={12}
                            options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true }}
                        >
                            {availablePlayers?.map(player => (
                                <PlayerMarker key={player.uid} player={player} activeMarker={activeMarker} handleMarkerClick={handleMarkerClick} />
                            ))}
                        </GoogleMap>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="Encontrar Oportunidades"
        description="Busca partidos públicos o jugadores libres para completar tu equipo."
      />
      <Tabs defaultValue="find-matches" className="flex flex-col flex-grow">
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
        <TabsContent value="find-matches" className="flex-grow">
            {renderFindMatches()}
        </TabsContent>
        <TabsContent value="find-players" className="flex-grow">
            {renderFindPlayers()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

