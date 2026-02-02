
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
import { Loader2, Save, ShieldCheck, Goal, Plus, Minus, FileClock, Check } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Sparkles } from 'lucide-react'
import { analyzeEvaluationTextAction } from '@/lib/actions/evaluation-actions'
import { TagSelector } from '@/components/ui/tag-selector'
import { PerformanceTag, performanceTagsDb } from '@/lib/performance-tags'
import { cn } from '@/lib/utils'
import type { Player, EvaluationAssignment, PlayerEvaluationFormData } from '@/lib/types'
import { BackButton } from '@/components/navigation/back-button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// --- Zod Validation (CORREGIDO Y REFORZADO) ---
const pointsEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoURL: z.string(),
  position: z.string(),
  evaluationType: z.literal('points'),
  rating: z.coerce.number().min(1, 'El rating debe ser al menos 1').max(10, 'El rating debe ser máximo 10'), // ✅ Requerido y con mensajes
  performanceTags: z.array(z.custom<PerformanceTag>()).optional(), // Puede no estar
});

const tagsEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoURL: z.string(),
  position: z.string(),
  evaluationType: z.literal('tags'),
  rating: z.coerce.number().optional(), // Puede no estar
  performanceTags: z.array(z.custom<PerformanceTag>()).min(3, 'Debes seleccionar al menos 3 etiquetas.'), // ✅ Requerido
  overrideNoNegative: z.boolean().optional(),
});

const attributeChangeSchema = z.object({
  attribute: z.enum(['pac', 'sho', 'pas', 'dri', 'def', 'phy']),
  change: z.number(),
  reason: z.string(),
});

const textEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoURL: z.string(),
  position: z.string(),
  evaluationType: z.literal('text'),
  textDescription: z.string().min(10, 'Describe al menos 10 caracteres').max(500, 'Máximo 500 caracteres'),
  aiAttributeChanges: z.array(attributeChangeSchema).optional(),
  aiConfidence: z.number().optional(),
  aiAnalysisComplete: z.boolean().optional(),
  aiSummary: z.string().optional(),
});

const playerEvaluationSchema = z.discriminatedUnion('evaluationType', [
  pointsEvaluationSchema,
  tagsEvaluationSchema,
  textEvaluationSchema,
]);

const evaluationSchema = z.object({
  evaluatorGoals: z.coerce.number().min(0).max(20).default(0),
  evaluations: z.array(playerEvaluationSchema),
}).superRefine((val, ctx) => {
  val.evaluations.forEach((ev, idx) => {
    // Exigir al menos 1 etiqueta negativa en evaluaciones tipo 'tags'
    if (ev && (ev as any).evaluationType === 'tags') {
      const tags = (ev as any).performanceTags || []
      const hasNegative = tags.some((t: any) => t && t.impact === 'negative')
      const override = (ev as any).overrideNoNegative === true
      if (!hasNegative && !override) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Incluye al menos 1 etiqueta negativa para equilibrar la evaluación.',
          path: ['evaluations', idx, 'performanceTags'],
        })
      }
    }
    // Exigir análisis de IA antes de enviar evaluaciones de texto
    if (ev && (ev as any).evaluationType === 'text') {
      if (!(ev as any).aiAnalysisComplete) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes presionar "Evaluar" antes de enviar.',
          path: ['evaluations', idx, 'textDescription'],
        })
      }
    }
  })
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

// Helper para obtener el color según el rating
const getRatingColor = (rating: number) => {
  if (rating >= 8) return 'from-green-500 to-green-600'
  if (rating >= 6) return 'from-yellow-500 to-orange-500'
  if (rating >= 4) return 'from-orange-500 to-red-500'
  return 'from-red-600 to-red-700'
}

const getRatingLabel = (rating: number) => {
  if (rating >= 9) return 'Excelente'
  if (rating >= 7) return 'Muy Bueno'
  if (rating >= 5) return 'Bueno'
  if (rating >= 3) return 'Regular'
  return 'Malo'
}

// Thumb color classes for slider selector
const getRatingThumbClasses = (rating: number) => {
  if (rating >= 9) return 'bg-green-600 border-green-700'
  if (rating >= 7) return 'bg-green-500 border-green-600'
  if (rating >= 6) return 'bg-yellow-500 border-yellow-600'
  if (rating >= 4) return 'bg-orange-500 border-orange-600'
  return 'bg-red-600 border-red-700'
}

// Palette for rating pills by number
const getRatingPillPalette = (n: number) => {
  if (n >= 9) return { bg: 'bg-green-600', text: 'text-white', tint: 'bg-green-600/10 text-green-700 border-green-600/20' }
  if (n >= 7) return { bg: 'bg-green-500', text: 'text-white', tint: 'bg-green-500/10 text-green-700 border-green-500/20' }
  if (n >= 5) return { bg: 'bg-yellow-500', text: 'text-white', tint: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' }
  if (n >= 3) return { bg: 'bg-orange-500', text: 'text-white', tint: 'bg-orange-500/10 text-orange-700 border-orange-500/20' }
  return { bg: 'bg-red-600', text: 'text-white', tint: 'bg-red-600/10 text-red-700 border-red-600/20' }
}

function RatingPills({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const current = value ?? 5
  const nums = Array.from({ length: 10 }, (_, i) => i + 1)
  return (
    <div className="grid grid-cols-10 gap-1 sm:gap-2">
      {nums.map((n) => {
        const palette = getRatingPillPalette(n)
        const selected = current === n
        return (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={selected ? 'default' : 'outline'}
            className={cn(
              'rounded-full h-8 px-0 text-xs',
              selected ? `${palette.bg} ${palette.text} border-transparent` : `${palette.tint}`
            )}
            onClick={() => onChange(n)}
          >
            {n}
          </Button>
        )
      })}
    </div>
  )
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
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId;
  const firestore = useFirestore()
  const { user } = useUser()
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [submissionIsPending, setSubmissionIsPending] = useState(false);
  const [randomTags, setRandomTags] = useState<Record<string, PerformanceTag[]>>({})
  const [analyzingText, setAnalyzingText] = useState<Record<string, boolean>>({})
  const [aiResults, setAiResults] = useState<Record<string, { attributeChanges: { attribute: string; change: number; reason: string }[]; confidence: number; summary: string }>>({})

  // Function to analyze text with AI
  const analyzeTextForPlayer = async (playerIndex: number) => {
    const evaluation = form.getValues(`evaluations.${playerIndex}`) as any;
    if (evaluation.evaluationType !== 'text' || !evaluation.textDescription || evaluation.textDescription.length < 10) {
      toast({
        variant: 'destructive',
        title: 'Texto insuficiente',
        description: 'Escribe al menos 10 caracteres para analizar el texto.',
      })
      return
    }

    const playerId = evaluation.subjectId
    setAnalyzingText(prev => ({ ...prev, [playerId]: true }))

    try {
      const result = await analyzeEvaluationTextAction({
        text: (evaluation as any).textDescription,
        playerPosition: evaluation.position as 'DEL' | 'MED' | 'DEF' | 'POR',
        playerName: evaluation.displayName,
      })

      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error en análisis',
          description: result.error,
        })
      } else {
        // Update form with attribute changes from AI
        form.setValue(`evaluations.${playerIndex}.aiAttributeChanges`, result.attributeChanges)
        form.setValue(`evaluations.${playerIndex}.aiConfidence`, result.confidence)
        form.setValue(`evaluations.${playerIndex}.aiAnalysisComplete`, true)
        form.setValue(`evaluations.${playerIndex}.aiSummary`, result.summary)

        setAiResults(prev => ({ ...prev, [playerId]: result }))

        const positiveChanges = result.attributeChanges.filter(c => c.change > 0).length
        const negativeChanges = result.attributeChanges.filter(c => c.change < 0).length
        toast({
          title: 'Análisis completado',
          description: `${positiveChanges} atributo(s) suben, ${negativeChanges} bajan`,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo analizar el texto. Intenta de nuevo.',
      })
    } finally {
      setAnalyzingText(prev => ({ ...prev, [playerId]: false }))
    }
  }

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
              photoURL: subject.photoURL || '',
              position: subject.position,
              evaluationType: 'points',
              rating: 5,
              performanceTags: [],
              textDescription: '',
              aiAnalysisComplete: false,
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

  // Estado del diálogo de confirmación (override consciente)
  const [confirmOverrideOpen, setConfirmOverrideOpen] = useState(false)
  const [pendingOverrideIndices, setPendingOverrideIndices] = useState<number[]>([])

  // Submit wrapper para permitir override consciente cuando no hay negativas
  const handleSmartSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const current = form.getValues()
    // Detectar evaluaciones 'tags' sin negativas
    const indicesSinNegativas: number[] = []
    current.evaluations.forEach((ev: any, idx: number) => {
      if (ev?.evaluationType === 'tags') {
        const tags: PerformanceTag[] = ev.performanceTags || []
        const hasNegative = tags.some((t) => t && t.impact === 'negative')
        if (!hasNegative) indicesSinNegativas.push(idx)
      }
    })
    if (indicesSinNegativas.length > 0) {
      setPendingOverrideIndices(indicesSinNegativas)
      setConfirmOverrideOpen(true)
      return
    }
    // Proceder con submit normal (validación Zod)
    form.handleSubmit(onSubmit)()
  }

  const confirmOverrideAndSubmit = () => {
    pendingOverrideIndices.forEach((idx) => {
      form.setValue(`evaluations.${idx}.overrideNoNegative`, true, { shouldValidate: false })
    })
    setConfirmOverrideOpen(false)
    form.handleSubmit(onSubmit)()
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
        <BackButton href="/matches" label="Volver a Partidos" />
        <PageHeader title="Evaluar Partido" description="Tus evaluaciones ya fueron enviadas." />
        <Alert variant="default" className="border-info text-info">
          <FileClock className="h-4 w-4 text-info" />
          <AlertTitle className="text-info">Evaluación en Proceso</AlertTitle>
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
        <BackButton href="/matches" label="Volver a Partidos" />
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
      <BackButton href="/matches" label="Volver a Partidos" />
      <PageHeader title="Evaluar Partido" description="Evalúa el rendimiento de tus compañeros de equipo asignados." />

      <Form {...form}>
        <form onSubmit={handleSmartSubmit} className="space-y-8">
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
                <div key={field.id} className="border rounded-lg p-6 bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar className="h-16 w-16 border-2 border-muted">
                      <AvatarImage src={field.photoURL} alt={field.displayName} className="object-cover" />
                      <AvatarFallback className="text-lg font-bold">{field.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-xl text-foreground">{field.displayName}</h3>
                      <p className="text-sm text-muted-foreground font-medium">{field.position}</p>
                    </div>
                  </div>

                  <Controller
                    name={`evaluations.${index}.evaluationType`}
                    control={form.control}
                    render={({ field: typeField }) => (
                      <Tabs value={typeField.value} onValueChange={(value) => {
                        form.setValue(`evaluations.${index}.evaluationType`, value as 'points' | 'tags' | 'text', { shouldValidate: true });
                      }} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="points" className="text-xs">Puntos</TabsTrigger>
                          <TabsTrigger value="tags" className="text-xs">Etiquetas</TabsTrigger>
                          <TabsTrigger value="text" className="text-xs">Descripción</TabsTrigger>
                        </TabsList>

                        <TabsContent value="points" className="p-6 bg-background border rounded-lg">
                          <FormField
                            control={form.control}
                            name={`evaluations.${index}.rating`}
                            render={({ field: ratingField }) => (
                              <FormItem className="space-y-6">
                                <FormLabel className="text-base font-medium">Calificación</FormLabel>
                                <FormControl>
                                  <RatingPills
                                    value={ratingField.value ?? 5}
                                    onChange={(n) => ratingField.onChange(n)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        <TabsContent value="tags" className="p-6 bg-background border rounded-lg">
                          <Controller
                            name={`evaluations.${index}.performanceTags`}
                            control={form.control}
                            render={({ field: tagsField, fieldState }) => (
                              <FormItem className="space-y-4">
                                <FormLabel className="text-base font-medium">Selecciona etiquetas de rendimiento</FormLabel>
                                <TagSelector
                                  tags={randomTags[field.subjectId] || []}
                                  selectedTagIds={(tagsField.value || []).map((t: any) => t.id)}
                                  onSelectionChange={(tagIds) => {
                                    const selectedTags = tagIds.map(id =>
                                      (randomTags[field.subjectId] || []).find(t => t.id === id)
                                    ).filter(Boolean) as PerformanceTag[]
                                    tagsField.onChange(selectedTags)
                                  }}
                                  minTags={3}
                                  maxTags={8}
                                />
                                <FormMessage>{fieldState.error?.message}</FormMessage>
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        <TabsContent value="text" className="p-6 bg-background border rounded-lg space-y-6">
                          <FormField
                            control={form.control}
                            name={`evaluations.${index}.textDescription`}
                            render={({ field: textField, fieldState }) => (
                              <FormItem className="space-y-3">
                                <FormLabel className="text-base">Descripción</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Ejemplo: Estuvo muy activo en defensa, recuperó varias pelotas importantes y distribuyó bien el juego. Sus pases fueron precisos pero le faltó más protagonismo en ataque..."
                                    value={textField.value || ''}
                                    onChange={textField.onChange}
                                    rows={5}
                                    maxLength={500}
                                    className="resize-none text-sm"
                                  />
                                </FormControl>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                  <span>{(textField.value || '').length}/500 caracteres</span>
                                  <span>Mínimo 10 caracteres para analizar</span>
                                </div>
                                <FormMessage>{fieldState.error?.message}</FormMessage>
                              </FormItem>
                            )}
                          />

                          <div className="space-y-4">
                            <Button
                              type="button"
                              onClick={() => analyzeTextForPlayer(index)}
                              disabled={
                                !form.watch(`evaluations.${index}.textDescription`) ||
                                (form.watch(`evaluations.${index}.textDescription`)?.length || 0) < 10 ||
                                analyzingText[field.subjectId]
                              }
                              size="lg"
                              className="w-full"
                            >
                              {analyzingText[field.subjectId] ? (
                                <>
                                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                  Evaluando...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-2 h-5 w-5" />
                                  Evaluar
                                </>
                              )}
                            </Button>

                            {aiResults[field.subjectId] && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                                <div className="flex items-center gap-2 text-emerald-800">
                                  <Check className="h-5 w-5" />
                                  <span className="font-semibold">Impacto en Atributos</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {aiResults[field.subjectId].attributeChanges.map((change) => (
                                    <div
                                      key={change.attribute}
                                      className={cn(
                                        'flex items-center justify-between p-2 rounded-md border',
                                        change.change > 0
                                          ? 'bg-green-50 border-green-200'
                                          : 'bg-red-50 border-red-200'
                                      )}
                                    >
                                      <span className="font-semibold text-sm uppercase">{change.attribute}</span>
                                      <span className={cn(
                                        'font-bold text-sm',
                                        change.change > 0 ? 'text-green-600' : 'text-red-600'
                                      )}>
                                        {change.change > 0 ? '+' : ''}{change.change}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="text-sm space-y-1">
                                  <p className="text-emerald-800 italic">{aiResults[field.subjectId].summary}</p>
                                  <p className="text-xs text-emerald-600">
                                    Confianza: {Math.round(aiResults[field.subjectId].confidence * 100)}%
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
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
      <Dialog open={confirmOverrideOpen} onOpenChange={setConfirmOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar solo etiquetas positivas</DialogTitle>
            <DialogDescription>
              Detectamos evaluaciones sin etiquetas negativas. Podés enviar de todas formas, pero se recomienda incluir al menos una negativa para equilibrar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" type="button" onClick={() => setConfirmOverrideOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={confirmOverrideAndSubmit}>Enviar igualmente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
