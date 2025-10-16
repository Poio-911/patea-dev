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
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { PlayerPosition } from '@/lib/types';
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

export function AddPlayerDialog() {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: 'Nuevo Jugador',
      pac: 75,
      sho: 75,
      pas: 75,
      dri: 75,
      def: 75,
      phy: 75,
    },
  });

  const onSubmit = async (data: PlayerFormData) => {
    if (!user || !firestore || !user.activeGroupId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes seleccionar un grupo activo para añadir un jugador.',
      });
      return;
    }

    const ovr = Math.round(
      (data.pac + data.sho + data.pas + data.dri + data.def + data.phy) / 6
    );

    try {
      await addDoc(collection(firestore, 'players'), {
        ...data,
        ovr,
        ownerUid: user.uid,
        groupId: user.activeGroupId,
        stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
        photoUrl: `https://picsum.photos/seed/${data.name}/400/400`,
      });
      toast({ title: 'Éxito', description: 'Jugador añadido correctamente.' });
      setOpen(false);
      reset();
    } catch (error) {
      console.error('Error al añadir jugador:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo añadir el jugador.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Jugador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {!user?.activeGroupId ? (
            <Alert variant="destructive">
                <AlertTitle>No hay grupo activo</AlertTitle>
                <AlertDescription>
                    Por favor, selecciona o crea un grupo antes de añadir un jugador.
                </AlertDescription>
            </Alert>
        ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Añadir Nuevo Jugador</DialogTitle>
                <DialogDescription>
                Introduce los detalles del nuevo jugador. Haz clic en guardar cuando hayas terminado.
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
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="pac">PAC</Label>
                    <Input id="pac" type="number" {...register('pac')} />
                </div>
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="sho">TIR</Label>
                    <Input id="sho" type="number" {...register('sho')} />
                </div>
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="pas">PAS</Label>
                    <Input id="pas" type="number" {...register('pas')} />
                </div>
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="dri">REG</Label>
                    <Input id="dri" type="number" {...register('dri')} />
                </div>
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="def">DEF</Label>
                    <Input id="def" type="number" {...register('def')} />
                </div>
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="phy">FIS</Label>
                    <Input id="phy" type="number" {...register('phy')} />
                </div>
                </div>
            </div>
            <DialogFooter>
                <Button type="submit">Guardar Jugador</Button>
            </DialogFooter>
            </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
