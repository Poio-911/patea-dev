
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
import { useState, useTransition } from 'react';
import type { AvailablePlayer, Match } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Send, UserSearch } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { findBestFitPlayerAction } from '@/lib/actions';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { InvitePlayerDialog } from './invite-player-dialog';

type FindBestFitDialogProps = {
  userMatches: Match[];
  availablePlayers: AvailablePlayer[];
};

export function FindBestFitDialog({
  userMatches,
  availablePlayers,
}: FindBestFitDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [recommendedPlayer, setRecommendedPlayer] = useState<AvailablePlayer | null>(null);
  const [recommendationReason, setRecommendationReason] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleFindPlayer = () => {
    if (!selectedMatchId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un partido para buscar.' });
      return;
    }
    const selectedMatch = userMatches.find(m => m.id === selectedMatchId);
    if (!selectedMatch) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el partido seleccionado.' });
      return;
    }

    startTransition(async () => {
      setRecommendedPlayer(null);
      setRecommendationReason('');
      
      const simpleAvailablePlayers = availablePlayers.map(p => ({
          uid: p.uid,
          displayName: p.displayName,
          ovr: p.ovr,
          position: p.position,
      }))
      
      const result = await findBestFitPlayerAction({ match: selectedMatch, availablePlayers: simpleAvailablePlayers });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Error de la IA', description: result.error });
      } else if (result.playerId && result.reason) {
        const foundPlayer = availablePlayers.find(p => p.uid === result.playerId);
        if (foundPlayer) {
          setRecommendedPlayer(foundPlayer);
          setRecommendationReason(result.reason);
          toast({ title: '¡Fichaje recomendado!', description: `La IA ha encontrado a ${foundPlayer.displayName}.` });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'La IA recomendó un jugador que ya no está disponible.' });
        }
      }
    });
  };

  const selectedMatch = userMatches.find(m => m.id === selectedMatchId);

  return (
    <Dialog open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
            setRecommendedPlayer(null);
            setRecommendationReason('');
            setSelectedMatchId(null);
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
            Encontrar Fichaje Ideal (IA)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Asistente de Fichajes IA</DialogTitle>
          <DialogDescription>
            Selecciona uno de tus partidos incompletos y la IA te recomendará al mejor jugador disponible para equilibrar el equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow py-4 space-y-4">
          {userMatches.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor='match-select'>Tus Partidos Incompletos</Label>
              <div className="flex gap-2">
                <Select onValueChange={setSelectedMatchId} value={selectedMatchId || ''}>
                  <SelectTrigger id="match-select">
                    <SelectValue placeholder="Elige un partido..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userMatches.map(match => (
                      <SelectItem key={match.id} value={match.id}>
                        {match.title} ({match.players.length}/{match.matchSize})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleFindPlayer} disabled={isPending || !selectedMatchId}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertDescription>No tienes partidos que necesiten jugadores. Crea uno para poder usar el asistente.</AlertDescription>
            </Alert>
          )}

          <div className="pt-4">
            {isPending && (
                 <div className="flex flex-col items-center justify-center h-40 gap-4 text-center border-2 border-dashed rounded-lg">
                    <Sparkles className="h-10 w-10 text-amber-500 animate-pulse" />
                    <p className="font-semibold">La IA está analizando el mercado...</p>
                    <p className="text-sm text-muted-foreground">Buscando el mejor jugador para tu partido.</p>
                </div>
            )}
            {recommendedPlayer && recommendationReason && (
                <Card className="bg-gradient-to-br from-primary/10 to-transparent">
                    <CardContent className="p-4 space-y-3">
                         <p className="text-sm text-center italic text-foreground/80 border-l-4 border-primary pl-3">&ldquo;{recommendationReason}&rdquo;</p>
                         <div className="flex gap-3 items-center pt-2">
                            <Avatar className="h-16 w-16 border-2 border-primary">
                                <AvatarImage src={recommendedPlayer.photoUrl} alt={recommendedPlayer.displayName} />
                                <AvatarFallback>{recommendedPlayer.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg">{recommendedPlayer.displayName}</h3>
                                <div className='flex gap-2 mt-1'>
                                    <Badge>{recommendedPlayer.ovr}</Badge>
                                    <Badge variant="outline">{recommendedPlayer.position}</Badge>
                                </div>
                            </div>
                            <InvitePlayerDialog 
                                playerToInvite={recommendedPlayer}
                                userMatches={selectedMatch ? [selectedMatch] : []}
                            >
                                <Button>
                                    <Send className="mr-2 h-4 w-4" />
                                    Invitar
                                </Button>
                            </InvitePlayerDialog>
                        </div>
                    </CardContent>
                </Card>
            )}
            {!isPending && !recommendedPlayer && selectedMatchId && (
                 <div className="flex flex-col items-center justify-center h-40 gap-4 text-center border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">Presiona el botón de búsqueda para encontrar una recomendación.</p>
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
