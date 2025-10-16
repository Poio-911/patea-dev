'use client';

import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc, writeBatch, collection, getDocs, updateDoc, getDoc, runTransaction, DocumentData, query } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, PlayerPosition } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Save, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { performanceTags } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';


const evaluationSchema = z.object({
  evaluations: z.array(z.object({
    playerId: z.string(),
    displayName: z.string(),
    photoUrl: z.string(),
    goals: z.coerce.number().min(0).max(20).default(0),
    rating: z.coerce.number().min(1).max(10).default(5),
    performanceTags: z.array(z.string()).max(2, 'Puedes seleccionar hasta 2 etiquetas.').default([]),
  }))
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

const OVR_PROGRESSION = {
    BASELINE_RATING: 5,
    SCALE: 0.6,
    MAX_STEP: 2,
    DECAY_START: 70,
    SOFT_CAP: 95,
    HARD_CAP: 99,
    MIN_OVR: 40,
    MIN_ATTRIBUTE: 20,
    MAX_ATTRIBUTE: 90
};


const calculateOvrChange = (currentOvr: number, newRating: number): number => {
    const { BASELINE_RATING, SCALE, MAX_STEP, DECAY_START, SOFT_CAP, HARD_CAP } = OVR_PROGRESSION;

    const ratingDelta = newRating - BASELINE_RATING;
    let rawDelta = ratingDelta * SCALE;

    if (currentOvr >= DECAY_START && currentOvr < SOFT_CAP) {
        const t = (currentOvr - DECAY_START) / (SOFT_CAP - DECAY_START);
        const factor = 1 - (0.6 * Math.min(1, t)); 
        rawDelta *= factor;
    } else if (currentOvr >= SOFT_CAP) {
        const t2 = (currentOvr - SOFT_CAP) / (HARD_CAP - SOFT_CAP);
        const hardFactor = 0.25 * (1 - t2);
        rawDelta *= hardFactor;
    }

    const finalDelta = Math.max(-MAX_STEP, Math.min(MAX_STEP, rawDelta));
    return Math.round(finalDelta);
}

const calculateAttributeChanges = (position: PlayerPosition, rating: number) => {
    const intensity = (rating - OVR_PROGRESSION.BASELINE_RATING) * 0.2; // Reduced scale for attributes
    const changes = { pac: 0, sho: 0, pas: 0, dri: 0, def: 0, phy: 0 };

    switch(position) {
        case 'DEL':
            changes.sho += intensity * 1.5;
            changes.pac += intensity;
            changes.dri += intensity * 0.5;
            break;
        case 'MED':
            changes.pas += intensity * 1.5;
            changes.dri += intensity;
            changes.sho += intensity * 0.5;
            break;
        case 'DEF':
            changes.def += intensity * 1.5;
            changes.phy += intensity;
            changes.pas += intensity * 0.5;
            break;
        case 'POR':
            changes.def += intensity * 1.5; // Goalkeeper stats are simplified to DEF
            changes.phy += intensity;
            changes.pas += intensity * 0.5;
            break;
    }
    return changes;
}

export default function EvaluateMatchPage() {
  const { id: matchId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matchRef = doc(firestore, 'matches', matchId as string);
  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
        evaluations: []
    }
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "evaluations",
  });

  if (match && form.getValues('evaluations').length === 0) {
    const initialEvals = match.players.map(p => ({
      playerId: p.uid,
      displayName: p.displayName,
      photoUrl: p.photoUrl || '',
      goals: 0,
      rating: 5,
      performanceTags: []
    }));
    replace(initialEvals);
  }

  const onSubmit = async (data: EvaluationFormData) => {
    if (!firestore || !match) return;
    setIsSubmitting(true);

    try {
        await runTransaction(firestore, async (transaction) => {
            const evaluationsCollectionRef = collection(firestore, 'matches', match.id, 'evaluations');
            
            const existingEvalsSnap = await getDocs(query(evaluationsCollectionRef));
            if (!existingEvalsSnap.empty) {
                throw new Error('Este partido ya ha sido evaluado.');
            }

            const playerDocsPromises = data.evaluations.map(evaluation => {
                const playerRef = doc(firestore, 'players', evaluation.playerId);
                return transaction.get(playerRef);
            });
            const playerDocs = await Promise.all(playerDocsPromises);
            
            playerDocs.forEach((playerDoc, index) => {
                const evaluation = data.evaluations[index];

                if (playerDoc.exists()) {
                    const playerData = playerDoc.data() as Player;
                    
                    const currentStats = playerData.stats || { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 };
                    
                    const newMatchesPlayed = currentStats.matchesPlayed + 1;
                    const newGoals = (currentStats.goals || 0) + evaluation.goals;

                    const totalRatingPoints = (currentStats.averageRating * currentStats.matchesPlayed) + evaluation.rating;
                    const newAverageRating = totalRatingPoints / newMatchesPlayed;

                    const attributeChanges = calculateAttributeChanges(playerData.position, evaluation.rating);
                    
                    const newAttributes = {
                        pac: Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, Math.round(playerData.pac + attributeChanges.pac))),
                        sho: Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, Math.round(playerData.sho + attributeChanges.sho))),
                        pas: Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, Math.round(playerData.pas + attributeChanges.pas))),
                        dri: Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, Math.round(playerData.dri + attributeChanges.dri))),
                        def: Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, Math.round(playerData.def + attributeChanges.def))),
                        phy: Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, Math.round(playerData.phy + attributeChanges.phy))),
                    };

                    const ovrChange = calculateOvrChange(playerData.ovr, evaluation.rating);
                    const newOvr = Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.HARD_CAP, playerData.ovr + ovrChange));
                    
                    const updatePayload = {
                        ...newAttributes,
                        'stats.matchesPlayed': newMatchesPlayed,
                        'stats.goals': newGoals,
                        'stats.averageRating': newAverageRating,
                        'ovr': newOvr,
                    };

                    transaction.update(playerDoc.ref, updatePayload);

                }
            });

            data.evaluations.forEach(evaluation => {
                const evalRef = doc(evaluationsCollectionRef, evaluation.playerId);
                transaction.set(evalRef, {
                    playerId: evaluation.playerId,
                    goals: evaluation.goals,
                    rating: evaluation.rating,
                    performanceTags: evaluation.performanceTags,
                    evaluatedBy: user?.uid,
                    evaluatedAt: new Date().toISOString(),
                });
            });
            
            const matchDocRef = doc(firestore, 'matches', match.id);
            transaction.update(matchDocRef, { status: 'evaluated' });
        });

        toast({
            title: 'Evaluación Guardada',
            description: 'Las estadísticas y el OVR de los jugadores se han actualizado.'
        });
        router.push('/matches');

    } catch (error: any) {
        console.error('Error saving evaluations:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'No se pudieron guardar las evaluaciones.'
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (matchLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!match) {
    return <div>Partido no encontrado.</div>;
  }
  
  if (match.ownerUid !== user?.uid) {
    return <div>No tienes permiso para evaluar este partido.</div>;
  }
  
  if (match.status === 'evaluated') {
    return (
        <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
            <PageHeader title={`Evaluar: ${match.title}`}/>
             <p>Este partido ya ha sido evaluado.</p>
            <Button onClick={() => router.push('/matches')}>Volver a Partidos</Button>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Evaluar: ${match.title}`}
        description={`Registra los goles y el rendimiento de cada jugador.`}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
                <CardTitle>Jugadores</CardTitle>
                <CardDescription>Asigna goles, una calificación (1-10) y hasta 2 etiquetas de rendimiento a cada jugador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-5 items-start gap-4 border-b pb-4">
                  <div className="md:col-span-2 flex items-center gap-4">
                     <Avatar className="h-12 w-12">
                        <AvatarImage src={field.photoUrl} alt={field.displayName} data-ai-hint="player portrait" />
                        <AvatarFallback>{field.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold">{field.displayName}</p>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name={`evaluations.${index}.goals`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goles</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`evaluations.${index}.rating`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rating: {field.value}</FormLabel>
                        <FormControl>
                            <div className="flex items-center gap-2 pt-2">
                                <span className="text-xs text-muted-foreground">1</span>
                                <Slider
                                    min={1}
                                    max={10}
                                    step={1}
                                    defaultValue={[field.value]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                />
                                <span className="text-xs text-muted-foreground">10</span>
                            </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Controller
                    control={form.control}
                    name={`evaluations.${index}.performanceTags`}
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Etiquetas</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value?.length && "text-muted-foreground")}>
                                            <span className="truncate">
                                                {field.value?.length ? field.value.join(', ') : "Seleccionar etiquetas"}
                                            </span>
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar etiqueta..." />
                                        <CommandList>
                                            <CommandEmpty>No se encontró la etiqueta.</CommandEmpty>
                                            <CommandGroup>
                                                {performanceTags.map((tag) => {
                                                    const isSelected = field.value?.includes(tag);
                                                    return (
                                                        <CommandItem
                                                            key={tag}
                                                            onSelect={() => {
                                                                if (isSelected) {
                                                                    field.onChange(field.value.filter((t: string) => t !== tag));
                                                                } else if (field.value.length < 2) {
                                                                    field.onChange([...field.value, tag]);
                                                                } else {
                                                                    toast({
                                                                        variant: 'destructive',
                                                                        title: 'Límite alcanzado',
                                                                        description: 'Solo puedes seleccionar hasta 2 etiquetas.'
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                                                <Check className={cn("h-4 w-4")} />
                                                            </div>
                                                            {tag}
                                                        </CommandItem>
                                                    )
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                             {form.formState.errors.evaluations?.[index]?.performanceTags && (
                                <p className="text-xs text-destructive">{form.formState.errors.evaluations[index].performanceTags.message}</p>
                            )}
                        </FormItem>
                    )}
                />
                </div>
              ))}
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar Evaluaciones
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
