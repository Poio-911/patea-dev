
'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { JerseyDesigner } from './team-builder/jersey-designer';
import { Player, Jersey, GroupTeam } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';


interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  players: Player[];
  currentUserId: string;
}

const memberSchema = z.object({
  playerId: z.string(),
  number: z.coerce.number().min(1, 'El dorsal debe ser mayor a 0.').max(99, 'El dorsal no puede ser mayor a 99.'),
});

const createTeamSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  members: z.array(memberSchema).min(1, 'Debes seleccionar al menos un jugador.'),
  jersey: z.object({
      type: z.custom<Jersey['type']>(),
      primaryColor: z.string(),
      secondaryColor: z.string()
  })
});

type CreateTeamFormData = z.infer<typeof createTeamSchema>;

const MemberManager = ({ groupPlayers }: { groupPlayers: Player[] }) => {
    const { control, formState: { errors } } = useFormContext<CreateTeamFormData>();
    const { fields, append, remove } = useFieldArray({
        control,
        name: "members"
    });
    const [searchTerm, setSearchTerm] = useState('');

    const selectedPlayerIds = useMemo(() => new Set(fields.map(field => field.playerId)), [fields]);

    const filteredPlayers = useMemo(() => {
        return groupPlayers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [groupPlayers, searchTerm]);

    const handlePlayerToggle = (playerId: string) => {
        const existingIndex = fields.findIndex(field => field.playerId === playerId);
        if (existingIndex > -1) {
            remove(existingIndex);
        } else {
            const nextNumber = fields.length > 0 ? Math.max(...fields.map(f => f.number)) + 1 : 1;
            append({ playerId, number: nextNumber > 99 ? 1 : nextNumber });
        }
    };
    
    return (
        <div className="space-y-4">
             <div className="relative">
                <Input
                    placeholder="Buscar jugador..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                />
            </div>
            <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                {filteredPlayers.length > 0 ? filteredPlayers.map(player => (
                    <label key={player.id} htmlFor={`player-${player.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                        <Checkbox
                            id={`player-${player.id}`}
                            checked={selectedPlayerIds.has(player.id)}
                            onCheckedChange={() => handlePlayerToggle(player.id)}
                        />
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={player.photoUrl} alt={player.name} />
                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{player.name}</span>
                    </label>
                )) : <p className="text-center text-sm text-muted-foreground p-4">No se encontraron jugadores.</p>}
                </div>
            </ScrollArea>
             {errors.members && (
                <p className="text-xs text-destructive">
                  {errors.members.message || errors.members.root?.message}
                </p>
              )}
        </div>
    );
};

const RosterManager = ({ groupPlayers }: { groupPlayers: Player[] }) => {
    const { control, formState: { errors } } = useFormContext<CreateTeamFormData>();
    const { fields } = useFieldArray({
        control,
        name: "members"
    });
    
    const selectedPlayers = useMemo(() => {
        return fields.map(field => ({
            ...field,
            playerDetails: groupPlayers.find(p => p.id === field.playerId)
        })).filter(item => item.playerDetails);
    }, [fields, groupPlayers]);

    return (
        <ScrollArea className="h-80">
            <div className="space-y-4 pr-4">
                {selectedPlayers.map((field, index) => (
                     <div key={field.id} className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Label htmlFor={`members.${index}.number`} className="w-8 text-lg font-bold text-muted-foreground">#</Label>
                            <Controller
                                control={control}
                                name={`members.${index}.number`}
                                render={({ field: numField }) => (
                                    <Input
                                        {...numField}
                                        id={`members.${index}.number`}
                                        type="number"
                                        min="1"
                                        max="99"
                                        className="w-20"
                                        onChange={e => numField.onChange(parseInt(e.target.value, 10) || 0)}
                                    />
                                )}
                            />
                        </div>
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={field.playerDetails?.photoUrl} alt={field.playerDetails?.name} />
                            <AvatarFallback>{field.playerDetails?.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="flex-1 font-medium">{field.playerDetails?.name}</p>
                        {errors.members?.[index]?.number && <p className="text-xs text-destructive">{errors.members[index]?.number?.message}</p>}
                     </div>
                ))}
                 {errors.members && errors.members.root && <p className="text-xs text-destructive mt-2">{errors.members.root.message}</p>}
            </div>
        </ScrollArea>
    )
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  groupId,
  players,
  currentUserId,
}: CreateTeamDialogProps) {
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      members: [],
      jersey: {
          type: 'plain',
          primaryColor: '#DC2626',
          secondaryColor: '#FFFFFF',
      },
    },
  });
  
   const { control, trigger, formState } = form;

  const handleNext = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await trigger('name');
    } else if (step === 2) {
      isValid = await trigger('members');
    }

    if (isValid) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };
  
  const handleCreate = async (data: CreateTeamFormData) => {
    if (!firestore) return;
    setIsCreating(true);

    try {
      const newTeam: Omit<GroupTeam, 'id'> = {
        name: data.name,
        groupId,
        jersey: data.jersey,
        members: data.members,
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
      };
      
      await addDoc(collection(firestore, 'teams'), newTeam);

      toast({
        title: '¡Equipo creado!',
        description: `El equipo "${data.name}" se ha creado exitosamente.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear el equipo.',
      });
    } finally {
      setIsCreating(false);
    }
  };
  
   const resetDialog = () => {
    setStep(1);
    form.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Equipo Nuevo</DialogTitle>
           <DialogDescription>
            {step === 1 && 'Dale un nombre a tu equipo y diseñá la camiseta.'}
            {step === 2 && 'Seleccioná los jugadores que formarán parte del plantel.'}
            {step === 3 && 'Asigná los dorsales a los jugadores.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center flex-1">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium', step === i ? 'bg-primary text-primary-foreground' : step > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                {step > i ? <Check className="h-4 w-4" /> : i}
              </div>
              {i < 3 && <div className={cn('flex-1 h-1 mx-2', step > i ? 'bg-primary/20' : 'bg-muted')} />}
            </div>
          ))}
        </div>
        
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)}>
                 {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                             <Label htmlFor="team-name">Nombre del Equipo</Label>
                             <Input id="team-name" {...form.register('name')} placeholder="Ej: Los Cracks" autoFocus />
                             {formState.errors.name && <p className="text-xs text-destructive">{formState.errors.name.message}</p>}
                        </div>
                        <Controller
                            control={control}
                            name="jersey"
                            render={({ field }) => (
                                <JerseyDesigner
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                )}
                
                {step === 2 && (
                    <MemberManager groupPlayers={players} />
                )}
                
                {step === 3 && <RosterManager groupPlayers={players} />}

                 <DialogFooter className="gap-2 sm:gap-2 mt-4">
                  <div className="flex w-full justify-between gap-2">
                    <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1 || isCreating}>
                      <ChevronLeft className="mr-2 h-4 w-4" /> Atrás
                    </Button>
                    {step < 3 ? (
                      <Button type="button" onClick={handleNext}>
                        Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={isCreating || !formState.isValid}>
                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Crear Equipo
                      </Button>
                    )}
                  </div>
                </DialogFooter>
            </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
