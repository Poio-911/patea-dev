'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trophy, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GroupTeam } from '@/lib/types';
import { createCupAction } from '@/lib/actions/server-actions';
import { JerseyPreview } from '../team-builder/jersey-preview';
import { AnimatePresence, motion } from 'framer-motion';
import { initializeFirebase } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getInitialRound } from '@/lib/utils/cup-bracket';
import { TeamSelectorCard } from './team-selector-card';

const createCupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  teamIds: z.array(z.string())
    .refine((ids) => {
      const validCounts = [2, 4, 8, 16, 32];
      return validCounts.includes(ids.length);
    }, 'Debes seleccionar 2, 4, 8, 16 o 32 equipos para el torneo.'),
  isPublic: z.boolean().default(false),
  startDate: z.string().min(1, 'Debes seleccionar una fecha de inicio.'),
  defaultLocation: z.string().optional(),
});

type CreateCupForm = z.infer<typeof createCupSchema>;

interface CreateCupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  userId: string;
  teams: GroupTeam[];
}

export function CreateCupDialog({ open, onOpenChange, groupId, userId, teams }: CreateCupDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<CreateCupForm>({
    resolver: zodResolver(createCupSchema),
    defaultValues: {
      name: '',
      teamIds: [],
      isPublic: false,
      startDate: '',
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

  const onSubmit = async (data: CreateCupForm) => {
    setIsCreating(true);
    try {
      let logoUrl: string | undefined;

      // Upload logo if selected
      if (logoFile) {
        const { firebaseApp } = initializeFirebase();
        const storage = getStorage(firebaseApp);
        const filePath = `cups/${groupId}/${Date.now()}_${logoFile.name}`;
        const storageRef = ref(storage, filePath);

        const uploadResult = await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(uploadResult.ref);
      }

      const defaultLocation = data.defaultLocation ? {
        name: data.defaultLocation,
        address: '',
        lat: 0,
        lng: 0,
        placeId: '',
      } : undefined;

      const result = await createCupAction(
        data.name,
        'single_elimination',
        data.isPublic,
        data.teamIds,
        groupId,
        userId,
        logoUrl,
        data.startDate,
        defaultLocation
      );

      if (result.success) {
        toast({ title: '¡Copa Creada!', description: `La copa "${data.name}" ha sido creada.` });
        onOpenChange(false);
        form.reset();
        setStep(1);
        removeLogo();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo crear la copa.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleNextStep = async () => {
    let fieldsToValidate: (keyof CreateCupForm)[] = [];
    if (step === 1) {
      fieldsToValidate = ['name'];
    } else if (step === 2) {
      fieldsToValidate = ['startDate'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setStep(prev => prev + 1);
    }
  };

  const selectedTeamCount = getValues('teamIds')?.length || 0;
  const validTeamCounts = [2, 4, 8, 16, 32];
  const isValidCount = validTeamCounts.includes(selectedTeamCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Crear Nueva Copa</DialogTitle>
          <DialogDescription>
            Configurá tu torneo de eliminación directa (pierde y queda afuera).
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
                      <Label htmlFor="name">Nombre de la Copa</Label>
                      <Input id="name" placeholder="Ej: Copa de Verano 2025" {...register('name')} />
                      {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Logo de la Copa (Opcional)</Label>
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
                      <Label>Formato de Torneo</Label>
                      <div className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-muted/30 p-4">
                        <h3 className="font-semibold">Eliminación Directa</h3>
                        <p className="text-xs text-muted-foreground text-center">Pierde y queda afuera. Un solo campeón.</p>
                      </div>
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
                      <p className="text-xs text-muted-foreground">Los partidos se programarán manualmente desde el bracket.</p>
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
                    <div className="space-y-2">
                      <Label>Equipos Participantes</Label>
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${isValidCount ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {selectedTeamCount} seleccionados
                        </span>
                        <span className="text-muted-foreground">Válido: 2, 4, 8, 16 o 32 equipos</span>
                      </div>
                    </div>
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
                  Crear Copa
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
