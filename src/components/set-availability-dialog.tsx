
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
  isAvailable: z.boolean(),
  availability: z.record(z.nativeEnum(Object.keys(daysOfWeek.reduce((acc, day) => ({ ...acc, [day.id]: '' }), {}))), z.array(z.string()).optional())
}).refine(data => {
    if (!data.isAvailable) return true;
    return Object.values(data.availability).some(times => times && times.length > 0);
}, {
    message: "Si estás disponible, debés seleccionar al menos un día y horario.",
    path: ["availability"],
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
      isAvailable: Object.keys(availability).length > 0,
      availability: availability || {},
    },
  });
  
  useEffect(() => {
    form.reset({
        isAvailable: Object.keys(availability).length > 0,
        availability: availability || {}
    });
  }, [availability, form]);


  const onSubmit = async (data: AvailabilityFormData) => {
    if (!firestore || !user || !player) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la disponibilidad.' });
      return;
    }
    setIsSubmitting(true);
    
    const availablePlayerDocRef = doc(firestore, 'availablePlayers', user.uid);

    try {
        if (data.isAvailable) {
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
                        availability: data.availability as Availability,
                    };
                    await setDoc(availablePlayerDocRef, newAvailablePlayer);
                    toast({ title: 'Disponibilidad actualizada', description: 'Tus preferencias de horario han sido guardadas.' });
                    setOpen(false);
                    setIsSubmitting(false);
                },
                (error) => {
                    toast({ variant: 'destructive', title: 'Error de ubicación', description: 'No se pudo obtener tu ubicación. Por favor, activa los permisos.' });
                    setIsSubmitting(false);
                }
            );
        } else {
            await deleteDoc(availablePlayerDocRef);
            toast({ title: 'Ya no estás disponible', description: 'Has sido eliminado del mercado de fichajes.' });
            setOpen(false);
            setIsSubmitting(false);
        }
    } catch (error) {
        console.error('Error updating availability:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar tu disponibilidad.' });
        setIsSubmitting(false);
    }
  };
  
  const isAvailable = form.watch('isAvailable');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Configurar Disponibilidad</DialogTitle>
            <DialogDescription>
              Hacete visible para otros organizadores y definí cuándo podés jugar.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="flex items-center space-x-4 rounded-md border p-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  Estoy disponible para partidos
                </p>
                <p className="text-sm text-muted-foreground">
                  Aparecerás en el mercado de pases para otros organizadores.
                </p>
              </div>
              <Controller
                control={form.control}
                name="isAvailable"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Disponibilidad para partidos"
                  />
                )}
              />
            </div>

            {isAvailable && (
              <div className="space-y-4 animate-in fade-in-0 duration-500">
                <Separator />
                <Label>¿Qué días y horarios te quedan bien?</Label>
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
                                className="justify-start gap-2"
                            >
                                <Label className="font-semibold w-24">{day.label}</Label>
                                {timeOfDayOptions.map(time => (
                                    <ToggleGroupItem key={time.id} value={time.id} className="text-xs px-2">
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
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
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
