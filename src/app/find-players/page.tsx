'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { AvailablePlayer, Match, DayOfWeek, TimeOfDay, PlayerPosition } from '@/lib/types';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { MapOverlayFilters } from '@/components/find-players/map-overlay-filters';
import { MapsProvider } from '@/components/maps/maps-provider';
import { getUserLocationAction, reverseGeocodeAction } from '@/lib/actions/location-actions';
import { searchPlayersAction } from '@/lib/actions/search-actions';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PlayerListCard } from '@/components/find-players/player-list-card'; // For Desktop Sidebar
import { PlayerMapCarousel } from '@/components/find-players/player-map-carousel'; // For Mobile Bottom
import { ScrollArea } from '@/components/ui/scroll-area';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getDistance } from '@/lib/geo-utils'; // Ensure we have this for distance sorting

// Lazy load map (no SSR — Google Maps needs browser)
const PlayersMap = dynamic(
  () => import('@/components/maps/players-map').then((m) => m.PlayersMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted animate-pulse" /> }
);

export default function FindPlayersPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Filter state
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | 'all'>('all');
  const [ovrRange, setOvrRange] = useState<[number, number]>([40, 99]);
  const [searchRadius, setSearchRadius] = useState(10);
  const [dayFilter, setDayFilter] = useState<DayOfWeek[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeOfDay[]>([]);

  // Search Results State
  const [searchResults, setSearchResults] = useState<(AvailablePlayer & { distance: number })[]>([]);
  const [isFetchingPlayers, setIsFetchingPlayers] = useState(false);

  // Interaction state
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [carouselApi, setCarouselApi] = useState<any>(); // CarouselApi type import issue sometimes, using any for safety or fix import

  // Initialize from URL if present
  useEffect(() => {
    if (searchParams.size > 0) {
      const lat = parseFloat(searchParams.get('lat') || '');
      const lng = parseFloat(searchParams.get('lng') || '');
      const radius = parseInt(searchParams.get('radius') || '10');
      const pos = searchParams.get('pos') as PlayerPosition | 'all' || 'all';
      const minOvr = parseInt(searchParams.get('minOvr') || '40');
      const maxOvr = parseInt(searchParams.get('maxOvr') || '99');

      if (!isNaN(lat) && !isNaN(lng)) {
        setUserLocation({ lat, lng });
        setHasSearched(true);

        // If location label not set, fetch it
        reverseGeocodeAction(lat, lng).then(res => {
          if (res.success && res.label) setLocationLabel(res.label);
        });
      }

      if (!isNaN(radius)) setSearchRadius(radius);
      if (pos) setPositionFilter(pos);
      if (!isNaN(minOvr) && !isNaN(maxOvr)) setOvrRange([minOvr, maxOvr]);
    } else {
      // Load saved location if no URL params
      async function loadSavedLocation() {
        const result = await getUserLocationAction();
        if (result.success && result.location) {
          setUserLocation({ lat: result.location.lat, lng: result.location.lng });
          setLocationLabel(result.location.label || '');
          setHasSearched(true);
        }
      }
      loadSavedLocation();
    }
  }, [searchParams]);

  // Sync state to URL
  useEffect(() => {
    if (!hasSearched) return;

    const params = new URLSearchParams(searchParams.toString());

    if (userLocation) {
      params.set('lat', userLocation.lat.toFixed(6));
      params.set('lng', userLocation.lng.toFixed(6));
    }

    params.set('radius', searchRadius.toString());
    params.set('pos', positionFilter);
    params.set('minOvr', ovrRange[0].toString());
    params.set('maxOvr', ovrRange[1].toString());

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [userLocation, searchRadius, positionFilter, ovrRange, hasSearched, pathname, router, searchParams]);

  const userMatchesQuery = useMemo(
    () =>
      firestore && user?.uid
        ? query(
          collection(firestore, 'matches'),
          where('createdBy', '==', user.uid),
          where('status', '==', 'upcoming')
        )
        : null,
    [firestore, user?.uid]
  );

  const { data: userMatches } = useCollection<Match>(userMatchesQuery);

  // Search Effect
  useEffect(() => {
    if (!userLocation) return;

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      setIsFetchingPlayers(true);
      try {
        const result = await searchPlayersAction({
          lat: userLocation.lat,
          lng: userLocation.lng,
          radiusInKm: searchRadius,
          position: positionFilter,
          minOvr: ovrRange[0],
          maxOvr: ovrRange[1],
          excludeIds: user ? [user.uid] : [],
          limit: 50
        });

        if (isActive && result.success && result.data) {
          setSearchResults(result.data.players);
        }
      } catch (error) {
        console.error("Search error", error);
      } finally {
        if (isActive) setIsFetchingPlayers(false);
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [userLocation, searchRadius, positionFilter, ovrRange, user]);

  // Client-side filtering for Day/Time
  const filteredResults = useMemo(() => {
    let players = searchResults;

    if (dayFilter.length > 0) {
      players = players.filter(p => {
        const playerDays = p.availability ? Object.keys(p.availability) as DayOfWeek[] : [];
        return dayFilter.some(d => playerDays.includes(d));
      });
    }

    if (timeFilter.length > 0) {
      players = players.filter(p => {
        const allTimes = new Set<TimeOfDay>();
        if (p.availability) {
          Object.values(p.availability).forEach(times => times?.forEach(t => allTimes.add(t)));
        }
        return timeFilter.some(t => allTimes.has(t));
      });
    }

    // Ensure distance sorting logic is consistent if server returns distant things or client location shifts slightly
    // Server action sorts by distance but let's trust it.
    return players;
  }, [searchResults, dayFilter, timeFilter]);

  // Utility map for distance display if needed, though players have distance prop now
  const distanceMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredResults.forEach(p => map.set(p.uid, p.distance));
    return map;
  }, [filteredResults]);


  // Request geolocation
  const handleRequestLocation = useCallback(async () => {
    setIsSearchingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      setIsSearchingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setHasSearched(true);
        setIsSearchingLocation(false);

        const geo = await reverseGeocodeAction(loc.lat, loc.lng);
        if (geo.success && geo.label) {
          setLocationLabel(geo.label);
        }
      },
      (error) => {
        const message =
          error.code === 1
            ? 'Debes permitir el acceso a la ubicación para buscar.'
            : 'No se pudo obtener tu ubicación.';
        setLocationError(message);
        setIsSearchingLocation(false);
      }
    );
  }, []);

  if (userLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // EMPTY STATE: No Location
  if (!userLocation && !hasSearched) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center px-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-xl">¿Dónde buscamos?</h3>
            <p className="text-muted-foreground mt-2">
              Para encontrar jugadores cracks cerca tuyo necesitamos saber tu ubicación.
            </p>
          </div>
          <Button onClick={handleRequestLocation} disabled={isSearchingLocation} size="lg" className="w-full">
            {isSearchingLocation ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="mr-2 h-4 w-4" />
            )}
            {isSearchingLocation ? 'Detectando...' : 'Usar mi ubicación actual'}
          </Button>
          {locationError && (
            <Alert variant="destructive">
              <AlertDescription>{locationError}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background flex flex-col md:flex-row">
      <FirstTimeInfoDialog
        featureKey="hasSeenFindPlayersInfo"
        title="Buscador de Jugadores"
        description="Explorá el mapa para encontrar jugadores cercanos. Usá el carrusel para ver detalles e invitarlos a tus partidos."
      />

      {/* ── DESKTOP SIDEBAR ── */}
      {hasSearched && (
        <div className="hidden md:flex flex-col w-[380px] border-r z-20 bg-background h-full shadow-xl">
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold tracking-tight">Jugadores cerca</h1>
            <p className="text-sm text-muted-foreground">{filteredResults.length} encontrados en tu zona</p>

            {/* Desktop Filters could go here or floating on map. Keeping simpler for now using Mobile/Floating ones or adding sidebar filters?
                     User wanted Option 1 which is "Map Improved".
                     Let's keep the Overlay filters for Map as they work well for desktop map too, or duplicate them here?
                     Let's use the overlay filters for consistency on the map view.
                 */}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {isFetchingPlayers ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3 border rounded-xl bg-card">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))
              ) : filteredResults.length > 0 ? (
                filteredResults.map(player => (
                  <PlayerListCard
                    key={player.uid}
                    player={player}
                    distanceKm={player.distance}
                    isActive={activePlayerId === player.uid}
                    onSelect={setActivePlayerId}
                    actionSlot={
                      userMatches && userMatches.length > 0 ? (
                        <InvitePlayerDialog
                          playerToInvite={player}
                          userMatches={userMatches}
                        >
                          <Button size="sm" className="">Invitar</Button>
                        </InvitePlayerDialog>
                      ) : null
                    }
                  />
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No se encontraron jugadores.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ── MAIN MAP AREA (Mobile & Desktop) ── */}
      <div className="flex-1 relative h-full">

        {/* Map */}
        {userLocation ? (
          <MapsProvider>
            <PlayersMap
              players={filteredResults}
              userLocation={userLocation}
              activePlayerId={activePlayerId}
              onPlayerSelect={setActivePlayerId}
              searchRadius={searchRadius}
            />
          </MapsProvider>
        ) : null}

        {/* Filters Overlay (Floating) */}
        <div className="absolute top-0 left-0 right-0 z-10 p-2 md:p-4 pointer-events-none">
          <div className="pointer-events-auto inline-block w-full md:w-auto">
            <MapOverlayFilters
              playerCount={filteredResults.length}
              locationLabel={locationLabel}
              positionFilter={positionFilter as PlayerPosition | 'all'}
              onPositionChange={setPositionFilter}
              ovrRange={ovrRange}
              onOvrChange={setOvrRange}
              searchRadius={searchRadius}
              onRadiusChange={setSearchRadius}
              dayFilter={dayFilter}
              onDayChange={setDayFilter}
              timeFilter={timeFilter}
              onTimeChange={setTimeFilter}
            />
          </div>
        </div>

        {/* Mobile Bottom Carousel */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 z-20 pb-6 pt-10 bg-gradient-to-t from-background/90 via-background/60 to-transparent">
          {filteredResults.length > 0 && (
            <PlayerMapCarousel
              players={filteredResults}
              distanceMap={distanceMap}
              activePlayerId={activePlayerId}
              onActiveChange={setActivePlayerId}
              userMatches={userMatches ?? []}
              api={carouselApi}
              setApi={setCarouselApi}
            />
          )}
        </div>

      </div>

    </div>
  );
}
