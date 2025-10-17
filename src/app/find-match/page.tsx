
'use client';

import { useState, useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2 } from 'lucide-react';
import { MatchMarker } from '@/components/match-marker';
import { libraries } from '@/lib/google-maps';
import { mapStyles } from '@/lib/map-styles';
import { MatchCard } from '@/components/match-card';
import { useCollection as usePlayersCollection } from '@/firebase/firestore/use-collection';
import type { Player } from '@/lib/types';

const containerStyle = {
  width: '100%',
  height: '40vh',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -34.9011, // Montevideo
  lng: -56.1645
};

export default function FindMatchPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });
  
  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);

    const { data: allGroupPlayers } = usePlayersCollection<Player>(playersQuery);


  const publicMatchesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'matches'),
      where('isPublic', '==', true),
      where('status', '==', 'upcoming')
    );
  }, [firestore]);

  const { data: publicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);
  
  const validPublicMatches = useMemo(() => {
    if (!publicMatches) return [];
    // Filter out matches that don't have the correct location object structure
    return publicMatches.filter(match => 
        match.location && 
        typeof match.location === 'object' && 
        'lat' in match.location && typeof match.location.lat === 'number' &&
        'lng' in match.location && typeof match.location.lng === 'number'
    );
  }, [publicMatches]);

  const handleMarkerClick = (matchId: string) => {
    setActiveMarker(activeMarker === matchId ? null : matchId);
  };
  
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
        <>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={defaultCenter}
                zoom={12}
                options={{
                    styles: mapStyles,
                    disableDefaultUI: true,
                    zoomControl: true,
                }}
                >
                {validPublicMatches?.map((match) => (
                    <MatchMarker
                    key={match.id}
                    match={match}
                    activeMarker={activeMarker}
                    handleMarkerClick={handleMarkerClick}
                    />
                ))}
            </GoogleMap>
            <div className="space-y-4">
                <h2 className="text-xl font-bold">Partidos Cercanos</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {validPublicMatches.map((match) => (
                        <div
                            key={match.id}
                            onMouseEnter={() => setActiveMarker(match.id)}
                            onMouseLeave={() => setActiveMarker(null)}
                        >
                            <MatchCard match={match} allPlayers={allGroupPlayers || []} />
                        </div>
                    ))}
                 </div>
                 {validPublicMatches.length === 0 && (
                    <p className="text-muted-foreground">No se encontraron partidos públicos por ahora. ¡Vuelve a intentarlo más tarde!</p>
                 )}
            </div>
        </>
      )}
    </div>
  );
}
