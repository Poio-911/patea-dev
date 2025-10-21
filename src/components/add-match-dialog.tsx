
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
import { Calendar as CalendarIcon, Loader2, PlusCircle, Search, ArrowLeft, Sun, Cloud, Cloudy, CloudRain, Wind, Zap, UserCheck, Users, Globe } from 'lucide-react';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Player, MatchLocation, Notification, Team } from '@/lib/types';
import { Alert, AlertDescription } from './ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { generateTeamsAction } from '@/lib/actions';
import { Progress } from './ui/progress';
import { getMatchDayForecast, GetMatchDayForecastOutput } from '@/ai/flows/get-match-day-forecast';
import { Switch } from './ui/switch';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';


const matchLocationSchema = z.object({
  name: z.string(),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string(),
});

const matchSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
  date: z.date({
    required_error: "La fecha del partido es obligatoria.",
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM).'),
  location: matchLocationSchema,
  type: z.enum(['manual', 'collaborative'], { required_error: 'El tipo es obligatorio.' }),
  matchSize: z.enum(['10', '14', '22'], { required_error: 'El tamaño es obligatorio.' }),
  players: z.array(z.string()),
  isPublic: z.boolean().optional(),
}).refine(data => {
    if (data.type === 'manual') {
        const minPlayers = Math.ceil(parseInt(data.matchSize) / 2);
        return data.players.length >= minPlayers;
    }
    return true;
}, {
    message: "Para partidos manuales, debes seleccionar al menos la mitad de los jugadores.",
    path: ['players'],
});


type MatchFormData = z.infer<typeof matchSchema>;

interface AddMatchDialogProps {
  allPlayers: Player[];
  disabled?: boolean;
}

const weatherIcons: Record<string, React.ElementType> = {
    Sun, Cloud, Cloudy, CloudRain, Wind, Zap
}

const positionColors: Record<Player['position'], string> = {
  DEL: 'text-chart-1',
  MED: 'text-chart-2',
  DEF: 'text-chart-3',
  POR: 'text-chart-4',
};

const LocationInput = ({ onSelectLocation }: { onSelectLocation: (location: MatchLocation) => void }) => {
    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: { /* Define options here, like componentRestrictions */ },
        debounce: 300,
    });

    const handleSelect = async (suggestion: google.maps.places.AutocompletePrediction) => {
        setValue(suggestion.description, false);
        clearSuggestions();

        try {
            const results = await getGeocode({ placeId: suggestion.place_id });
            const { lat, lng } = getLatLng(results[0]);
            
            const placeName = suggestion.structured_formatting.main_text;

            onSelectLocation({ 
                name: placeName,
                address: suggestion.description, 
                lat, 
                lng,
                placeId: suggestion.place_id
            });
        } catch (error) {
            console.error("Error getting geocode: ", error);
        }
    };
    
    return (
        <Popover open={status === 'OK' && value.length > 2}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <SoccerPlayerIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={!ready}
                        placeholder="Buscá la dirección de la cancha..."
                        className="pl-10"
                        autoComplete="off"
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                    <CommandList>
                        {status === 'OK' && (
                             <CommandGroup>
                                {data.map((suggestion) => (
                                    <CommandItem key={suggestion.place_id} value={suggestion.description} onSelect={() => handleSelect(suggestion)}>
                                        {suggestion.description}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {status === 'ZERO_RESULTS' && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};


export function AddMatchDialog({ allPlayers, disabled }: AddMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [weather, setWeather] = useState<GetMatchDayForecastOutput | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<MatchFormData>({
    resolver: zodResolver(matchSchema),
    mode: 'onChange',
    defaultValues: {
      title: 'Partido Amistoso',
      date: new Date(),
      time: '21:00',
      type: 'manual',
      matchSize: '10',
      players: [],
      isPublic: false,
    },
  });
  
  const { formState, trigger, watch, setValue, getValues, control } = form;
  const watchedDate = watch('date');
  const watchedLocation = watch('location');
  const watchedTime = watch('time');
  const watchedType = watch('type');
  const watchedPlayers = watch('players');

  const selectedMatchSize = parseInt(form.watch('matchSize'), 10);
  const matchType = form.watch('type');
  const selectedPlayersCount = form.watch('players').length;

  useEffect(() => {
    // Reset state when dialog is opened or closed
    if (!open) {
      setTimeout(() => {
        form.reset({
          title: 'Partido Amistoso',
          date: new Date(),
          time: '21:00',
          type: 'manual',
          matchSize: '10',
          players: [],
          isPublic: false,
        });
        setStep(1);
        setSearchTerm('');
        setWeather(null);
      }, 200);
    }
  }, [open, form]);

  useEffect(() => {
    // Fetch weather when date or location changes
    const fetchWeather = async () => {
        if (watchedDate && watchedLocation?.address) {
            setIsFetchingWeather(true);
            setWeather(null);
            try {
                const dateObj = watchedDate;
                const [hours, minutes] = watchedTime.split(':').map(Number);
                const matchDateTime = new Date(dateObj);
                matchDateTime.setHours(hours, minutes);

                const forecast = await getMatchDayForecast({
                    location: watchedLocation.address,
                    date: matchDateTime.toISOString(),
                });
                setWeather(forecast);
            } catch (error) {
                console.error("Failed to fetch weather", error);
                setWeather(null); // Clear previous weather on error
            } finally {
                setIsFetchingWeather(false);
            }
        }
    };
    
    const debounceTimeout = setTimeout(() => {
        fetchWeather();
    }, 1000); // Debounce to avoid excessive API calls

    return () => clearTimeout(debounceTimeout);
  }, [watchedDate, watchedLocation, watchedTime]);


  useEffect(() => {
    // Reset player selection when match type or size changes
    setValue('players', []);
  }, [matchType, selectedMatchSize, setValue]);


  const handlePlayerSelect = (playerId: string, checked: boolean) => {
    const currentPlayers = form.getValues('players');
    const newPlayers = checked
      ? [...currentPlayers, playerId]
      : currentPlayers.filter(id => id !== playerId);
    
    if (newPlayers.length > selectedMatchSize) {
        toast({
            variant: 'destructive',
            title: 'Límite de jugadores alcanzado',
            description: `No podés seleccionar más de ${selectedMatchSize} jugadores.`
        });
        return;
    }
    setValue('players', newPlayers, { shouldValidate: true });
  };
  
  const filteredPlayers = useMemo(() => {
    if (!allPlayers) return [];
    return allPlayers.filter(player => player.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allPlayers, searchTerm]);

  const goToNextStep = async () => {
    const fieldsToValidate: (keyof MatchFormData)[] = ['title', 'date', 'time', 'location', 'type', 'matchSize'];
    const result = await trigger(fieldsToValidate);
    if (result) {
        if (matchType === 'collaborative') {
            form.handleSubmit(onSubmit)();
        } else {
            setStep(2);
        }
    }
  };


  const onSubmit = (data: MatchFormData) => {
    if (!user || !firestore || !user.activeGroupId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Tenés que tener un grupo activo.' });
      return;
    }
    
    startTransition(async () => {
        try {
            if (data.type === 'manual') {
              await createManualMatch(data);
            } else {
              await createCollaborativeMatch(data);
            }
            
            toast({ title: '¡Listo!', description: 'Partido armado correctamente.' });
            setOpen(false);
        } catch (error: any) {
            console.error('Error al crear el partido:', error);
            toast({
                variant: 'destructive',
                title: 'Error al armar el partido',
                description: error.message || 'No se pudo programar el partido.',
            });
        }
    });
  };

  const createManualMatch = async (data: MatchFormData) => {
    if (!firestore || !user?.uid || !user.activeGroupId) throw new Error("User not authenticated");
    
    const batch = writeBatch(firestore);

    const selectedPlayersData = allPlayers.filter(p => data.players.includes(p.id));
    
    let finalTeams: Team[] = [];
    if (selectedPlayersData.length === selectedMatchSize) {
        const teamGenerationResult = await generateTeamsAction(selectedPlayersData);
        if ('error' in teamGenerationResult) {
            throw new Error(teamGenerationResult.error || 'No se pudieron generar los equipos.');
        }
        finalTeams = teamGenerationResult.teams || [];
    }

    const newMatchRef = doc(collection(firestore, 'matches'));
    const newMatch = {
      ...data,
      date: data.date.toISOString(),
      isPublic: false,
      matchSize: selectedMatchSize,
      status: 'upcoming' as const,
      ownerUid: user.uid,
      groupId: user.activeGroupId,
      players: selectedPlayersData.map(p => ({ uid: p.id, displayName: p.name, ovr: p.ovr, position: p.position, photoUrl: p.photoUrl || '' })),
      playerUids: selectedPlayersData.map(p => p.id),
      teams: finalTeams,
      weather: weather || undefined,
    };
    batch.set(newMatchRef, newMatch);

    selectedPlayersData.forEach(player => {
        if (player.id === user.uid) return; 
        const notificationRef = doc(collection(firestore, `users/${player.id}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            type: 'match_invite',
            title: '¡Te convocaron!',
            message: `${user.displayName} te sumó al partido "${data.title}".`,
            link: `/matches`,
            isRead: false,
            createdAt: new Date().toISOString(),
        };
        batch.set(notificationRef, notification);
    });

    await batch.commit();
  }

  const createCollaborativeMatch = async (data: MatchFormData) => {
    if (!user?.uid || !user.activeGroupId) throw new Error("User not authenticated");
    const newMatch = {
      ...data,
      date: data.date.toISOString(),
      isPublic: data.isPublic,
      matchSize: selectedMatchSize,
      status: 'upcoming' as const,
      ownerUid: user.uid,
      groupId: user.activeGroupId,
      players: [], 
      playerUids: [],
      teams: [],
      weather: weather || undefined,
    };

    await addDoc(collection(firestore!, 'matches'), newMatch);
  }

  const WeatherIcon = weather ? weatherIcons[weather.icon] : null;


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Armar Partido
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Armar un Partido Nuevo</DialogTitle>
            <DialogDescription>
              {step === 1 ? 'Meté los detalles del partido y elegí cómo se arma.' : 'Elegí los jugadores para el partido.'}
            </DialogDescription>
          </DialogHeader>

          <div className={cn("py-4 transition-all duration-300", step !== 1 && "hidden")}>
                <div className="space-y-4">
                <div>
                    <Label htmlFor="title">Título del Partido</Label>
                    <Input id="title" {...form.register('title')} />
                    {formState.errors.title && <p className="text-xs text-destructive mt-1">{formState.errors.title.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Fecha</Label>
                      <Controller
                          name="date"
                          control={control}
                          render={({ field }) => (
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <Button
                                          variant={"outline"}
                                          className={cn(
                                              "w-full justify-start text-left font-normal",
                                              !field.value && "text-muted-foreground"
                                          )}
                                      >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elegí una fecha</span>}
                                      </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                          mode="single"
                                          selected={field.value}
                                          onSelect={field.onChange}
                                          initialFocus
                                      />
                                  </PopoverContent>
                              </Popover>
                          )}
                      />
                      {formState.errors.date && <p className="text-xs text-destructive mt-1">{formState.errors.date.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="time">Hora</Label>
                        <Input id="time" {...form.register('time')} />
                        {formState.errors.time && <p className="text-xs text-destructive mt-1">{formState.errors.time.message}</p>}
                    </div>
                </div>
                
                <div>
                    <Label>Ubicación</Label>
                    <LocationInput onSelectLocation={(location) => setValue('location', location, { shouldValidate: true })} />
                    {formState.errors.location && <p className="text-xs text-destructive mt-1">{formState.errors.location.address?.message}</p>}
                </div>
                
                <div className="p-3 bg-muted/50 rounded-lg min-h-[60px] flex items-center justify-center">
                    {isFetchingWeather ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Viendo el pronóstico...</span>
                        </div>
                    ) : weather && WeatherIcon ? (
                        <div className="flex items-center justify-center gap-4 text-sm w-full">
                            <div className="flex items-center gap-2">
                                <WeatherIcon className="h-6 w-6 text-primary"/>
                                <p className="font-bold text-lg">{weather.temperature}°C</p>
                            </div>
                            <p className="font-medium text-muted-foreground">{weather.description}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center">Poné fecha y lugar para ver el pronóstico del tiempo.</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Tamaño del Partido</Label>
                    <Controller
                        name="matchSize"
                        control={form.control}
                        render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-3 gap-2">
                                <Label className="group flex flex-col items-center justify-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                    <RadioGroupItem value="10" className="sr-only" />
                                    <SoccerPlayerIcon className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground group-has-[:checked]:text-primary-foreground" />
                                    <span className="font-bold text-sm">Fútbol 5</span>
                                </Label>
                                <Label className="group flex flex-col items-center justify-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                    <RadioGroupItem value="14" className="sr-only" />
                                    <SoccerPlayerIcon className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground group-has-[:checked]:text-primary-foreground" />
                                    <span className="font-bold text-sm">Fútbol 7</span>
                                </Label>
                                <Label className="group flex flex-col items-center justify-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                    <RadioGroupItem value="22" className="sr-only" />
                                    <SoccerPlayerIcon className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground group-has-[:checked]:text-primary-foreground" />
                                    <span className="font-bold text-sm">Fútbol 11</span>
                                </Label>
                            </RadioGroup>
                        )}
                    />
                </div>
                
                <div className="space-y-2">
                    <Label>Tipo de Partido</Label>
                     <Controller
                        name="type"
                        control={form.control}
                        render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Label className="flex gap-4 border rounded-md p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                    <div className="flex-shrink-0 mt-1">
                                        <RadioGroupItem value="manual" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 font-bold">
                                            <UserCheck className="h-5 w-5" />
                                            <span>Manual</span>
                                        </div>
                                        <span className="text-xs font-normal leading-tight">El organizador elige a todos los jugadores.</span>
                                    </div>
                                </Label>
                                <Label className="flex gap-4 border rounded-md p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                    <div className="flex-shrink-0 mt-1">
                                        <RadioGroupItem value="collaborative" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                         <div className="flex items-center gap-2 font-bold">
                                            <Users className="h-5 w-5" />
                                            <span>Colaborativo</span>
                                        </div>
                                        <span className="text-xs font-normal leading-tight">Los jugadores del grupo se apuntan para participar.</span>
                                    </div>
                                </Label>
                            </RadioGroup>
                        )}
                    />
                </div>

                {watchedType === 'collaborative' && (
                  <Controller
                    name="isPublic"
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex items-center space-x-4 rounded-md border p-4">
                        <Globe />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            Hacer Partido Público
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Permite que jugadores de afuera de tu grupo lo encuentren y se sumen.
                          </p>
                        </div>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                )}
                </div>
          </div>
          
          <div className={cn("py-4 transition-all duration-300", step !== 2 && "hidden")}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Jugadores ({selectedPlayersCount} / {selectedMatchSize})</Label>
                        <Progress value={(selectedPlayersCount / selectedMatchSize) * 100} />
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar jugador por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    {allPlayers.length > 0 ? (
                        <div className="max-h-[350px] md:max-h-full overflow-y-auto space-y-2 border p-2 rounded-md">
                            {filteredPlayers.map(player => (
                                <div key={player.id} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                                    <Checkbox
                                        id={`player-${player.id}`}
                                        onCheckedChange={(checked) => handlePlayerSelect(player.id, !!checked)}
                                        checked={form.getValues('players').includes(player.id)}
                                    />
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <Label htmlFor={`player-${player.id}`} className="flex-1 cursor-pointer flex items-center gap-2">
                                        <span className="font-semibold">{player.name}</span>
                                        <SoccerPlayerIcon className={cn("h-4 w-4", positionColors[player.position])} />
                                        <span className={cn("text-xs font-semibold", positionColors[player.position])}>{player.position}</span>
                                    </Label>
                                </div>
                            ))}
                            {filteredPlayers.length === 0 && (
                                <p className="p-4 text-center text-sm text-muted-foreground">
                                    No se encontraron jugadores con ese nombre.
                                </p>
                            )}
                        </div>
                    ) : (
                        <Alert>
                            <AlertDescription>
                                No hay jugadores en tu grupo. Andá a la página de Jugadores para agregar.
                            </AlertDescription>
                        </Alert>
                    )}
                    {formState.errors.players && <p className="text-xs text-destructive mt-1">{formState.errors.players.message}</p>}
                </div>
          </div>
          
          <DialogFooter>
            {step === 1 && (
                 <Button type="button" onClick={goToNextStep}>
                    {matchType === 'collaborative' ? 'Armar Partido' : 'Siguiente'}
                 </Button>
            )}
            {step === 2 && (
                <div className="flex w-full justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                    <Button type="submit" disabled={isPending || (watchedType === 'manual' && watchedPlayers.length < selectedMatchSize / 2)}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isPending ? 'Armando...' : 'Armar Partido'}
                    </Button>
                </div>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
