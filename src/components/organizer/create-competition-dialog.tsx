'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Calendar as CalendarIcon } from 'lucide-react';
import type { CompetitionFormat, LeagueFormat, CupFormat, CupSeedingType } from '@/lib/types';
import { LeagueLogoCropperDialog } from '@/components/organizer/league-logo-cropper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { initializeFirebase } from '@/firebase';
import { loadGooglePlaces } from '@/lib/google-maps';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Settings2, Users, DollarSign, BookTemplate, Save, Trash2 } from 'lucide-react';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { saveTemplateAction, loadTemplatesAction, deleteTemplateAction, type CompetitionTemplate } from '@/lib/actions/template-actions';

const competitionSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  format: z.enum(['league', 'cup'] as const),
  subFormat: z.string(),
  sportType: z.enum(['f5', 'f7', 'f11'] as const),
  locationData: z.object({
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
  }).nullable().optional(),
  startDate: z.string().optional(),
  // Advanced rules
  pointsForWin: z.number().min(1).max(10).optional(),
  pointsForDraw: z.number().min(0).max(10).optional(),
  tiebreaker: z.enum(['goal_difference', 'goals_for', 'head_to_head'] as const).optional(),
  yellowsForSuspension: z.number().min(1).max(20).optional(),
  seedingType: z.enum(['random', 'ovr_based'] as const).optional(),
  // Registration
  maxTeams: z.number().min(2).max(64).optional(),
  registrationFee: z.number().min(0).optional(),
  registrationDeadline: z.string().optional(),
  allowPublicRegistration: z.boolean().optional(),
});

interface CreateCompetitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CompetitionLocationData = {
  address: string;
  lat: number;
  lng: number;
};

interface CompetitionLocationInputProps {
  value: CompetitionLocationData | null | undefined;
  onChange: (location: CompetitionLocationData) => void;
}

function CompetitionLocationInput({ value, onChange }: CompetitionLocationInputProps) {
  const [inputValue, setInputValue] = React.useState(value?.address || '');
  const [isOpen, setIsOpen] = React.useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = React.useState(false);
  const [geoLoading, setGeoLoading] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const [googleSuggestions, setGoogleSuggestions] = React.useState<Array<{ description: string; placeId: string }>>([]);
  const [osmSuggestions, setOsmSuggestions] = React.useState<Array<{ label: string; lat: number; lng: number; placeId: string }>>([]);
  const [useGoogleAutocomplete, setUseGoogleAutocomplete] = React.useState(false);
  const [debouncedValue, setDebouncedValue] = React.useState(inputValue);
  const autocompleteServiceRef = React.useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = React.useRef<google.maps.places.PlacesService | null>(null);

  React.useEffect(() => {
    setInputValue(value?.address || '');
  }, [value?.address]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    setAutocompleteLoading(true);
    const handler = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [inputValue]);

  React.useEffect(() => {
    if (!useGoogleAutocomplete) return;
    let active = true;

    if (!debouncedValue || debouncedValue.length < 3) {
      setGoogleSuggestions([]);
      setIsOpen(false);
      setAutocompleteLoading(false);
      return;
    }

    const svc = autocompleteServiceRef.current;
    if (!svc) {
      setAutocompleteLoading(false);
      return;
    }

    const request: any = {
      input: debouncedValue,
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: ['uy', 'ar'] },
    };

    svc.getPlacePredictions(request, (predictions: any) => {
      if (!active) return;
      const entries = (predictions || []).map((prediction: any) => {
        const main = prediction.structured_formatting?.main_text as string | undefined;
        const secondary = prediction.structured_formatting?.secondary_text as string | undefined;
        const secondaryTrimmed = secondary
          ? secondary.split(',').slice(0, 2).map((segment: string) => segment.trim()).join(', ')
          : undefined;
        const fallback = (prediction.description || '').split(',').slice(0, 2).map((segment: string) => String(segment).trim()).join(', ');
        const label = main ? `${main} – ${secondaryTrimmed || ''}`.trim().replace(/\s–\s$/, '') : fallback;
        return { description: label, placeId: prediction.place_id as string };
      });

      setGoogleSuggestions(entries);
      setIsOpen(entries.length > 0);
      setAutocompleteLoading(false);
    });

    return () => { active = false; };
  }, [debouncedValue, useGoogleAutocomplete]);

  React.useEffect(() => {
    if (useGoogleAutocomplete) return;
    let active = true;

    const fetchOsm = async () => {
      try {
        if (!debouncedValue || debouncedValue.length < 3) {
          setOsmSuggestions([]);
          setIsOpen(false);
          setAutocompleteLoading(false);
          return;
        }

        const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(debouncedValue)}`);
        const json = await response.json();
        if (active && json?.success) {
          setOsmSuggestions(json.suggestions || []);
          setIsOpen((json.suggestions || []).length > 0);
        }
      } catch {
        if (active) {
          setOsmSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (active) {
          setAutocompleteLoading(false);
        }
      }
    };

    fetchOsm();
    return () => { active = false; };
  }, [debouncedValue, useGoogleAutocomplete]);

  const resolveTypedAddress = async (address: string) => {
    if (!address || address.length < 5) {
      setGeoError('Ingresá una dirección válida.');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const json = await response.json();

      if (!json?.success) {
        throw new Error(json?.error || 'No se pudo validar la dirección.');
      }

      onChange({
        address,
        lat: json.lat,
        lng: json.lng,
      });
      setIsOpen(false);
      setOsmSuggestions([]);
      setGoogleSuggestions([]);
    } catch (error: any) {
      setGeoError(error?.message || 'Error al validar la dirección.');
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="space-y-2">
            <Input
              value={inputValue}
              onChange={(event) => {
                setGeoError(null);
                setInputValue(event.target.value);
              }}
              onKeyDown={async (event) => {
                if (!useGoogleAutocomplete && event.key === 'Enter' && inputValue.length >= 5) {
                  event.preventDefault();
                  await resolveTypedAddress(inputValue);
                }
              }}
              placeholder="Buscá o escribí la dirección de la sede..."
              autoComplete="off"
              className="bg-background/50 border-white/10"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {(autocompleteLoading || geoLoading) && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>{useGoogleAutocomplete ? 'Elegí una sugerencia de Google.' : 'Elegí una sugerencia o validá la dirección escrita.'}</span>
              </div>
              {!useGoogleAutocomplete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => resolveTypedAddress(inputValue)}
                  disabled={geoLoading || !inputValue || inputValue.length < 5}
                >
                  Usar dirección
                </Button>
              )}
            </div>
            {value?.address && (
              <p className="text-xs text-primary">Dirección seleccionada: {value.address}</p>
            )}
            {geoError && <p className="text-xs text-destructive">{geoError}</p>}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]" align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
          <Command>
            <CommandList>
              <CommandGroup>
                {useGoogleAutocomplete ? (
                  googleSuggestions.length > 0 ? (
                    googleSuggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion.placeId}
                        value={suggestion.description}
                        onSelect={() => {
                          const svc = placesServiceRef.current;
                          const g = (window as any).google as typeof google | undefined;
                          if (!svc || !g) return;

                          svc.getDetails(
                            { placeId: suggestion.placeId, fields: ['place_id', 'formatted_address', 'geometry'] },
                            (place, status) => {
                              if (!place || status !== g.maps.places.PlacesServiceStatus.OK || !place.geometry?.location || !place.place_id) {
                                return;
                              }

                              const lat = place.geometry.location.lat();
                              const lng = place.geometry.location.lng();
                              const address = place.formatted_address || suggestion.description;

                              onChange({ address, lat, lng });
                              setInputValue(address);
                              setIsOpen(false);
                              setGoogleSuggestions([]);
                            }
                          );
                        }}
                      >
                        {suggestion.description}
                      </CommandItem>
                    ))
                  ) : (
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                  )
                ) : (
                  <>
                    {osmSuggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion.placeId}
                        value={suggestion.label}
                        onSelect={() => {
                          onChange({
                            address: suggestion.label,
                            lat: suggestion.lat,
                            lng: suggestion.lng,
                          });
                          setInputValue(suggestion.label);
                          setIsOpen(false);
                          setOsmSuggestions([]);
                        }}
                      >
                        {suggestion.label}
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
  );
}

export function CreateCompetitionDialog({ open, onOpenChange }: CreateCompetitionDialogProps) {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [generatedPhotoUrl, setGeneratedPhotoUrl] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<CompetitionTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);
  const [templatePopoverOpen, setTemplatePopoverOpen] = React.useState(false);

  const form = useForm<z.infer<typeof competitionSchema>>({
    resolver: zodResolver(competitionSchema),
    defaultValues: {
      name: '',
      format: 'league',
      subFormat: 'round_robin',
      sportType: 'f5',
      locationData: null,
      startDate: '',
      // Advanced rules defaults
      pointsForWin: 3,
      pointsForDraw: 1,
      tiebreaker: 'goal_difference',
      yellowsForSuspension: 5,
      seedingType: 'random',
      allowPublicRegistration: false,
    },
  });

  const format = form.watch('format');

  React.useEffect(() => {
    if (open && user) {
      setLoadingTemplates(true);
      loadTemplatesAction(user.uid).then((result) => {
        if (result.success && result.templates) setTemplates(result.templates);
        setLoadingTemplates(false);
      });
    }
  }, [open, user]);

  const applyTemplate = React.useCallback((tpl: CompetitionTemplate) => {
    form.setValue('format', tpl.format);
    if (tpl.subFormat) form.setValue('subFormat', tpl.subFormat);
    if (tpl.sportType) form.setValue('sportType', tpl.sportType as 'f5' | 'f7' | 'f11');
    if (tpl.rules?.pointsForWin !== undefined) form.setValue('pointsForWin', tpl.rules.pointsForWin);
    if (tpl.rules?.pointsForDraw !== undefined) form.setValue('pointsForDraw', tpl.rules.pointsForDraw);
    if (tpl.rules?.tiebreaker) form.setValue('tiebreaker', tpl.rules.tiebreaker as 'goal_difference' | 'goals_for' | 'head_to_head');
    if (tpl.rules?.yellowsForSuspension !== undefined) form.setValue('yellowsForSuspension', tpl.rules.yellowsForSuspension);
    if (tpl.registrationConfig?.maxTeams) form.setValue('maxTeams', tpl.registrationConfig.maxTeams);
    if (tpl.registrationConfig?.registrationFee !== undefined) form.setValue('registrationFee', tpl.registrationConfig.registrationFee);
    if (tpl.registrationConfig?.allowRegistrations !== undefined) form.setValue('allowPublicRegistration', tpl.registrationConfig.allowRegistrations);
    setTemplatePopoverOpen(false);
    toast({ title: `Plantilla “${tpl.name}” aplicada` });
  }, [form, toast]);

  const handleSaveTemplate = React.useCallback(async () => {
    if (!user) return;
    const data = form.getValues();
    const name = window.prompt('Nombre para la plantilla:');
    if (!name?.trim()) return;
    setIsSavingTemplate(true);
    const result = await saveTemplateAction(user.uid, {
      name: name.trim(),
      format: data.format,
      subFormat: data.subFormat,
      sportType: data.sportType,
      rules: {
        pointsForWin: data.pointsForWin,
        pointsForDraw: data.pointsForDraw,
        tiebreaker: data.tiebreaker,
        yellowsForSuspension: data.yellowsForSuspension,
      },
      registrationConfig: {
        allowRegistrations: data.allowPublicRegistration || false,
        maxTeams: data.maxTeams,
        registrationFee: data.registrationFee,
        requirePayment: (data.registrationFee ?? 0) > 0,
        requireDocuments: false,
      },
    });
    setIsSavingTemplate(false);
    if (result.success) {
      toast({ title: 'Plantilla guardada' });
      loadTemplatesAction(user.uid).then((r) => { if (r.success && r.templates) setTemplates(r.templates); });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  }, [form, user, toast]);

  const parseDateFromText = React.useCallback((value?: string): Date | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }

    return undefined;
  }, []);

  const onSubmit = async (data: z.infer<typeof competitionSchema>) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    
    try {
      let finalLogoUrl = null;

      if (generatedPhotoUrl && generatedPhotoUrl.startsWith('data:image')) {
        try {
          setIsUploading(true);
          setUploadProgress(0);

          const response = await fetch(generatedPhotoUrl);
          const blob = await response.blob();

          const { firebaseApp } = initializeFirebase();
          const storage = getStorage(firebaseApp);
          const storagePath = `league-logos/${user.uid}/logo_${Date.now()}.webp`;
          const storageRef = ref(storage, storagePath);

          // Use uploadBytesResumable for progress tracking
          const uploadTask = uploadBytesResumable(storageRef, blob, {
            contentType: 'image/webp',
          });

          // Wait for upload to complete with progress updates
          await new Promise<void>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(Math.round(progress));
              },
              (error) => {
                reject(error);
              },
              () => {
                resolve();
              }
            );
          });

          finalLogoUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setIsUploading(false);
        } catch (uploadError) {
          console.error("Error uploading league logo:", uploadError);
          setIsUploading(false);
          toast({
            variant: "destructive",
            title: "Error al subir logo",
            description: "No se pudo subir el logo. Por favor, intentá de nuevo."
          });
          setIsSubmitting(false);
          return; // Don't create competition without logo if upload fails
        }
      }

      const isLeague = data.format === 'league';
      const collectionName = isLeague ? 'leagues' : 'cups';
      const competitionsRef = collection(firestore, collectionName);

      const commonFields = {
        name: data.name,
        logoUrl: finalLogoUrl || null,
        format: data.subFormat,
        sportType: data.sportType,
        location: data.locationData?.address || null,
        locationLat: data.locationData?.lat || null,
        locationLng: data.locationData?.lng || null,
        startDate: data.startDate || null,
        status: 'draft',
        ownerUid: user.uid,
        isPublic: true,
        teams: [],
        createdAt: serverTimestamp(),
      };

      const newCompetition = isLeague
        ? {
            ...commonFields,
            competitionType: 'league',
            groupId: 'standalone_league',
            standings: [],
            allowPublicRegistration: data.allowPublicRegistration || false,
            maxTeams: data.maxTeams || null,
            registrationFee: data.registrationFee ?? null,
            registrationDeadline: data.registrationDeadline || null,
            rules: {
              pointsForWin: data.pointsForWin || 3,
              pointsForDraw: data.pointsForDraw || 1,
              tiebreaker: data.tiebreaker || 'goal_difference',
              yellowsForSuspension: data.yellowsForSuspension || 5,
            },
          }
        : {
            ...commonFields,
            groupId: 'standalone_cup',
            seedingType: data.seedingType || 'random',
          };

      const docRef = await addDoc(competitionsRef, newCompetition);

      toast({
        title: isLeague ? 'Liga Creada' : 'Copa Creada',
        description: `¡Tu ${isLeague ? 'liga' : 'copa'} "${data.name}" se creó con éxito!`,
      });

      onOpenChange(false);
      form.reset();
      setImagePreview(null);
      setGeneratedPhotoUrl(null);
      router.push(isLeague ? `/organizer/league/${docRef.id}` : `/organizer/cup/${docRef.id}`);
    } catch (error: any) {
      console.error('[CreateCompetition] ERROR:', error?.code, error?.message, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || error?.code || 'Hubo un problema al crear la competición.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/20">
          <DialogTitle className="font-headline font-black uppercase tracking-tight text-xl">Nueva Competición</DialogTitle>
          <DialogDescription>
            Configurá tu torneo de ligas o copas con dirección, formato y reglas personalizadas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Templates bar */}
            <div className="flex items-center gap-2">
              <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" disabled={loadingTemplates}>
                    {loadingTemplates ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookTemplate className="h-3 w-3" />}
                    Plantillas
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2 z-[200]" align="start">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-2 py-1">Mis plantillas</p>
                  {templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-3">No hay plantillas guardadas.</p>
                  ) : (
                    <div className="space-y-1">
                      {templates.map((tpl) => (
                        <div key={tpl.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 group">
                          <button
                            type="button"
                            className="flex-1 text-left text-sm font-medium truncate"
                            onClick={() => applyTemplate(tpl)}
                          >
                            {tpl.name}
                            <span className="ml-1 text-xs text-muted-foreground font-normal">{tpl.format === 'league' ? 'Liga' : 'Copa'}</span>
                          </button>
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                            onClick={async () => {
                              if (!user || !tpl.id) return;
                              await deleteTemplateAction(user.uid, tpl.id);
                              setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">Cargá una configuración predefinida</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Logo Section */}
              <div className="flex flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
                <LeagueLogoCropperDialog
                  onSaveComplete={(newUrl) => {
                    setImagePreview(newUrl);
                    setGeneratedPhotoUrl(newUrl);
                  }}
                >
                  <button type="button" className="relative group focus:outline-none">
                    <Avatar className="h-28 w-28 border-4 border-muted-foreground/20 group-hover:border-primary/50 transition-colors bg-muted">
                      <AvatarImage src={imagePreview || undefined} alt="Logo de Torneo" className="object-cover" />
                      <AvatarFallback className="text-4xl bg-primary/10">
                        <Camera className="h-10 w-10 text-primary drop-shadow-[0_0_8px_rgba(200,255,0,0.5)]" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-8 w-8 text-foreground" />
                    </div>
                  </button>
                </LeagueLogoCropperDialog>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-center mt-2">Escudo Torneo</p>
              </div>

              {/* Basic Fields Section */}
              <div className="flex-1 space-y-4 w-full">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Nombre Comercial</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Copa de Verano 2026" className="font-headline font-black text-lg bg-background/50 border-white/10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Tipo</FormLabel>
                        <Select onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue('subFormat', val === 'league' ? 'round_robin' : 'single_elimination');
                        }} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50 border-white/10">
                              <SelectValue placeholder="Selecciona el tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[100]">
                            <SelectItem value="league">Liga (Puntos)</SelectItem>
                            <SelectItem value="cup">Copa (Eliminación)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {format === 'league' ? (
                    <FormField
                      control={form.control}
                      name="subFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Formato</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-background/50 border-white/10">
                                <SelectValue placeholder="Formato" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="z-[100]">
                              <SelectItem value="round_robin">Todos contra Todos</SelectItem>
                              <SelectItem value="double_round_robin">Ida y Vuelta</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="subFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Formato</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-background/50 border-white/10">
                                <SelectValue placeholder="Formato" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="z-[100]">
                              <SelectItem value="single_elimination">Eliminación Directa</SelectItem>
                              <SelectItem value="group_and_knockout">Fase de Grupos</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="h-px w-full bg-border/40" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField
                  control={form.control}
                  name="sportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Deporte</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background/50 border-white/10">
                            <SelectValue placeholder="Seleccioná el formato" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[100]">
                          <SelectItem value="f5">Futbol 5</SelectItem>
                          <SelectItem value="f7">Futbol 7</SelectItem>
                          <SelectItem value="f11">Futbol 11</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Fecha de Inicio <span className="text-muted-foreground/50 font-normal">(Opcional)</span></FormLabel>
                    <FormControl>
                      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between bg-background/50 border-white/10 hover:bg-background/70"
                          >
                            <span className={field.value ? 'text-foreground' : 'text-muted-foreground'}>
                              {field.value || 'Seleccioná una fecha'}
                            </span>
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            locale={es}
                            selected={parseDateFromText(field.value)}
                            onSelect={(selectedDate) => {
                              if (!selectedDate) return;
                              field.onChange(formatDate(selectedDate, 'dd/MM/yyyy'));
                              setIsDatePickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location Section */}
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="locationData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">
                      Sede Central (Dirección)
                    </FormLabel>
                    <FormControl>
                      <CompetitionLocationInput
                        value={field.value}
                        onChange={(locationData) => form.setValue('locationData', locationData)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Advanced Config Section - Conditional by format */}
            {format === 'league' ? (
            <>
            <Collapsible className="space-y-4 border-t border-border/40 pt-6">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex w-full items-center justify-between p-0 hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Reglamento Avanzado (Opcional)
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pointsForWin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">
                          Puntos por Victoria
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            className="bg-background/50 border-white/10"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 3)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pointsForDraw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">
                          Puntos por Empate
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            className="bg-background/50 border-white/10"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tiebreaker"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">
                          Desempate por
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50 border-white/10">
                              <SelectValue placeholder="Criterio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[100]">
                            <SelectItem value="goal_difference">Diferencia de Gol</SelectItem>
                            <SelectItem value="goals_for">Goles a Favor</SelectItem>
                            <SelectItem value="head_to_head">Enfrentamientos Directos</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="yellowsForSuspension"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">
                          Amarillas para Suspensión
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            className="bg-background/50 border-white/10"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <p className="text-xs text-muted-foreground/70 italic">
                  Estos ajustes permiten personalizar el sistema de puntos y criterios de desempate del torneo.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Registration Section - Leagues only */}
            <Collapsible className="space-y-4 border-t border-border/40 pt-6">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex w-full items-center justify-between p-0 hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Inscripciones Abiertas (Opcional)
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="allowPublicRegistration"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-border/40 p-3 bg-muted/20">
                      <div>
                        <FormLabel className="text-sm font-semibold">Permitir inscripción pública</FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">Los equipos podrán inscribirse desde la página pública de la liga.</p>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={e => field.onChange(e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxTeams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Máx. equipos</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={2}
                            max={64}
                            placeholder="Sin límite"
                            className="bg-background/50 border-white/10"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="registrationFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Arancel de inscripción ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Gratis"
                            className="bg-background/50 border-white/10"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="registrationDeadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Fecha límite de inscripción</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="bg-background/50 border-white/10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>
            </>
            ) : (
            <div className="border-t border-border/40 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Configuración de Copa</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="seedingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">Tipo de Sorteo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || 'random'}>
                        <FormControl>
                          <SelectTrigger className="bg-background/50 border-white/10">
                            <SelectValue placeholder="Tipo de sorteo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[100]">
                          <SelectItem value="random">Aleatorio</SelectItem>
                          <SelectItem value="ovr_based">Por Nivel (OVR)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="yellowsForSuspension"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold tracking-widest text-muted-foreground">
                        Amarillas para Suspensión
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          className="bg-background/50 border-white/10"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            )}

            {isUploading && (
              <div className="space-y-2 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Subiendo logo...</span>
                  <span className="font-bold text-primary">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-border/40 pb-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting || isUploading}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate || isSubmitting}
                className="text-xs gap-1.5"
              >
                {isSavingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Guardar plantilla
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploading} className="font-bold tracking-wide uppercase px-8">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploading ? `Subiendo ${uploadProgress}%` : 'Creando...'}
                  </>
                ) : 'Crear Competición'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
