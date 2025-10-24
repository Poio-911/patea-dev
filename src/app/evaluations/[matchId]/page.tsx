
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { 
  collection, 
  query, 
  where, 
  addDoc, 
  getDocs, 
} from 'firebase/firestore'
import { Loader2, Save, ShieldCheck, Goal, Plus, Minus, FileClock } from 'lucide-react'

import { useFirestore, useUser, useCollection } from '@/firebase'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { PerformanceTag, performanceTagsDb } from '@/lib/performance-tags'
import { cn } from '@/lib/utils'
import type { Player, EvaluationAssignment, PlayerEvaluationFormData } from '@/lib/types'

// --- Zod Validation (CORREGIDO Y REFORZADO) ---
const pointsEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  position: z.string(),
  evaluationType: z.literal('points'),
  rating: z.coerce.number().min(1, 'El rating debe ser al menos 1').max(10, 'El rating debe ser máximo 10'), // ✅ Requerido y con mensajes
  performanceTags: z.array(z.custom<PerformanceTag>()).optional(), // Puede no estar
});

const tagsEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  position: z.string(),
  evaluationType: z.literal('tags'),
  rating: z.coerce.number().optional(), // Puede no estar
  performanceTags: z.array(z.custom<PerformanceTag>()).min(3, 'Debes seleccionar al menos 3 etiquetas.'), // ✅ Requerido
});

const playerEvaluationSchema = z.discriminatedUnion('evaluationType', [
  pointsEvaluationSchema,
  tagsEvaluationSchema,
]);

const evaluationSchema = z.object({
  evaluatorGoals: z.coerce.number().min(0).max(20).default(0),
  evaluations: z.array(playerEvaluationSchema),
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

// --- Helper ---
const shuffleArray = <T,>(array: T[]): T[] => {
  let currentIndex = array.length
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }
  return array
}

const TagCheckbox = ({
  tag,
  subjectId,
  isChecked,
  onCheckedChange,
}: {
  tag: PerformanceTag
  subjectId: string
  isChecked: boolean
  onCheckedChange: (checked: boolean) => void
}) => {
  const positiveEffects = tag.effects.filter((e) => e.change > 0)
  const negativeEffects = tag.effects.filter((e) => e.change < 0)
  const uniqueId = `tag-${tag.id}-${subjectId}`;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        isChecked ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'
      )}
    >
      <Checkbox checked={isChecked} onCheckedChange={onCheckedChange} id={uniqueId} className="mt-1" />
      <label htmlFor={uniqueId} className="w-full cursor-pointer space-y-2">
        <div>
          <p className="font-semibold">{tag.name}</p>
          <p className="text-xs text-muted-foreground">{tag.description}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {positiveEffects.map((effect) => (
            <div key={effect.attribute} className="flex items-center gap-1 text-xs font-medium text-green-600">
              <Plus size={12} /> {effect.attribute.toUpperCase()}: +{effect.change}
            </div>
          ))}
          {negativeEffects.map((effect) => (
            <div key={effect.attribute} className="flex items-center gap-1 text-xs font-medium text-red-600">
              <Minus size={12} /> {effect.attribute.toUpperCase()}: {effect.change}
            </div>
          ))}
        </div>
      </label>
    </div>
  )
}

// --- MAIN COMPONENT ---
export default function PerformEvaluationPage() {
  const { matchId } = useParams();
  const firestore = useFirestore()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [submissionIsPending, setSubmissionIsPending] = useState(false);
  const [randomTags, setRandomTags] = useState<Record<string, PerformanceTag[]>>({})

  const allGroupPlayersQuery = useMemo(
    () =>
      firestore && user?.activeGroupId
        ? query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId))
        : null,
    [firestore, user?.activeGroupId]
  )
  const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(allGroupPlayersQuery)

  const userAssignmentsQuery = useMemo(() => {
    if (!firestore || !user?.uid || !matchId) return null;
    return query(
      collection(firestore, 'matches', matchId as string, 'assignments'),
      where('evaluatorId', '==', user.uid),
      where('status', '==', 'pending')
    )
  }, [firestore, user, matchId])

  const { data: assignments, loading: assignmentsLoading } =
    useCollection<EvaluationAssignment>(userAssignmentsQuery)

  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { evaluatorGoals: 0, evaluations: [] },
  })

  const { fields, replace } = useFieldArray({ control: form.control, name: 'evaluations' })

  const getRandomTagsForPosition = useCallback((position: string) => {
    const positionTags = performanceTagsDb.filter(
      (tag) => tag.positions.includes('ALL') || tag.positions.includes(position as any)
    )
    const selectedPositive = shuffleArray(positionTags.filter((t) => t.impact === 'positive')).slice(0, 6)
    const selectedNegative = shuffleArray(positionTags.filter((t) => t.impact === 'negative')).slice(0, 4)
    return shuffleArray([...selectedPositive, ...selectedNegative])
  }, [])

  useEffect(() => {
    async function checkPendingSubmission() {
      if (!firestore || !user?.uid || !matchId) return;
      const submissionsQuery = query(
        collection(firestore, 'evaluationSubmissions'),
        where('matchId', '==', matchId),
        where('evaluatorId', '==', user.uid)
      );
      const snapshot = await getDocs(submissionsQuery);
      setSubmissionIsPending(!snapshot.empty);
    }

    checkPendingSubmission();
  }, [firestore, user, matchId, isPageLoading]);


  useEffect(() => {
    if (assignments && allGroupPlayers) {
      if (assignments.length > 0) {
        const initialFormValues: PlayerEvaluationFormData[] = []
        const tagsForPlayers: Record<string, PerformanceTag[]> = {}

        for (const assignment of assignments) {
          const subject = allGroupPlayers.find((p) => p.id === assignment.subjectId)
          if (subject) {
            initialFormValues.push({
              assignmentId: assignment.id,
              subjectId: assignment.subjectId,
              displayName: subject.name,
              photoUrl: subject.photoUrl || '',
              position: subject.position,
              evaluationType: 'points',
              rating: 5, // ✅ Valor inicial explícito
              performanceTags: [],
            })
            tagsForPlayers[subject.id] = getRandomTagsForPosition(subject.position)
          }
        }

        replace(initialFormValues as any)
        setRandomTags(tagsForPlayers)
      }
      setIsPageLoading(false)
    } else if (!assignmentsLoading && !playersLoading) {
      setIsPageLoading(false)
    }
  }, [assignments, allGroupPlayers, replace, assignmentsLoading, playersLoading, getRandomTagsForPosition])

  const onSubmit = async (data: EvaluationFormData) => {
    if (!firestore || !user || !matchId) return

    setIsSubmitting(true)
    try {
      const submissionData = {
        evaluatorId: user.uid,
        matchId,
        submittedAt: new Date().toISOString(),
        submission: data,
      };

      await addDoc(collection(firestore, 'evaluationSubmissions'), submissionData);

      toast({
        title: '¡Evaluaciones en camino!',
        description: 'Tus evaluaciones se han enviado y se procesarán en segundo plano.',
      })
      router.push('/evaluations')
    } catch (error: any) {
      console.error("Error submitting evaluation:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron enviar las evaluaciones.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isPageLoading || assignmentsLoading || playersLoading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )

  if (!user || !matchId || typeof matchId !== 'string') return <div>Datos no encontrados.</div>

  if (submissionIsPending) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="Evaluar Partido" description="Tus evaluaciones ya fueron enviadas." />
            <Alert variant="default" className="border-blue-500 text-blue-700">
                <FileClock className="h-4 w-4" />
                <AlertTitle className="text-blue-700">Evaluación en Proceso</AlertTitle>
                <AlertDescription>
                    Tus evaluaciones para este partido ya fueron enviadas y están esperando ser procesadas por el organizador.
                    <Button asChild variant="link" className="p-0 h-auto ml-1">
                        <Link href="/evaluations">Volver a mis evaluaciones</Link>
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Evaluar Partido" description="Ya no tienes evaluaciones pendientes para este partido." />
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Sin Evaluaciones Pendientes</AlertTitle>
          <AlertDescription>
            No tienes jugadores asignados para evaluar en este partido, o ya has completado tu evaluación. ¡Gracias!
            <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/evaluations">Volver a mis evaluaciones</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Evaluar Partido" description="Evalúa el rendimiento de tus compañeros de equipo asignados." />

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
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="border-b pb-6 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={field.photoUrl} alt={field.displayName} />
                      <AvatarFallback>{field.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-lg">{field.displayName}</p>
                  </div>

                  <Controller
                    name={`evaluations.${index}.evaluationType`}
                    control={form.control}
                    render={({ field: typeField }) => (
                      <Tabs value={typeField.value} onValueChange={(value) => {
                        form.setValue(`evaluations.${index}.evaluationType`, value as 'points' | 'tags', { shouldValidate: true });
                      }} className="w-full">
                        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
                          <TabsTrigger value="points">Evaluar por Puntos</TabsTrigger>
                          <TabsTrigger value="tags">Evaluar por Etiquetas</TabsTrigger>
                        </TabsList>

                        <TabsContent value="points" className="p-4 bg-muted/30 rounded-b-md">
                          <FormField
                            control={form.control}
                            name={`evaluations.${index}.rating`}
                            render={({ field: ratingField }) => (
                              <FormItem>
                                <FormLabel>Rating: {ratingField.value ?? 5}</FormLabel>
                                <FormControl>
                                  <div className="flex items-center gap-2 pt-2">
                                    <span className="text-xs text-muted-foreground">1</span>
                                    <Slider
                                      min={1}
                                      max={10}
                                      step={1}
                                      value={[ratingField.value ?? 5]}
                                      onValueChange={(value) => ratingField.onChange(value[0])}
                                    />
                                    <span className="text-xs text-muted-foreground">10</span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        <TabsContent value="tags" className="p-4 bg-muted/30 rounded-b-md">
                          <Controller
                            name={`evaluations.${index}.performanceTags`}
                            control={form.control}
                            render={({ field: tagsField, fieldState }) => (
                              <FormItem>
                                <FormLabel>Elige al menos 3 etiquetas</FormLabel>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-96 overflow-y-auto">
                                  {randomTags[field.subjectId]?.map((tag) => (
                                    <TagCheckbox
                                      key={tag.id}
                                      tag={tag}
                                      subjectId={field.subjectId}
                                      isChecked={!!(tagsField.value || []).find((t: any) => t.id === tag.id)}
                                      onCheckedChange={(checked) => {
                                        const currentVal = tagsField.value || []
                                        const newVal = checked
                                          ? [...currentVal, tag]
                                          : currentVal.filter((t: any) => t.id !== tag.id)
                                        tagsField.onChange(newVal)
                                      }}
                                    />
                                  ))}
                                </div>
                                <FormMessage>{fieldState.error?.message}</FormMessage>
                              </FormItem>
                            )}
                          />
                        </TabsContent>
                      </Tabs>
                    )}
                  />
                  <FormMessage>{form.formState.errors.evaluations?.[index]?.root?.message}</FormMessage>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Enviando...' : 'Enviar Evaluaciones'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
