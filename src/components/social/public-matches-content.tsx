'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Loader2, Trophy, Users, MapPin } from 'lucide-react';
import { useUser } from '@/firebase';
import { getPublicMatchesAction, type PublicMatchFilters } from '@/lib/actions/explore-actions';
import type { Match, MatchType } from '@/lib/types';
import { CompactMatchCard } from '@/components/compact-match-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MATCH_TYPE_FILTERS: { value: MatchType; label: string }[] = [
    { value: 'manual', label: 'Amistoso' },
    { value: 'collaborative', label: 'Colaborativo' },
    { value: 'by_teams', label: 'Por Equipos' },
];

export function PublicMatchesContent() {
    const { user } = useUser();
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTypes, setSelectedTypes] = useState<MatchType[]>([]);

    useEffect(() => {
        if (user) {
            loadMatches();
        }
    }, [user]);

    const loadMatches = async () => {
        if (!user) return;
        setIsLoading(true);
        const result = await getPublicMatchesAction(user.uid);
        if (result.success && result.matches) {
            setMatches(result.matches);
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

    // Apply client-side type filter
    const filteredMatches = useMemo(() => {
        if (selectedTypes.length === 0) return matches;
        return matches.filter(m => selectedTypes.includes(m.type));
    }, [matches, selectedTypes]);

    if (!user) {
        return (
            <div className="border border-border rounded-lg p-10 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                    Iniciá sesión para ver partidos disponibles
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Type filter pills */}
            <div className="flex flex-wrap gap-2">
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

            {/* Loading */}
            {isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-32 rounded-lg" />
                    ))}
                </div>
            )}

            {/* Results */}
            {!isLoading && filteredMatches.length > 0 && (
                <div>
                    <p className="text-sm text-muted-foreground mb-3">
                        {filteredMatches.length} partido{filteredMatches.length !== 1 ? 's' : ''} disponible{filteredMatches.length !== 1 ? 's' : ''}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {filteredMatches.map((match) => (
                            <CompactMatchCard key={match.id} match={match} />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && filteredMatches.length === 0 && (
                <div className="border border-border rounded-lg p-10 text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-1">
                        No hay partidos públicos disponibles
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {matches.length > 0
                            ? 'Probá quitando los filtros para ver más opciones'
                            : 'Creá un partido público para que otros se unan'}
                    </p>
                </div>
            )}
        </div>
    );
}

export default PublicMatchesContent;
