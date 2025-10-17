'use client';

import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, writeBatch, collection, query, where } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, PlayerPosition, Evaluation } from '@/lib/types';
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

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

export default function PerformEvaluationPage() {
  const { matchId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [assignments, setAssignments] = useState<{ uid: string; displayName: string; photoUrl: string }[]>([]);

  const matchRef = useMemo(() => firestore ? doc(firestore, 'matches', matchId as string) : null, [firestore, matchId]);
  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);
  
  const allGroupPlayersQuery = useMemo(() => 
    firestore && match?.groupId ? query(collection(firestore, 'players'), where('groupId', '==', match.groupId)) : null
  , [firestore, match]);
  const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(allGroupPlayersQuery);

  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { evaluations: [] }
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "evaluations" });

  useEffect(() => {
    if (match && user && allGroupPlayers) {
      const userTeam = match.teams.find(team => team.players.some(p => p.uid === user.uid));
      if (!userTeam) {
        setIsPageLoading(false);
        return;
      }
      
      const realPlayersInTeam = userTeam.players.filter(p => {
          const fullPlayer = allGroupPlayers.find(gp => gp.id === p.uid);
          return fullPlayer && isRealUser(fullPlayer);
      });

      const playersToEvaluate = userTeam.players
        .filter(p => p.uid !== user.uid) // Can't evaluate self
        .map(p => ({
          uid: p.uid,
          displayName: p.displayName,
          photoUrl: allGroupPlayers.find(gp => gp.id === p.uid)?.photoUrl || ''
        }));
      
      // Simple assignment: evaluate up to 2 other players in your team
      // A more robust system would be needed for fairness in all cases.
      const assigned = playersToEvaluate.slice(0, 2); 
      setAssignments(assigned);

      const initialFormValues = assigned.map(p => ({
          playerId: p.uid,
          displayName: p.displayName,
          photoUrl: p.photoUrl,
          goals: 0,
          rating: 5,
          performanceTags: []
      }));
      replace(initialFormValues);
      setIsPageLoading(false);

    } else if (!matchLoading && !playersLoading) {
      setIsPageLoading(false);
    }
  }, [match, user, allGroupPlayers, replace, matchLoading, playersLoading]);


  const onSubmit = async (data: EvaluationFormData) => {
    if (!firestore || !match || !user) return;
    setIsSubmitting(true);
    
    try {
        const batch = writeBatch(firestore);
        
        data.evaluations.forEach(evaluation => {
            // A unique ID for an evaluation document can be who evaluated it.
            const evalRef = doc(firestore, 'matches', match.id, 'evaluations', user.uid);
            const newEvaluation: Omit<Evaluation, 'id'> = {
                playerId: evaluation.playerId,
                goals: evaluation.goals,
                rating: evaluation.rating,
                performanceTags: evaluation.performanceTags || [],
                evaluatedBy: user.uid,
                evaluatedAt: new Date().toISOString(),
            };
            // Note: This logic assumes one user evaluates one other player.
            // If a user evaluates multiple players, we'd need a different doc ID strategy, like a sub-collection per player.
            // For now, we are overwriting to keep it simple, assuming one doc per evaluator.
            // Let's refine this to store evaluations of multiple players
             const specificEvalRef = doc(collection(firestore, 'matches', match.id, 'evaluations'));
             batch.set(specificEvalRef, newEvaluation);
        });

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
  
  if (isPageLoading || matchLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!match || !user) {
    return <div>Datos no encontrados.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title={`Evaluar Partido: ${match.title}`}
            description={`Evalúa el rendimiento de tus compañeros de equipo asignados.`}
        />
        {assignments.length === 0 ? (
             <Alert variant="default">
                <AlertTitle>Sin Asignaciones</AlertTitle>
                <AlertDescription>
                    No se te han asignado jugadores para evaluar en este partido, o ya has completado tu evaluación. ¡Gracias!
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