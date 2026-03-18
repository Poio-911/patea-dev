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
  getDocs,
  doc,
} from 'firebase/firestore'
import { Loader2, Save, ShieldCheck, Goal, Plus, Minus, FileClock, Check, Award, MessageSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { useFirestore, useUser, useCollection, useDoc } from '@/firebase'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles } from 'lucide-react'
import { analyzeEvaluationTextAction, submitEvaluationSubmissionAction } from '@/lib/actions/evaluation-actions'
import { TagSelector } from '@/components/ui/tag-selector'
import { PerformanceTag, performanceTagsDb } from '@/lib/performance-tags'
import { cn } from '@/lib/utils'
import type { Player, EvaluationAssignment, PlayerEvaluationFormData, Match } from '@/lib/types'
import { BackButton } from '@/components/navigation/back-button'
import { useHaptics } from '@/hooks/use-haptics'
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog'
import { CounterDial } from '@/components/ui/gamer/counter-dial';
import { PlayerCarousel } from '@/components/ui/gamer/player-carousel';
import { AiScanOverlay } from '@/components/ui/gamer/ai-scan-overlay';

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
  evaluatorAssists: z.coerce.number().min(0).max(20).default(0),
  personalChronicle: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  mvpVote: z.string().optional(),
  evaluations: z.array(playerEvaluationSchema),
}).superRefine((val, ctx) => {
  val.evaluations.forEach((ev, idx) => {
    // Validación proporcional: por cada 2 positivos, 1 negativo requerido
    if (ev && (ev as any).evaluationType === 'tags') {
      const tags = (ev as any).performanceTags || []
      const positiveCount = tags.filter((t: any) => t && t.impact === 'positive').length
      const negativeCount = tags.filter((t: any) => t && t.impact === 'negative').length
      const requiredNegatives = Math.ceil(positiveCount / 2)
      const override = (ev as any).overrideNoNegative === true
      if (!override && negativeCount < requiredNegatives) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Con ${positiveCount} tags positivos necesitás al menos ${requiredNegatives} negativos.`,
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

const getRatingThumbClasses = (rating: number) => {
  if (rating >= 9) return 'bg-green-600 border-green-700'
  if (rating >= 7) return 'bg-green-500 border-green-600'
  if (rating >= 6) return 'bg-yellow-500 border-yellow-600'
  if (rating >= 4) return 'bg-orange-500 border-orange-600'
  return 'bg-red-600 border-red-700'
}

// Old Rating Pills Removed

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
        isChecked ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50',
        "game:border-primary/20",
        isChecked ? "game:bg-primary/20 game:border-primary game:shadow-[0_0_10px_rgba(170,254,72,0.3)]" : "game:hover:bg-primary/5 game:hover:border-primary/30"
      )}
    >
      <Checkbox checked={isChecked} onCheckedChange={onCheckedChange} id={uniqueId} className="mt-1" />
      <label htmlFor={uniqueId} className="w-full cursor-pointer space-y-2">
        <div>
          <p className="font-semibold game:text-white">{tag.name}</p>
          <p className="text-xs text-muted-foreground game:text-slate-400">{tag.description}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {positiveEffects.map((effect) => (
            <div key={effect.attribute} className="flex items-center gap-1 text-xs font-medium text-green-600 game:text-green-400">
              <Plus size={12} /> {effect.attribute.toUpperCase()}: +{effect.change}
            </div>
          ))}
          {negativeEffects.map((effect) => (
            <div key={effect.attribute} className="flex items-center gap-1 text-xs font-medium text-red-600 game:text-red-400">
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
  const { success: hapticSuccess } = useHaptics()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [submissionIsPending, setSubmissionIsPending] = useState(false);
  const [randomTags, setRandomTags] = useState<Record<string, PerformanceTag[]>>({})
  const [analyzingText, setAnalyzingText] = useState<Record<string, boolean>>({})
  const [aiResults, setAiResults] = useState<Record<string, { attributeChanges: { attribute: string; change: number; reason: string }[]; confidence: number; summary: string }>>({})

  const matchRef = useMemo(() => matchId ? doc(firestore!, 'matches', matchId as string) : null, [firestore, matchId])
  const { data: currentMatch } = useDoc<Match>(matchRef)

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
    defaultValues: {
      evaluatorGoals: 0,
      evaluatorAssists: 0,
      personalChronicle: '',
      mvpVote: '',
      evaluations: []
    },
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
    if (!user || !matchId) return

    setIsSubmitting(true)
    try {
      const result = await submitEvaluationSubmissionAction(matchId, data as unknown as Record<string, unknown>);
      if (!result.success) {
        throw new Error(result.error || 'No se pudieron enviar las evaluaciones.');
      }

      hapticSuccess();
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

  if (isPageLoading || assignmentsLoading || playersLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !matchId || typeof matchId !== 'string') return <div>Datos no encontrados.</div>;

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
    );
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

          {/* Tu Rendimiento - GAMER REDESIGN */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm game:bg-card/80 game:border-primary/30 game:shadow-[0_0_20px_rgba(170,254,72,0.1)]">
            {/* Background glow - Game Mode Only */}
            <div className="absolute top-0 right-0 h-[200px] w-[200px] bg-primary/10 blur-[80px] hidden game:block" />

            <div className="relative space-y-6  p-6">
              <div className="relative flex items-center gap-3 mb-6">
                <div className="rounded-lg bg-muted/50 border border-border/50 p-2 text-muted-foreground ring-1 ring-border/50 game:bg-primary/10 game:text-primary game:ring-primary/20 game:border-none">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground game:text-white">Tu Rendimiento</h3>
                  <p className="text-sm text-muted-foreground game:text-primary/60">Registrá tus estadísticas personales del partido.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="evaluatorGoals"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-muted/30 p-6 backdrop-blur-sm game:border-white/10 game:bg-background">
                      <CounterDial
                        value={field.value}
                        onChange={field.onChange}
                        label="GOLES MARCADOS"
                        icon={<Goal className="h-8 w-8" />}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="evaluatorAssists"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-muted/30 p-6 backdrop-blur-sm game:border-white/10 game:bg-background">
                      <CounterDial
                        value={field.value}
                        onChange={field.onChange}
                        label="ASISTENCIAS"
                        icon={<Award className="h-8 w-8" />}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* MVP Selection - Placeholder for Carousel, using Styled Select for now */}
              <FormField
                control={form.control}
                name="mvpVote"
                render={({ field }) => (
                  <FormItem className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border game:bg-primary/20 game:text-primary game:ring-primary/50">
                        <Award className="h-5 w-5 animate-pulse" />
                      </div>
                      <FormLabel className="text-lg font-bold text-foreground game:text-primary tracking-wide">VOTO MVP</FormLabel>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/50 p-4 game:bg-background game:border-primary/20">
                      <PlayerCarousel
                        players={currentMatch?.players
                          .filter((p, idx, arr) => arr.findIndex(x => x.uid === p.uid) === idx)
                          .map(p => ({
                            id: p.uid,
                            name: p.displayName,
                            photoURL: p.photoURL,
                            position: p.position // Assuming player object has position, if not might need to fetch or map
                          })) || []}
                        selectedId={field.value}
                        onSelect={field.onChange}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personalChronicle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80 game:text-cyan-200/80">Crónica Personal (Opcional)</FormLabel>
                    <div className="relative group">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-600/20 opacity-0 transition-opacity group-focus-within:opacity-100 blur-sm hidden game:block" />
                      <FormControl>
                        <Textarea
                          placeholder="¿Cómo te sentiste en la cancha? Contanos..."
                          className="relative resize-none h-24 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-border game:border-white/10 game:bg-background game:text-white game:placeholder:text-white/30"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Card className="border-border bg-card shadow-sm game:bg-card/80 game:border-primary/30 game:shadow-[0_0_20px_rgba(170,254,72,0.1)]">
            <CardHeader>
              <CardTitle className="text-foreground game:text-white">Jugadores a Evaluar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-border bg-muted/30 p-6 shadow-sm transition-all hover:bg-card hover:shadow-md game:border-white/10 game:bg-background game:shadow-none game:hover:bg-card game:hover:border-primary/30">
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar className="h-16 w-16 border-2 border-border/50 game:border-primary/50">
                      <AvatarImage src={field.photoURL} alt={field.displayName} className="object-cover" />
                      <AvatarFallback className="text-lg font-bold text-muted-foreground bg-muted game:bg-card game:text-primary">{field.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-xl text-foreground game:text-white">{field.displayName}</h3>
                      <p className="text-sm text-muted-foreground font-medium font-mono uppercase tracking-wider game:text-primary/80">{field.position}</p>
                    </div>
                  </div>

                  <Controller
                    name={`evaluations.${index}.evaluationType`}
                    control={form.control}
                    render={({ field: typeField }) => (
                      <Tabs value={typeField.value} onValueChange={(value) => {
                        form.setValue(`evaluations.${index}.evaluationType`, value as 'points' | 'tags' | 'text', { shouldValidate: true });
                      }} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-muted game:bg-background game:border game:border-white/10">
                          <TabsTrigger value="points" className="text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm game:data-[state=active]:bg-primary game:data-[state=active]:text-background">Puntos</TabsTrigger>
                          <TabsTrigger value="tags" className="text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm game:data-[state=active]:bg-primary game:data-[state=active]:text-background">Etiquetas</TabsTrigger>
                          <TabsTrigger value="text" className="text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm game:data-[state=active]:bg-primary game:data-[state=active]:text-background">Descripción</TabsTrigger>
                        </TabsList>

                        <TabsContent value="points" className="mt-2">
                          <FormField
                            control={form.control}
                            name={`evaluations.${index}.rating`}
                            render={({ field: ratingField }) => {
                              const val = ratingField.value || 5;
                              const isBad = val < 5;
                              const isGood = val >= 7;
                              const colorClass = isBad ? "text-rose-500" : isGood ? "text-emerald-500" : "text-amber-500";
                              const bgClass = isBad ? "bg-rose-500" : isGood ? "bg-emerald-500" : "bg-amber-500";

                              return (
                                <FormItem className="space-y-6 flex flex-col items-center pb-4 pt-2">
                                  <div className="text-center">
                                    <p className="text-sm rounded-full bg-background border px-4 py-1.5 font-bold uppercase tracking-widest text-muted-foreground mb-4">Rating del Partido</p>
                                    <motion.div
                                      key={val}
                                      initial={{ scale: 0.8, y: -10 }}
                                      animate={{ scale: 1, y: 0 }}
                                      className={cn("text-7xl font-black drop-shadow-sm transition-colors duration-300", colorClass)}
                                    >
                                      {val}
                                    </motion.div>
                                  </div>
                                  <FormControl className="w-full max-w-sm px-4">
                                    <div className="flex items-center gap-4 w-full">
                                      <span className="text-sm font-bold text-muted-foreground bg-muted h-8 w-8 flex items-center justify-center rounded-full">1</span>
                                      <div className="flex-1 relative">
                                        {/* Custom slider track color based on value */}
                                        <Slider
                                          min={1}
                                          max={10}
                                          step={1}
                                          value={[val]}
                                          onValueChange={(value) => ratingField.onChange(value[0])}
                                          className={cn("w-full cursor-pointer [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-4 [&_[role=slider]]:shadow-lg transition-colors",
                                            isBad ? "[&_[role=slider]]:border-rose-500" : isGood ? "[&_[role=slider]]:border-emerald-500" : "[&_[role=slider]]:border-amber-500"
                                          )}
                                        />
                                      </div>
                                      <span className="text-sm font-bold text-muted-foreground bg-muted h-8 w-8 flex items-center justify-center rounded-full">10</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )
                            }}
                          />
                        </TabsContent>

                        <TabsContent value="tags" className="mt-2">
                          <Controller
                            name={`evaluations.${index}.performanceTags`}
                            control={form.control}
                            render={({ field: tagsField, fieldState }) => (
                              <FormItem className="space-y-4">
                                <FormLabel className="text-base font-medium text-foreground game:text-white">Selecciona etiquetas de rendimiento</FormLabel>
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
                                  maxTags={5}
                                />
                                <FormMessage>{fieldState.error?.message}</FormMessage>
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        <TabsContent value="text" className="mt-2 space-y-6">
                          <FormField
                            control={form.control}
                            name={`evaluations.${index}.textDescription`}
                            render={({ field: textField, fieldState }) => (
                              <FormItem className="space-y-3">
                                <FormLabel className="text-base text-foreground game:text-white">Descripción</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Ejemplo: Estuvo muy activo en defensa, recuperó varias pelotas importantes y distribuyó bien el juego. Sus pases fueron precisos pero le faltó más protagonismo en ataque..."
                                    value={textField.value || ''}
                                    onChange={textField.onChange}
                                    rows={5}
                                    maxLength={500}
                                    className="resize-none text-sm border-border text-foreground placeholder:text-muted-foreground focus:border-border game:bg-background game:text-white game:border-white/10 game:placeholder:text-white/30"
                                  />
                                </FormControl>
                                <div className="flex justify-between items-center text-xs text-muted-foreground game:text-slate-400">
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
                              className={cn(
                                "w-full transition-all duration-300 relative overflow-hidden",
                                analyzingText[field.subjectId]
                                  ? "bg-zinc-800 text-emerald-400 border-emerald-500/50"
                                  : aiResults[field.subjectId]
                                    ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                              )}
                            >
                              {analyzingText[field.subjectId] ? (
                                <>
                                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                  <span className="animate-pulse">Analizando jugada...</span>
                                </>
                              ) : aiResults[field.subjectId] ? (
                                <>
                                  <Check className="mr-2 h-5 w-5" />
                                  Analizado — Re-evaluar
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-2 h-5 w-5 fill-white" />
                                  ANÁLISIS TÁCTICO
                                </>
                              )}
                            </Button>

                            {/* AI Results Panel — shown AFTER analysis completes */}
                            {!analyzingText[field.subjectId] && aiResults[field.subjectId] && (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3 game:bg-emerald-950/30 game:border-emerald-500/30">
                                <div className="flex items-center gap-2 text-emerald-700 game:text-emerald-400">
                                  <Sparkles className="h-4 w-4" />
                                  <span className="text-xs font-bold uppercase tracking-wide">Análisis Completado</span>
                                  <span className="ml-auto text-xs text-emerald-600/70 game:text-emerald-500/70">Confianza: {Math.round(aiResults[field.subjectId].confidence * 100)}%</span>
                                </div>
                                <p className="text-sm text-emerald-800 italic game:text-emerald-300">
                                  &ldquo;{aiResults[field.subjectId].summary}&rdquo;
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {aiResults[field.subjectId].attributeChanges.map((change) => (
                                    <div
                                      key={change.attribute}
                                      title={change.reason}
                                      className={cn(
                                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase border",
                                        change.change > 0
                                          ? "bg-green-100 text-green-700 border-green-300 game:bg-green-950/40 game:text-green-400 game:border-green-600/40"
                                          : "bg-red-100 text-red-700 border-red-300 game:bg-red-950/40 game:text-red-400 game:border-red-600/40"
                                      )}
                                    >
                                      {change.change > 0 ? <Plus size={10} /> : <Minus size={10} />}
                                      {change.attribute} {change.change > 0 ? `+${change.change}` : change.change}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    )}
                  />
                  <FormMessage />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="game:bg-primary game:text-background game:hover:bg-primary/90 game:font-bold">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Enviando...' : 'Enviar Evaluaciones'}
            </Button>
          </div>
        </form>
      </Form >
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
    </div >
  )
}
