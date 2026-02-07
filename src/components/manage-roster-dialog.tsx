
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { GroupTeam, DetailedTeamPlayer, Player } from '@/lib/types';
import { PlayerPositionBadge } from '@/components/player-styles';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { UserMinus, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ResponsiveAlertDialog as AlertDialog, ResponsiveAlertDialogAction as AlertDialogAction, ResponsiveAlertDialogCancel as AlertDialogCancel, ResponsiveAlertDialogContent as AlertDialogContent, ResponsiveAlertDialogDescription as AlertDialogDescription, ResponsiveAlertDialogFooter as AlertDialogFooter, ResponsiveAlertDialogHeader as AlertDialogHeader, ResponsiveAlertDialogTitle as AlertDialogTitle } from '@/components/ui/responsive-alert-dialog';

interface ManageRosterDialogProps {
  team: GroupTeam;
  players: DetailedTeamPlayer[];
  allGroupPlayers: Player[];
  children: React.ReactNode;
}

export function ManageRosterDialog({ team, players, allGroupPlayers, children }: ManageRosterDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [open, setOpen] = useState(false);
  const [localPlayers, setLocalPlayers] = useState<DetailedTeamPlayer[]>(players);
  const [saving, setSaving] = useState(false);
  const [playerToAddId, setPlayerToAddId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalPlayers(players);
    }
  }, [open, players]);

  const usedNumbers = useMemo(() => {
    const nums = new Set<number>();
    localPlayers.forEach(p => {
      if (p.number && p.number > 0) nums.add(p.number);
    });
    return nums;
  }, [localPlayers]);

  const duplicateNumbers = useMemo(() => {
    const counts: Record<number, number> = {};
    localPlayers.forEach(p => {
      if (p.number && p.number > 0) {
        counts[p.number] = (counts[p.number] || 0) + 1;
      }
    });
    return Object.keys(counts)
      .map(n => parseInt(n, 10))
      .filter(n => counts[n] > 1);
  }, [localPlayers]);

  const hasDuplicates = duplicateNumbers.length > 0;

  const nextAvailableNumber = useMemo(() => {
    let n = 1;
    const used = new Set<number>([...usedNumbers]);
    while (used.has(n)) n++;
    return n;
  }, [usedNumbers]);

  const playersInRosterIds = useMemo(() => new Set(localPlayers.map(p => p.id)), [localPlayers]);
  const addablePlayers = useMemo(() => allGroupPlayers.filter(p => !playersInRosterIds.has(p.id)), [allGroupPlayers, playersInRosterIds]);

  const handleNumberChange = (playerId: string, value: string) => {
    const num = parseInt(value, 10);
    setLocalPlayers(prev => prev.map(p => (p.id === playerId ? { ...p, number: isNaN(num) ? 0 : Math.max(0, Math.min(99, num)) } : p)));
  };

  const handleStatusChange = (playerId: string, status: 'titular' | 'suplente') => {
    setLocalPlayers(prev => prev.map(p => (p.id === playerId ? { ...p, status } : p)));
  };

  const autoAssignNumbers = () => {
    const assigned = new Set<number>([...usedNumbers]);
    let next = 1;
    const updated = localPlayers.map(p => {
      if (p.number && p.number > 0) return p;
      while (assigned.has(next)) {
        next += 1;
      }
      assigned.add(next);
      return { ...p, number: next };
    });
    setLocalPlayers(updated);
  };

  const handleAddPlayer = () => {
    if (!playerToAddId) return;
    const base = allGroupPlayers.find(p => p.id === playerToAddId);
    if (!base) return;
    const newPlayer: DetailedTeamPlayer = {
      ...base,
      number: nextAvailableNumber,
      status: 'suplente',
    } as DetailedTeamPlayer;
    setLocalPlayers(prev => [...prev, newPlayer]);
    setPlayerToAddId(null);
    setAddOpen(false);
  };

  const handleRemovePlayer = (playerId: string) => {
    setLocalPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const saveChanges = async () => {
    if (!firestore) return;
    if (!team?.id) return;
    setSaving(true);
    try {
      const teamRef = doc(firestore, 'teams', team.id);
      const newMembers = localPlayers.map(lp => ({
        playerId: lp.id,
        number: lp.number || 0,
        status: lp.status || 'suplente',
      }));
      await updateDoc(teamRef, { members: newMembers });
      toast({ title: 'Plantel actualizado', description: 'Se guardaron los cambios del plantel.' });
      setOpen(false);
    } catch (e: any) {
      console.error('Error saving roster:', e);
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudo guardar el plantel.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar Plantel</DialogTitle>
          <DialogDescription>Editar dorsales y estado en bloque</DialogDescription>
        </DialogHeader>
        <Separator />

        {hasDuplicates && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Dorsales duplicados</AlertTitle>
            <AlertDescription>
              Hay jugadores con el mismo dorsal: {duplicateNumbers.join(', ')}. Ajustá los números o usá la auto-asignación.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center mb-3 gap-2">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={autoAssignNumbers}>Auto-asignar dorsales</Button>
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={addablePlayers.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar jugador
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command>
                  <CommandInput placeholder="Buscar jugador..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                    <CommandGroup>
                      {addablePlayers.map(p => (
                        <CommandItem key={p.id} value={p.name || ''} onSelect={() => {
                          setPlayerToAddId(p.id);
                          handleAddPlayer();
                        }}>
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="outline">{localPlayers.length} jugadores</Badge>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
          {localPlayers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-2 border rounded-md">
              <Avatar className="h-8 w-8">
                <AvatarImage src={p.photoUrl || undefined} />
                <AvatarFallback>{p.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium leading-tight">{p.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <PlayerPositionBadge position={p.position} showIcon={false} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className={`w-16 ${duplicateNumbers.includes(p.number || 0) && p.number ? 'border-destructive' : ''}`}
                  value={p.number || ''}
                  min={0}
                  max={99}
                  onChange={(e) => handleNumberChange(p.id, e.target.value)}
                  placeholder="N°"
                />
                {duplicateNumbers.includes(p.number || 0) && p.number ? (
                  <span className="text-xs text-destructive">Dorsal duplicado</span>
                ) : null}
                <Select value={p.status || 'suplente'} onValueChange={(v) => handleStatusChange(p.id, v as any)}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="titular">Titular</SelectItem>
                    <SelectItem value="suplente">Suplente</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => setConfirmRemoveId(p.id)} title="Quitar del plantel">
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <AlertDialog open={!!confirmRemoveId} onOpenChange={(open) => !open && setConfirmRemoveId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quitar jugador del plantel</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no elimina al jugador del grupo, solo del plantel del equipo.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmRemoveId(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (confirmRemoveId) { handleRemovePlayer(confirmRemoveId); setConfirmRemoveId(null); } }}>Quitar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={saveChanges} disabled={saving || hasDuplicates}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
