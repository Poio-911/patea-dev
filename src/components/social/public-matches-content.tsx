'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Trophy, MapPin, List, Map as MapIcon, LocateFixed, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser } from '@/firebase';
import { getPublicMatchesAction, type PublicMatchFilters } from '@/lib/actions/explore-actions';
import type { Match, MatchType } from '@/lib/types';
import { CompactMatchCard } from '@/components/compact-match-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDistance, formatDistance } from '@/lib/geo-utils';

const MATCH_TYPE_FILTERS: { value: MatchType; label: string }[] = [
    { value: 'manual', label: 'Amistoso' },
    { value: 'collaborative', label: 'Colaborativo' },
    { value: 'by_teams', label: 'Por Equipos' },
];

const DISTANCE_OPTIONS = [
    { value: 5, label: '5 km' },
    { value: 10, label: '10 km' },
    { value: 25, label: '25 km' },
    { value: null as number | null, label: 'Todos' },
];

type ViewMode = 'list' | 'map';

export function PublicMatchesContent() {
    const { user } = useUser();
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTypes, setSelectedTypes] = useState<MatchType[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [maxDistance, setMaxDistance] = useState<number | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error' | 'denied'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadMatches();
        }
    }, [user]);

    // Request geolocation on mount
    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setLocationStatus('success');
                },
                (err) => {
                    console.warn('Geolocation access denied or failed', err);
                    if (err.code === 1) { // PERMISSION_DENIED
                        setLocationStatus('denied');
                    } else {
                        setLocationStatus('error');
                    }
                },
                { enableHighAccuracy: false, timeout: 8000 }
            );
        } else {
            setLocationStatus('error');
        }
    }, []);

    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) return;
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationStatus('success');
                setIsLocating(false);
            },
            () => {
                setIsLocating(false);
                // We don't update status here to avoid flashing alert if user just cancelled one attempt
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    const loadMatches = async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        const result = await getPublicMatchesAction(user.uid);
        if (result.success && result.matches) {
            setMatches(result.matches);
        } else if (result.error) {
            setError(result.error);
        }
        setIsLoading(false);
    };

    const toggleType = (type: MatchType) => {
        setSelectedTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    // Compute distances and apply filters
    const filteredMatches = useMemo(() => {
        let result = matches;

        // Type filter
        if (selectedTypes.length > 0) {
            result = result.filter(m => selectedTypes.includes(m.type));
        }

        // Distance filter (only if we have user location and a max distance)
        if (userLocation && maxDistance !== null) {
            result = result.filter(m => {
                if (!m.location?.lat || !m.location?.lng) return false;
                const dist = getDistance(userLocation, { lat: m.location.lat, lng: m.location.lng });
                return dist <= maxDistance;
            });
        }

        return result;
    }, [matches, selectedTypes, userLocation, maxDistance]);

    // Only matches with coordinates (for map view)
    const geoMatches = useMemo(() =>
        filteredMatches.filter(m => m.location?.lat && m.location?.lng),
        [filteredMatches]
    );

    // Helper to get distance string for a match
    const getMatchDistance = useCallback((match: Match): string | undefined => {
        if (!userLocation || !match.location?.lat || !match.location?.lng) return undefined;
        return formatDistance(getDistance(userLocation, { lat: match.location.lat, lng: match.location.lng }));
    }, [userLocation]);

    if (!user) {
        return (
            <div className="border border-border rounded-lg p-10 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                    Inicia sesion para ver partidos disponibles
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>Error al cargar partidos</AlertTitle>
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            )}

            {/* Geolocation Alert */}
            {(locationStatus === 'denied' || locationStatus === 'error') && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>Ubicación no disponible</AlertTitle>
                    <AlertDescription>
                        {locationStatus === 'denied'
                            ? 'Has bloqueado el acceso a tu ubicación. Habilítala en tu navegador para ver partidos cercanos.'
                            : 'No pudimos obtener tu ubicación exacta. Verifica tus permisos.'}
                    </AlertDescription>
                </Alert>
            )}

            {/* Controls row: type filters + view toggle */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 flex-1">
                    {MATCH_TYPE_FILTERS.map(type => (
                        <Button
                            key={type.value}
                            variant={selectedTypes.includes(type.value) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleType(type.value)}
                            className={cn(
                                'h-7 text-xs rounded-full transition-all',
                                selectedTypes.includes(type.value) && 'shadow-sm'
                            )}
                        >
                            {type.label}
                        </Button>
                    ))}
                </div>

                {/* View toggle */}
                <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                            'px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                            viewMode === 'list'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={cn(
                            'px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                            viewMode === 'map'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <MapIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Distance filter row */}
            <div className="flex items-center gap-2 flex-wrap">
                {!userLocation ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={requestLocation}
                        disabled={isLocating}
                        className="h-7 text-xs rounded-full gap-1"
                    >
                        <LocateFixed className={cn("h-3 w-3", isLocating && "animate-pulse")} />
                        {isLocating ? 'Localizando...' : 'Filtrar por distancia'}
                    </Button>
                ) : (
                    <>
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        {DISTANCE_OPTIONS.map(opt => (
                            <Button
                                key={opt.label}
                                variant={maxDistance === opt.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setMaxDistance(opt.value)}
                                className={cn(
                                    'h-7 text-xs rounded-full transition-all',
                                    maxDistance === opt.value && 'shadow-sm'
                                )}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </>
                )}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-32 rounded-lg" />
                    ))}
                </div>
            )}

            {/* Map view */}
            {!isLoading && viewMode === 'map' && (
                <MapView
                    matches={geoMatches}
                    userLocation={userLocation}
                    maxDistance={maxDistance}
                />
            )}

            {/* List view */}
            {!isLoading && viewMode === 'list' && filteredMatches.length > 0 && (
                <div>
                    <p className="text-sm text-muted-foreground mb-3">
                        {filteredMatches.length} partido{filteredMatches.length !== 1 ? 's' : ''} disponible{filteredMatches.length !== 1 ? 's' : ''}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {filteredMatches.map((match) => (
                            <CompactMatchCard
                                key={match.id}
                                match={match}
                                distance={getMatchDistance(match)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && viewMode === 'list' && filteredMatches.length === 0 && (
                <div className="border border-border rounded-lg p-10 text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-1">
                        No hay partidos disponibles
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {matches.length > 0
                            ? 'Proba quitando los filtros para ver mas opciones'
                            : 'Crea un partido publico para que otros se unan'}
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Lazy-loaded map sub-component ──────────────────────
import dynamic from 'next/dynamic';
import { MapsProvider } from '@/components/maps/maps-provider';

const LazyMatchesMap = dynamic(
    () => import('@/components/maps/matches-map').then(m => ({ default: m.MatchesMap })),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[400px] rounded-lg bg-muted/30 animate-pulse flex items-center justify-center">
                <MapIcon className="h-8 w-8 text-muted-foreground/30" />
            </div>
        ),
    }
);

function MapView({
    matches,
    userLocation,
    maxDistance,
}: {
    matches: Match[];
    userLocation: { lat: number; lng: number } | null;
    maxDistance: number | null;
}) {
    if (matches.length === 0) {
        return (
            <div className="border border-border rounded-lg p-10 text-center">
                <MapIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-1">
                    No hay partidos con ubicacion en el mapa
                </p>
                <p className="text-sm text-muted-foreground">
                    Los partidos sin coordenadas no aparecen aqui
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-[400px] rounded-lg overflow-hidden border border-border">
            <MapsProvider>
                <LazyMatchesMap
                    matches={matches}
                    userLocation={userLocation}
                    searchRadius={maxDistance}
                />
            </MapsProvider>
        </div>
    );
}

export default PublicMatchesContent;
