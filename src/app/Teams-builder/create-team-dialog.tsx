'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { JerseyDesigner } from './jersey-designer';
import { Player, Jersey } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  players: Player[];
  currentUserId: string;
}

const teamNameSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
});

type TeamNameForm = z.infer<typeof teamNameSchema>;

export function CreateTeamDialog({
  open,
  onOpenChange,
  groupId,
  players,
  currentUserId,
}: CreateTeamDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [jersey, setJersey] = useState<Jersey>({
    type: 'plain',
    primaryColor: '#DC2626',
    secondaryColor: '#FFFFFF',
  });
  const [isCreating, setIsCreating] = useState(false);

  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<TeamNameForm>({
    resolver: zodResolver(teamNameSchema),
    defaultValues: {
      name: '',
    },
  });

  const handlePlayerToggle = (playerId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      form.trigger('name').then(isValid => {
        if (isValid) setStep(2);
      });
    } else {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleCreate = async (data: TeamNameForm) => {
    if (!firestore) return;
    setIsCreating(true);

    try {
      await addDoc(collection(firestore, 'teams'), {
        name: data.name,
        groupId,
        jersey,
        playerIds: selectedPlayerIds,
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
      });

      toast({
        title: '¡Equipo creado!',
        description: `El equipo "${data.name}" se ha creado exitosamente.`,
      });

      // Reset form
      form.reset();
      setStep(1);
      setSelectedPlayerIds([]);
      setJersey({
        type: 'plain',
        primaryColor: '#DC2626',
        secondaryColor: '#FFFFFF',
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
    setSelectedPlayerIds([]);
    setJersey({
      type: 'plain',
      primaryColor: '#DC2626',
      secondaryColor: '#FFFFFF',
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Equipo Nuevo</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Dale un nombre a tu equipo'}
            {step === 2 && 'Seleccioná los jugadores del equipo'}
            {step === 3 && 'Diseñá la camiseta del equipo'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center flex-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  step === i
                    ? 'bg-primary text-primary-foreground'
                    : step > i
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {step > i ? <Check className="h-4 w-4" /> : i}
              </div>
              {i < 3 && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-2',
                    step > i ? 'bg-primary/20' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Nombre del Equipo */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Nombre del Equipo</Label>
              <Input
                id="team-name"
                {...form.register('name')}
                placeholder="Ej: Los Cracks, Equipo Rojo, etc."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNext();
                  }
                }}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Selección de Jugadores */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Jugadores ({selectedPlayerIds.length} seleccionados)</Label>
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3">
                {players.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay jugadores en este grupo
                  </p>
                ) : (
                  players.map(player => (
                    <label
                      key={player.id}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-muted cursor-pointer"
                      htmlFor={`player-${player.id}`}
                    >
                      <Checkbox
                        id={`player-${player.id}`}
                        checked={selectedPlayerIds.includes(player.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPlayerIds(prev => [...prev, player.id]);
                          } else {
                            setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
                          }
                        }}
                      />
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={player.photoUrl} alt={player.name} />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.position} · OVR {player.ovr}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Diseño de Camiseta */}
        {step === 3 && (
          <div className="py-4">
            <JerseyDesigner value={jersey} onChange={setJersey} />
          </div>
        )}

        {/* Footer con botones de navegación */}
        <DialogFooter className="gap-2 sm:gap-2">
          <div className="flex w-full justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 1 || isCreating}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={step === 2 && selectedPlayerIds.length === 0}
              >
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  form.handleSubmit(handleCreate)();
                }}
                disabled={isCreating}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Equipo
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
