
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
import { doc, writeBatch, collection, getDoc } from 'firebase/firestore';
import type { AvailablePlayer, Match, Player, Invitation, Notification } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';


type InvitePlayerDialogProps = {
  playerToInvite?: AvailablePlayer | null; // For inviting external players
  allGroupPlayers?: Player[]; // For inviting internal players
  userMatches: Match[];
  children: React.ReactNode;
  match?: Match | null; // Match is pre-selected
  disabled?: boolean;
};

export function InvitePlayerDialog({
  playerToInvite,
  allGroupPlayers = [],
  userMatches,
  children,
  match, // Use the pre-selected match
  disabled,
}: InvitePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(match?.id || null);
  const [selectedGroupPlayers, setSelectedGroupPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const finalSelectedMatchId = match?.id || selectedMatchId;
  const isInvitingExternal = !!playerToInvite;

  const getMatchById = (id: string) => [...userMatches, ...(match ? [match] : [])].find(m => m.id === id);

  const availableGroupPlayers = useMemo(() => {
    if (isInvitingExternal || !allGroupPlayers) return []; // FIX: Check if allGroupPlayers is null/undefined

    const selectedMatchData = finalSelectedMatchId ? getMatchById(finalSelectedMatchId) : null;
    const playerUidsInMatch = new Set(selectedMatchData?.playerUids || []);

    return allGroupPlayers
      .filter(p => !playerUidsInMatch.has(p.id) && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allGroupPlayers, finalSelectedMatchId, searchTerm, isInvitingExternal, userMatches, match]);


  const handleInvite = () => {
    if (!firestore || !user || !finalSelectedMatchId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un partido para invitar.' });
      return;
    }

    const playersToInvite = isInvitingExternal && playerToInvite
      ? [{ id: playerToInvite.uid, name: playerToInvite.displayName }]
      : selectedGroupPlayers.map(pId => {
        const player = allGroupPlayers.find(p => p.id === pId);
        return { id: pId, name: player?.name || 'Jugador' };
      });

    if (playersToInvite.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'No has seleccionado ningún jugador para invitar.' });
      return;
    }

    startTransition(async () => {
      const batch = writeBatch(firestore);
      const selectedMatchData = getMatchById(finalSelectedMatchId);

      if (!selectedMatchData) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el partido seleccionado.' });
        return;
      }

      let invitesSent = 0;
      for (const player of playersToInvite) {
        const invitationRef = doc(collection(firestore, `matches/${finalSelectedMatchId}/invitations`));
        const newInvitation: Omit<Invitation, 'id'> = {
          matchId: selectedMatchData.id,
          matchTitle: selectedMatchData.title,
          matchDate: selectedMatchData.date,
          playerId: player.id,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        batch.set(invitationRef, newInvitation);

        const notificationRef = doc(collection(firestore, `users/${player.id}/notifications`));
        const notification: Omit<Notification, 'id'> = {
          type: 'match_invite',
          title: '¡Te han invitado a un partido!',
          message: `${user.displayName} te invita a unirte a "${selectedMatchData.title}".`,
          link: `/matches`,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        batch.set(notificationRef, notification);
        invitesSent++;
      }

      try {
        await batch.commit();
        toast({
          title: '¡Invitaciones Enviadas!',
          description: `Se han enviado ${invitesSent} invitaciones para unirse a "${selectedMatchData.title}".`,
        });
        setOpen(false);
        setSelectedGroupPlayers([]);
        setSearchTerm('');
      } catch (error) {
        console.error('Error inviting player(s): ', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudieron enviar las invitaciones. Verifica tus permisos.',
        });
      }
    });
  };


  if (disabled) {
    return <div className="w-full">{children}</div>;
  }

  const dialogTitle = isInvitingExternal
    ? `Invitar a ${playerToInvite?.displayName}`
    : `Invitar Jugadores del Grupo`;

  const dialogDescription = isInvitingExternal
    ? `Selecciona uno de tus partidos para invitar a ${playerToInvite?.displayName}.`
    : `Selecciona jugadores de tu grupo para invitar al partido "${match?.title}".`;


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex-grow py-4 space-y-4">
          {!isInvitingExternal ? (
            // UI for inviting group players
            <>
              <Input
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-4"
              />
              <ScrollArea className="h-64">
                <div className="space-y-2 pr-4">
                  {availableGroupPlayers.map(p => (
                    <div key={p.id} className="flex items-center space-x-3 rounded-md border p-3">
                      <Checkbox
                        id={`player-checkbox-${p.id}`}
                        checked={selectedGroupPlayers.includes(p.id)}
                        onCheckedChange={checked => {
                          setSelectedGroupPlayers(prev =>
                            checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                          );
                        }}
                      />
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.photoUrl} alt={p.name} />
                        <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`player-checkbox-${p.id}`} className="flex-1 cursor-pointer font-medium">{p.name}</Label>
                    </div>
                  ))}
                  {availableGroupPlayers.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground p-4">No hay jugadores disponibles o que coincidan con tu búsqueda.</p>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            // UI for inviting external player
            userMatches.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor='match-select'>Tus Partidos Incompletos</Label>
                <Select onValueChange={setSelectedMatchId} value={selectedMatchId || ''}>
                  <SelectTrigger id="match-select">
                    <SelectValue placeholder="Elegí un partido..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userMatches.map(matchItem => (
                      <SelectItem key={matchItem.id} value={matchItem.id}>
                        {matchItem.title} ({matchItem.players?.length || 0}/{matchItem.matchSize})
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
          <Button onClick={handleInvite} disabled={isPending || !finalSelectedMatchId || (isInvitingExternal ? false : selectedGroupPlayers.length === 0)}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Enviar Invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
