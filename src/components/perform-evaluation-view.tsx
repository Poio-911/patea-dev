'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { Loader2, Save, ShieldCheck, Goal, Plus, Minus, FileClock, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  performanceTags: z.array(z.custom<PerformanceTag>()).min(3, 'Debes seleccionar exactamente 3 etiquetas.').max(3, 'Solo puedes seleccionar 3 etiquetas.'), // Requerido exacto
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
  const isPositiveImpact = tag.impact === 'positive';

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onCheckedChange(!isChecked)}
      className={cn(
        'relative flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-300 overflow-hidden',
        isChecked
          ? isPositiveImpact
            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            : 'bg-rose-500/10 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
          : 'bg-card border-border hover:border-border/80 hover:bg-accent/50',
        "game:bg-card/50 game:border-white/10"
      )}
    >
      {/* Background Glow when checked */}
      {isChecked && (
        <div className={cn(
          "absolute inset-0 opacity-20 blur-xl pointer-events-none",
          isPositiveImpact ? "bg-emerald-400" : "bg-rose-400"
        )} />
      )}

      <div className="flex items-start justify-between w-full relative z-10">
        <div>
          <p className={cn("font-bold text-base", isChecked ? (isPositiveImpact ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400") : "text-foreground game:text-white")}>
            {tag.name}
          </p>
          <p className="text-xs text-muted-foreground game:text-slate-400 mt-0.5">{tag.description}</p>
        </div>
        {isChecked && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn("p-1 rounded-full", isPositiveImpact ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")}>
            <Zap size={14} className="fill-current" />
          </motion.div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 relative z-10 w-full pt-2 border-t border-border/50">
        {positiveEffects.map((effect) => (
          <div key={effect.attribute} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded">
            + {effect.change} {effect.attribute}
          </div>
        ))}
        {negativeEffects.map((effect) => (
          <div key={effect.attribute} className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest bg-rose-500/10 px-1.5 py-0.5 rounded">
            {effect.change} {effect.attribute}
          </div>
        ))}
      </div>
    </motion.button>
  )
}

// --- MAIN COMPONENT ---
export default function PerformEvaluationView({ matchId }: { matchId: string }) {
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

  if (!user) return <div>Datos no encontrados.</div>

  if (submissionIsPending) {
    return (
      <div className="flex flex-col gap-8">
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
          {/* Strict Game Mode Card */}
          <Card className="game:border-primary/30 game:bg-card/80 game:backdrop-blur-md game:shadow-[0_0_20px_rgba(170,254,72,0.1)]">
            <CardHeader>
              <CardTitle className="game:text-white">Tu Rendimiento</CardTitle>
              <CardDescription className="game:text-slate-400">Antes de evaluar a tus compañeros, registra tu propia actuación.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="evaluatorGoals"
                render={({ field }) => (
                  <FormItem className="flex flex-col items-center justify-center p-6 bg-card/50 rounded-2xl border border-border/50">
                    <FormLabel className="text-lg font-bold game:text-white mb-4">¿Cuántos goles marcaste?</FormLabel>
                    <div className="flex items-center gap-6">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-full border-2 border-primary/20 hover:border-primary hover:bg-primary/10 text-primary transition-all active:scale-95"
                        onClick={() => field.onChange(Math.max(0, (field.value || 0) - 1))}
                      >
                        <Minus className="h-6 w-6" />
                      </Button>
                      <div className="flex items-center justify-center w-24 h-24 rounded-3xl bg-background border-2 border-primary shadow-[0_0_30px_rgba(var(--primary),0.15)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
                        <span className="text-5xl font-black text-foreground relative z-10">{field.value}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-full border-2 border-primary/20 hover:border-primary hover:bg-primary/10 text-primary transition-all active:scale-95"
                        onClick={() => field.onChange(Math.min(20, (field.value || 0) + 1))}
                      >
                        <Plus className="h-6 w-6" />
                      </Button>
                    </div>
                    <FormMessage className="mt-4" />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="game:border-primary/30 game:bg-card/80 game:backdrop-blur-md game:shadow-[0_0_20px_rgba(170,254,72,0.1)]">
            <CardHeader>
              <CardTitle className="game:text-white">Jugadores a Evaluar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="border-b pb-6 last:border-b-0 last:pb-0 game:border-white/10">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12 game:ring-2 game:ring-primary game:ring-offset-2 game:ring-offset-background">
                      <AvatarImage src={field.photoURL} alt={field.displayName} />
                      <AvatarFallback className="game:bg-background game:text-primary">{field.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-lg game:text-white">{field.displayName}</p>
                  </div>

                  <Controller
                    name={`evaluations.${index}.evaluationType`}
                    control={form.control}
                    render={({ field: typeField }) => (
                      <Tabs value={typeField.value} onValueChange={(value) => {
                        form.setValue(`evaluations.${index}.evaluationType`, value as 'points' | 'tags', { shouldValidate: true });
                      }} className="w-full">
                        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 game:bg-background">
                          <TabsTrigger value="points" className="game:data-[state=active]:bg-primary game:data-[state=active]:text-background">Evaluar por Puntos</TabsTrigger>
                          <TabsTrigger value="tags" className="game:data-[state=active]:bg-primary game:data-[state=active]:text-background">Evaluar por Etiquetas</TabsTrigger>
                        </TabsList>

                        <TabsContent value="points" className="p-4 bg-muted/30 rounded-b-md game:bg-white/5">
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
                                    <p className="text-sm rounded-full bg-background border px-4 py-1.5 font-bold uppercase tracking-widest text-muted-foreground mb-4">Rating de Partido</p>
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

                        <TabsContent value="tags" className="p-4 bg-muted/30 rounded-b-md game:bg-white/5">
                          <Controller
                            name={`evaluations.${index}.performanceTags`}
                            control={form.control}
                            render={({ field: tagsField, fieldState }) => (
                              <FormItem>
                                <FormLabel className="game:text-white">Elige exactamente 3 etiquetas</FormLabel>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-96 overflow-y-auto">
                                  {randomTags[field.subjectId]?.map((tag) => (
                                    <TagCheckbox
                                      key={tag.id}
                                      tag={tag}
                                      subjectId={field.subjectId}
                                      isChecked={!!(tagsField.value || []).find((t: any) => t.id === tag.id)}
                                      onCheckedChange={(checked) => {
                                        const currentVal = tagsField.value || []
                                        if (checked && currentVal.length >= 3) return; // Limit directly in UI
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
            <Button type="submit" disabled={isSubmitting} className="game:bg-primary game:text-background game:hover:bg-primary/90 game:font-bold">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Enviando...' : 'Enviar Evaluaciones'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
