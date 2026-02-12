'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Flame, Clock, UserPlus, Search, X, AlertCircle } from 'lucide-react';
import { useUser, useFirestore, useCollection, db } from '@/firebase';
import { UserSuggestionCard } from '@/components/social/user-suggestion-card';
import { getSuggestedUsersAction } from '@/lib/actions/social-feed-actions';
import { searchPlayersAction, type PlayerSearchFilters } from '@/lib/actions/explore-actions';
import type { SuggestedUser, Match, PlayerPosition, UserProfile } from '@/lib/types';
import { doc, collection, query, where, or } from 'firebase/firestore';
import { useDoc } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: 'DEL', label: 'DEL' },
  { value: 'MED', label: 'MED' },
  { value: 'DEF', label: 'DEF' },
  { value: 'POR', label: 'POR' },
];

export function ExploreContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [searchResults, setSearchResults] = useState<SuggestedUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<PlayerPosition[]>([]);

  // Get user profile for activeGroupId
  const userRef = user ? doc(db, 'users', user.uid) : null;
  const { data: userProfile } = useDoc<UserProfile>(userRef);

  // Get ALL user's upcoming matches (owned OR participating) that have open spots
  const matchesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'matches'),
      where('playerUids', 'array-contains', user.uid),
      where('status', '==', 'upcoming')
    );
  }, [firestore, user]);
  const { data: allUserMatches } = useCollection<Match>(matchesQuery);

  // Matches with open spots (for the banner and invitation)
  const incompleteMatches = useMemo(() => {
    if (!allUserMatches) return [];
    return allUserMatches.filter(m => (m.players?.length || 0) < m.matchSize);
  }, [allUserMatches]);

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
  }, [user, userProfile?.activeGroupId]);

  const loadSuggestions = async () => {
    if (!user) return;

    setIsLoading(true);
    const result = await getSuggestedUsersAction(user.uid, userProfile?.activeGroupId || undefined);
    if (result.success && result.users) {
      setSuggestedUsers(result.users);
    }
    setIsLoading(false);
  };

  // Search with debounce
  const performSearch = useCallback(async (q: string, positions: PlayerPosition[]) => {
    if (!user) return;

    if (!q.trim() && positions.length === 0) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    const filters: PlayerSearchFilters = {};
    if (positions.length > 0) filters.positions = positions;

    const result = await searchPlayersAction(q, filters, user.uid);
    if (result.success && result.users) {
      setSearchResults(result.users);
    }
    setIsSearching(false);
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery, selectedPositions);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedPositions, performSearch]);

  const togglePosition = (pos: PlayerPosition) => {
    setSelectedPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedPositions([]);
    setSearchResults(null);
  };

  const isFilterActive = searchQuery.trim().length > 0 || selectedPositions.length > 0;

  const groupUsers = suggestedUsers.filter((u) => u.reason === 'same_group');
  const popularUsers = suggestedUsers.filter((u) => u.reason === 'most_followed');
  const activeUsers = suggestedUsers.filter((u) => u.reason === 'recently_active');

  if (!user) {
    return (
      <div className="border border-border rounded-lg p-10 text-center">
        <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          Iniciá sesión para buscar jugadores
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner: Incomplete matches — the core context for why you're searching */}
      {incompleteMatches.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm mb-1">
                {incompleteMatches.length === 1
                  ? 'Te falta completar un partido'
                  : `Tenés ${incompleteMatches.length} partidos incompletos`
                }
              </p>
              <div className="space-y-1">
                {incompleteMatches.slice(0, 3).map(match => {
                  const spotsLeft = match.matchSize - (match.players?.length || 0);
                  return (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="truncate">{match.title || 'Partido'}</span>
                      <span className="shrink-0 ml-2 font-medium text-primary">
                        {spotsLeft} lugar{spotsLeft !== 1 ? 'es' : ''} libre{spotsLeft !== 1 ? 's' : ''}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Buscá jugadores abajo e invitalos directamente
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar jugador por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {isFilterActive && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Position filter pills */}
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map(pos => (
            <Button
              key={pos.value}
              variant={selectedPositions.includes(pos.value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => togglePosition(pos.value)}
              className={cn(
                'h-7 text-xs rounded-full transition-all',
                selectedPositions.includes(pos.value) && 'shadow-sm'
              )}
            >
              {pos.value}
            </Button>
          ))}
        </div>
      </div>

      {/* Search results or suggestions */}
      {isFilterActive ? (
        <div>
          {isSearching ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((suggestedUser) => (
                <UserSuggestionCard
                  key={suggestedUser.uid}
                  user={suggestedUser}
                  currentUserId={user?.uid}
                  onFollow={loadSuggestions}
                  userMatches={incompleteMatches}
                />
              ))}
            </div>
          ) : searchResults ? (
            <div className="border border-border rounded-lg p-10 text-center">
              <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-1">
                Sin resultados
              </p>
              <p className="text-sm text-muted-foreground">
                Probá con otro nombre o ajustá los filtros
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2].map((section) => (
                <div key={section} className="space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-9 w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : suggestedUsers.length === 0 ? (
            <div className="border border-border rounded-lg p-10 text-center">
              <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-1">
                No hay sugerencias disponibles
              </p>
              <p className="text-sm text-muted-foreground">
                Unite a un grupo o jugá más partidos para obtener recomendaciones
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupUsers.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-blue-500" />
                    <h2 className="font-semibold text-sm">De tu grupo</h2>
                  </div>
                  <div className="space-y-2">
                    {groupUsers.map((suggestedUser) => (
                      <UserSuggestionCard
                        key={suggestedUser.uid}
                        user={suggestedUser}
                        currentUserId={user?.uid}
                        onFollow={loadSuggestions}
                        userMatches={incompleteMatches}
                      />
                    ))}
                  </div>
                </section>
              )}

              {popularUsers.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="h-5 w-5 text-amber-500" />
                    <h2 className="font-semibold text-sm">Populares</h2>
                  </div>
                  <div className="space-y-2">
                    {popularUsers.map((suggestedUser) => (
                      <UserSuggestionCard
                        key={suggestedUser.uid}
                        user={suggestedUser}
                        currentUserId={user?.uid}
                        onFollow={loadSuggestions}
                        userMatches={incompleteMatches}
                      />
                    ))}
                  </div>
                </section>
              )}

              {activeUsers.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-green-500" />
                    <h2 className="font-semibold text-sm">Activos recientemente</h2>
                  </div>
                  <div className="space-y-2">
                    {activeUsers.map((suggestedUser) => (
                      <UserSuggestionCard
                        key={suggestedUser.uid}
                        user={suggestedUser}
                        currentUserId={user?.uid}
                        onFollow={loadSuggestions}
                        userMatches={incompleteMatches}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ExploreContent;
