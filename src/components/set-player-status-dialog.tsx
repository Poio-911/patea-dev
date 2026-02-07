

'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogDescription as DialogDescription, ResponsiveDialogFooter as DialogFooter, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle, ResponsiveDialogTrigger as DialogTrigger } from '@/components/ui/responsive-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Loader2 } from 'lucide-react';
import type { GroupTeam, GroupTeamMember, PlayerStatus, DetailedTeamPlayer } from '@/lib/types';

const playerStatusSchema = z.object({
  number: z.coerce.number().min(1, "El dorsal debe ser mayor a 0").max(99, "El dorsal no puede ser mayor a 99"),
  status: z.enum(['titular', 'suplente'], { required_error: 'Debes seleccionar un estado.'}),
});

type PlayerStatusFormData = z.infer<typeof playerStatusSchema>;

interface SetPlayerStatusDialogProps {
  player: DetailedTeamPlayer;
  team: GroupTeam;
  onPlayerUpdate?: () => void;
  children: React.ReactNode;
}

export function SetPlayerStatusDialog({ player, team, onPlayerUpdate, children }: SetPlayerStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<PlayerStatusFormData>({
    resolver: zodResolver(playerStatusSchema),
    defaultValues: {
      number: player.number || 0,
      status: player.status || 'titular',
    },
  });

  const existingNumbers = useMemo(() => {
    return (team.members || [])
      .filter((m) => m.playerId !== player.id && typeof m.number === 'number')
      .map((m) => m.number);
  }, [team.members, player.id]);

  const nextAvailableNumber = useMemo(() => {
    for (let n = 1; n <= 99; n++) {
      if (!existingNumbers.includes(n)) return n;
    }
    return 0;
  }, [existingNumbers]);

  const onSubmit = async (data: PlayerStatusFormData) => {
    if (!firestore) return;
    setIsSubmitting(true);

    try {
      // Prevent duplicate dorsals within the team
      if (existingNumbers.includes(data.number)) {
        form.setError('number', { type: 'manual', message: `El dorsal ${data.number} ya está en uso.` });
        toast({ variant: 'destructive', title: 'Dorsal ocupado', description: `El número ${data.number} ya lo tiene otro jugador.` });
        setIsSubmitting(false);
        return;
      }
      const teamRef = doc(firestore, 'teams', team.id);
      const updatedMembers = team.members.map((member: GroupTeamMember) => {
        if (member.playerId === player.id) {
          return { ...member, number: data.number, status: data.status };
        }
        return member;
      });

      await updateDoc(teamRef, { members: updatedMembers });

      toast({
        title: 'Jugador Actualizado',
        description: `Se guardaron los cambios para ${player.name}.`,
      });
      onPlayerUpdate?.(); // Trigger re-fetch on the parent page
      setOpen(false);
    } catch (error) {
      console.error('Error updating player status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron guardar los cambios.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Estado de {player.name}</DialogTitle>
          <DialogDescription>
            Ajustá el número de camiseta y si el jugador es titular o suplente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dorsal">Dorsal</Label>
            <Input id="dorsal" type="number" min={1} max={99} {...form.register('number', { valueAsNumber: true })} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Próximo disponible:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.setValue('number', nextAvailableNumber, { shouldValidate: true })}
                disabled={nextAvailableNumber === 0}
              >
                {nextAvailableNumber || 'N/A'}
              </Button>
            </div>
            {form.formState.errors.number && (
              <p className="text-xs text-destructive">{form.formState.errors.number.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Controller
                name="status"
                control={form.control}
                render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                        <div>
                            <RadioGroupItem value="titular" id="titular" className="sr-only" />
                            <Label htmlFor="titular" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                Titular
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="suplente" id="suplente" className="sr-only" />
                            <Label htmlFor="suplente" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                Suplente
                            </Label>
                        </div>
                    </RadioGroup>
                )}
            />
             {form.formState.errors.status && (
              <p className="text-xs text-destructive">{form.formState.errors.status.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
