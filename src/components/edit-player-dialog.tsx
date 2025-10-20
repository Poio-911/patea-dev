
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Player } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const playerSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  position: z.enum(['DEL', 'MED', 'DEF', 'POR'], { required_error: 'La posición es obligatoria.'}),
  pac: z.coerce.number().min(1).max(99),
  sho: z.coerce.number().min(1).max(99),
  pas: z.coerce.number().min(1).max(99),
  dri: z.coerce.number().min(1).max(99),
  def: z.coerce.number().min(1).max(99),
  phy: z.coerce.number().min(1).max(99),
});

type PlayerFormData = z.infer<typeof playerSchema>;

interface EditPlayerDialogProps {
    player: Player;
    children: React.ReactNode;
}

const AttributeInput = ({ label, attributeKey, register }: { label: string, attributeKey: string, register: any }) => (
    <div className="grid grid-cols-2 items-center gap-2">
        <Label htmlFor={attributeKey.toLowerCase()}>{label}</Label>
        <Input id={attributeKey.toLowerCase()} type="number" {...register(attributeKey.toLowerCase())} />
    </div>
);

export function EditPlayerDialog({ player, children }: EditPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: player.name,
      position: player.position,
      pac: player.pac,
      sho: player.sho,
      pas: player.pas,
      dri: player.dri,
      def: player.def,
      phy: player.phy,
    },
  });

  const onSubmit = async (data: PlayerFormData) => {
    if (!firestore) return;
    setIsSubmitting(true);

    const ovr = Math.round(
      (data.pac + data.sho + data.pas + data.dri + data.def + data.phy) / 6
    );

    try {
      const playerRef = doc(firestore, 'players', player.id);
      await updateDoc(playerRef, {
        ...data,
        ovr,
      });

      toast({ title: 'Éxito', description: 'Jugador actualizado correctamente.' });
      setOpen(false);
    } catch (error) {
      console.error('Error al actualizar jugador:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el jugador.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
            <DialogTitle>Editar Jugador</DialogTitle>
            <DialogDescription>
            Modifica los detalles del jugador. Haz clic en guardar cuando hayas terminado.
            </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
                Nombre
            </Label>
            <Input id="name" {...register('name')} className="col-span-3" />
            </div>
            {errors.name && <p className="col-span-4 text-right text-xs text-destructive">{errors.name.message}</p>}
            
            <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="position" className="text-right">
                Posición
            </Label>
            <Controller
                name="position"
                control={control}
                render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona una posición" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="DEL">DEL (Delantero)</SelectItem>
                    <SelectItem value="MED">MED (Centrocampista)</SelectItem>
                    <SelectItem value="DEF">DEF (Defensa)</SelectItem>
                    <SelectItem value="POR">POR (Portero)</SelectItem>
                    </SelectContent>
                </Select>
                )}
            />
            </div>
            {errors.position && <p className="col-span-4 text-right text-xs text-destructive">{errors.position.message}</p>}

            <div className="grid grid-cols-2 gap-4">
                <AttributeInput label="RIT" attributeKey="pac" register={register} />
                <AttributeInput label="TIR" attributeKey="sho" register={register} />
                <AttributeInput label="PAS" attributeKey="pas" register={register} />
                <AttributeInput label="REG" attributeKey="dri" register={register} />
                <AttributeInput label="DEF" attributeKey="def" register={register} />
                <AttributeInput label="FIS" attributeKey="phy" register={register} />
            </div>
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
