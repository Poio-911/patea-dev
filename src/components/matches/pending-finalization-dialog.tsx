'use client';

import { useState } from 'react';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Loader2, CheckCircle, Eye, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Match } from '@/lib/types';

interface PendingFinalizationDialogProps {
  matches: Match[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalizeAll: () => Promise<void>;
}

export function PendingFinalizationDialog({
  matches,
  open,
  onOpenChange,
  onFinalizeAll,
}: PendingFinalizationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFinalizeAll = async () => {
    setIsLoading(true);
    try {
      await onFinalizeAll();
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (matches.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Tenés partidos sin finalizar
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {matches.length === 1
              ? 'Tenés un partido que ya pasó y no fue finalizado.'
              : `Tenés ${matches.length} partidos que ya pasaron y no fueron finalizados.`}
            {' '}Podés finalizarlos ahora o ver los detalles de cada uno.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] pr-4">
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{match.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(match.date), "d 'de' MMM", { locale: es })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {match.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{match.location?.name || match.location?.address}</span>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="ml-2 shrink-0">
                  <Link href={`/matches/${match.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Después
          </Button>
          <Button
            onClick={handleFinalizeAll}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Finalizar {matches.length === 1 ? 'Partido' : `${matches.length} Partidos`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
