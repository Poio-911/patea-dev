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
import { useState, useTransition, useEffect } from 'react';
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
// Removed Google Places; using OSM endpoints instead
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
  const [value, setValue] = useState(initialValue?.address || '');
  const [osmSuggestions, setOsmSuggestions] = useState<Array<{ label: string; lat: number; lng: number; placeId: string }>>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchOsm = async () => {
      try {
        if (!value || value.length < 3) { setOsmSuggestions([]); return; }
        const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(value)}`);
        const json = await res.json();
        if (active && json?.success) setOsmSuggestions(json.suggestions || []);
      } catch {
        if (active) setOsmSuggestions([]);
      }
    };
    fetchOsm();
    setIsOpen(!!value && value.length > 2);
    return () => { active = false; };
  }, [value]);

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
      onSelectLocation({ name: json.name || addr, address: addr, lat: json.lat, lng: json.lng, placeId: json.placeId || `manual:${json.lat},${json.lng}` });
      setIsOpen(false);
      setOsmSuggestions([]);
    } catch (e: any) {
      setGeoError(e?.message || 'Error de geocodificación');
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && value && value.length >= 5) {
                e.preventDefault();
                await tryGeocode(value);
              }
            }}
            placeholder="Buscá la dirección de la cancha..."
            autoComplete="off"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Tip: Elegí una sugerencia o usá la dirección escrita.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => tryGeocode(value)} disabled={geoLoading || !value || value.length < 5}>Usar dirección</Button>
          </div>
          {geoError && <p className="text-xs text-destructive mt-1">{geoError}</p>}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandList>
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
            <CommandGroup>
              {osmSuggestions.map((s) => (
                <CommandItem
                  key={s.placeId}
                  onSelect={() => {
                    onSelectLocation({ name: s.label, address: s.label, lat: s.lat, lng: s.lng, placeId: s.placeId });
                    setValue(s.label);
                    setIsOpen(false);
                    setOsmSuggestions([]);
                  }}
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">Coordenadas: {s.lat}, {s.lng}</div>
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

      if ('success' in result && result.success) {
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
          description: ('error' in result && result.error) || 'No se pudo crear la postulación.',
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
