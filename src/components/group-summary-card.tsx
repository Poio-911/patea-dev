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

  // Auto-load on mount if no summary exists
  useEffect(() => {
    if (!summary && !loading && !error) {
      loadSummary();
    }
  }, [groupId]);

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Resumen IA
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={loadSummary}
            disabled={loading}
            title="Regenerar resumen"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : summary ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Hacé clic en el botón para generar un resumen del grupo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
