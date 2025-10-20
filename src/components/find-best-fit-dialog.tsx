

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useTransition, useEffect } from 'react';
import type { AvailablePlayer, Match } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Send, UserSearch } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { findBestFitPlayerAction } from '@/lib/actions';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { InvitePlayerDialog } from './invite-player-dialog';
import { ScrollArea } from './ui/scroll-area';

type RecommendedPlayer = AvailablePlayer & { reason: string };

type FindBestFitDialogProps = {
  userMatches: Match[];
  availablePlayers: AvailablePlayer[];
  selectedMatchId: string | null;
};

export function FindBestFitDialog({
  userMatches,
  availablePlayers,
  selectedMatchId,
}: FindBestFitDialogProps) {
  const [open, setOpen] = useState(false);
  const [recommendedPlayers, setRecommendedPlayers] = useState<RecommendedPlayer[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    // If the dialog is open and the selectedMatchId changes (from outside),
    // trigger the search automatically.
    if (open && selectedMatchId) {
        handleFindPlayer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatchId, open]);

  const handleFindPlayer = () => {
    if (!selectedMatchId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Primero seleccioná un partido en la página principal.' });
      return;
    }
    const selectedMatch = userMatches.find(m => m.id === selectedMatchId);
    if (!selectedMatch) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el partido seleccionado.' });
      return;
    }

    startTransition(async () => {
      setRecommendedPlayers([]);
      
      const simpleAvailablePlayers = availablePlayers.map(p => ({
          uid: p.uid,
          displayName: p.displayName,
          ovr: p.ovr,
          position: p.position,
      }))
      
      const result = await findBestFitPlayerAction({ match: selectedMatch, availablePlayers: simpleAvailablePlayers });

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error del Asistente', description: result.error });
      } else if (result.recommendations && result.recommendations.length > 0) {
        const foundPlayers: RecommendedPlayer[] = result.recommendations.map(rec => {
            const playerDetails = availablePlayers.find(p => p.uid === rec.playerId);
            return playerDetails ? { ...playerDetails, reason: rec.reason } : null;
        }).filter((p): p is RecommendedPlayer => p !== null);

        if (foundPlayers.length > 0) {
            setRecommendedPlayers(foundPlayers);
            toast({ title: '¡Fichajes recomendados!', description: `Encontramos ${foundPlayers.length} jugador(es) para tu equipo.` });
        } else {
             toast({ variant: 'destructive', title: 'Error', description: 'El asistente recomendó jugadores que ya no están disponibles.' });
        }
      } else {
         toast({ title: 'Sin suerte esta vez', description: 'No se encontraron jugadores adecuados entre los disponibles.' });
      }
    });
  };

  const selectedMatch = userMatches.find(m => m.id === selectedMatchId);

  return (
    <Dialog open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
            setRecommendedPlayers([]);
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto" disabled={!selectedMatchId}>
            <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
            Asistente de Fichajes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Asistente de Fichajes para "{selectedMatch?.title}"</DialogTitle>
          <DialogDescription>
            La IA está analizando a los jugadores disponibles para recomendarte los mejores fichajes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow py-4 space-y-4 overflow-y-hidden">
          <div className="pt-4 flex-grow overflow-y-hidden">
            <ScrollArea className="h-full max-h-96">
                <div className="space-y-4 pr-4">
                    {isPending && (
                        <div className="flex flex-col items-center justify-center h-40 gap-4 text-center border-2 border-dashed rounded-lg">
                            <Sparkles className="h-10 w-10 text-amber-500 animate-pulse" />
                            <p className="font-semibold">Revisando la lista de jugadores libres...</p>
                            <p className="text-sm text-muted-foreground">Encontrando a los mejores jugadores para tu partido.</p>
                        </div>
                    )}
                    {recommendedPlayers.length > 0 && recommendedPlayers.map(player => (
                        <Card key={player.uid} className="bg-gradient-to-br from-primary/10 to-transparent">
                            <CardContent className="p-4 space-y-3">
                                <p className="text-sm text-center italic text-foreground/80 border-l-4 border-primary pl-3">&ldquo;{player.reason}&rdquo;</p>
                                <div className="flex gap-3 items-center pt-2">
                                    <Avatar className="h-16 w-16 border-2 border-primary">
                                        <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                        <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg">{player.displayName}</h3>
                                        <div className='flex gap-2 mt-1'>
                                            <Badge>{player.ovr}</Badge>
                                            <Badge variant="outline">{player.position}</Badge>
                                        </div>
                                    </div>
                                    <InvitePlayerDialog 
                                        playerToInvite={player}
                                        userMatches={selectedMatch ? [selectedMatch] : []}
                                        match={selectedMatch}
                                        disabled={!selectedMatch}
                                    >
                                        <Button>
                                            <Send className="mr-2 h-4 w-4" />
                                            Invitar
                                        </Button>
                                    </InvitePlayerDialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {!isPending && recommendedPlayers.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 gap-4 text-center border-2 border-dashed rounded-lg">
                           <Button onClick={handleFindPlayer} disabled={isPending || !selectedMatchId}>
                                <UserSearch className="mr-2 h-4 w-4" />
                                {isPending ? "Buscando..." : "Buscar Fichajes Ahora"}
                            </Button>
                            <p className="text-sm text-muted-foreground mt-2">Pulsa el botón para recibir una recomendación.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
