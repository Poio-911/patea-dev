'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import type { Match, AvailablePlayer, PlayerPosition } from '@/lib/types';
import { useFirestore } from '@/firebase'; // Keep for other hooks if needed, but not for search
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { InvitePlayerDialog } from './invite-player-dialog';
import { Sparkles, Send, UserPlus, Loader2, MapPin, Filter, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { searchPlayersAction } from '@/lib/actions/search-actions';
import { PlayerPositionBadge } from './player-styles';

interface AvailablePlayersSectionProps {
  match: Match;
  isOwner: boolean;
}

export function AvailablePlayersSection({ match, isOwner }: AvailablePlayersSectionProps) {
  const [recommendations, setRecommendations] = useState<(AvailablePlayer & { distance: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecommendations() {
      setIsLoading(true);
      setError(null);

      try {
        if (!match.location?.lat || !match.location?.lng) {
          // Fallback if match has no location (shouldn't happen often)
          setIsLoading(false);
          return;
        }

        // Calculate Average OVR of current players to guide recommendation
        const currentPlayersOvr = match.players?.map(p => p.ovr) || [];
        const avgOvr = currentPlayersOvr.length > 0
          ? Math.round(currentPlayersOvr.reduce((a, b) => a + b, 0) / currentPlayersOvr.length)
          : 0;

        // Determining needed positions could be complex, for now we search 'all' but prioritizing balance would be next step.
        // Or we could pass 'all' and let user filter in full view.

        const result = await searchPlayersAction({
          lat: match.location.lat,
          lng: match.location.lng,
          radiusInKm: 15, // A bit wider to ensure we get results
          excludeIds: match.playerUids || [],
          minOvr: avgOvr > 0 ? Math.max(0, avgOvr - 15) : 0, // Wide range around average
          maxOvr: avgOvr > 0 ? Math.min(99, avgOvr + 15) : 99,
          limit: 5 // Only top 5 for this view
        });

        if (result.success && result.data) {
          setRecommendations(result.data.players);
        } else {
          console.error("Search failed:", result.error);
          setError("No pudimos cargar recomendaciones.");
        }
      } catch (err) {
        console.error("Error fetching recommendations:", err);
        setError("Error de conexión.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecommendations();
  }, [match.id, match.playerUids, match.location]); // Re-fetch if players change (to exclude new ones) or match data changes

  const spotsLeft = match.matchSize - (match.players?.length || 0);

  if (!isOwner) return null;

  // Build URL for "View More"
  const findPlayersUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (match.location?.lat && match.location?.lng) {
      params.set('lat', match.location.lat.toString());
      params.set('lng', match.location.lng.toString());
      params.set('radius', '15');
    }
    return `/find-players?${params.toString()}`;
  }, [match.location]);

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="bg-muted/30 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Recomendados para tu partido</CardTitle>
              <CardDescription className="text-xs">
                Jugadores cercanos y de nivel similar. Faltan {spotsLeft}.
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs h-8">
            <Link href={findPlayersUrl}>
              Ver todos
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Buscando cracks...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-destructive">
            {error}
            <Button variant="link" size="sm" onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <UserSearch className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No encontramos jugadores cercanos</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Intentá ampliar la búsqueda en el mapa global.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={findPlayersUrl}>Ir al Buscador Global</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {recommendations.map(player => (
              <div key={player.uid} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={player.photoUrl} alt={player.displayName} />
                  <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate block">{player.displayName}</span>
                    {player.distance < 2 && (
                      <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] font-normal gap-0.5 text-muted-foreground">
                        <MapPin className="h-2 w-2" />
                        Mucha
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PlayerPositionBadge position={player.position} size="xs" showIcon={false} />
                    <span className="font-semibold text-foreground">{player.ovr} OVR</span>
                    <span>• {player.distance.toFixed(1)} km</span>
                  </div>
                </div>

                <InvitePlayerDialog
                  playerToInvite={player}
                  userMatches={[match]} // Should pass array, but we are inside specific match context so this is redundant if dialog was smarter, but it works.
                  match={match}
                >
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </InvitePlayerDialog>
              </div>
            ))}

            <div className="p-2">
              <Button variant="ghost" className="w-full text-xs text-muted-foreground h-8" asChild>
                <Link href={findPlayersUrl}>
                  Buscar con filtros avanzados
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserSearch({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M21 21l-6-6" />
      <circle cx="10" cy="10" r="3" />
    </svg>
  )
}

