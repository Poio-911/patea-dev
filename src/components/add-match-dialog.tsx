

'use client';

import { Button } from '@/components/ui/button';
import {
    ResponsiveDialog as Dialog,
    ResponsiveDialogContent as DialogContent,
    ResponsiveDialogDescription as DialogDescription,
    ResponsiveDialogFooter as DialogFooter,
    ResponsiveDialogHeader as DialogHeader,
    ResponsiveDialogTitle as DialogTitle,
    ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Search, ArrowLeft, Sun, Cloud, Cloudy, CloudRain, Wind, Zap, UserCheck, Users, Globe, Check, HelpCircle, ChevronRight, UsersRound, MapPin } from 'lucide-react';
import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser, useAuth } from '@/firebase';
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
import { PlayerSelectItem } from './player-select-item';
import { generateTeamsAction, getWeatherForecastAction, createActivityAction } from '@/lib/actions/server-actions';
import { getGroupVenuesAction } from '@/lib/actions/venue-actions';
import type { Venue } from '@/lib/types';
import { Progress } from './ui/progress';
import type { GetMatchDayForecastOutput } from '@/ai/flows/get-match-day-forecast';
import { Switch } from './ui/switch';
// Removed Google Places autocomplete; using OSM endpoints instead
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { loadGooglePlaces } from '@/lib/google-maps';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { useCollection } from '@/firebase/firestore/use-collection';
import { JerseyPreview } from './team-builder/jersey-preview';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { createSessionCookie } from '@/lib/auth-actions';
import {
    ResponsiveTooltip as Tooltip,
    ResponsiveTooltipContent as TooltipContent,
    ResponsiveTooltipProvider as TooltipProvider,
    ResponsiveTooltipTrigger as TooltipTrigger,
} from '@/components/ui/responsive-tooltip';
// Removed local position badge in favor of shared PlayerPositionBadge via PlayerSelectItem

const matchLocationSchema = z.object({
    name: z.string(),
    address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
    lat: z.number(),
    lng: z.number(),
    placeId: z.string(),
});

const matchSchema = z.object({
    title: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
    isPlanning: z.boolean().default(false),
    date: z.date().optional(),
    time: z.string().optional(),
    location: matchLocationSchema,
    type: z.enum(['manual', 'collaborative', 'by_teams'], { required_error: 'El tipo es obligatorio.' }),
    matchSize: z.enum(['10', '14', '22'], { required_error: 'El tamaño es obligatorio.' }),
    players: z.array(z.string()),
    selectedTeams: z.array(z.string()).optional(),
    isPublic: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'manual') {
        const minPlayers = Math.ceil(parseInt(data.matchSize) / 2);
        if (data.players.length < minPlayers) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debes seleccionar suficientes jugadores.", path: ['players'] });
        }
    }
    if (data.type === 'by_teams' && data.selectedTeams?.length !== 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debes seleccionar exactamente 2 equipos.", path: ['selectedTeams'] });
    }
    if (!data.isPlanning) {
        if (!data.date) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha es obligatoria.", path: ['date'] });
        }
        if (!data.time) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La hora es obligatoria.", path: ['time'] });
        } else if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.time)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Formato de hora inválido.", path: ['time'] });
        }
    }
});


type MatchFormData = z.infer<typeof matchSchema>;

interface AddMatchDialogProps {
    allPlayers: Player[];
    disabled?: boolean;
}

const weatherIcons: Record<string, React.ElementType> = {
    Sun, Cloud, Cloudy, CloudRain, Wind, Zap
}

// Deprecated per UI homogenization: use PlayerPositionBadge via PlayerSelectItem

interface LocationInputProps {
    onSelectLocation: (location: MatchLocation) => void;
    groupVenues?: Venue[];
    venuesLoading?: boolean;
}

const LocationInput = ({ onSelectLocation, groupVenues = [], venuesLoading = false }: LocationInputProps) => {
    const [value, setValue] = useState('');
    const [osmSuggestions, setOsmSuggestions] = useState<Array<{ label: string; lat: number; lng: number; placeId: string }>>([]);
    const [googleSuggestions, setGoogleSuggestions] = useState<Array<{ description: string; placeId: string }>>([]);
    const [geoLoading, setGeoLoading] = useState(false);
    const [autocompleteLoading, setAutocompleteLoading] = useState(false);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [useGoogleAutocomplete, setUseGoogleAutocomplete] = useState(false);
    const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);
    const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
    const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

    const trimAddress = (addr?: string) => {
        if (!addr) return '';
        const parts = addr.split(',').map(p => p.trim()).filter(Boolean);
        return parts.slice(0, 2).join(', ');
    };

    useEffect(() => {
        // Load Google Places and initialize services (no pac overlay UI)
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined;
        let cancelled = false;
        if (!apiKey) return;
        loadGooglePlaces(apiKey, 'es')
            .then((g) => {
                if (cancelled) return;
                try {
                    if (!autocompleteServiceRef.current) {
                        autocompleteServiceRef.current = new g.maps.places.AutocompleteService();
                    }
                    if (!placesServiceRef.current) {
                        const dummy = document.createElement('div');
                        placesServiceRef.current = new g.maps.places.PlacesService(dummy);
                    }
                    setUseGoogleAutocomplete(true);
                } catch {
                    setUseGoogleAutocomplete(false);
                }
            })
            .catch(() => setUseGoogleAutocomplete(false));
        return () => { cancelled = true; };
    }, []);

    const [debouncedValue, setDebouncedValue] = useState(value);

    // Debounce the input value update
    useEffect(() => {
        setAutocompleteLoading(true);
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, 300); // Reduced to 300ms for snappier response
        return () => clearTimeout(handler);
    }, [value]);

    // Fetch Google suggestions when active
    useEffect(() => {
        if (!useGoogleAutocomplete) return;
        let active = true;

        // Use debouncedValue instead of value
        if (!debouncedValue || debouncedValue.length < 3) {
            setGoogleSuggestions([]);
            setIsOpen(false);
            return;
        }

        const svc = autocompleteServiceRef.current;
        if (!svc) return;

        // Optimize with location bias (e.g. UY, AR) to speed up relevance
        const req: any = {
            input: debouncedValue,
            types: ['establishment', 'geocode'],
            componentRestrictions: { country: ['uy', 'ar'] } // Restrict to Uruguay and Argentina
        };

        svc.getPlacePredictions(req, (preds: any) => {
            setAutocompleteLoading(false);
            if (!active) return;
            const arr = (preds || []).map((p: any) => {
                const main = p.structured_formatting?.main_text as string | undefined;
                const secondary = p.structured_formatting?.secondary_text as string | undefined;
                const secondaryTrimmed = secondary ? secondary.split(',').slice(0, 2).map((s: any) => String(s).trim()).join(', ') : undefined;
                const fallback = (p.description || '').split(',').slice(0, 2).map((s: any) => String(s).trim()).join(', ');
                const label = main ? `${main} – ${secondaryTrimmed || ''}`.trim().replace(/\s–\s$/, '') : fallback;
                return { description: label, placeId: p.place_id as string };
            });
            setGoogleSuggestions(arr);
            setIsOpen(arr.length > 0);
        });
        return () => { active = false; };
    }, [debouncedValue, useGoogleAutocomplete]);

    useEffect(() => {
        if (useGoogleAutocomplete) return; // skip OSM when Google is active
        let active = true;
        const fetchOsm = async () => {
            try {
                if (!debouncedValue || debouncedValue.length < 3) { setOsmSuggestions([]); setAutocompleteLoading(false); return; }
                const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(debouncedValue)}`);
                const json = await res.json();
                if (active && json?.success) {
                    setOsmSuggestions(json.suggestions || []);
                    setAutocompleteLoading(false);
                }
            } catch {
                if (active) {
                    setOsmSuggestions([]);
                    setAutocompleteLoading(false);
                }
            }
        };
        fetchOsm();
        setIsOpen(!!debouncedValue && debouncedValue.length > 2);
        return () => { active = false; };
    }, [debouncedValue, useGoogleAutocomplete]);

    const handleVenueSelect = (venue: Venue) => {
        onSelectLocation({
            name: venue.name,
            address: venue.address,
            lat: venue.location.lat,
            lng: venue.location.lng,
            placeId: `venue:${venue.id}`,
        });
    };

    const tryGeocode = async (addr: string) => {
        if (!addr || addr.length < 5) { setGeoError('Ingresá una dirección válida.'); return; }
        setGeoLoading(true);
        setGeoError(null);
        try {
            const resp = await fetch('/api/geocode', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr })
            });
            const json = await resp.json();
            if (!json?.success) throw new Error(json?.error || 'No se pudo geocodificar');
            onSelectLocation({
                name: json.name || 'Cancha',
                address: addr,
                lat: json.lat,
                lng: json.lng,
                placeId: json.placeId || `manual:${json.lat},${json.lng}`,
            });
            setIsOpen(false);
            setOsmSuggestions([]);
        } catch (e: any) {
            setGeoError(e?.message || 'Error de geocodificación');
        } finally {
            setGeoLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Canchas del grupo */}
            {groupVenues.length > 0 && !showSearch && (
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Canchas del Grupo</Label>
                    {venuesLoading ? (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                            {groupVenues.map(venue => (
                                <Button
                                    key={venue.id}
                                    type="button"
                                    variant="outline"
                                    className="justify-start h-auto py-2 px-3"
                                    onClick={() => handleVenueSelect(venue)}
                                >
                                    <MapPin className="h-4 w-4 mr-2 text-primary shrink-0" />
                                    <div className="text-left overflow-hidden">
                                        <p className="font-medium truncate">{venue.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{venue.address}</p>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSearch(true)}
                        className="w-full"
                    >
                        <Search className="h-4 w-4 mr-2" />
                        Buscar otra ubicación
                    </Button>
                </div>
            )}

            {/* Búsqueda de ubicación (Google u OSM según disponibilidad) */}
            {(showSearch || groupVenues.length === 0) && (
                <div className="space-y-2">
                    {groupVenues.length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSearch(false)}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver a canchas del grupo
                        </Button>
                    )}
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <div className="space-y-2">
                                <div className="relative">
                                    <Input
                                        ref={setInputEl}
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                        onKeyDown={async (e) => {
                                            if (!useGoogleAutocomplete && e.key === 'Enter' && value && value.length >= 5) {
                                                e.preventDefault();
                                                await tryGeocode(value);
                                            }
                                        }}
                                        placeholder="Buscá la dirección de la cancha..."
                                        autoComplete="off"
                                    />
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {autocompleteLoading && value.length > 2 && (
                                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground inline" />
                                            )}
                                            <p className="text-xs text-muted-foreground">{useGoogleAutocomplete ? 'Elegí una sugerencia de Google.' : 'Tip: Elegí una sugerencia o usá la dirección escrita.'}</p>
                                        </div>
                                        {!useGoogleAutocomplete && (
                                            <Button type="button" variant="outline" size="sm" onClick={() => tryGeocode(value)} disabled={geoLoading || !value || value.length < 5}>Usar dirección</Button>
                                        )}
                                    </div>
                                    {geoError && <p className="text-xs text-destructive mt-1">{geoError}</p>}
                                </div>
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <Command>
                                <CommandList>
                                    <CommandGroup>
                                        {useGoogleAutocomplete ? (
                                            googleSuggestions.length > 0 ? (
                                                googleSuggestions.map(s => (
                                                    <CommandItem key={s.placeId} value={s.description} onSelect={() => {
                                                        const svc = placesServiceRef.current;
                                                        const g = (window as any).google as typeof google | undefined;
                                                        if (!svc || !g) return;
                                                        svc.getDetails({ placeId: s.placeId, fields: ['place_id', 'name', 'formatted_address', 'geometry'] }, (place, status) => {
                                                            if (!place || status !== g.maps.places.PlacesServiceStatus.OK || !place.geometry?.location || !place.place_id) return;
                                                            const lat = place.geometry.location.lat();
                                                            const lng = place.geometry.location.lng();
                                                            onSelectLocation({
                                                                name: (place.name || 'Cancha'),
                                                                address: place.formatted_address || s.description,
                                                                lat,
                                                                lng,
                                                                placeId: place.place_id,
                                                            });
                                                            const display = place.name ? `${place.name} – ${trimAddress(place.formatted_address || s.description)}` : (trimAddress(place.formatted_address || s.description) || s.description);
                                                            setValue(display);
                                                            setIsOpen(false);
                                                            setGoogleSuggestions([]);
                                                        });
                                                    }}>
                                                        {s.description}
                                                    </CommandItem>
                                                ))
                                            ) : (
                                                <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                                            )
                                        ) : (
                                            <>
                                                {osmSuggestions.map(s => (
                                                    <CommandItem key={s.placeId} value={s.label} onSelect={() => {
                                                        onSelectLocation({ name: s.label, address: s.label, lat: s.lat, lng: s.lng, placeId: s.placeId });
                                                        setValue(s.label);
                                                        setIsOpen(false);
                                                        setOsmSuggestions([]);
                                                    }}>
                                                        {s.label}
                                                    </CommandItem>
                                                ))}
                                                {osmSuggestions.length === 0 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                                            </>
                                        )}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            )}
        </div>
    );
};


export function AddMatchDialog({ allPlayers, disabled }: AddMatchDialogProps) {
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [positionFilter, setPositionFilter] = useState<'all' | 'DEL' | 'MED' | 'DEF' | 'POR'>('all');
    const [weather, setWeather] = useState<GetMatchDayForecastOutput | null>(null);
    const [isFetchingWeather, setIsFetchingWeather] = useState(false);
    const [groupVenues, setGroupVenues] = useState<Venue[]>([]);
    const [venuesLoading, setVenuesLoading] = useState(false);
    const { user } = useUser();
    const auth = useAuth();
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
            isPlanning: false,
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
    const watchedIsPlanning = watch('isPlanning');
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
                    isPlanning: false,
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
                setPositionFilter('all');
                setWeather(null);
            }, 200);
        }
    }, [open, form]);

    // Ensure server session cookie exists when opening the dialog
    useEffect(() => {
        const ensureSession = async () => {
            try {
                if (open && auth?.currentUser) {
                    const idToken = await auth.currentUser.getIdToken(true);
                    await createSessionCookie(idToken);
                }
            } catch (e) {
                // Non-blocking: if it fails, API will return auth error and UI will show toast
            }
        };
        ensureSession();
    }, [open, auth]);

    // Load group venues when dialog opens
    useEffect(() => {
        const loadVenues = async () => {
            if (!open || !user?.activeGroupId) return;
            setVenuesLoading(true);
            try {
                const result = await getGroupVenuesAction(user.activeGroupId);
                if (result.success && result.venues) {
                    setGroupVenues(result.venues);
                }
            } catch (e) {
                console.error('Error loading venues:', e);
            } finally {
                setVenuesLoading(false);
            }
        };
        loadVenues();
    }, [open, user?.activeGroupId]);

    useEffect(() => {
        const fetchWeather = async () => {
            if (watchedDate && watchedLocation?.address) {
                setIsFetchingWeather(true);
                setWeather(null);
                try {
                    const dateObj = watchedDate;
                    const [hours, minutes] = (watchedTime || '00:00').split(':').map(Number);
                    const matchDateTime = new Date(dateObj);
                    matchDateTime.setHours(hours, minutes);

                    const forecast = await getWeatherForecastAction({
                        location: watchedLocation.address,
                        date: matchDateTime.toISOString(),
                        lat: watchedLocation.lat,
                        lng: watchedLocation.lng,
                    });
                    if ('description' in forecast) {
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
                toast({ variant: 'destructive', title: 'Límite de equipos', description: 'Solo puedes seleccionar 2 equipos.' });
                return;
            }
            newTeams = [...currentTeams, teamId];
        }
        setValue('selectedTeams', newTeams, { shouldValidate: true });
    };


    const filteredPlayers = useMemo(() => {
        if (!allPlayers) return [];
        return allPlayers.filter(player => {
            const matchesName = player.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
            return matchesName && matchesPosition;
        });
    }, [allPlayers, searchTerm, positionFilter]);

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
                // Try to reassert server session before calling the API
                try {
                    if (auth?.currentUser) {
                        const idToken = await auth.currentUser.getIdToken(true);
                        await createSessionCookie(idToken);
                    }
                } catch { }
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
        if (!user?.uid || !user.activeGroupId) throw new Error("Datos insuficientes para crear partido por equipos.");
        if (!data.selectedTeams || data.selectedTeams.length !== 2) throw new Error("Debes seleccionar exactamente 2 equipos.");

        const resp = await fetch('/api/matches/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                title: data.title,
                date: data.isPlanning || !data.date ? '' : new Date(`${data.date.toDateString()} ${data.time || '00:00'}`).toISOString(),
                time: data.isPlanning || !data.time ? '' : data.time,
                isPlanning: data.isPlanning,
                location: data.location,
                type: 'by_teams',
                matchSize: parseInt(data.matchSize),
                isPublic: false,
                weather: data.isPlanning ? undefined : weather,
                selectedTeams: data.selectedTeams,
            }),
        });
        const json = await resp.json();
        if (!json?.success) throw new Error(json?.error || 'No se pudo crear el partido');
    };


    const createManualMatch = async (data: MatchFormData) => {
        if (!firestore || !user?.uid || !user.activeGroupId) throw new Error("User not authenticated");

        // Delegate to server API

        const selectedPlayersData = allPlayers
            .filter(p => data.players.includes(p.id))
            .map(p => ({
                id: p.id,
                name: p.name,
                ovr: p.ovr,
                position: p.position
            }));

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

        const resp = await fetch('/api/matches/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                title: data.title,
                date: data.isPlanning || !data.date ? '' : data.date.toISOString(),
                time: data.isPlanning || !data.time ? '' : data.time,
                isPlanning: data.isPlanning,
                location: data.location,
                type: 'manual',
                matchSize: selectedMatchSize,
                isPublic: false,
                weather: data.isPlanning ? undefined : weather,
                players: selectedPlayersData.map(p => p.id),
            }),
        });
        const json = await resp.json();
        if (!json?.success) throw new Error(json?.error || 'No se pudo crear el partido');
    }

    const createCollaborativeMatch = async (data: MatchFormData) => {
        if (!user?.uid || !user.activeGroupId) throw new Error("User not authenticated");
        const newMatch: any = {
            ...data,
            date: data.date ? data.date.toISOString() : '',
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

        const resp = await fetch('/api/matches/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                title: data.title,
                date: data.isPlanning || !data.date ? '' : data.date.toISOString(),
                time: data.isPlanning || !data.time ? '' : data.time,
                isPlanning: data.isPlanning,
                location: data.location,
                type: 'collaborative',
                matchSize: selectedMatchSize,
                isPublic: data.isPublic,
                weather: data.isPlanning ? undefined : weather,
            }),
        });
        const json = await resp.json();
        if (!json?.success) throw new Error(json?.error || 'No se pudo crear el partido');
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
                                    <LocationInput
                                        onSelectLocation={(location) => setValue('location', location, { shouldValidate: true })}
                                        groupVenues={groupVenues}
                                        venuesLoading={venuesLoading}
                                    />
                                    {formState.errors.location && <p className="text-xs text-destructive mt-1">{formState.errors.location.address?.message}</p>}
                                </div>

                                <div className="space-y-4">
                                    <Controller
                                        name="isPlanning"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="flex items-center justify-between space-x-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                                                <div className="flex-1 space-y-1">
                                                    <Label htmlFor="isPlanning" className="font-semibold cursor-pointer text-sm">Definir horario por votación</Label>
                                                    <p className="text-xs text-muted-foreground">Elegí esta opción si todavía no saben la fecha u hora.</p>
                                                </div>
                                                <Switch id="isPlanning" checked={field.value} onCheckedChange={field.onChange} />
                                            </div>
                                        )}
                                    />

                                    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity", watchedIsPlanning && "opacity-50 pointer-events-none")}>
                                        <div>
                                            <Label>Fecha</Label>
                                            <Controller
                                                name="date"
                                                control={control}
                                                render={({ field }) => {
                                                    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

                                                    const handleSelect = (date: Date | undefined) => {
                                                        field.onChange(date);
                                                        setIsDatePickerOpen(false);
                                                    };

                                                    return isMobile ? (
                                                        <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                                            <DialogTrigger asChild>
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
                                                            </DialogTrigger>
                                                            <DialogContent className="w-[calc(100%-2rem)] max-w-md p-4 flex flex-col items-center">
                                                                <DialogHeader className="w-full text-center sm:text-left mb-2">
                                                                    <DialogTitle>Seleccionar Fecha</DialogTitle>
                                                                    <DialogDescription className="sr-only">Seleccioná la fecha del partido en el calendario</DialogDescription>
                                                                </DialogHeader>
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={field.value}
                                                                    onSelect={handleSelect}
                                                                    locale={es}
                                                                    className="rounded-md border mx-auto"
                                                                />
                                                            </DialogContent>
                                                        </Dialog>
                                                    ) : (
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
                                                    );
                                                }}
                                            />
                                            {formState.errors.date && <p className="text-xs text-destructive mt-1">{formState.errors.date.message}</p>}
                                        </div>
                                        <div>
                                            <Label htmlFor="time">Hora</Label>
                                            <Input id="time" {...form.register('time')} />
                                            {formState.errors.time && <p className="text-xs text-destructive mt-1">{formState.errors.time.message}</p>}
                                        </div>
                                    </div>

                                    {!watchedIsPlanning && (
                                        <div className="p-3 bg-muted/50 rounded-lg min-h-[60px] flex items-center justify-center">
                                            {isFetchingWeather ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Viendo el pronóstico...</span>
                                                </div>
                                            ) : weather && WeatherIcon ? (
                                                <div className="flex items-center justify-center gap-4 text-sm w-full">
                                                    <div className="flex items-center gap-2">
                                                        <WeatherIcon className="h-6 w-6 text-primary" />
                                                        <p className="font-bold text-lg">{weather.temperature}°C</p>
                                                    </div>
                                                    <p className="font-medium text-muted-foreground">{weather.description}</p>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center">Poné fecha y lugar para ver el pronóstico.</p>
                                            )}
                                        </div>
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

                                        {/* Búsqueda y Filtros */}
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Buscar jugador..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>

                                            {/* Filtro por posición */}
                                            <ToggleGroup
                                                type="single"
                                                value={positionFilter}
                                                onValueChange={(v) => setPositionFilter((v || 'all') as typeof positionFilter)}
                                                className="justify-start"
                                            >
                                                <ToggleGroupItem value="all" size="sm">Todos</ToggleGroupItem>
                                                <ToggleGroupItem value="DEL" size="sm" className="text-chart-1">DEL</ToggleGroupItem>
                                                <ToggleGroupItem value="MED" size="sm" className="text-chart-2">MED</ToggleGroupItem>
                                                <ToggleGroupItem value="DEF" size="sm" className="text-chart-3">DEF</ToggleGroupItem>
                                                <ToggleGroupItem value="POR" size="sm" className="text-chart-4">POR</ToggleGroupItem>
                                            </ToggleGroup>
                                        </div>

                                        {/* Selección rápida */}
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span className="text-sm text-muted-foreground">Selección rápida:</span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const needed = selectedMatchSize - selectedPlayersCount;
                                                    if (needed <= 0) return;
                                                    const currentSelected = form.getValues('players');
                                                    const available = allPlayers
                                                        .filter(p => !currentSelected.includes(p.id))
                                                        .sort((a, b) => b.ovr - a.ovr)
                                                        .slice(0, needed);
                                                    const newSelection = [...currentSelected, ...available.map(p => p.id)];
                                                    setValue('players', newSelection, { shouldValidate: true });
                                                }}
                                                disabled={selectedPlayersCount >= selectedMatchSize}
                                            >
                                                Completar con mejores
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setValue('players', [], { shouldValidate: true })}
                                                disabled={selectedPlayersCount === 0}
                                            >
                                                Limpiar selección
                                            </Button>
                                        </div>

                                        {allPlayers.length > 0 ? (
                                            <div className="max-h-[350px] md:max-h-full overflow-y-auto space-y-2 border p-2 rounded-md">
                                                {filteredPlayers.map(player => {
                                                    const isSelected = form.getValues('players').includes(player.id);
                                                    return (
                                                        <PlayerSelectItem
                                                            key={player.id}
                                                            player={player}
                                                            selected={isSelected}
                                                            onToggle={() => handlePlayerSelect(player.id, !isSelected)}
                                                            variant="row"
                                                            selectionControl="checkbox"
                                                            showPosition
                                                            showOvr
                                                            density="sm"
                                                        />
                                                    );
                                                })}
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
                                        {!teamsLoading && (!groupTeams || groupTeams.length === 0) && (
                                            <Alert><AlertDescription>Tu grupo no tiene equipos creados. Creá un equipo desde la sección "Mis Equipos" para usar este modo.</AlertDescription></Alert>
                                        )}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-1">
                                            {groupTeams?.map(team => (
                                                <div key={team.id} onClick={() => handleTeamSelect(team.id)} className={cn("relative rounded-lg border-2 cursor-pointer transition-all", getValues('selectedTeams')?.includes(team.id) ? 'border-primary ring-2 ring-primary/50' : 'hover:border-primary/50')}>
                                                    <div className="flex flex-col items-center p-4 gap-2">
                                                        <JerseyPreview jersey={team.jersey} size="md" />
                                                        <p className="font-bold text-center text-sm">{team.name}</p>
                                                        <p className="text-xs text-muted-foreground">{team.members?.length ?? 0} jugadores</p>
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
                            <Button type="submit" className="w-full sm:w-auto" disabled={isPending || (watchedType === 'manual' && watchedPlayers.length < selectedMatchSize / 2) || (watchedType === 'by_teams' && (form.watch('selectedTeams')?.length ?? 0) < 2)}>
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
