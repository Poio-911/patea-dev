
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
import { useState, useTransition, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, arrayUnion, writeBatch, collection, getDoc, setDoc } from 'firebase/firestore';
import type { AvailablePlayer, Match, Player, Invitation, Notification } from '@/lib/types';
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
  playerToInvite: AvailablePlayer | null;
  userMatches: Match[];
  children: React.ReactNode;
  match?: Match | null; // Match is pre-selected
  disabled?: boolean;
};

export function InvitePlayerDialog({
  playerToInvite,
  userMatches,
  children,
  match, // Use the pre-selected match
  disabled,
}: InvitePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(match?.id || null);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const finalSelectedMatchId = match?.id || selectedMatchId;

  const handleInvite = () => {
    if (!firestore || !user || !finalSelectedMatchId || !playerToInvite) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un partido para invitar.' });
        return;
    }

    startTransition(async () => {
      const batch = writeBatch(firestore);
      const matchRef = doc(firestore, 'matches', finalSelectedMatchId);
      const allMatches = userMatches.length > 0 ? userMatches : (match ? [match] : []);
      const selectedMatchData = allMatches.find(m => m.id === finalSelectedMatchId);

      if (!selectedMatchData) {
          toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el partido seleccionado.' });
          return;
      }

      if (selectedMatchData.playerUids.includes(playerToInvite.uid)) {
          toast({ variant: 'default', title: 'Jugador ya en el partido', description: `${playerToInvite.displayName} ya está en la lista.` });
          setOpen(false);
          return;
      }

      const invitationRef = doc(collection(firestore, `matches/${finalSelectedMatchId}/invitations`));
      const newInvitation: Omit<Invitation, 'id'> = {
          playerId: playerToInvite.uid,
          playerName: playerToInvite.displayName,
          playerOvr: playerToInvite.ovr,
          playerPhotoUrl: playerToInvite.photoUrl || '',
          status: 'pending',
          createdAt: new Date().toISOString()
      };
      batch.set(invitationRef, newInvitation);

      const notificationRef = doc(collection(firestore, `users/${playerToInvite.uid}/notifications`));
      const notification: Omit<Notification, 'id'> = {
        type: 'match_invite',
        title: '¡Te han invitado a un partido!',
        message: `${user.displayName} te invita a unirte a "${selectedMatchData.title}".`,
        link: `/matches`,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      batch.set(notificationRef, notification);

      try {
        await batch.commit();
        toast({
          title: '¡Invitación Enviada!',
          description: `Se ha enviado una invitación a ${playerToInvite.displayName} para unirse a "${selectedMatchData.title}".`,
        });
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

  if (disabled) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Invitar a {playerToInvite?.displayName}</DialogTitle>
          <DialogDescription>
            {match ? `Confirma para enviar la invitación para el partido "${match.title}".` : 'Selecciona uno de tus partidos incompletos para enviarle una invitación.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow py-4">
          {!match && (
              userMatches.length > 0 ? (
                <div className="space-y-2">
                    <Label htmlFor='match-select'>Tus Partidos Incompletos</Label>
                    <Select onValueChange={setSelectedMatchId} value={selectedMatchId || ''}>
                        <SelectTrigger id="match-select">
                            <SelectValue placeholder="Elige un partido..." />
                        </SelectTrigger>
                        <SelectContent>
                            {userMatches.map(matchItem => (
                                <SelectItem key={matchItem.id} value={matchItem.id}>
                                    {matchItem.title} ({matchItem.players.length}/{matchItem.matchSize})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              ) : (
                <Alert>
                    <AlertDescription>No tienes partidos que necesiten jugadores. Crea uno para poder invitar.</AlertDescription>
                </Alert>
              )
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleInvite} disabled={isPending || !finalSelectedMatchId}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Enviar Invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
