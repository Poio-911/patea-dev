
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Player, AvailablePlayer, DayOfWeek, TimeOfDay, Availability } from '@/lib/types';
import { useFirestore, useUser } from '@/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarCheck, UserRoundX } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';

const daysOfWeek: { id: DayOfWeek, label: string }[] = [
    { id: 'lunes', label: 'Lunes' },
    { id: 'martes', label: 'Martes' },
    { id: 'miercoles', label: 'Miércoles' },
    { id: 'jueves', label: 'Jueves' },
    { id: 'viernes', label: 'Viernes' },
    { id: 'sabado', label: 'Sábado' },
    { id: 'domingo', label: 'Domingo' },
];

const timeOfDayOptions: { id: TimeOfDay, label: string }[] = [
    { id: 'mañana', label: 'Mañana' },
    { id: 'tarde', label: 'Tarde' },
    { id: 'noche', label: 'Noche' },
];

const availabilitySchema = z.object({
  availability: z.object({
    lunes: z.array(z.string()).optional(),
    martes: z.array(z.string()).optional(),
    miercoles: z.array(z.string()).optional(),
    jueves: z.array(z.string()).optional(),
    viernes: z.array(z.string()).optional(),
    sabado: z.array(z.string()).optional(),
    domingo: z.array(z.string()).optional(),
  }).refine(data => Object.values(data).some(times => times && times.length > 0), {
    message: "Debes seleccionar al menos un día y horario para guardar tu disponibilidad.",
    path: ["lunes"], // report error on one of the fields
  })
});


type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface SetAvailabilityDialogProps {
  player: Player | null;
  availability: Availability;
  children: React.ReactNode;
}

export function SetAvailabilityDialog({ player, availability, children }: SetAvailabilityDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      availability: availability || {},
    },
  });
  
  useEffect(() => {
    form.reset({
        availability: availability || {}
    });
  }, [availability, form, open]);


  const onSubmit = async (data: AvailabilityFormData) => {
    if (!firestore || !user || !player) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la disponibilidad.' });
      return;
    }
    setIsSubmitting(true);
    
    // Clean up undefined values from the availability object
    const cleanAvailability = Object.entries(data.availability).reduce((acc, [day, times]) => {
        if (times !== undefined) {
            acc[day as DayOfWeek] = times as TimeOfDay[];
        }
        return acc;
    }, {} as Availability);


    const availablePlayerDocRef = doc(firestore, 'availablePlayers', user.uid);

    try {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const newAvailablePlayer: Omit<AvailablePlayer, 'id'> = {
                    uid: user.uid,
                    displayName: player.name,
                    photoUrl: player.photoUrl || '',
                    position: player.position,
                    ovr: player.ovr,
                    location: { lat: latitude, lng: longitude },
                    availability: cleanAvailability,
                };
                await setDoc(availablePlayerDocRef, newAvailablePlayer, { merge: true });
                toast({ title: 'Disponibilidad actualizada', description: 'Tus preferencias de horario han sido guardadas.' });
                setOpen(false);
                setIsSubmitting(false);
            },
            (error) => {
                toast({ variant: 'destructive', title: 'Error de ubicación', description: 'No se pudo obtener tu ubicación. Por favor, activa los permisos.' });
                setIsSubmitting(false);
            }
        );
    } catch (error) {
        console.error('Error updating availability:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar tu disponibilidad.' });
        setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurar Disponibilidad Semanal</DialogTitle>
          <DialogDescription>
            Marcá los días y los momentos en los que generalmente estás libre para jugar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-grow overflow-hidden flex flex-col">
            <ScrollArea className="flex-grow -mx-6 px-6">
              <div className="py-4 space-y-4">
                {daysOfWeek.map(day => (
                  <div key={day.id} className="p-3 border rounded-md">
                     <Controller
                        control={form.control}
                        name={`availability.${day.id}`}
                        render={({ field }) => (
                            <ToggleGroup 
                                type="multiple" 
                                variant="outline"
                                value={field.value || []}
                                onValueChange={field.onChange}
                                className="justify-start gap-2 flex-wrap"
                            >
                                <Label className="font-semibold w-24 flex-shrink-0">{day.label}</Label>
                                {timeOfDayOptions.map(time => (
                                    <ToggleGroupItem key={time.id} value={time.id} className="text-xs px-2 h-8">
                                        {time.label}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        )}
                     />
                  </div>
                ))}
                {form.formState.errors.availability && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.availability.message}</p>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4 pt-4 border-t">
                <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <CalendarCheck className="mr-2 h-4 w-4" />
                )}
                Guardar Disponibilidad
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
