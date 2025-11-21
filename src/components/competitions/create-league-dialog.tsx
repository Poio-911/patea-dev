
'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Loader2, PlusCircle, Trophy, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GroupTeam, LeagueFormat } from '@/lib/types';
import { createLeagueAction } from '@/lib/actions/server-actions';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { JerseyPreview } from '../team-builder/jersey-preview';
import { Badge } from '../ui/badge';
import { AnimatePresence, motion } from 'framer-motion';
import { initializeFirebase } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { TeamSelectorCard } from './team-selector-card';

const createLeagueSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  format: z.enum(['round_robin', 'double_round_robin'], { required_error: 'Debes seleccionar un formato.' }),
  teamIds: z.array(z.string()).min(4, 'Debes seleccionar al menos 4 equipos.'),
  isPublic: z.boolean().default(false),
  // Schedule configuration
  startDate: z.string().min(1, 'Debes seleccionar una fecha de inicio.'),
  matchFrequency: z.enum(['weekly', 'biweekly'], { required_error: 'Debes seleccionar la frecuencia.' }),
  matchDayOfWeek: z.number().min(0).max(6),
  matchTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Hora inválida.'),
  defaultLocation: z.string().optional(),
});

type CreateLeagueForm = z.infer<typeof createLeagueSchema>;

const daysOfWeek = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

interface CreateLeagueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  userId: string;
  teams: GroupTeam[];
}

export function CreateLeagueDialog({ open, onOpenChange, groupId, userId, teams }: CreateLeagueDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<CreateLeagueForm>({
    resolver: zodResolver(createLeagueSchema),
    defaultValues: {
      name: '',
      format: 'round_robin',
      teamIds: [],
      isPublic: false,
      startDate: '',
      matchFrequency: 'weekly',
      matchDayOfWeek: 6, // Saturday by default
      matchTime: '15:00',
      defaultLocation: '',
    },
  });
  const { register, handleSubmit, control, getValues, setValue, trigger, formState: { errors } } = form;

  const handleTeamSelect = (teamId: string) => {
    const currentTeamIds = getValues('teamIds') || [];
    const newTeamIds = currentTeamIds.includes(teamId)
      ? currentTeamIds.filter(id => id !== teamId)
      : [...currentTeamIds, teamId];
    setValue('teamIds', newTeamIds, { shouldValidate: true });
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Error', description: 'El archivo debe ser una imagen.' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Error', description: 'La imagen no debe superar los 5MB.' });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const onSubmit = async (data: CreateLeagueForm) => {
    setIsCreating(true);
    try {
      let logoUrl: string | undefined;

      // Upload logo if selected
      if (logoFile) {
        const { firebaseApp } = initializeFirebase();
        const storage = getStorage(firebaseApp);
        const filePath = `leagues/${groupId}/${Date.now()}_${logoFile.name}`;
        const storageRef = ref(storage, filePath);

        const uploadResult = await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(uploadResult.ref);
      }

      const scheduleConfig = {
        startDate: data.startDate,
        matchFrequency: data.matchFrequency,
        matchDayOfWeek: data.matchDayOfWeek,
        matchTime: data.matchTime,
        defaultLocation: data.defaultLocation ? {
          name: data.defaultLocation,
          address: '',
          lat: 0,
          lng: 0,
          placeId: '',
        } : undefined,
      };

      const result = await createLeagueAction(
        data.name,
        data.format,
        data.teamIds,
        data.isPublic,
        groupId,
        userId,
        scheduleConfig,
        logoUrl
      );

      if (result.success) {
        toast({ title: '¡Liga Creada!', description: `La liga "${data.name}" ha sido creada.` });
        onOpenChange(false);
        form.reset();
        setStep(1);
        removeLogo();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo crear la liga.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleNextStep = async () => {
    let fieldsToValidate: (keyof CreateLeagueForm)[] = [];
    if (step === 1) {
      fieldsToValidate = ['name', 'format'];
    } else if (step === 2) {
      fieldsToValidate = ['startDate', 'matchFrequency', 'matchTime'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setStep(prev => prev + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3"><Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> Crear Nueva Liga</DialogTitle>
          <DialogDescription>
            Configurá los detalles de tu liga de todos contra todos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 my-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${step >= i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i}</div>
              <p className={`text-sm font-medium ${step >= i ? 'text-foreground' : 'text-muted-foreground'}`}>
                {i === 1 ? 'Detalles' : i === 2 ? 'Programación' : 'Equipos'}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-y-auto -mx-6 px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="py-4 space-y-4"
              >
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre de la Liga</Label>
                      <Input id="name" placeholder="Ej: Liga de los Domingos" {...register('name')} />
                      {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Logo de la Liga (Opcional)</Label>
                      {!logoPreview ? (
                        <div className="flex items-center justify-center w-full">
                          <label htmlFor="logo-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">PNG, JPG hasta 5MB</p>
                            </div>
                            <input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                          </label>
                        </div>
                      ) : (
                        <div className="relative w-full h-32 border-2 rounded-lg overflow-hidden">
                          <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain bg-muted/30" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={removeLogo}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Formato</Label>
                      <Controller name="format" control={control} render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                          <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <RadioGroupItem value="round_robin" className="sr-only" />
                            <h3 className="font-semibold">Todos contra todos</h3>
                            <p className="text-xs text-muted-foreground text-center">Cada equipo juega contra todos una vez.</p>
                          </Label>
                          <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <RadioGroupItem value="double_round_robin" className="sr-only" />
                            <h3 className="font-semibold">Ida y vuelta</h3>
                            <p className="text-xs text-muted-foreground text-center">Cada equipo juega contra todos dos veces.</p>
                          </Label>
                        </RadioGroup>
                      )} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Controller name="isPublic" control={control} render={({ field }) => (
                        <Switch id="is-public" checked={field.value} onCheckedChange={field.onChange} />
                      )} />
                      <Label htmlFor="is-public">Permitir que equipos de otros grupos se postulen</Label>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Fecha de Inicio</Label>
                      <Input id="startDate" type="date" {...register('startDate')} min={new Date().toISOString().split('T')[0]} />
                      {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Frecuencia de Partidos</Label>
                      <Controller name="matchFrequency" control={control} render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                          <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <RadioGroupItem value="weekly" className="sr-only" />
                            <h3 className="font-semibold">Semanal</h3>
                            <p className="text-xs text-muted-foreground">Cada 7 días</p>
                          </Label>
                          <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <RadioGroupItem value="biweekly" className="sr-only" />
                            <h3 className="font-semibold">Quincenal</h3>
                            <p className="text-xs text-muted-foreground">Cada 14 días</p>
                          </Label>
                        </RadioGroup>
                      )} />
                      {errors.matchFrequency && <p className="text-sm text-destructive">{errors.matchFrequency.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="matchDayOfWeek">Día Preferido</Label>
                        <Controller name="matchDayOfWeek" control={control} render={({ field }) => (
                          <select
                            id="matchDayOfWeek"
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {daysOfWeek.map(day => (
                              <option key={day.value} value={day.value}>{day.label}</option>
                            ))}
                          </select>
                        )} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="matchTime">Hora</Label>
                        <Input id="matchTime" type="time" {...register('matchTime')} />
                        {errors.matchTime && <p className="text-sm text-destructive">{errors.matchTime.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultLocation">Ubicación por Defecto (Opcional)</Label>
                      <Input id="defaultLocation" placeholder="Ej: Cancha Municipal" {...register('defaultLocation')} />
                      <p className="text-xs text-muted-foreground">Puedes cambiarla para cada partido después.</p>
                    </div>
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-4">
                    <Label>Equipos Participantes (mínimo 4)</Label>
                    <ScrollArea className="h-72">
                      <div className="grid grid-cols-1 gap-2 pr-4">
                        {teams.map(team => (
                          <TeamSelectorCard
                            key={team.id}
                            team={team}
                            isSelected={getValues('teamIds').includes(team.id)}
                            onSelect={handleTeamSelect}
                            currentGroupId={groupId}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                    {errors.teamIds && <p className="text-sm text-destructive">{errors.teamIds.message}</p>}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <DialogFooter className="mt-auto pt-4 border-t">
            {step < 3 ? (
              <>
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={() => setStep(prev => prev - 1)}>
                    Atrás
                  </Button>
                )}
                <Button type="button" onClick={handleNextStep}>Siguiente</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setStep(prev => prev - 1)}>Atrás</Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Liga
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
