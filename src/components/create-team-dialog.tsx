
'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, ChevronRight, Check, Search, Shirt, Shield, UserPlus } from 'lucide-react';
import { JerseyDesigner } from './team-builder/jersey-designer';
import { Player, Jersey, GroupTeam, GroupTeamMember } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { celebrationConfetti } from '@/lib/animations';
import { ScrollArea } from './ui/scroll-area';
import { assignSmartDorsal } from '@/lib/utils/dorsal-logic';
import { TeamTacticalAnalysis } from './team-builder/team-tactical-analysis';
import { PlayerSelectionCard } from './team-builder/player-selection-card';

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

// --- Helper Component: Step Indicator ---
const TeamStepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { id: 1, label: 'Identidad', icon: Shirt },
    { id: 2, label: 'Plantel', icon: UserPlus },
  ];

  return (
    <div className="flex items-center justify-center gap-4 py-4 relative z-10">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300",
            currentStep === step.id
              ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_-3px_rgba(var(--primary),0.5)]"
              : currentStep > step.id
                ? "bg-muted/50 border-muted text-muted-foreground"
                : "bg-transparent border-transparent text-muted-foreground opacity-50"
          )}>
            <div className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
              currentStep === step.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {currentStep > step.id ? <Check className="w-3 h-3" /> : step.id}
            </div>
            <span className="text-sm font-bold uppercase tracking-wide hidden sm:block">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={cn("h-[2px] w-8 mx-2 rounded-full", currentStep > 1 ? "bg-primary/50" : "bg-muted-foreground/20")} />
          )}
        </div>
      ))}
    </div>
  );
};

const MemberManager = ({ groupPlayers, existingTeams }: { groupPlayers: Player[], existingTeams: GroupTeam[] }) => {
  const { setValue, getValues, watch } = useFormContext<CreateTeamFormData>();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const selectedPlayerIds = new Set(watch('playerIds') || []);

  const filteredPlayers = useMemo(() => {
    return groupPlayers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [groupPlayers, searchTerm]);

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
      const newIds = currentIds.filter(id => id !== playerId);
      setValue('playerIds', newIds, { shouldValidate: true });
    } else {
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
    <div className="space-y-4 h-full flex flex-col">
      {/* Search Bar with Glass effect */}
      <div className="relative z-10">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="Buscar cracks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-black/20 border-white/10 focus:border-primary/50 focus:bg-black/40 transition-all backdrop-blur-sm"
        />
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
          {filteredPlayers.length > 0 ? filteredPlayers.map(player => (
            <PlayerSelectionCard
              key={player.id}
              player={player}
              isSelected={selectedPlayerIds.has(player.id)}
              isMaxedOut={(playerTeamCounts[player.id] || 0) >= 3}
              teamCount={playerTeamCounts[player.id] || 0}
              onToggle={handlePlayerToggle}
            />
          )) : (
            <div className="col-span-full py-12 text-center text-muted-foreground flex flex-col items-center">
              <Search className="h-8 w-8 mb-2 opacity-50" />
              <p>No se encontraron jugadores.</p>
            </div>
          )}
        </div>
      </ScrollArea>
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

  const { control, trigger, watch } = form;
  const selectedPlayerIds = watch('playerIds');

  // Compute selected players objects for Tactical Analysis
  const selectedPlayersList = useMemo(() => {
    return players.filter(p => selectedPlayerIds?.includes(p.id));
  }, [players, selectedPlayerIds]);


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
      <DialogContent className="sm:max-w-4xl w-full h-[100dvh] md:max-h-[85vh] md:h-[800px] flex flex-col p-0 gap-0 bg-background/95 dark:bg-black/85 backdrop-blur-xl border-border/50 dark:border-white/10 overflow-hidden shadow-2xl transition-all duration-300">

        {/* Header - Locker Room Style */}
        <div className="relative px-4 sm:px-6 py-4 border-b border-border/10 dark:border-white/5 bg-gradient-to-r from-muted/20 dark:from-background/50 to-transparent z-20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase text-foreground dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:to-white/60">
              Locker Room
            </h2>
            <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase">
              {step === 1 ? 'Diseño de Identidad' : 'Fichajes y Táctica'}
            </p>
          </div>
          <div className="flex bg-muted/20 dark:bg-white/5 rounded-full px-3 py-1 items-center gap-2 border border-border/10 dark:border-white/5">
            <Shield className="w-3 h-3 text-primary" />
            <span className="text-xs font-bold text-primary">CLUB FOUNDER</span>
          </div>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleCreate)} className="flex-grow flex flex-col min-h-0 relative">

            <TeamStepIndicator currentStep={step} />

            {/* Content Area */}
            <div className="flex-grow overflow-hidden relative px-6 md:px-8 pb-4">

              {step === 1 && (
                <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  {/* Left Column: Input + Preview (Mobile Order) */}
                  <div className="md:col-span-5 flex flex-col gap-6 justify-center">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="team-name" className="text-xs uppercase tracking-widest text-muted-foreground">Nombre del Club</Label>
                        <Input
                          id="team-name"
                          {...form.register('name')}
                          placeholder="Ej: Los Galácticos"
                          autoFocus
                          className="text-2xl font-black italic bg-transparent border-0 border-b-2 border-border/40 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/30 h-14 transition-colors"
                        />
                        {form.formState.errors.name && <p className="text-xs text-destructive font-bold">{form.formState.errors.name.message}</p>}
                      </div>
                    </div>

                    {/* Visual Decoration for Desktop */}
                    <div className="hidden md:block p-6 rounded-2xl bg-muted/20 dark:bg-white/5 border border-border/10 dark:border-white/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-32 bg-primary/10 dark:bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-all duration-700" />
                      <h3 className="text-lg font-bold mb-2 z-10 relative">Identidad Visual</h3>
                      <p className="text-sm text-muted-foreground z-10 relative">Diseñá la camiseta que tus jugadores llevarán con orgullo en la cancha.</p>
                    </div>
                  </div>

                  {/* Right Column: Jersey Editor (Hero) */}
                  <div className="md:col-span-7 h-full overflow-y-auto pr-2">
                    <div className="bg-muted/10 dark:bg-black/40 border border-border/10 dark:border-white/5 rounded-2xl p-6 h-full backdrop-blur-md">
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
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex-shrink-0">
                    <TeamTacticalAnalysis selectedPlayers={selectedPlayersList} />
                  </div>
                  <div className="flex-grow min-h-0 relative">
                    <MemberManager
                      groupPlayers={players}
                      existingTeams={existingTeams || []}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto px-6 py-4 pb-8 sm:pb-4 border-t border-border/10 dark:border-white/10 bg-background/80 dark:bg-black/60 backdrop-blur-xl flex justify-between items-center shrink-0 z-20">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={step === 1 || isCreating}
                className="hover:bg-muted/50 dark:hover:bg-white/5"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Atrás
              </Button>

              {step < 2 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 skew-x-[-10deg]"
                >
                  <span className="skew-x-[10deg] flex items-center">
                    Siguiente Fase <ChevronRight className="ml-2 h-4 w-4" />
                  </span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isCreating || !form.formState.isValid}
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white dark:text-black font-black uppercase tracking-wide px-8 skew-x-[-10deg] shadow-[0_0_20px_-5px_rgba(34,197,94,0.6)]"
                >
                  <span className="skew-x-[10deg] flex items-center">
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Fundar Equipo
                  </span>
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
