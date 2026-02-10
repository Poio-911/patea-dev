'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { AvailablePlayer, Match } from '@/lib/types';
import { MapsProvider } from '@/components/maps/maps-provider';
import { ExplorationMap } from '@/components/explore/exploration-map';
import { SearchToggle } from '@/components/explore/search-toggle';
import { searchPlayersAction, searchMatchesAction } from '@/lib/actions/search-actions';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { PlayerCarouselCard } from '@/components/find-players/player-carousel-card';
import { MatchExploreCard } from '@/components/explore/match-explore-card';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, SlidersHorizontal, Navigation, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<'players' | 'matches'>((searchParams.get('tab') as any) || 'players');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [players, setPlayers] = useState<(AvailablePlayer & { distance: number })[]>([]);
  const [matches, setMatches] = useState<(Match & { distance: number })[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  const { user } = useUser();
  const firestore = useFirestore();

  // User's matches for invitations
  const userMatchesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'matches'), where('ownerUid', '==', user.uid), where('status', '==', 'upcoming'));
  }, [firestore, user?.uid]);
  const { data: userMatches } = useCollection<Match>(userMatchesQuery);

  // Initial Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error('Error obteniendo ubicación:', err)
    );
  }, []);

  // Search Logic
  const handleSearch = useCallback(async (loc: { lat: number; lng: number }, rad: number, currentTab: 'players' | 'matches') => {
    setIsLoading(true);
    setActiveId(null);
    try {
      if (currentTab === 'players') {
        const res = await searchPlayersAction({ lat: loc.lat, lng: loc.lng, radiusInKm: rad });
        if (res.success) setPlayers(res.data?.players || []);
      } else {
        const res = await searchMatchesAction({ lat: loc.lat, lng: loc.lng, radiusInKm: rad });
        if (res.success) setMatches(res.data?.matches || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userLocation) {
      handleSearch(userLocation, searchRadius, tab);
    }
  }, [userLocation, searchRadius, tab, handleSearch]);

  // Carousel <-> Map Sync
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      const index = carouselApi.selectedScrollSnap();
      const list = tab === 'players' ? players : matches;
      const entity = list[index];
      if (entity) {
        const id = (entity as any).uid || (entity as any).id;
        setActiveId(id);
      }
    };
    carouselApi.on('select', onSelect);
    return () => { carouselApi.off('select', onSelect); };
  }, [carouselApi, tab, players, matches]);

  useEffect(() => {
    if (!carouselApi || !activeId) return;
    const list = tab === 'players' ? players : matches;
    const index = list.findIndex(e => ((e as any).uid || (e as any).id) === activeId);
    if (index >= 0 && index !== carouselApi.selectedScrollSnap()) {
      carouselApi.scrollTo(index);
    }
  }, [carouselApi, activeId, tab, players, matches]);

  const entities = useMemo(() => {
    if (tab === 'players') return players.map(p => ({ type: 'player' as const, data: p }));
    return matches.map(m => ({ type: 'match' as const, data: m }));
  }, [tab, players, matches]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <MapsProvider>
        <div className="absolute inset-0">
          <ExplorationMap
            type={tab}
            entities={entities}
            userLocation={userLocation}
            activeEntityId={activeId}
            onEntitySelect={setActiveId}
            searchRadius={searchRadius}
          />
        </div>
      </MapsProvider>

      {/* Top Bar Overlay */}
      <div className="absolute top-4 left-0 right-0 z-40 px-4 flex flex-col items-center gap-3">
        <SearchToggle
          value={tab}
          onChange={(v) => {
            setTab(v);
            router.push(`/explore?tab=${v}`, { scroll: false });
          }}
        />
      </div>

      {/* Bottom Panel Overlay */}
      <div className="absolute bottom-20 md:bottom-8 left-0 right-0 z-30">
        <div className="max-w-5xl mx-auto px-4 flex flex-col gap-4">

          {/* Active Filters / Status */}
          <div className="flex justify-between items-end mb-1">
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="bg-background/80 backdrop-blur-md border-border/40 w-fit">
                <MapPin className="h-3 w-3 mr-1 text-primary" />
                {searchRadius} km a la redonda
              </Badge>
              <h2 className="text-foreground font-bold text-shadow-sm flex items-center gap-2">
                {tab === 'players' ? 'JUGADORES' : 'PARTIDOS'} CERCANOS
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </h2>
            </div>

            {!userLocation && !isLoading && (
              <Button size="sm" variant="secondary" onClick={() => window.location.reload()} className="h-8 rounded-full">
                <Navigation className="h-3 w-3 mr-1" /> Reintentar GPS
              </Button>
            )}
          </div>

          {/* Entities Carousel */}
          {entities.length > 0 ? (
            <Carousel
              setApi={setCarouselApi}
              opts={{ align: 'center', loop: false }}
              className="w-full"
            >
              <CarouselContent className="-ml-3 pb-2">
                {entities.map((entity) => {
                  const id = entity.data.id || (entity.data as any).uid;
                  const distance = (entity.data as any).distance;

                  return (
                    <CarouselItem key={id} className="pl-3 basis-auto">
                      {entity.type === 'player' ? (
                        <PlayerCarouselCard
                          player={entity.data as AvailablePlayer}
                          distanceKm={distance}
                          isActive={activeId === id}
                          onSelect={setActiveId}
                          actionSlot={
                            userMatches && userMatches.length > 0 ? (
                              <InvitePlayerDialog
                                playerToInvite={entity.data as AvailablePlayer}
                                userMatches={userMatches}
                              >
                                <Button size="sm" className="w-full h-8 text-xs font-bold">
                                  Invitar
                                </Button>
                              </InvitePlayerDialog>
                            ) : null
                          }
                        />
                      ) : (
                        <MatchExploreCard
                          match={entity.data as Match}
                          distanceKm={distance}
                          isActive={activeId === id}
                          onSelect={setActiveId}
                        />
                      )}
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          ) : !isLoading && userLocation ? (
            <div className="p-8 bg-background/80 backdrop-blur-xl border border-border/40 rounded-2xl text-center shadow-2xl">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No encontramos {tab === 'players' ? 'jugadores' : 'partidos'} públicos en esta zona.</p>
              <Button variant="link" onClick={() => setSearchRadius(r => r + 10)} className="text-primary mt-1">
                Ampliar radio de búsqueda
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
