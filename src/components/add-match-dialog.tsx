

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
import { Calendar as CalendarIcon, Loader2, PlusCircle, Search, ArrowLeft, Sun, Cloud, Cloudy, CloudRain, Wind, Zap, UserCheck, Users, Globe, Check, HelpCircle, ChevronRight, UsersRound } from 'lucide-react';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Player, MatchLocation, Notification, Team, MatchType, GroupTeam } from '@/lib/types';
import { celebrationConfetti } from '@/lib/animations';
import { Alert, AlertDescription } from './ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { generateTeamsAction, getWeatherForecastAction, createActivityAction } from '@/lib/actions/server-actions';
import { Progress } from './ui/progress';
import { GetMatchDayForecastOutput } from '@/ai/flows/get-match-day-forecast';
import { Switch } from './ui/switch';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { useCollection } from '@/firebase/firestore/use-collection';
import { JerseyPreview } from './team-builder/jersey-preview';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';

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
  type: z.enum(['manual', 'collaborative', 'by_teams'], { required_error: 'El tipo es obligatorio.' }),
  matchSize: z.enum(['10', '14', '22'], { required_error: 'El tamaño es obligatorio.' }),
  players: z.array(z.string()),
  selectedTeams: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
}).refine(data => {
    if (data.type === 'manual') {
        const minPlayers = Math.ceil(parseInt(data.matchSize) / 2);
        return data.players.length >= minPlayers;
    }
    if (data.type === 'by_teams') {
        return data.selectedTeams?.length === 2;
    }
    return true;
}, {
    message: "Para partidos 'manuales', debes seleccionar al menos la mitad de los jugadores. Para partidos 'por equipos', debes seleccionar exactamente 2 equipos.",
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
        requestOptions: { 
            componentRestrictions: { country: 'UY' } // Restringir a Uruguay
         },
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
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={!ready}
                        placeholder="Buscá la dirección de la cancha..."
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

  const teamsQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'teams'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  const { data: groupTeams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);

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
      selectedTeams: [],
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
          selectedTeams: [],
        });
        setStep(1);
        setSearchTerm('');
        setWeather(null);
      }, 200);
    }
  }, [open, form]);

  useEffect(() => {
    const fetchWeather = async () => {
        if (watchedDate && watchedLocation?.address) {
            setIsFetchingWeather(true);
            setWeather(null);
            try {
                const dateObj = watchedDate;
                const [hours, minutes] = watchedTime.split(':').map(Number);
                const matchDateTime = new Date(dateObj);
                matchDateTime.setHours(hours, minutes);

                const forecast = await getWeatherForecastAction({
                    location: watchedLocation.address,
                    date: matchDateTime.toISOString(),
                });
                if('description' in forecast) {
                    setWeather(forecast);
                }
            } catch (error) {
                console.error("Failed to fetch weather", error);
                setWeather(null);
            } finally {
                setIsFetchingWeather(false);
            }
        }
    };
    
    const debounceTimeout = setTimeout(() => {
        fetchWeather();
    }, 1000);

    return () => clearTimeout(debounceTimeout);
  }, [watchedDate, watchedLocation, watchedTime]);


  useEffect(() => {
    setValue('players', []);
    setValue('selectedTeams', []);
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
  
  const handleTeamSelect = (teamId: string) => {
    const currentTeams = getValues('selectedTeams') || [];
    let newTeams;
    if (currentTeams.includes(teamId)) {
        newTeams = currentTeams.filter(id => id !== teamId);
    } else {
        if (currentTeams.length >= 2) {
            toast({ variant: 'destructive', title: 'Límite de equipos', description: 'Solo puedes seleccionar 2 equipos.'});
            return;
        }
        newTeams = [...currentTeams, teamId];
    }
    setValue('selectedTeams', newTeams, { shouldValidate: true });
  };
  

  const filteredPlayers = useMemo(() => {
    if (!allPlayers) return [];
    return allPlayers.filter(player => player.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allPlayers, searchTerm]);

  const goToNextStep = async () => {
    let fieldsToValidate: (keyof MatchFormData)[];
    if (step === 1) {
        fieldsToValidate = ['title', 'date', 'time', 'location'];
    } else if (step === 2) {
        fieldsToValidate = ['matchSize', 'type'];
    } else {
        return;
    }

    const result = await trigger(fieldsToValidate);
    if (result) {
        if (step === 2 && getValues('type') === 'collaborative') {
            form.handleSubmit(onSubmit)(); // Submit form directly if collaborative
        } else {
            setStep(s => s + 1);
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
            } else if (data.type === 'by_teams') {
              await createByTeamsMatch(data);
            } else {
              await createCollaborativeMatch(data);
            }

            celebrationConfetti();
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

  const createByTeamsMatch = async (data: MatchFormData) => {
    if (!firestore || !user?.uid || !user.activeGroupId || !groupTeams) throw new Error("Datos insuficientes para crear partido por equipos.");
    if (!data.selectedTeams || data.selectedTeams.length !== 2) throw new Error("Debes seleccionar exactamente 2 equipos.");

    const selectedTeamsData = data.selectedTeams.map(id => groupTeams.find(t => t.id === id)).filter((t): t is GroupTeam => !!t);

    const allTeamMembers = selectedTeamsData.flatMap(t => t.members);
    const allPlayerIds = [...new Set(allTeamMembers.map(m => m.playerId))];
    
    const playersQuery = query(collection(firestore, 'players'), where('__name__', 'in', allPlayerIds));
    const playersSnap = await getDocs(playersQuery);
    const playersMap = new Map(playersSnap.docs.map(d => [d.id, {id: d.id, ...d.data()} as Player]));

    const finalTeams: Team[] = selectedTeamsData.map(teamData => {
        const teamPlayers = teamData.members.map(member => {
            const playerDetails = playersMap.get(member.playerId);
            return {
                uid: member.playerId,
                displayName: playerDetails?.name || 'Jugador',
                ovr: playerDetails?.ovr || 50,
                position: playerDetails?.position || 'MED'
            };
        });

        const totalOVR = teamPlayers.reduce((sum, p) => sum + p.ovr, 0);
        const averageOVR = totalOVR / teamPlayers.length;

        return {
            name: teamData.name,
            jersey: teamData.jersey,
            players: teamPlayers,
            totalOVR,
            averageOVR,
        };
    });

    const newMatchData: any = {
      title: data.title,
      date: data.date.toISOString(),
      time: data.time,
      location: data.location,
      type: 'by_teams' as MatchType,
      matchSize: finalTeams[0].players.length + finalTeams[1].players.length,
      isPublic: false,
      status: 'upcoming' as const,
      ownerUid: user.uid,
      groupId: user.activeGroupId,
      players: finalTeams.flatMap(t => t.players),
      playerUids: finalTeams.flatMap(t => t.players.map(p => p.uid)),
      teams: finalTeams,
    };

    if (weather) {
      newMatchData.weather = weather;
    }

    const matchDoc = await addDoc(collection(firestore, 'matches'), newMatchData);

    // Create social activity
    const currentPlayer = allPlayers.find(p => p.id === user.uid);
    if (currentPlayer) {
      await createActivityAction({
        type: 'match_organized',
        userId: user.uid,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        playerPhotoUrl: currentPlayer.photoUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          matchId: matchDoc.id,
          matchTitle: data.title,
        },
      });
    }
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
        if (!teamGenerationResult.teams) {
            throw new Error('La respuesta de la IA no contiene equipos.');
        }
        finalTeams = teamGenerationResult.teams;
    }

    const newMatchRef = doc(collection(firestore, 'matches'));
    const newMatch: any = {
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
    };

    if (weather) {
      newMatch.weather = weather;
    }

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
    const newMatch: any = {
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
    };

    if (weather) {
      newMatch.weather = weather;
    }

    const matchDoc = await addDoc(collection(firestore!, 'matches'), newMatch);

    // Create social activity
    const currentPlayer = allPlayers.find(p => p.id === user.uid);
    if (currentPlayer) {
      await createActivityAction({
        type: 'match_organized',
        userId: user.uid,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        playerPhotoUrl: currentPlayer.photoUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          matchId: matchDoc.id,
          matchTitle: data.title,
        },
      });
    }
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] w-[95vw] flex flex-col">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-grow overflow-hidden">
          <DialogHeader>
            <DialogTitle>Armar un Partido Nuevo</DialogTitle>
             <DialogDescription>
              Paso {step} de {getValues('type') === 'collaborative' ? 2 : 3}: {
                step === 1 ? 'Detalles del evento.' :
                step === 2 ? 'Formato del partido.' :
                'Selección de participantes.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-grow py-4 overflow-y-auto pr-2 -mx-2 px-2">
            {step === 1 && (
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="title">Título del Partido</Label>
                        <Input id="title" {...form.register('title')} />
                        {formState.errors.title && <p className="text-xs text-destructive mt-1">{formState.errors.title.message}</p>}
                    </div>
                    
                    <div>
                        <Label>Ubicación</Label>
                        <LocationInput onSelectLocation={(location) => setValue('location', location, { shouldValidate: true })} />
                        {formState.errors.location && <p className="text-xs text-destructive mt-1">{formState.errors.location.address?.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <p className="text-sm text-muted-foreground text-center">Poné fecha y lugar para ver el pronóstico.</p>
                        )}
                    </div>
                </div>
            )}
            
            {step === 2 && (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label>Tamaño del Partido</Label>
                        <Controller
                            name="matchSize"
                            control={form.control}
                            render={({ field }) => (
                                <ToggleGroup type="single" onValueChange={field.onChange} value={field.value} className="w-full justify-start" variant="outline">
                                    <ToggleGroupItem value="10" aria-label="Fútbol 5">Fútbol 5</ToggleGroupItem>
                                    <ToggleGroupItem value="14" aria-label="Fútbol 7">Fútbol 7</ToggleGroupItem>
                                    <ToggleGroupItem value="22" aria-label="Fútbol 11">Fútbol 11</ToggleGroupItem>
                                </ToggleGroup>
                            )}
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label>Tipo de Partido</Label>
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild><button type="button"><HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" /></button></TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p><b>Manual:</b> El DT elige, la IA arma equipos.</p>
                                        <p><b>Colaborativo:</b> Los jugadores se apuntan.</p>
                                        <p><b>Por Equipos:</b> Duelo de equipos creados.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                         <Controller
                            name="type"
                            control={form.control}
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <Label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                        <RadioGroupItem value="manual" />
                                        <div className="flex items-center gap-2 font-bold"><UserCheck className="h-4 w-4" /><span>Manual</span></div>
                                    </Label>
                                    <Label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                        <RadioGroupItem value="collaborative" />
                                        <div className="flex items-center gap-2 font-bold"><Users className="h-4 w-4" /><span>Colaborativo</span></div>
                                    </Label>
                                    <Label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary-foreground/50">
                                        <RadioGroupItem value="by_teams" />
                                        <div className="flex items-center gap-2 font-bold"><UsersRound className="h-4 w-4" /><span>Por Equipos</span></div>
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
                              <p className="text-sm font-medium leading-none">Hacer Partido Público</p>
                              <p className="text-sm text-muted-foreground">Permite que jugadores de afuera se sumen.</p>
                            </div>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </div>
                        )}
                      />
                    )}
                </div>
            )}
            {step === 3 && (
                <>
                   {matchType === 'manual' && (
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
                                            <Label htmlFor={`player-${player.id}`} className="flex-1 cursor-pointer flex items-center gap-2">
                                                <span className="font-semibold">{player.name}</span>
                                                <Badge variant="outline" className={cn("text-xs", positionColors[player.position])}>{player.position}</Badge>
                                            </Label>
                                        </div>
                                    ))}
                                    {filteredPlayers.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No se encontraron jugadores.</p>}
                                </div>
                            ) : (
                                <Alert><AlertDescription>No hay jugadores en tu grupo.</AlertDescription></Alert>
                            )}
                            {formState.errors.players && <p className="text-xs text-destructive mt-1">{formState.errors.players.message}</p>}
                        </div>
                   )}
                   {matchType === 'by_teams' && (
                        <div className="space-y-4">
                            <Label>Seleccioná dos equipos para el partido</Label>
                            {teamsLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-1">
                                {groupTeams?.map(team => (
                                    <div key={team.id} onClick={() => handleTeamSelect(team.id)} className={cn("rounded-lg border-2 cursor-pointer transition-all", getValues('selectedTeams')?.includes(team.id) ? 'border-primary ring-2 ring-primary/50' : 'hover:border-primary/50')}>
                                        <div className="flex flex-col items-center p-4 gap-2">
                                            <JerseyPreview jersey={team.jersey} size="md" />
                                            <p className="font-bold text-center text-sm">{team.name}</p>
                                        </div>
                                        {getValues('selectedTeams')?.includes(team.id) && (
                                            <div className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                                                <Check className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {formState.errors.selectedTeams && <p className="text-xs text-destructive mt-1">{formState.errors.selectedTeams.message}</p>}
                        </div>
                    )}
                </>
            )}
          </div>
          
          <DialogFooter className="mt-auto pt-4 border-t">
            {step > 1 && (
                <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} disabled={isPending}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Atrás
                </Button>
            )}
            {step < 3 && matchType !== 'collaborative' && (
                 <Button type="button" onClick={goToNextStep} className="w-full sm:w-auto" disabled={isPending}>
                    Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                 </Button>
            )}
             {step === 2 && matchType === 'collaborative' && (
                 <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Armar Partido'}
                 </Button>
            )}
            {step === 3 && (
                <Button type="submit" className="w-full sm:w-auto" disabled={isPending || (watchedType === 'manual' && watchedPlayers.length < selectedMatchSize / 2)}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isPending ? 'Armando...' : 'Armar Partido'}
                </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
