'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Search, Calendar, UserSearch } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { getDistance } from '@/lib/geo-utils';

export default function FindMatchPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [searchRadius, setSearchRadius] = useState(7);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Match Filters
  const [matchDateFilter, setMatchDateFilter] = useState<string>('');
  const [matchSizeFilter, setMatchSizeFilter] = useState<string[]>([]);

  // Data fetching
  const publicMatchesQuery = useMemo(() => firestore ? query(collection(firestore, 'matches'), where('isPublic', '==', true), where('status', '==', 'upcoming')) : null, [firestore]);
  const { data: allPublicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);

  const filteredMatches = useMemo(() => {
    if (!allPublicMatches || !userLocation || !filtersApplied) return [];
    return allPublicMatches.filter(match => {
      if (!match.location?.lat || !match.location?.lng) return false;
      const distance = getDistance(userLocation, match.location);
      if (distance > searchRadius) return false;
      if (matchDateFilter && !isSameDay(new Date(match.date), parseISO(matchDateFilter))) return false;
      if (matchSizeFilter.length > 0 && !matchSizeFilter.includes(String(match.matchSize))) return false;
      return true;
    }).sort((a, b) => getDistance(userLocation, a.location) - getDistance(userLocation, b.location));
  }, [allPublicMatches, userLocation, searchRadius, matchDateFilter, matchSizeFilter, filtersApplied]);

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

  if (userLoading) {
    return <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <FirstTimeInfoDialog
        featureKey="hasSeenFindMatchInfo"
        title="Buscar Partido"
        description="Acá podés encontrar partidos públicos que hayan creado otros organizadores cerca de tu zona."
      />
      <PageHeader title="Buscar Partido" description="Encontrá partidos públicos cerca tuyo." />

      {/* Link to find-players */}
      <Link href="/find-players" className="group">
        <Card className="border-dashed hover:border-primary/50 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserSearch className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">Buscar Jugadores</p>
              <p className="text-xs text-muted-foreground">Encontrá jugadores cerca tuyo con mapa interactivo</p>
            </div>
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div><Label>Fecha</Label><Input type="date" value={matchDateFilter} onChange={e => setMatchDateFilter(e.target.value)} /></div>
              <div><Label>Tamaño del Partido</Label><ToggleGroup type="multiple" value={matchSizeFilter} onValueChange={setMatchSizeFilter} variant="outline" className="justify-start mt-1"><ToggleGroupItem value="10">F5</ToggleGroupItem><ToggleGroupItem value="14">F7</ToggleGroupItem><ToggleGroupItem value="22">F11</ToggleGroupItem></ToggleGroup></div>
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
            <CardHeader className="p-4"><CardTitle className="text-lg">Resultados ({filteredMatches.length})</CardTitle></CardHeader>
            <CardContent className="p-2 flex-grow overflow-hidden"><ScrollArea className="h-full">
              {filtersApplied && (
                <div className="space-y-2 p-1">
                  {filteredMatches.length > 0 ? filteredMatches.map((match) => (
                    <div id={`card-${match.id}`} key={match.id}>
                      <Card className={cn("cursor-pointer", activeMarker === match.id ? "border-primary" : "")} onMouseEnter={() => setActiveMarker(match.id)} onMouseLeave={() => setActiveMarker(null)}>
                        <div className="p-3 grid grid-cols-3 gap-2 items-center">
                          <div className="col-span-2 space-y-1">
                            <h3 className="font-semibold text-sm leading-tight">{match.title}</h3>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(match.date), "d MMM", { locale: es })} - {match.time}hs</span>
                            </div>
                          </div>
                          <div className="col-span-1 flex flex-col items-end gap-1">
                            <Badge variant="secondary">{match.players.length}/{match.matchSize}</Badge>
                            <InvitePlayerDialog userMatches={[match]} match={match}>
                              <Button size="sm" variant="default" className="h-7 text-xs w-full">Unirme</Button>
                            </InvitePlayerDialog>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )) : <Alert><AlertDescription>No se encontraron partidos con esos filtros.</AlertDescription></Alert>}
                </div>
              )}
            </ScrollArea></CardContent>
          </Card>
        </div>

        <div className="h-[400px] lg:h-full w-full rounded-lg overflow-hidden lg:col-span-2">
          <Alert>
            <AlertDescription>
              El mapa interactivo está disponible en la sección <Link href="/find-players" className="text-primary underline underline-offset-2 font-medium">Buscar Jugadores</Link>.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
