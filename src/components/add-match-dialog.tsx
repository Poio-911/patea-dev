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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarIcon, Loader2, PlusCircle } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Player, MatchType, MatchSize } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { generateTeamsAction } from '@/lib/actions';
import { Separator } from './ui/separator';

const matchSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
  date: z.date({ required_error: 'La fecha es obligatoria.' }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM).'),
  location: z.string().min(3, 'La ubicación es obligatoria.'),
  type: z.enum(['manual', 'collaborative'], { required_error: 'El tipo es obligatorio.' }),
  matchSize: z.enum(['10', '14', '22'], { required_error: 'El tamaño es obligatorio.' }),
  players: z.array(z.string()).refine(val => val.length > 0, { message: 'Debes seleccionar al menos un jugador.' }),
});

type MatchFormData = z.infer<typeof matchSchema>;

interface AddMatchDialogProps {
  allPlayers: Player[];
  disabled?: boolean;
}

export function AddMatchDialog({ allPlayers, disabled }: AddMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<MatchFormData>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      title: 'Partido Amistoso',
      time: '21:00',
      location: 'Cancha Principal',
      type: 'manual',
      matchSize: '10',
      players: [],
    },
  });

  const selectedMatchSize = parseInt(form.watch('matchSize') as MatchSize | string, 10);

  const handlePlayerSelect = (playerId: string, checked: boolean) => {
    const currentPlayers = form.getValues('players');
    const newPlayers = checked
      ? [...currentPlayers, playerId]
      : currentPlayers.filter(id => id !== playerId);
    
    if (newPlayers.length > selectedMatchSize) {
        toast({
            variant: 'destructive',
            title: 'Límite de jugadores alcanzado',
            description: `No puedes seleccionar más de ${selectedMatchSize} jugadores para este tipo de partido.`
        });
        return;
    }

    form.setValue('players', newPlayers);
  };


  const onSubmit = (data: MatchFormData) => {
    if (!user || !firestore || !user.activeGroupId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes tener un grupo activo.' });
      return;
    }
    
    if (data.players.length !== selectedMatchSize) {
      toast({ variant: 'destructive', title: 'Error de jugadores', description: `Debes seleccionar exactamente ${selectedMatchSize} jugadores.` });
      return;
    }

    startTransition(async () => {
        try {
            const selectedPlayersData = allPlayers.filter(p => data.players.includes(p.id));

            const teamGenerationResult = await generateTeamsAction(selectedPlayersData);
            
            if (teamGenerationResult.error || !teamGenerationResult.teams) {
                throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
            }

            const newMatch = {
                ...data,
                matchSize: selectedMatchSize,
                date: data.date.toISOString(),
                status: 'upcoming',
                ownerUid: user.uid,
                groupId: user.activeGroupId,
                players: selectedPlayersData.map(p => ({ uid: p.id, displayName: p.name, ovr: p.ovr, position: p.position, photoUrl: p.photoUrl || '' })),
                teams: teamGenerationResult.teams,
            };
    
            await addDoc(collection(firestore, 'matches'), newMatch);
            
            toast({ title: 'Éxito', description: 'Partido programado y equipos generados.' });
            setOpen(false);
            form.reset();
        } catch (error: any) {
            console.error('Error al crear el partido:', error);
            toast({
                variant: 'destructive',
                title: 'Error al crear partido',
                description: error.message || 'No se pudo programar el partido.',
            });
        }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Programar Partido
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Programar Nuevo Partido</DialogTitle>
            <DialogDescription>
              Introduce los detalles del partido y selecciona los jugadores.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Column 1: Match Details */}
                <div className="space-y-4">
                <div>
                    <Label htmlFor="title">Título del Partido</Label>
                    <Input id="title" {...form.register('title')} />
                    {form.formState.errors.title && <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>}
                    </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>Fecha</Label>
                        <Controller
                            name="date"
                            control={form.control}
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, 'PPP') : <span>Elige una fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                        {form.formState.errors.date && <p className="text-xs text-destructive mt-1">{form.formState.errors.date.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="time">Hora</Label>
                        <Input id="time" {...form.register('time')} />
                        {form.formState.errors.time && <p className="text-xs text-destructive mt-1">{form.formState.errors.time.message}</p>}
                    </div>
                </div>
                
                <div>
                    <Label htmlFor="location">Ubicación</Label>
                    <Input id="location" {...form.register('location')} />
                    {form.formState.errors.location && <p className="text-xs text-destructive mt-1">{form.formState.errors.location.message}</p>}
                </div>

                <div>
                    <Label>Tamaño del Partido</Label>
                    <Controller
                        name="matchSize"
                        control={form.control}
                        render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-4 mt-2">
                                <Label className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                                    <RadioGroupItem value="10" /> 5 vs 5
                                </Label>
                                <Label className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                                    <RadioGroupItem value="14" /> 7 vs 7
                                </Label>
                                <Label className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                                    <RadioGroupItem value="22" /> 11 vs 11
                                </Label>
                            </RadioGroup>
                        )}
                    />
                </div>
                
                <div>
                    <Label>Tipo de Partido</Label>
                    <Controller
                        name="type"
                        control={form.control}
                        render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 mt-2">
                                <Label className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-accent">
                                    <RadioGroupItem value="manual" /> Manual
                                </Label>
                                <Label className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-accent" aria-disabled>
                                    <RadioGroupItem value="collaborative" disabled /> Colaborativo (Próximamente)
                                </Label>
                            </RadioGroup>
                        )}
                    />
                </div>

                </div>

                {/* Column 2: Player Selection */}
                <div className="space-y-4">
                    <Label>Jugadores ({form.watch('players').length} / {selectedMatchSize})</Label>
                    {allPlayers.length > 0 ? (
                        <div className="max-h-[400px] md:max-h-full overflow-y-auto space-y-2 border p-2 rounded-md">
                            {allPlayers.map(player => (
                                <div key={player.id} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 has-[:checked]:bg-accent">
                                    <Checkbox
                                        id={`player-${player.id}`}
                                        onCheckedChange={(checked) => handlePlayerSelect(player.id, !!checked)}
                                        checked={form.getValues('players').includes(player.id)}
                                    />
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <Label htmlFor={`player-${player.id}`} className="flex-1 cursor-pointer">
                                        <span className="font-semibold">{player.name}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">{player.position} - OVR: {player.ovr}</span>
                                    </Label>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Alert>
                            <AlertDescription>
                                No hay jugadores en tu grupo activo. Añade jugadores desde la página de Jugadores.
                            </AlertDescription>
                        </Alert>
                    )}
                    {form.formState.errors.players && <p className="text-xs text-destructive mt-1">{form.formState.errors.players.message}</p>}
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? 'Programando...' : 'Programar Partido y Generar Equipos'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
