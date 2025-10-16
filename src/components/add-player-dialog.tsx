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

const playerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.enum(['DEL', 'MED', 'DEF', 'POR']),
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
      name: 'New Player',
      pac: 75,
      sho: 75,
      pas: 75,
      dri: 75,
      def: 75,
      phy: 75,
    },
  });

  const onSubmit = async (data: PlayerFormData) => {
    if (!user || !firestore) return;

    const ovr = Math.round(
      (data.pac + data.sho + data.pas + data.dri + data.def + data.phy) / 6
    );

    try {
      await addDoc(collection(firestore, 'players'), {
        ...data,
        ovr,
        ownerUid: user.uid,
        stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
        photoUrl: `https://picsum.photos/seed/${data.name}/400/400`,
      });
      toast({ title: 'Success', description: 'Player added successfully.' });
      setOpen(false);
      reset();
    } catch (error) {
      console.error('Error adding player:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add player.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add New Player</DialogTitle>
            <DialogDescription>
              Enter the details for the new player. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" {...register('name')} className="col-span-3" />
            </div>
            {errors.name && <p className="col-span-4 text-xs text-destructive">{errors.name.message}</p>}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="position" className="text-right">
                Position
              </Label>
              <Controller
                name="position"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEL">DEL (Forward)</SelectItem>
                      <SelectItem value="MED">MED (Midfielder)</SelectItem>
                      <SelectItem value="DEF">DEF (Defender)</SelectItem>
                      <SelectItem value="POR">POR (Goalkeeper)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
             {errors.position && <p className="col-span-4 text-xs text-destructive">{errors.position.message}</p>}

            <div className="grid grid-cols-2 gap-4">
               <div className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor="pac">PAC</Label>
                  <Input id="pac" type="number" {...register('pac')} />
              </div>
               <div className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor="sho">SHO</Label>
                  <Input id="sho" type="number" {...register('sho')} />
              </div>
               <div className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor="pas">PAS</Label>
                  <Input id="pas" type="number" {...register('pas')} />
              </div>
               <div className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor="dri">DRI</Label>
                  <Input id="dri" type="number" {...register('dri')} />
              </div>
               <div className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor="def">DEF</Label>
                  <Input id="def" type="number" {...register('def')} />
              </div>
               <div className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor="phy">PHY</Label>
                  <Input id="phy" type="number" {...register('phy')} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save Player</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
