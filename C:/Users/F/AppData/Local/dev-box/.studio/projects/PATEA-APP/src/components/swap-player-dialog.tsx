'use client';

import { useState, useMemo } from 'react';
import type { Match, Player } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Loader2, Replace } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';

interface SwapPlayerDialogProps {
  match: Match;
  playerToSwap: { uid: string; displayName: string; ovr: number; position: Player['position'] };
  allPlayers: Match['players'];
  children: React.ReactNode;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

export function SwapPlayerDialog({ match, playerToSwap, allPlayers, children }: SwapPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const { sourceTeam, sourceTeamIndex, otherPlayers } = useMemo(() => {
    if (!match.teams || match.teams.length === 0) {
      return { sourceTeam: null, sourceTeamIndex: -1, otherPlayers: [] };
    }

    const sourceTeamIndex = match.teams.findIndex(t => t.players.some(p => p.uid === playerToSwap.uid));
    const sourceTeam = sourceTeamIndex !== -1 ? match.teams[sourceTeamIndex] : null;

    const allPlayerUidsInTeams = new Set(match.teams.flatMap(t => t.players.map(p => p.uid)));
    const benchPlayers = allPlayers.filter(p => !allPlayerUidsInTeams.has(p.uid));
    
    const opponentTeamPlayers = match.teams[1 - sourceTeamIndex]?.players || [];

    return {
      sourceTeam,
      sourceTeamIndex,
      otherPlayers: [...opponentTeamPlayers, ...benchPlayers],
    };
  }, [match, playerToSwap, allPlayers]);

  const handleSwap = async (playerToSwapWith: { uid: string; displayName: string; ovr: number; position: Player['position'] }) => {
    if (!firestore || !sourceTeam || sourceTeamIndex === -1) return;
    setIsSwapping(true);

    const newTeams = JSON.parse(JSON.stringify(match.teams));
    
    // Find where playerToSwapWith is
    const targetTeamIndex = newTeams.findIndex((t: any) => t.players.some((p: any) => p.uid === playerToSwapWith.uid));

    // Remove playerToSwap from source team
    const player1Index = newTeams[sourceTeamIndex].players.findIndex((p: any) => p.uid === playerToSwap.uid);
    const [player1] = newTeams[sourceTeamIndex].players.splice(player1Index, 1);
    
    if (targetTeamIndex !== -1) { // Swapping with another player in a team
        const player2Index = newTeams[targetTeamIndex].players.findIndex((p: any) => p.uid === playerToSwapWith.uid);
        const [player2] = newTeams[targetTeamIndex].players.splice(player2Index, 1);
        
        newTeams[sourceTeamIndex].players.push(player2);
        newTeams[targetTeamIndex].players.push(player1);
    } else { // Swapping with a player from the bench
        newTeams[sourceTeamIndex].players.push(playerToSwapWith);
    }

    // Recalculate OVRs
    newTeams.forEach((team: any) => {
        team.averageOVR = team.players.reduce((sum: number, p: any) => sum + p.ovr, 0) / team.players.length;
    });

    try {
      const matchRef = doc(firestore, 'matches', match.id);
      await updateDoc(matchRef, { teams: newTeams });
      toast({ title: "Intercambio realizado", description: `${playerToSwap.displayName} fue intercambiado con ${playerToSwapWith.displayName}.` });
      setOpen(false);
    } catch (error) {
      console.error("Error swapping players:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar el intercambio.' });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Intercambiar Jugador</DialogTitle>
          <DialogDescription>
            Seleccioná un jugador para intercambiarlo con <span className="font-bold">{playerToSwap.displayName}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-72">
            <div className="space-y-2 pr-4">
              {otherPlayers.map(player => (
                <div key={player.uid} className="flex items-center gap-3 p-2 rounded-md border">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={(player as any).photoUrl} alt={player.displayName} />
                    <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{player.displayName}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-xs", positionBadgeStyles[player.position])}>{player.position}</Badge>
                    <Badge variant="secondary" className="text-xs">{player.ovr}</Badge>
                  </div>
                  <Button size="sm" onClick={() => handleSwap(player)} disabled={isSwapping}>
                    {isSwapping ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Elegir'}
                  </Button>
                </div>
              ))}
              {otherPlayers.length === 0 && (
                <p className="text-center text-muted-foreground pt-10">No hay jugadores disponibles para intercambiar.</p>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
