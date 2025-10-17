
'use client';

import { useState, useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2 } from 'lucide-react';
import { MatchMarker } from '@/components/match-marker';
import { useToast } from '@/hooks/use-toast';
import { libraries } from '@/lib/google-maps';


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
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const { toast } = useToast();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  // It's useful to have all players from the user's active group to check their profile when joining a match
  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: allGroupPlayers } = useCollection<Player>(playersQuery);


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
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={12}
        >
          {validPublicMatches?.map((match) => (
            <MatchMarker
              key={match.id}
              match={match}
              allPlayers={allGroupPlayers || []}
              activeMarker={activeMarker}
              handleMarkerClick={handleMarkerClick}
            />
          ))}
        </GoogleMap>
      )}
    </div>
  );
}
