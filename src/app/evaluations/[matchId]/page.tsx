
'use client';

import { useFirestore, useUser, useCollection } from '@/firebase';
import { doc, writeBatch, collection, query, where, setDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, EvaluationAssignment, Evaluation, SelfEvaluation } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Save, ShieldCheck, Goal, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { performanceTags } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const playerEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  rating: z.coerce.number().min(1).max(10).default(5),
  performanceTags: z.array(z.string()).max(2, "No puedes seleccionar más de 2 etiquetas.").optional(),
});

const evaluationSchema = z.object({
  evaluatorGoals: z.coerce.number().min(0).max(20).default(0),
  evaluations: z.array(playerEvaluationSchema)
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

export default function PerformEvaluationPage() {
  const { matchId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Get all players in the group to get subject details (photo, name)
  const allGroupPlayersQuery = useMemo(() => 
    firestore && user?.activeGroupId ? query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId)) : null
  , [firestore, user?.activeGroupId]);
  const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(allGroupPlayersQuery);
  
  // Get this user's pending assignments for this specific match
  const userAssignmentsQuery = useMemo(() => {
      if (!firestore || !user?.uid || !matchId) return null;
      return query(
          collection(firestore, 'matches', matchId as string, 'assignments'),
          where('evaluatorId', '==', user.uid),
          where('status', '==', 'pending')
      );
  }, [firestore, user, matchId]);
  const { data: assignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(userAssignmentsQuery);


  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { 
        evaluatorGoals: 0,
        evaluations: [] 
    }
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "evaluations" });

  useEffect(() => {
    if (assignments && allGroupPlayers) {
      if (assignments.length > 0) {
        const initialFormValues = assignments.map(assignment => {
            const subject = allGroupPlayers.find(p => p.id === assignment.subjectId);
            return {
                assignmentId: assignment.id,
                subjectId: assignment.subjectId,
                displayName: subject?.name || 'Jugador desconocido',
                photoUrl: subject?.photoUrl || '',
                rating: 5,
                performanceTags: []
            };
        });
        replace(initialFormValues);
      }
      setIsPageLoading(false);
    } else if (!assignmentsLoading && !playersLoading) {
        setIsPageLoading(false);
    }
  }, [assignments, allGroupPlayers, replace, assignmentsLoading, playersLoading]);


  const onSubmit = async (data: EvaluationFormData) => {
    if (!firestore || !user || !matchId) return;
    setIsSubmitting(true);
    
    try {
        const batch = writeBatch(firestore);

        // 1. Save self-evaluation (goals)
        const selfEvalRef = doc(firestore, 'matches', matchId as string, 'selfEvaluations', user.uid);
        const newSelfEvaluation: Omit<SelfEvaluation, 'id'> = {
            playerId: user.uid,
            matchId: matchId as string,
            goals: data.evaluatorGoals,
            reportedAt: new Date().toISOString(),
        };
        batch.set(selfEvalRef, newSelfEvaluation);
        
        for (const evaluation of data.evaluations) {
            // 2. Create the peer evaluation document
            const evalRef = doc(collection(firestore, 'evaluations'));
            const newEvaluation: Omit<Evaluation, 'id'> = {
                assignmentId: evaluation.assignmentId,
                playerId: evaluation.subjectId,
                evaluatorId: user.uid,
                matchId: matchId as string,
                rating: evaluation.rating,
                performanceTags: evaluation.performanceTags || [],
                evaluatedAt: new Date().toISOString(),
            };
            batch.set(evalRef, newEvaluation);

            // 3. Update the assignment status to 'completed'
            const assignmentRef = doc(firestore, 'matches', matchId as string, 'assignments', evaluation.assignmentId);
            batch.update(assignmentRef, {
                status: 'completed',
                evaluationId: evalRef.id
            });
        }

        await batch.commit();
        
        toast({
            title: '¡Evaluación Enviada!',
            description: 'Gracias por tu participación. Tus evaluaciones han sido guardadas.'
        });
        router.push('/evaluations');
        
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'No se pudieron guardar las evaluaciones.'
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (isPageLoading || assignmentsLoading || playersLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return <div>Datos no encontrados.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title={`Evaluar Partido`}
            description={`Evalúa el rendimiento de tus compañeros de equipo asignados.`}
        />
        {fields.length === 0 ? (
             <Alert variant="default">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Sin Evaluaciones Pendientes</AlertTitle>
                <AlertDescription>
                    No tienes jugadores asignados para evaluar en este partido, o ya has completado tu evaluación. ¡Gracias!
                    <Button asChild variant="link" className="p-0 h-auto ml-1">
                        <Link href="/evaluations">Volver a mis evaluaciones</Link>
                    </Button>
                </AlertDescription>
            </Alert>
        ) : (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tu Rendimiento</CardTitle>
                            <CardDescription>Antes de evaluar a tus compañeros, registra tu propia actuación.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <FormField
                                control={form.control}
                                name="evaluatorGoals"
                                render={({ field }) => (
                                    <FormItem className="max-w-xs">
                                        <FormLabel>¿Cuántos goles marcaste en este partido?</FormLabel>
                                        <div className="flex items-center gap-2">
                                            <Goal className="h-5 w-5 text-muted-foreground" />
                                            <FormControl>
                                                <Input type="number" min="0" {...field} />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Jugadores a Evaluar</CardTitle>
                            <CardDescription>Asigna una calificación (1-10) y hasta 2 etiquetas a cada jugador.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 items-start gap-6 border-b pb-6 last:border-b-0 last:pb-0">
                                <div className="flex items-center gap-4 md:col-span-1">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={field.photoUrl} alt={field.displayName} data-ai-hint="player portrait" />
                                        <AvatarFallback>{field.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <p className="font-semibold">{field.displayName}</p>
                                </div>
                                
                                <FormField
                                    control={form.control}
                                    name={`evaluations.${index}.rating`}
                                    render={({ field: ratingField }) => (
                                    <FormItem className="md:col-span-1">
                                        <FormLabel>Rating: {ratingField.value}</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-2 pt-2">
                                                <span className="text-xs text-muted-foreground">1</span>
                                                <Slider
                                                    min={1}
                                                    max={10}
                                                    step={1}
                                                    defaultValue={[ratingField.value]}
                                                    onValueChange={(value) => ratingField.onChange(value[0])}
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
                                    render={({ field: tagsField, fieldState }) => (
                                        <FormItem className="flex flex-col md:col-span-1">
                                            <FormLabel>Etiquetas (Opcional)</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !tagsField.value?.length && "text-muted-foreground")}>
                                                            <span className="truncate">
                                                                {tagsField.value?.length ? tagsField.value.join(', ') : "Seleccionar etiquetas"}
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
                                                                    const isSelected = tagsField.value?.includes(tag);
                                                                    return (
                                                                        <CommandItem
                                                                            key={tag}
                                                                            onSelect={() => {
                                                                                const currentValue = tagsField.value || [];
                                                                                if (isSelected) {
                                                                                    tagsField.onChange(currentValue.filter((t: string) => t !== tag));
                                                                                } else if (currentValue.length < 2) {
                                                                                    tagsField.onChange([...currentValue, tag]);
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
                                            <FormMessage>{fieldState.error?.message}</FormMessage>
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
                        Enviar Evaluaciones
                        </Button>
                    </div>
                </form>
            </Form>
        )}
    </div>
  );
}

    