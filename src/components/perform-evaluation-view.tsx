
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { doc, writeBatch, collection, query, where } from 'firebase/firestore'
import { Loader2, Save, ShieldCheck, Goal, Plus, Minus } from 'lucide-react'

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
import type { Player, EvaluationAssignment, Evaluation } from '@/lib/types'

// --- Validación con Zod ---
const playerEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  position: z.string(),
  evaluationType: z.enum(['points', 'tags']).default('points'),
  rating: z.coerce.number().min(1).max(10).optional(),
  performanceTags: z
    .array(z.any())
    .min(3, 'Debes seleccionar al menos 3 etiquetas.')
    .optional(),
})

const evaluationSchema = z.object({
  evaluatorGoals: z.coerce.number().min(0).max(20).default(0),
  evaluations: z.array(playerEvaluationSchema),
})

type EvaluationFormData = z.infer<typeof evaluationSchema>
type PlayerEvaluationFormData = z.infer<typeof playerEvaluationSchema>

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

// --- COMPONENTE PRINCIPAL ---
export default function PerformEvaluationView({ matchId }: { matchId: string }) {
  const firestore = useFirestore()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
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
    if (!firestore || !user?.uid || !matchId) return null
    return query(
      collection(firestore, 'matches', matchId, 'assignments'),
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
              rating: 5,
              performanceTags: [],
            })
            tagsForPlayers[subject.id] = getRandomTagsForPosition(subject.position)
          }
        }

        replace(initialFormValues)
        setRandomTags(tagsForPlayers)
      }
      setIsPageLoading(false)
    } else if (!assignmentsLoading && !playersLoading) {
      setIsPageLoading(false)
    }
  }, [assignments, allGroupPlayers, replace, assignmentsLoading, playersLoading, getRandomTagsForPosition])

  const onSubmit = async (data: EvaluationFormData) => {
    if (!firestore || !user || !matchId) return

    for (const evaluation of data.evaluations) {
      if (evaluation.evaluationType === 'points' && (!evaluation.rating || evaluation.rating < 1 || evaluation.rating > 10)) {
        toast({
          variant: 'destructive',
          title: 'Error de Validación',
          description: `Debes asignar un rating (1-10) para ${evaluation.displayName}.`,
        })
        return
      }
      if (evaluation.evaluationType === 'tags' && (!evaluation.performanceTags || evaluation.performanceTags.length < 3)) {
        toast({
          variant: 'destructive',
          title: 'Error de Validación',
          description: `Debes seleccionar al menos 3 etiquetas para ${evaluation.displayName}.`,
        })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const batch = writeBatch(firestore)

      const selfEvalRef = doc(collection(firestore, 'matches', matchId, 'selfEvaluations'))
      batch.set(selfEvalRef, {
        playerId: user.uid,
        matchId,
        goals: data.evaluatorGoals,
        reportedAt: new Date().toISOString(),
      })

      for (const evaluation of data.evaluations) {
        const evalRef = doc(collection(firestore, 'evaluations'))
        const newEvaluation: Omit<Evaluation, 'id'> = {
          assignmentId: evaluation.assignmentId,
          playerId: evaluation.subjectId,
          evaluatorId: user.uid,
          matchId,
          goals: 0,
          evaluatedAt: new Date().toISOString(),
        }

        if (evaluation.evaluationType === 'points') {
          newEvaluation.rating = evaluation.rating
        } else {
          newEvaluation.performanceTags = evaluation.performanceTags
        }

        batch.set(evalRef, newEvaluation)

        const assignmentRef = doc(firestore, 'matches', matchId, 'assignments', evaluation.assignmentId)
        batch.update(assignmentRef, {
          status: 'completed',
          evaluationId: evalRef.id,
        })
      }

      await batch.commit()

      toast({
        title: '¡Evaluación Enviada!',
        description: 'Gracias por tu participación. Tus evaluaciones han sido guardadas.',
      })
      router.push('/evaluations')
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron guardar las evaluaciones.',
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

  if (!user) return <div>Datos no encontrados.</div>

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Evaluar Partido" description="Evalúa el rendimiento de tus compañeros de equipo asignados." />

      {fields.length === 0 ? (
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
                        <Tabs value={typeField.value} onValueChange={typeField.onChange} className="w-full">
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
                                  <FormLabel>Rating: {ratingField.value || 5}</FormLabel>
                                  <FormControl>
                                    <div className="flex items-center gap-2 pt-2">
                                      <span className="text-xs text-muted-foreground">1</span>
                                      <Slider
                                        min={1}
                                        max={10}
                                        step={1}
                                        defaultValue={[ratingField.value || 5]}
                                        onValueChange={(value) => ratingField.onChange(value[0])}
                                      />
                                      <span className="text-xs text-muted-foreground">10</span>
                                    </div>
                                  </FormControl>
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
                                        isChecked={!!tagsField.value?.find((t) => t.id === tag.id)}
                                        onCheckedChange={(checked) => {
                                          const currentVal = tagsField.value || []
                                          const newVal = checked
                                            ? [...currentVal, tag]
                                            : currentVal.filter((t) => t.id !== tag.id)
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
      )}
    </div>
  )
}
