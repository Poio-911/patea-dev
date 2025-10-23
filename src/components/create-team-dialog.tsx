
'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, ChevronRight, Check, Users, Search } from 'lucide-react';
import { JerseyDesigner } from './team-builder/jersey-designer';
import { Player, Jersey, GroupTeam, GroupTeamMember } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Card } from './ui/card';


interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  players: Player[];
  currentUserId: string;
}

const createTeamSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  playerIds: z.array(z.string()).min(1, 'Debes seleccionar al menos un jugador.'),
  jersey: z.object({
      type: z.custom<Jersey['type']>(),
      primaryColor: z.string(),
      secondaryColor: z.string()
  })
});

type CreateTeamFormData = z.infer<typeof createTeamSchema>;

const MemberManager = ({ groupPlayers }: { groupPlayers: Player[] }) => {
    const { control, getValues, setValue, formState: { errors } } = useFormContext<CreateTeamFormData>();
    const [searchTerm, setSearchTerm] = useState('');

    const selectedPlayerIds = new Set(getValues('playerIds') || []);

    const filteredPlayers = useMemo(() => {
        return groupPlayers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [groupPlayers, searchTerm]);

    const handlePlayerToggle = (playerId: string) => {
        const currentIds = getValues('playerIds') || [];
        const newIds = selectedPlayerIds.has(playerId)
            ? currentIds.filter(id => id !== playerId)
            : [...currentIds, playerId];
        setValue('playerIds', newIds, { shouldValidate: true });
    };
    
    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar jugador..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>
            <ScrollArea className="h-72">
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pr-4">
                {filteredPlayers.length > 0 ? filteredPlayers.map(player => {
                    const isSelected = selectedPlayerIds.has(player.id);
                    return (
                        <Card 
                            key={player.id} 
                            onClick={() => handlePlayerToggle(player.id)}
                            className={cn(
                                "cursor-pointer transition-all border-2",
                                isSelected ? "border-primary ring-2 ring-primary/50" : "border-border"
                            )}
                        >
                            <div className="flex flex-col items-center p-3 gap-2 relative">
                                {isSelected && (
                                    <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <Check className="h-4 w-4" />
                                    </div>
                                )}
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={player.photoUrl} alt={player.name} />
                                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="text-center">
                                    <p className="font-semibold text-sm truncate">{player.name}</p>
                                    <p className="text-xs text-muted-foreground">{player.position} / OVR {player.ovr}</p>
                                </div>
                            </div>
                        </Card>
                    )
                }) : <p className="col-span-full text-center text-sm text-muted-foreground p-4">No se encontraron jugadores.</p>}
                </div>
            </ScrollArea>
             {errors.playerIds && (
                <p className="text-xs text-destructive">
                  {(errors.playerIds as any).message || (errors.playerIds.root as any)?.message}
                </p>
              )}
        </div>
    );
};


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
      playerIds: [],
      jersey: {
          type: 'plain',
          primaryColor: '#DC2626',
          secondaryColor: '#FFFFFF',
      },
    },
  });
  
   const { control, trigger } = form;

  const handleNext = async () => {
    let isValid;
    if (step === 1) {
        isValid = await trigger('name');
    } else if (step === 2) {
        isValid = await trigger('playerIds');
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
        const members: GroupTeamMember[] = data.playerIds.map((playerId: string, index: number) => ({
            playerId,
            number: index + 1, // Assign sequential numbers as default
            status: 'titular', // Default status for new members
        }));

      const newTeam: Omit<GroupTeam, 'id'> = {
        name: data.name,
        groupId,
        jersey: data.jersey,
        members,
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crear Equipo Nuevo</DialogTitle>
           <DialogDescription>
            {step === 1 && 'Dale una identidad a tu equipo con un nombre y una camiseta única.'}
            {step === 2 && 'Seleccioná los jugadores que formarán parte del plantel.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-center gap-2 my-4">
            {[1, 2].map(i => (
                <div key={i} className="flex items-center">
                    <div className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium', step === i ? 'bg-primary text-primary-foreground' : step > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                        {step > i ? <Check className="h-4 w-4" /> : i}
                    </div>
                    <p className={cn("ml-2 text-sm font-medium", step >= i ? "text-foreground" : "text-muted-foreground")}>
                        {i === 1 ? 'Diseño' : 'Jugadores'}
                    </p>
                </div>
            ))}
        </div>
        
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="flex-grow flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto -mx-6 px-6">
                 {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                        <div className="space-y-6">
                             <div className="space-y-2">
                                <Label htmlFor="team-name">Nombre del Equipo</Label>
                                <Input id="team-name" {...form.register('name')} placeholder="Ej: Los Cracks" autoFocus />
                                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                             </div>
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
                     <div className="py-4">
                        <MemberManager groupPlayers={players} />
                    </div>
                )}
                </div>

                 <DialogFooter className="gap-2 sm:gap-2 mt-auto pt-4 border-t">
                  <div className="flex w-full justify-between gap-2">
                    <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1 || isCreating}>
                      <ChevronLeft className="mr-2 h-4 w-4" /> Atrás
                    </Button>
                    {step < 2 ? (
                      <Button type="button" onClick={handleNext}>
                        Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={isCreating || !form.formState.isValid}>
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
