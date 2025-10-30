
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from './ui/card';

interface SwapPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerToSwap: Player | null;
  swapTargets: Player[];
  onConfirmSwap: (targetPlayerId: string) => void;
  isSubmitting: boolean;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};


export function SwapPlayerDialog({
  open,
  onOpenChange,
  playerToSwap,
  swapTargets,
  onConfirmSwap,
  isSubmitting,
}: SwapPlayerDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  if (!playerToSwap) return null;

  const handleConfirm = () => {
    if (selectedTargetId) {
      onConfirmSwap(selectedTargetId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar Jugador</DialogTitle>
          <DialogDescription>
            Seleccioná un jugador para intercambiar con {playerToSwap.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="mb-2 text-sm font-semibold">Cambiar a:</p>
          <Card className="p-3 bg-muted/50">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={playerToSwap.photoUrl} alt={playerToSwap.name} />
                <AvatarFallback>{playerToSwap.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-bold">{playerToSwap.name.toUpperCase()}</span>
              <Badge variant="secondary">{playerToSwap.ovr}</Badge>
            </div>
          </Card>
          <div className="flex justify-center my-4">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-2 text-sm font-semibold">Por:</p>
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-2">
              {swapTargets.map(target => (
                <Card
                  key={target.id}
                  onClick={() => setSelectedTargetId(target.id)}
                  className={cn(
                    'p-3 cursor-pointer hover:bg-accent transition-all border-2',
                    selectedTargetId === target.id ? 'border-primary ring-2 ring-primary/50' : 'border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={target.photoUrl} alt={target.name} />
                      <AvatarFallback>{target.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold flex-1">{target.name.toUpperCase()}</span>
                    <Badge variant="outline" className={cn(positionBadgeStyles[target.position])}>
                        {target.position}
                    </Badge>
                    <Badge variant="secondary">{target.ovr}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedTargetId || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
