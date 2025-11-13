
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
import { Loader2, PlusCircle, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GroupTeam, LeagueFormat } from '@/lib/types';
import { createLeagueAction } from '@/lib/actions/server-actions';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { JerseyPreview } from '../team-builder/jersey-preview';
import { Badge } from '../ui/badge';
import { AnimatePresence, motion } from 'framer-motion';

const createLeagueSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  format: z.enum(['round_robin', 'double_round_robin'], { required_error: 'Debes seleccionar un formato.' }),
  teamIds: z.array(z.string()).min(4, 'Debes seleccionar al menos 4 equipos.'),
  isPublic: z.boolean().default(false),
});

type CreateLeagueForm = z.infer<typeof createLeagueSchema>;

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
  const { toast } = useToast();

  const form = useForm<CreateLeagueForm>({
    resolver: zodResolver(createLeagueSchema),
    defaultValues: {
      name: '',
      format: 'round_robin',
      teamIds: [],
      isPublic: false,
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

  const onSubmit = async (data: CreateLeagueForm) => {
    setIsCreating(true);
    try {
      const result = await createLeagueAction(data.name, data.format, data.teamIds, data.isPublic, groupId, userId);
      if (result.success) {
        toast({ title: '¡Liga Creada!', description: `La liga "${data.name}" ha sido creada.` });
        onOpenChange(false);
        form.reset();
        setStep(1);
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
    const isValid = await trigger(step === 1 ? ['name', 'format'] : ['teamIds']);
    if (isValid) {
      setStep(prev => prev + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Crear Nueva Liga</DialogTitle>
          <DialogDescription>
            Configurá los detalles de tu liga de todos contra todos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 my-2">
            {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${step >= i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i}</div>
                    <p className={`text-sm font-medium ${step >= i ? 'text-foreground' : 'text-muted-foreground'}`}>{i === 1 ? 'Detalles' : 'Equipos'}</p>
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
                    <Label>Equipos Participantes (mínimo 4)</Label>
                    <ScrollArea className="h-72">
                      <div className="grid grid-cols-2 gap-2 pr-4">
                        {teams.map(team => (
                          <div key={team.id} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 has-[:checked]:bg-accent">
                            <Checkbox
                              id={`team-${team.id}`}
                              checked={getValues('teamIds').includes(team.id)}
                              onCheckedChange={() => handleTeamSelect(team.id)}
                            />
                            <Label htmlFor={`team-${team.id}`} className="flex-1 cursor-pointer flex items-center gap-2">
                               <div className="w-8 h-8 flex-shrink-0"><JerseyPreview jersey={team.jersey} /></div>
                               <span className="font-semibold text-sm truncate">{team.name}</span>
                            </Label>
                          </div>
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
            {step === 1 ? (
              <Button type="button" onClick={handleNextStep}>Siguiente</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Atrás</Button>
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
