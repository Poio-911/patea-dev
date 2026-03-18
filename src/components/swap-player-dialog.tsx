
'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { successConfetti } from '@/lib/animations';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from './ui/button';
import { Loader2, Shuffle } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import type { Match, Team } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlayerPositionBadge } from '@/components/player-styles';
import { isErrorResponse } from '@/lib/errors';
import { updateMatchTeamsAction } from '@/lib/actions/match-actions';

interface SwapPlayerDialogProps {
  match: Match;
  playerToSwap: Team['players'][0];
  children: React.ReactNode;
}

export function SwapPlayerDialog({ match, playerToSwap, children }: SwapPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const { toast } = useToast();

  const handleSwap = async () => {
    if (!selectedPlayerId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar un jugador para el intercambio.' });
      return;
    }
    setIsSwapping(true);

    try {
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

      const result = await updateMatchTeamsAction(match.id, newTeams);
      if (isErrorResponse(result) || !result.success) {
        throw new Error(result.error || 'No se pudo realizar el intercambio.');
      }

      successConfetti();
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

  const { eligiblePlayers } = useMemo(() => {
    if (!match.teams || match.teams.length < 2) {
      return { eligiblePlayers: [] };
    }

    const sourceTeam = match.teams.find(team => team.players.some(p => p.uid === playerToSwap.uid));
    if (!sourceTeam) {
      return { eligiblePlayers: [] };
    }

    // Filter to get players from the *other* team(s)
    const eligible = match.teams
      .filter(team => team.name !== sourceTeam.name)
      .flatMap(team => team.players);

    return { eligiblePlayers: eligible };
  }, [match.teams, playerToSwap.uid]);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Intercambiar a {playerToSwap.displayName || (playerToSwap as any).name || 'Jugador'}</DialogTitle>
          <DialogDescription>
            Seleccioná un jugador del equipo contrario para hacer el cambio.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="h-64 overflow-y-auto pr-4" data-vaul-no-drag>
            <div className="space-y-2">
              {eligiblePlayers.map(player => {
                const isSelected = selectedPlayerId === player.uid;
                const pName = player.displayName || (player as any).name || 'Jugador';
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
                      <AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoURL} alt={pName} />
                      <AvatarFallback>{pName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{pName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <PlayerPositionBadge position={player.position as import('@/lib/types').PlayerPosition} showIcon={false} size="sm" />
                        <span>OVR {player.ovr}</span>
                        <span>— {match.teams?.find(t => t.players.some(p => p.uid === player.uid))?.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
