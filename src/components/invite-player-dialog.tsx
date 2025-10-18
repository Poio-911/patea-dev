
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
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, arrayUnion, writeBatch, collection } from 'firebase/firestore';
import type { AvailablePlayer, Match, Notification } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';

type InvitePlayerDialogProps = {
  playerToInvite: AvailablePlayer;
  userMatches: Match[];
  children: React.ReactNode;
};

export function InvitePlayerDialog({
  playerToInvite,
  userMatches,
  children,
}: InvitePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleInvite = () => {
    if (!firestore || !user || !selectedMatchId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un partido para invitar.' });
        return;
    }

    startTransition(async () => {
      const batch = writeBatch(firestore);
      const matchRef = doc(firestore, 'matches', selectedMatchId);
      const selectedMatch = userMatches.find(m => m.id === selectedMatchId);

      if (!selectedMatch) {
          toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el partido seleccionado.' });
          return;
      }

      // Check if player is already in the match
      if (selectedMatch.playerUids.includes(playerToInvite.uid)) {
          toast({ variant: 'default', title: 'Jugador ya en el partido', description: `${playerToInvite.displayName} ya está en la lista.` });
          setOpen(false);
          return;
      }

      // Payload to add to the match's player array
      const playerPayload = {
        uid: playerToInvite.uid,
        displayName: playerToInvite.displayName,
        ovr: playerToInvite.ovr,
        position: playerToInvite.position,
        photoUrl: playerToInvite.photoUrl || ''
      };

      batch.update(matchRef, {
        players: arrayUnion(playerPayload),
        playerUids: arrayUnion(playerToInvite.uid),
      });

      // Notification for the invited player
      const notificationRef = doc(collection(firestore, `users/${playerToInvite.uid}/notifications`));
      const notification: Omit<Notification, 'id'> = {
        type: 'match_invite',
        title: '¡Te han invitado a un partido!',
        message: `${user.displayName} te invita a unirte a "${selectedMatch.title}".`,
        link: `/matches`,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      batch.set(notificationRef, notification);

      try {
        await batch.commit();
        toast({
          title: '¡Invitación Enviada!',
          description: `${playerToInvite.displayName} ha sido invitado a "${selectedMatch.title}".`,
        });
        setSelectedMatchId(null);
        setOpen(false);
      } catch (error) {
        console.error('Error inviting player: ', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo enviar la invitación.',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Invitar a {playerToInvite.displayName}</DialogTitle>
          <DialogDescription>
            Selecciona uno de tus partidos incompletos para enviarle una invitación.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow py-4">
          {userMatches.length > 0 ? (
            <div className="space-y-2">
                <Label htmlFor='match-select'>Tus Partidos Incompletos</Label>
                 <Select onValueChange={setSelectedMatchId}>
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
            </div>
          ) : (
            <Alert>
                <AlertDescription>No tienes partidos manuales o privados que necesiten jugadores. Crea uno para poder invitar.</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleInvite} disabled={isPending || !selectedMatchId}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Enviar Invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
