'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Match, Player } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';

type InvitePlayerDialogProps = {
  match: Match;
  availablePlayers: Player[];
  disabled?: boolean;
  children: React.ReactNode;
};

export function InvitePlayerDialog({
  match,
  availablePlayers,
  disabled,
  children,
}: InvitePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();

  const spotsAvailable = match.matchSize - match.players.length;

  const handlePlayerSelect = (player: Player, checked: boolean) => {
    const newSelection = checked
      ? [...selectedPlayers, player]
      : selectedPlayers.filter((p) => p.id !== player.id);
      
    if (newSelection.length > spotsAvailable) {
        toast({
            variant: 'destructive',
            title: 'Límite de invitaciones',
            description: `Solo puedes invitar a ${spotsAvailable} jugador(es) más.`
        });
        return;
    }

    setSelectedPlayers(newSelection);
  };

  const handleInvite = () => {
    if (!firestore) return;
    if (selectedPlayers.length === 0) {
      toast({ variant: 'destructive', title: 'Ningún jugador seleccionado' });
      return;
    }

    startTransition(async () => {
      const matchRef = doc(firestore, 'matches', match.id);
      const playersToInvite = selectedPlayers.map(p => ({
        uid: p.id,
        displayName: p.name,
        ovr: p.ovr,
        position: p.position,
        photoUrl: p.photoUrl || ''
      }));

      try {
        await updateDoc(matchRef, {
          players: arrayUnion(...playersToInvite),
        });
        toast({
          title: 'Jugadores invitados',
          description: `${selectedPlayers.length} jugador(es) han sido añadidos al partido.`,
        });
        setSelectedPlayers([]);
        setOpen(false);
      } catch (error) {
        console.error('Error inviting players: ', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo invitar a los jugadores.',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Invitar Jugadores a "{match.title}"</DialogTitle>
          <DialogDescription>
            Selecciona jugadores de tu grupo para añadir al partido. Quedan {spotsAvailable} plazas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto -mx-6 px-6 py-4 border-y">
          {availablePlayers.length > 0 ? (
            <div className="space-y-2">
              {availablePlayers.map((player) => (
                <div key={player.id} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 has-[:checked]:bg-accent">
                    <Checkbox
                        id={`invite-${player.id}`}
                        onCheckedChange={(checked) => handlePlayerSelect(player, !!checked)}
                        checked={selectedPlayers.some(p => p.id === player.id)}
                    />
                     <Avatar className="h-9 w-9">
                        <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                     <Label htmlFor={`invite-${player.id}`} className="flex-1 cursor-pointer">
                        <span className="font-semibold">{player.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{player.position} - OVR: {player.ovr}</span>
                    </Label>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
                <AlertDescription>No hay más jugadores disponibles para invitar en este grupo.</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleInvite} disabled={isPending || selectedPlayers.length === 0}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Invitar ({selectedPlayers.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
