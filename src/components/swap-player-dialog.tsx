
'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Loader2, Shuffle } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import type { Match, Team } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SwapPlayerDialogProps {
  match: Match;
  playerToSwap: Team['players'][0];
  children: React.ReactNode;
}

export function SwapPlayerDialog({ match, playerToSwap, children }: SwapPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSwap = async () => {
    if (!firestore || !selectedPlayerId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar un jugador para el intercambio.' });
      return;
    }
    setIsSwapping(true);
    
    try {
      const matchRef = doc(firestore, 'matches', match.id);
      
      const newTeams: Team[] = JSON.parse(JSON.stringify(match.teams));
      
      let sourceTeamIndex = -1, sourcePlayerIndex = -1;
      let targetTeamIndex = -1, targetPlayerIndex = -1;

      newTeams.forEach((team, teamIdx) => {
        let pIdx = team.players.findIndex(p => p.uid === playerToSwap.uid);
        if (pIdx !== -1) {
          sourceTeamIndex = teamIdx;
          sourcePlayerIndex = pIdx;
        }
        pIdx = team.players.findIndex(p => p.uid === selectedPlayerId);
        if (pIdx !== -1) {
          targetTeamIndex = teamIdx;
          targetPlayerIndex = pIdx;
        }
      });
      
      if (sourceTeamIndex === -1 || targetTeamIndex === -1) {
          throw new Error("No se pudo encontrar a uno de los jugadores en los equipos.");
      }

      const temp = newTeams[sourceTeamIndex].players[sourcePlayerIndex];
      newTeams[sourceTeamIndex].players[sourcePlayerIndex] = newTeams[targetTeamIndex].players[targetPlayerIndex];
      newTeams[targetTeamIndex].players[targetPlayerIndex] = temp;
      
      newTeams.forEach(team => {
        const totalOVR = team.players.reduce((sum, p) => sum + p.ovr, 0);
        team.averageOVR = team.players.length > 0 ? totalOVR / team.players.length : 0;
      });

      await updateDoc(matchRef, { teams: newTeams });
      
      toast({ title: '¡Intercambio realizado!', description: 'Los equipos han sido actualizados.' });
      setOpen(false);

    } catch (error: any) {
      console.error("Error swapping players:", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo realizar el intercambio.' });
    } finally {
      setIsSwapping(false);
      setSelectedPlayerId(null);
    }
  };
  
  const eligiblePlayers = match.teams?.flatMap(team => team.players).filter(p => p.uid !== playerToSwap.uid) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Intercambiar a {playerToSwap.displayName}</DialogTitle>
          <DialogDescription>
            Seleccioná un jugador para hacer el cambio.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-2">
              {eligiblePlayers.map(player => {
                const isSelected = selectedPlayerId === player.uid;
                return (
                  <div
                    key={player.uid}
                    onClick={() => setSelectedPlayerId(player.uid)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
                      isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoUrl} alt={player.displayName} />
                      <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{player.displayName}</p>
                      <p className="text-xs text-muted-foreground">OVR: {player.ovr} - {match.teams?.find(t => t.players.some(p => p.uid === player.uid))?.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSwap} disabled={!selectedPlayerId || isSwapping}>
            {isSwapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
            Confirmar Intercambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
