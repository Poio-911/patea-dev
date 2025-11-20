
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
import { publishActivityAction } from '@/lib/actions/social-actions';

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

const AttributeInput = ({ label, attributeKey, register }: { label: string, attributeKey: string, register: any }) => (
    <div className="grid grid-cols-2 items-center gap-2">
        <Label htmlFor={attributeKey.toLowerCase()}>{label}</Label>
        <Input id={attributeKey.toLowerCase()} type="number" {...register(attributeKey.toLowerCase())} />
    </div>
);


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
      pac: 50,
      sho: 50,
      pas: 50,
      dri: 50,
      def: 50,
      phy: 50,
    },
  });

  const onSubmit = async (data: PlayerFormData) => {
    if (!user || !firestore || !user.activeGroupId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Tenés que seleccionar un grupo activo para añadir un jugador.',
      });
      return;
    }

    const ovr = Math.round(
      (data.pac + data.sho + data.pas + data.dri + data.def + data.phy) / 6
    );

    try {
      const docRef = await addDoc(collection(firestore, 'players'), {
        ...data,
        ovr,
        ownerUid: user.uid,
        groupId: user.activeGroupId,
        stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
        photoUrl: `https://picsum.photos/seed/${data.name}/400/400`,
      });

      // Publish social activity for player creation
      try {
        await publishActivityAction({
          type: 'player_created',
          userId: user.uid,
          metadata: {
            playerName: data.name,
            playerId: docRef.id,
            position: data.position,
            ovr: ovr
          }
        });
      } catch (socialError) {
        console.warn('Failed to publish player creation activity:', socialError);
        // Don't fail the player creation if social activity fails
      }

      toast({ title: '¡Jugador Agregado!', description: 'El jugador se sumó al plantel.' });
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
          Agregar Jugador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {!user?.activeGroupId ? (
            <Alert variant="destructive">
                <AlertTitle>No hay grupo activo</AlertTitle>
                <AlertDescription>
                    Por favor, seleccioná o creá un grupo antes de agregar un jugador.
                </AlertDescription>
            </Alert>
        ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Agregar un Jugador Manual</DialogTitle>
                <DialogDescription>
                Meté los datos del nuevo jugador. Hacé clic en guardar cuando termines.
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
                        <SelectValue placeholder="Seleccioná una posición" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="DEL">DEL (Delantero)</SelectItem>
                        <SelectItem value="MED">MED (Volante)</SelectItem>
                        <SelectItem value="DEF">DEF (Defensa)</SelectItem>
                        <SelectItem value="POR">POR (Arquero)</SelectItem>
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
                <Button type="submit">Guardar Jugador</Button>
            </DialogFooter>
            </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
