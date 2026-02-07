
'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogDescription as DialogDescription, ResponsiveDialogFooter as DialogFooter, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle } from '@/components/ui/responsive-dialog';
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
import { celebrationConfetti } from '@/lib/animations';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { PlayerPositionBadge } from '@/components/player-styles';
import { Card } from './ui/card';
import { AlertCircle, ShieldAlert, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCollection } from '@/firebase';
import { where, query } from 'firebase/firestore';
import { assignSmartDorsal } from '@/lib/utils/dorsal-logic';
import { JerseyPreview } from './team-builder/jersey-preview';


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

// --- Helper Component: Team Balance Warning ---
const TeamBalanceWarning = ({ players, selectedIds }: { players: Player[], selectedIds: string[] }) => {
  if (!selectedIds || selectedIds.length === 0) return null;

  const selectedPlayers = players.filter(p => selectedIds.includes(p.id));
  const hasGK = selectedPlayers.some(p => p.position === 'POR');
  const hasDEF = selectedPlayers.some(p => p.position === 'DEF');
  const hasFWD = selectedPlayers.some(p => p.position === 'DEL');

  const warnings = [];
  if (!hasGK) warnings.push("Falta Arquero (POR)");
  if (!hasDEF) warnings.push("Sin Defensores (DEF)");
  if (!hasFWD) warnings.push("Sin Delanteros (DEL)");

  if (warnings.length === 0) return null;

  return (
    <Alert variant="destructive" className="mt-2 bg-destructive/10 border-destructive/20 text-destructive-foreground">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">Equipo Desbalanceado</AlertTitle>
      <AlertDescription className="text-xs">
        {warnings.join(', ')}.
        <span className="block mt-1 font-medium">Te recomendamos cubrir estas posiciones.</span>
      </AlertDescription>
    </Alert>
  );
};

const MemberManager = ({ groupPlayers, existingTeams }: { groupPlayers: Player[], existingTeams: GroupTeam[] }) => {
  const { control, getValues, setValue, formState: { errors } } = useFormContext<CreateTeamFormData>();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const selectedPlayerIds = new Set(getValues('playerIds') || []);

  const filteredPlayers = useMemo(() => {
    return groupPlayers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [groupPlayers, searchTerm]);

  // Calcular en cuántos equipos está cada jugador
  const playerTeamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    existingTeams.forEach(team => {
      team.members.forEach(member => {
        counts[member.playerId] = (counts[member.playerId] || 0) + 1;
      });
    });
    return counts;
  }, [existingTeams]);

  const handlePlayerToggle = (playerId: string) => {
    const currentIds = getValues('playerIds') || [];
    const isSelected = selectedPlayerIds.has(playerId);

    if (isSelected) {
      // Deseleccionar
      const newIds = currentIds.filter(id => id !== playerId);
      setValue('playerIds', newIds, { shouldValidate: true });
    } else {
      // Seleccionar - Validar límite de 3 equipos
      const currentTeamCount = playerTeamCounts[playerId] || 0;
      if (currentTeamCount >= 3) {
        toast({
          variant: 'destructive',
          title: 'Límite alcanzado',
          description: 'Este jugador ya pertenece a 3 equipos (máximo permitido).',
        });
        return;
      }
      const newIds = [...currentIds, playerId];
      setValue('playerIds', newIds, { shouldValidate: true });
    }
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
            const teamCount = playerTeamCounts[player.id] || 0;
            const isMaxedOut = teamCount >= 3;

            return (
              <Card
                key={player.id}
                onClick={() => !isMaxedOut || isSelected ? handlePlayerToggle(player.id) : null}
                className={cn(
                  "cursor-pointer transition-all border-2 relative",
                  isSelected ? "border-primary ring-2 ring-primary/50" : "border-border",
                  isMaxedOut && !isSelected && "opacity-60 cursor-not-allowed bg-muted"
                )}
              >
                <div className="flex flex-col items-center p-3 gap-2 relative">
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                  {isMaxedOut && !isSelected && (
                    <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive z-10" title="Límite de equipos alcanzado">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                  )}
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={player.photoUrl} alt={player.name} />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="text-center w-full">
                    <p className="font-semibold text-sm truncate">{player.name}</p>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-2 mt-1">
                      <PlayerPositionBadge position={player.position} showIcon={false} size="sm" />
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {teamCount}/3
                      </Badge>
                    </div>
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

  // Fetch existing teams to validate player memberships
  const teamsQuery = useMemo(() => {
    if (!firestore || !groupId) return null;
    return query(collection(firestore, 'teams'), where('groupId', '==', groupId));
  }, [firestore, groupId]);

  const { data: existingTeams } = useCollection<GroupTeam>(teamsQuery);

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
      // Build used numbers set from checking if this team was being edited (not applicable here as it is create)
      // Actually we assign for this team only.
      const usedNumbers = new Set<number>();

      const members: GroupTeamMember[] = data.playerIds.map((playerId: string) => {
        const player = players.find(p => p.id === playerId);
        const dorsal = assignSmartDorsal(player?.position || 'MED', usedNumbers);
        usedNumbers.add(dorsal);

        return {
          playerId,
          number: dorsal,
          status: 'titular',
        };
      });

      const newTeam: Omit<GroupTeam, 'id'> = {
        name: data.name,
        groupId,
        jersey: data.jersey,
        members,
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(firestore, 'teams'), newTeam);

      celebrationConfetti();
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
                <div className="py-4 space-y-4">
                  <MemberManager
                    groupPlayers={players}
                    existingTeams={existingTeams || []}
                  />
                  <TeamBalanceWarning players={players} selectedIds={form.watch('playerIds')} />
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
