'use client';

import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc, writeBatch, collection, getDocs, updateDoc, getDoc, runTransaction, DocumentData, query } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

const evaluationSchema = z.object({
  evaluations: z.array(z.object({
    playerId: z.string(),
    displayName: z.string(),
    photoUrl: z.string(),
    goals: z.coerce.number().min(0).max(20).default(0),
    rating: z.coerce.number().min(1).max(10).default(5),
  }))
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

export default function EvaluateMatchPage() {
  const { id: matchId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

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
    }));
    replace(initialEvals);
  }

  const onSubmit = async (data: EvaluationFormData) => {
    if (!firestore || !match) return;

    try {
        await runTransaction(firestore, async (transaction) => {
            const evaluationsCollectionRef = collection(firestore, 'matches', match.id, 'evaluations');
            
            // 1. Check if evaluations already exist (read operation, but not a transactional one)
            // This is better done outside a transaction or by attempting a read first.
            const existingEvalsSnap = await getDocs(query(evaluationsCollectionRef));
            if (!existingEvalsSnap.empty) {
                throw new Error('Este partido ya ha sido evaluado.');
            }

            // --- ALL READS FIRST ---
            const playerDocsPromises = data.evaluations.map(evaluation => {
                const playerRef = doc(firestore, 'players', evaluation.playerId);
                return transaction.get(playerRef);
            });
            const playerDocs = await Promise.all(playerDocsPromises);

            // --- THEN ALL WRITES ---

            // 2. Save new evaluations
            data.evaluations.forEach(evaluation => {
                const evalRef = doc(evaluationsCollectionRef, evaluation.playerId);
                transaction.set(evalRef, {
                    playerId: evaluation.playerId,
                    goals: evaluation.goals,
                    rating: evaluation.rating,
                    evaluatedBy: user?.uid,
                    evaluatedAt: new Date().toISOString(),
                });
            });

            // 3. Update player stats for each evaluation
            playerDocs.forEach((playerDoc, index) => {
                const evaluation = data.evaluations[index];
                if (playerDoc.exists()) {
                    const playerData = playerDoc.data() as Player;
                    const currentStats = playerData.stats || { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 };
                    
                    const newMatchesPlayed = currentStats.matchesPlayed + 1;
                    const newGoals = (currentStats.goals || 0) + evaluation.goals;

                    // Calculate new average rating
                    const totalRatingPoints = (currentStats.averageRating * currentStats.matchesPlayed) + evaluation.rating;
                    const newAverageRating = totalRatingPoints / newMatchesPlayed;
                    
                    transaction.update(playerDoc.ref, {
                        'stats.matchesPlayed': newMatchesPlayed,
                        'stats.goals': newGoals,
                        'stats.averageRating': newAverageRating,
                    });
                }
            });
            
            // 4. Update match status
            const matchDocRef = doc(firestore, 'matches', match.id);
            transaction.update(matchDocRef, { status: 'evaluated' });
        });

        toast({
            title: 'Evaluación Guardada',
            description: 'Las estadísticas del partido y de los jugadores se han actualizado.'
        });
        router.push('/matches');

    } catch (error: any) {
        console.error('Error saving evaluations:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'No se pudieron guardar las evaluaciones.'
        });
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
                <CardDescription>Asigna goles y una calificación del 1 al 10 a cada jugador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 items-center gap-4 border-b pb-4">
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
                </div>
              ))}
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar Evaluaciones
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
