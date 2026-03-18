
'use client';

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { useState, useTransition, useMemo, useCallback } from 'react';
import { useUser } from '@/firebase';
import type { AvailablePlayer, Match, Player, Invitation } from '@/lib/types';
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
import { PlayerSelectItem } from '@/components/player-select-item';
import { sendMatchInvitationsAction } from '@/lib/actions/match-invitation-actions';


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
  const { user } = useUser();
  const { toast } = useToast();

  const finalSelectedMatchId = match?.id || selectedMatchId;
  const isInvitingExternal = !!playerToInvite;

  const getMatchById = useCallback((id: string) => [...userMatches, ...(match ? [match] : [])].find(m => m.id === id), [match, userMatches]);

  const availableGroupPlayers = useMemo(() => {
    if (isInvitingExternal || !allGroupPlayers) return []; // FIX: Check if allGroupPlayers is null/undefined

    const selectedMatchData = finalSelectedMatchId ? getMatchById(finalSelectedMatchId) : null;
    const playerUidsInMatch = new Set(selectedMatchData?.playerUids || []);

    return allGroupPlayers
      .filter(p => !playerUidsInMatch.has(p.id) && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allGroupPlayers, finalSelectedMatchId, getMatchById, isInvitingExternal, searchTerm]);


  const handleInvite = () => {
    if (!user || !finalSelectedMatchId) {
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
      const selectedMatchData = getMatchById(finalSelectedMatchId);

      if (!selectedMatchData) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el partido seleccionado.' });
        return;
      }

      try {
        const result = await sendMatchInvitationsAction(finalSelectedMatchId, playersToInvite.map((player) => player.id));
        if (!result.success) {
          throw new Error(result.error || 'No se pudieron enviar las invitaciones.');
        }
        toast({
          title: '¡Invitaciones Enviadas!',
          description: `Se han enviado ${result.sent || playersToInvite.length} invitaciones para unirse a "${selectedMatchData.title}".`,
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
                    <PlayerSelectItem
                      key={p.id}
                      variant="row"
                      selectionControl="checkbox"
                      player={{ id: p.id, name: p.name, photoURL: p.photoURL || '', position: p.position, ovr: p.ovr }}
                      selected={selectedGroupPlayers.includes(p.id)}
                      onToggle={() => {
                        setSelectedGroupPlayers(prev =>
                          prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      showPosition
                      showOvr
                      density="sm"
                      className="border"
                    />
                  ))}
                  {availableGroupPlayers.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground p-4">No hay jugadores disponibles o que coincidan con tu búsqueda.</p>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            // UI for inviting external player
            match ? (
              // Match already pre-selected — show confirmation only, no extra selector
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm font-medium">Invitar a <strong>{match.title}</strong></p>
                <p className="text-xs text-muted-foreground">{match.date} · {match.location.name}</p>
              </div>
            ) : userMatches.length > 0 ? (
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
