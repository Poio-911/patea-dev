'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { generateGroupSummaryAction } from '@/lib/actions/ai-actions';
import { cn } from '@/lib/utils';

interface GroupSummaryCardProps {
  groupId: string;
  className?: string;
}

export function GroupSummaryCard({ groupId, className }: GroupSummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    if (!groupId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await generateGroupSummaryAction(groupId);
      if (result.error) {
        setError(result.error);
      } else {
        setSummary(result.summary || null);
      }
    } catch (err) {
      setError('Error al generar el resumen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn('relative overflow-hidden bg-card hover:bg-card text-card-foreground border-border shadow-sm transition-all hover:border-primary/40 group', className)}>
      {/* Animated Gradient Border Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-headline text-lg uppercase tracking-wide text-primary">
            <Sparkles className="h-5 w-5 animate-pulse" />
            Resumen IA
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:text-primary hover:bg-muted"
            onClick={loadSummary}
            disabled={loading}
            title="Regenerar resumen"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-4/5 bg-muted" />
            <Skeleton className="h-4 w-3/4 bg-muted" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : summary ? (
          <p className="text-sm text-muted-foreground leading-relaxed font-medium">
            {summary}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground italic">
              Descubrí qué dice la IA sobre el rendimiento de tu grupo.
            </p>
            <Button size="sm" onClick={loadSummary} variant="outline" className="border-primary/30 hover:bg-primary/5 hover:text-primary">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Generar Resumen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
