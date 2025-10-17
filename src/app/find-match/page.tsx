
'use client';

import { useState, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Compass } from 'lucide-react';
import { MatchMarker } from '@/components/match-marker';

const containerStyle = {
  width: '100%',
  height: '70vh',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -34.9011, // Montevideo
  lng: -56.1645
};

export default function FindMatchPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [geocodedMatches, setGeocodedMatches] = useState<any[]>([]);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: allGroupPlayers } = useCollection<Player>(playersQuery);


  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ['places'],
  });

  const publicMatchesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'matches'),
      where('isPublic', '==', true),
      where('status', '==', 'upcoming')
    );
  }, [firestore]);

  const { data: publicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);

  const geocodeMatches = useCallback(async () => {
    if (!publicMatches || typeof window.google === 'undefined') return;

    const geocoder = new window.google.maps.Geocoder();
    const geocoded = await Promise.all(
      publicMatches.map(async (match) => {
        try {
          const response = await geocoder.geocode({ address: match.location });
          if (response.results[0]) {
            return {
              ...match,
              position: {
                lat: response.results[0].geometry.location.lat(),
                lng: response.results[0].geometry.location.lng(),
              },
            };
          }
        } catch (error) {
          console.error(`Geocoding error for location "${match.location}":`, error);
          return null; // Return null for matches that fail to geocode
        }
        return null;
      })
    );

    setGeocodedMatches(geocoded.filter(Boolean)); // Filter out nulls
  }, [publicMatches]);

  useState(() => {
    if (isLoaded) {
      geocodeMatches();
    }
  });

  const handleMarkerClick = (matchId: string) => {
    setActiveMarker(activeMarker === matchId ? null : matchId);
  };
  
  if (loadError) {
    return <div>Error al cargar el mapa. Asegúrate de que la clave de API sea correcta.</div>;
  }

  const loading = matchesLoading || !isLoaded;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Buscar Partido"
        description="Encuentra partidos públicos cerca de ti y únete."
      />
      {loading ? (
        <div className="flex h-[70vh] w-full items-center justify-center rounded-lg bg-muted">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        isLoaded && (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={defaultCenter}
            zoom={12}
          >
            {geocodedMatches.map((match) => (
              <MatchMarker
                key={match.id}
                match={match}
                allPlayers={allGroupPlayers || []}
                activeMarker={activeMarker}
                handleMarkerClick={handleMarkerClick}
              />
            ))}
          </GoogleMap>
        )
      )}
    </div>
  );
}
