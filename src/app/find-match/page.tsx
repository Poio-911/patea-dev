
'use client';

import { useState, useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import type { Match, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, MapPin, Calendar, Clock, UserPlus, LogOut } from 'lucide-react';
import { MatchMarker } from '@/components/match-marker';
import { libraries } from '@/lib/google-maps';
import { mapStyles } from '@/lib/map-styles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: -34.9011, // Montevideo
  lng: -56.1645
};


const CompactMatchCard = ({ match, onHover, isActive, onJoinOrLeave }: { match: Match, onHover: (id: string | null) => void, isActive: boolean, onJoinOrLeave: (match: Match) => void }) => {
    const { user } = useUser();
    const [isJoining, setIsJoining] = useState(false);

    const isUserInMatch = useMemo(() => {
        if (!user) return false;
        return match.players.some(p => p.uid === user.uid);
    }, [match.players, user]);

    const isMatchFull = useMemo(() => {
        return match.players.length >= match.matchSize;
    }, [match.players, match.matchSize]);

    const handleAction = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsJoining(true);
        await onJoinOrLeave(match);
        setIsJoining(false);
    }
    
    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200",
                isActive ? "border-primary shadow-lg" : "hover:border-muted-foreground/50"
            )}
            onMouseEnter={() => onHover(match.id)}
            onMouseLeave={() => onHover(null)}
        >
            <div className="p-4">
                <h3 className="font-bold truncate">{match.title}</h3>
                <div className="text-xs text-muted-foreground mt-2 space-y-1.5">
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
                    <Button
                        variant={isUserInMatch ? 'secondary' : 'default'}
                        size="sm"
                        onClick={handleAction}
                        disabled={isJoining || (isMatchFull && !isUserInMatch)}
                        className="h-8 px-2 text-xs"
                    >
                        {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : (isUserInMatch ? 'Darse de baja' : 'Apuntarse')}
                    </Button>
                </div>
            </div>
        </Card>
    )
}

export default function FindMatchPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

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

  const { data: publicMatches, loading: matchesLoading } = useCollection<Match>(publicMatchesQuery);

  const validPublicMatches = useMemo(() => {
    if (!publicMatches) return [];
    return publicMatches.filter(match =>
        match.location &&
        typeof match.location === 'object' &&
        'lat' in match.location && typeof match.location.lat === 'number' &&
        'lng' in match.location && typeof match.location.lng === 'number'
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [publicMatches]);

  const handleMarkerClick = (matchId: string) => {
    setActiveMarker(activeMarker === matchId ? null : matchId);
     const element = document.getElementById(`match-card-${matchId}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleJoinOrLeaveMatch = async (match: Match) => {
    if (!firestore || !user) return;

    const isUserInMatch = match.players.some(p => p.uid === user.uid);
    const isMatchFull = match.players.length >= match.matchSize;
    const matchRef = doc(firestore, 'matches', match.id);

    try {
        if(isUserInMatch) {
            const playerToRemove = match.players.find(p => p.uid === user.uid);
            if (playerToRemove) {
                await updateDoc(matchRef, { players: arrayRemove(playerToRemove) });
            }
            toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${match.title}".` });
        } else {
            if (isMatchFull) {
                toast({ variant: 'destructive', title: 'Partido Lleno', description: 'No quedan plazas disponibles.' });
                return;
            }
            
            const playerProfileRef = doc(firestore, 'players', user.uid);
            const playerSnap = await getDoc(playerProfileRef);

            if (!playerSnap.exists()) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se encontró tu perfil de jugador.' });
                return;
            }
            
            const playerProfile = playerSnap.data() as Player;
            const playerPayload = { 
                uid: user.uid,
                displayName: playerProfile.name,
                ovr: playerProfile.ovr,
                position: playerProfile.position,
                photoUrl: playerProfile.photoUrl || ''
            };
            
            await updateDoc(matchRef, { players: arrayUnion(playerPayload) });
            toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${match.title}".` });
        }
    } catch (error) {
      console.error("Error joining/leaving match: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la operación.' });
    }
  };

  const loading = matchesLoading || !isLoaded;

  return (
    <div className="flex flex-col gap-8 h-[calc(100vh-10rem)]">
      <PageHeader
        title="Buscar Partido"
        description="Encuentra partidos públicos cerca de ti y únete."
      />
      {loading ? (
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <Card className="lg:col-span-1 h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Partidos Cercanos</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow p-2">
                    <ScrollArea className="h-full">
                        <div className="space-y-3 p-2">
                            {validPublicMatches.length > 0 ? validPublicMatches.map((match) => (
                               <div id={`match-card-${match.id}`} key={match.id}>
                                 <CompactMatchCard
                                    match={match}
                                    onHover={setActiveMarker}
                                    isActive={activeMarker === match.id}
                                    onJoinOrLeave={handleJoinOrLeaveMatch}
                                />
                               </div>
                            )) : (
                                <p className="text-muted-foreground text-sm p-4 text-center">No se encontraron partidos públicos por ahora.</p>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
             <div className="lg:col-span-2 h-full min-h-[300px] lg:min-h-0">
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
            </div>
        </div>
      )}
    </div>
  );
}
