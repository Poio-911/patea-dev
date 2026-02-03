'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, RefreshCw, AlertCircle, Lightbulb } from 'lucide-react';
import { getPlayerImprovementSuggestionsAction } from '@/lib/actions/server-actions';
import { cn } from '@/lib/utils';

interface PlayerSuggestionsCardProps {
  playerId: string;
  groupId: string;
  className?: string;
}

export function PlayerSuggestionsCard({ playerId, groupId, className }: PlayerSuggestionsCardProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadSuggestions = async () => {
    if (!playerId || !groupId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getPlayerImprovementSuggestionsAction(playerId, groupId);
      if ('error' in result && result.error) {
        setError(result.error);
      } else if ('suggestions' in result) {
        setSuggestions(result.suggestions || []);
      }
    } catch (err) {
      setError('Error al obtener sugerencias');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };



  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/10 pointer-events-none" />

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-500" />
            Consejos del DT
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={loadSuggestions}
            disabled={loading}
            title="Actualizar consejos"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 mt-0.5 shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 mt-0.5 shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 mt-0.5 shrink-0" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : suggestions.length > 0 ? (
          <ul className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                <span className="text-muted-foreground">{suggestion}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Hacé clic en el botón para recibir los consejos personalizados del DT.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
