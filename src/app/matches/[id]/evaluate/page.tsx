'use client';

import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, writeBatch, collection, getDocs, updateDoc, getDoc, runTransaction, DocumentData, query, setDoc, where } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, PlayerPosition, Evaluation, Team } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Save, Users, Check, ThumbsUp, BarChart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { performanceTags } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const playerEvaluationSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  goals: z.coerce.number().min(0).max(20).default(0),
  rating: z.coerce.number().min(1).max(10).default(5),
  performanceTags: z.array(z.string()).max(2, "No puedes seleccionar más de 2 etiquetas.").optional(),
});

const evaluationSchema = z.object({
  evaluations: z.array(playerEvaluationSchema)
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

// Types for assignments and status
type Assignment = { evaluatorId: string; playersToEvaluate: { uid: string; displayName: string; photoUrl: string }[] };

// Helper to determine if a player is a "real user"
const isRealUser = (player: { id: string, ownerUid?: string }) => player.id === player.ownerUid;

export default function EvaluateMatchPage() {
  const { id: matchId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myAssignments, setMyAssignments] = useState<{ uid: string; displayName: string; photoUrl: string }[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  const allGroupPlayersQuery = useMemo(() => 
    firestore && user?.activeGroupId ? query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId)) : null
  , [firestore, user?.activeGroupId]);
  const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(allGroupPlayersQuery);

  const matchRef = useMemo(() => firestore ? doc(firestore, 'matches', matchId as string) : null, [firestore, matchId]);
  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  const evaluationsRef = useMemo(() => firestore ? collection(firestore, 'matches', matchId as string, 'evaluations') : null, [firestore, matchId]);
  const { data: submittedEvaluations, loading: evalsLoading } = useCollection<Evaluation>(evaluationsRef);

  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { evaluations: [] }
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "evaluations" });

  const shuffleArray = <T,>(array: T[]): T[] => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  };
  
  const hasUserSubmitted = useMemo(() => {
    if(!user || !submittedEvaluations) return false;
    return submittedEvaluations.some(e => e.evaluatedBy === user.uid);
  }, [user, submittedEvaluations]);

  useEffect(() => {
    if (match && user && !evalsLoading && !playersLoading && allGroupPlayers && !hasUserSubmitted) {
        const userIsParticipant = match.players.some(p => p.uid === user.uid);
        const userPlayerProfile = allGroupPlayers.find(p => p.id === user.uid);
        const isUserARealPlayer = userPlayerProfile ? isRealUser(userPlayerProfile) : false;

        if (!userIsParticipant || !isUserARealPlayer) {
            setIsPageLoading(false);
            return;
        }

        const generateAssignments = () => {
            const assignments: Assignment[] = [];
            (match.teams || []).forEach(team => {
                const realPlayersInTeam = team.players.filter(p => {
                    const fullPlayer = allGroupPlayers.find(gp => gp.id === p.uid);
                    return fullPlayer && isRealUser(fullPlayer);
                });

                for (let i = 0; i < realPlayersInTeam.length; i++) {
                    const evaluator = realPlayersInTeam[i];
                    
                    const potentialTargets = shuffleArray([...team.players]);

                    const playersToEvaluate = potentialTargets
                        .filter(p => p.uid !== evaluator.uid)
                        .slice(0, 2);
                    
                    assignments.push({
                        evaluatorId: evaluator.uid,
                        playersToEvaluate: playersToEvaluate.map(p => ({
                            uid: p.uid,
                            displayName: match.players.find(mp => mp.uid === p.uid)?.displayName || p.displayName,
                            photoUrl: match.players.find(mp => mp.uid === p.uid)?.photoUrl || ''
                        }))
                    });
                }
            });
            return assignments;
        };
        
        const allAssignments = generateAssignments();
        const userAssignments = allAssignments.find(a => a.evaluatorId === user.uid)?.playersToEvaluate || [];
        setMyAssignments(userAssignments);
        
        if (userAssignments.length > 0) {
            const initialFormValues = userAssignments.map(p => ({
                playerId: p.uid,
                displayName: p.displayName,
                photoUrl: p.photoUrl,
                goals: 0,
                rating: 5,
                performanceTags: []
            }));
            replace(initialFormValues);
        }

        setIsPageLoading(false);
    } else if (!matchLoading && !evalsLoading && !playersLoading) {
      setIsPageLoading(false);
    }
  }, [match, user, evalsLoading, playersLoading, allGroupPlayers, replace, hasUserSubmitted, matchLoading]);

  const onSubmit = async (data: EvaluationFormData) => {
    if (!firestore || !match || !user) return;
    setIsSubmitting(true);
    
    try {
        const batch = writeBatch(firestore);
        
        data.evaluations.forEach(evaluation => {
            const evalDocId = `${user.uid}_${evaluation.playerId}`;
            const evalRef = doc(firestore, 'matches', match.id, 'evaluations', evalDocId);
            const newEvaluation: Omit<Evaluation, 'id'> = {
                playerId: evaluation.playerId,
                goals: evaluation.goals,
                rating: evaluation.rating,
                performanceTags: evaluation.performanceTags || [],
                evaluatedBy: user.uid,
                evaluatedAt: new Date().toISOString(),
            };
            batch.set(evalRef, newEvaluation);
        });

        await batch.commit();
        
        toast({
            title: '¡Evaluación Enviada!',
            description: 'Gracias por tu participación. Tus evaluaciones han sido guardadas.'
        });
        // Let the useEffect handle the view change by updating `hasUserSubmitted` state via `submittedEvaluations` refetch.
        
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

  const totalPossibleEvaluators = useMemo(() => {
    if (!match || !allGroupPlayers) return 0;
    return match.players.filter(p => {
        const fullPlayer = allGroupPlayers.find(gp => gp.id === p.uid);
        return fullPlayer && isRealUser(fullPlayer);
    }).length;
  }, [match, allGroupPlayers]);

  const completedEvaluatorsCount = useMemo(() => {
    if (!submittedEvaluations) return 0;
    const uniqueEvaluators = new Set(submittedEvaluations.map(e => e.evaluatedBy));
    return uniqueEvaluators.size;
  }, [submittedEvaluations]);

  const evaluationProgress = totalPossibleEvaluators > 0 ? (completedEvaluatorsCount / totalPossibleEvaluators) * 100 : 0;
  
  if (matchLoading || isPageLoading || evalsLoading || playersLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!match || !user) {
    return <div>Datos no encontrados.</div>;
  }
  
  const isParticipant = match.players.some(p => p.uid === user.uid);
  if (!isParticipant) {
    return <div>No participaste en este partido, por lo que no puedes evaluar.</div>;
  }
  
  if (match.status === 'evaluated') {
    return (
        <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
            <PageHeader title={`Evaluación de: ${match.title}`}/>
            <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Evaluación Completa</AlertTitle>
                <AlertDescription>Este partido ya ha sido evaluado y los OVRs de los jugadores han sido actualizados.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/matches')}>Volver a Partidos</Button>
        </div>
    )
  }
  
  const userPlayerProfile = allGroupPlayers?.find(p => p.id === user.uid);
  const isUserARealPlayer = userPlayerProfile ? isRealUser(userPlayerProfile) : false;

  // VIEW FOR ORGANIZER (if they are NOT a real player, otherwise they should evaluate)
  const isOwner = match.ownerUid === user.uid;
  if (isOwner && !isUserARealPlayer) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title={`Panel de Evaluación: ${match.title}`}
                description={`Supervisa el progreso de las evaluaciones de los jugadores.`}
            />
            <Card>
                <CardHeader>
                    <CardTitle>Progreso de la Evaluación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-primary">{completedEvaluatorsCount} / {totalPossibleEvaluators}</span>
                        <span className="text-muted-foreground">jugadores reales han evaluado</span>
                    </div>
                    <Progress value={evaluationProgress} />
                    <Alert>
                        <BarChart className="h-4 w-4" />
                        <AlertTitle>¿Qué sigue?</AlertTitle>
                        <AlertDescription>
                            Cuando suficientes jugadores hayan completado sus evaluaciones (recomendado >80%), podrás finalizar el proceso para calcular y actualizar los nuevos OVRs.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardContent>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                    <Button size="lg" disabled={true} >
                                        Finalizar y Calcular OVRs
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Esta función se habilitará cuando la participación sea suficiente.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardContent>
            </Card>
        </div>
    );
  }

  // VIEW FOR MANUAL PLAYERS (who can't evaluate)
  if (!isUserARealPlayer) {
     return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title={`Evaluar Jugadores: ${match.title}`}
                description={`Estado de la evaluación del partido.`}
            />
            <Alert>
                <ThumbsUp className="h-4 w-4" />
                <AlertTitle>¡Gracias por participar!</AlertTitle>
                <AlertDescription>
                    Como jugador manual, puedes ser evaluado por tus compañeros. Los resultados se calcularán cuando el organizador cierre el proceso.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  // VIEW FOR REAL PLAYERS (who can evaluate)
  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title={`Evaluar Jugadores: ${match.title}`}
            description={`Evalúa el rendimiento de tus compañeros de equipo asignados.`}
        />
        {hasUserSubmitted ? (
            <Alert>
                <ThumbsUp className="h-4 w-4" />
                <AlertTitle>¡Gracias por participar!</AlertTitle>
                <AlertDescription>
                    Ya has enviado tus evaluaciones para este partido. Los resultados se calcularán cuando el organizador cierre el proceso.
                </AlertDescription>
            </Alert>
        ) : myAssignments.length === 0 ? (
             <Alert variant="destructive">
                <AlertTitle>Sin Asignaciones</AlertTitle>
                <AlertDescription>
                    No se te han asignado jugadores para evaluar, o todos los jugadores del equipo ya han sido evaluados por otros. ¡Gracias por tu disposición!
                </AlertDescription>
            </Alert>
        ) : (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Jugadores a Evaluar</CardTitle>
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
                                render={({ field, fieldState }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Etiquetas (Opcional)</FormLabel>
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
                                                                            const currentValue = field.value || [];
                                                                            if (isSelected) {
                                                                                field.onChange(currentValue.filter((t: string) => t !== tag));
                                                                            } else if (currentValue.length < 2) {
                                                                                field.onChange([...currentValue, tag]);
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

    