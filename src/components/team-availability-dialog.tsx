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
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Loader2, MapPin } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { MatchLocation, GroupTeam } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { createTeamAvailabilityPostAction } from '@/lib/actions/server-actions';
import { celebrationConfetti } from '@/lib/animations';

const matchLocationSchema = z.object({
  name: z.string(),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string(),
});

const postSchema = z.object({
  date: z.date({
    required_error: "La fecha del partido es obligatoria.",
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM).'),
  location: matchLocationSchema,
  description: z.string().optional(),
});

type PostFormData = z.infer<typeof postSchema>;

interface TeamAvailabilityDialogProps {
  team: GroupTeam;
  userId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const LocationInput = ({ onSelectLocation, value: initialValue }: {
  onSelectLocation: (location: MatchLocation) => void;
  value?: MatchLocation;
}) => {
    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            componentRestrictions: { country: 'UY' }
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
                        value={initialValue?.address || value}
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
                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                        <CommandGroup>
                            {data.map((suggestion) => (
                                <CommandItem
                                    key={suggestion.place_id}
                                    onSelect={() => handleSelect(suggestion)}
                                    className="flex items-center gap-2"
                                >
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                        <div className="font-medium">
                                            {suggestion.structured_formatting.main_text}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {suggestion.structured_formatting.secondary_text}
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export function TeamAvailabilityDialog({ team, userId, trigger, onSuccess }: TeamAvailabilityDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      time: '19:00',
    },
  });

  const selectedDate = watch('date');
  const selectedLocation = watch('location');

  const onSubmit = (data: PostFormData) => {
    startTransition(async () => {
      const result = await createTeamAvailabilityPostAction(
        team.id,
        userId,
        {
          date: data.date.toISOString().split('T')[0],
          time: data.time,
          location: data.location,
          description: data.description,
        }
      );

      if (result.success) {
        celebrationConfetti();
        toast({
          title: '¡Postulación creada!',
          description: `Tu equipo "${team.name}" está disponible para jugar.`,
        });
        setOpen(false);
        reset();
        onSuccess?.();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo crear la postulación.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Postular Equipo</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Postular {team.name}</DialogTitle>
          <DialogDescription>
            Publicá cuando y dónde tu equipo está disponible para jugar. Otros equipos podrán aceptar tu postulación.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="date">Fecha del partido</Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, 'PPP', { locale: es }) : 'Seleccioná una fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
          </div>

          {/* Time Input */}
          <div className="space-y-2">
            <Label htmlFor="time">Hora</Label>
            <Controller
              control={control}
              name="time"
              render={({ field }) => (
                <Input
                  type="time"
                  {...field}
                  placeholder="HH:MM"
                />
              )}
            />
            {errors.time && <p className="text-sm text-destructive">{errors.time.message}</p>}
          </div>

          {/* Location Input */}
          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <Controller
              control={control}
              name="location"
              render={({ field }) => (
                <LocationInput
                  onSelectLocation={field.onChange}
                  value={field.value}
                />
              )}
            />
            {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Ej: Preferimos jugar en pasto sintético. Tenemos 11 jugadores disponibles."
                  rows={3}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publicar Postulación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
