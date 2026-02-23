
'use client';

import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, writeBatch, runTransaction, getDocs, where, addDoc, deleteDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, EvaluationAssignment, Evaluation, OvrHistory, SelfEvaluation, PerformanceTag } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Check, UserCheck, UserX, Star, AlertTriangle, FileClock, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { logger } from '@/lib/logger';
import { publishMatchPlayedActivity, publishOvrChangeActivity } from '@/lib/actions/social-actions';
import { updateLeagueStandingsAction, advanceCupWinnerAction } from '@/lib/actions/server-actions';
import { isErrorResponse } from '@/lib/errors';
import { BackButton } from '@/components/navigation/back-button';
import { cn } from '@/lib/utils';

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

// --- Player Progression Logic ---
// Moved entirely to server-actions.ts for security and atomicity.

export default function EvaluateMatchPage() {
    const params = useParams<{ id: string }>();
    const matchId = params?.id;
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    const [isPageLoading, setIsPageLoading] = useState(true);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isProcessingSubmissions, setIsProcessingSubmissions] = useState(false);
    const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState(0);

    const allGroupPlayersQuery = useMemo(() =>
        firestore && user?.activeGroupId ? query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId)) : null
        , [firestore, user?.activeGroupId]);
    const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(allGroupPlayersQuery);

    const matchRef = useMemo(() => firestore ? doc(firestore, 'matches', matchId as string) : null, [firestore, matchId]);
    const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

    const assignmentsQuery = useMemo(() =>
        firestore ? collection(firestore, 'matches', matchId as string, 'assignments') : null,
        [firestore, matchId]);
    const { data: assignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(assignmentsQuery);

    const processPendingSubmissions = useCallback(async () => {
        if (!firestore || !matchId) return;
        setIsProcessingSubmissions(true);

        try {
            // ✅ Use runTransaction for atomicity and to prevent race conditions
            await runTransaction(firestore, async (transaction) => {
                const submissionsQuery = query(collection(firestore, 'evaluationSubmissions'), where('matchId', '==', matchId));
                const snapshot = await getDocs(submissionsQuery);

                if (snapshot.empty) {
                    setPendingSubmissionsCount(0); // Ensure count is reset if no submissions
                    return;
                }

                setPendingSubmissionsCount(snapshot.size);

                for (const submissionDoc of snapshot.docs) {
                    const submissionData = submissionDoc.data();

                    // ✅ SOFT DELETE: Move to processedSubmissions with processing metadata
                    const processedRef = doc(collection(firestore, `matches/${matchId}/processedSubmissions`));
                    transaction.set(processedRef, {
                        ...submissionData,
                        processedAt: new Date().toISOString(),
                        originalSubmissionId: submissionDoc.id,
                        processingStatus: 'completed',
                    });

                    // Delete original submission (data preserved in processedSubmissions)
                    transaction.delete(submissionDoc.ref);

                    const { evaluatorId, submission: formData } = submissionData;

                    // Create self-evaluation if player contributed (goals or assists)
                    if (formData.evaluatorGoals > 0 || (formData.evaluatorAssists && formData.evaluatorAssists > 0)) {
                        const selfEvalRef = doc(collection(firestore, `matches/${matchId}/selfEvaluations`));
                        transaction.set(selfEvalRef, {
                            playerId: evaluatorId,
                            matchId,
                            goals: formData.evaluatorGoals,
                            assists: formData.evaluatorAssists || 0,
                            reportedAt: submissionData.submittedAt,
                        });
                    }

                    // Create peer evaluations
                    for (const evaluation of formData.evaluations) {
                        const evalRef = doc(collection(firestore, 'evaluations'));
                        const newEvaluation: Omit<Evaluation, 'id'> = {
                            assignmentId: evaluation.assignmentId,
                            playerId: evaluation.subjectId,
                            evaluatorId,
                            matchId: matchId as string,
                            goals: 0,
                            evaluatedAt: submissionData.submittedAt,
                        };

                        if (evaluation.evaluationType === 'points') {
                            newEvaluation.rating = evaluation.rating;
                        } else if (evaluation.evaluationType === 'tags') {
                            newEvaluation.performanceTags = evaluation.performanceTags;
                        } else if (evaluation.evaluationType === 'text') {
                            // Save AI attribute changes for direct attribute impact
                            if ((evaluation as any).aiAttributeChanges) {
                                newEvaluation.aiAttributeChanges = (evaluation as any).aiAttributeChanges;
                                newEvaluation.aiConfidence = (evaluation as any).aiConfidence;
                            }
                            // Text and summary for reference
                            newEvaluation.textDescription = evaluation.textDescription || '';
                            if ((evaluation as any).aiSummary) newEvaluation.aiSummary = (evaluation as any).aiSummary;
                        }

                        transaction.set(evalRef, newEvaluation);

                        // Update assignment status
                        const assignmentRef = doc(firestore, 'matches', matchId as string, 'assignments', evaluation.assignmentId);
                        transaction.update(assignmentRef, { status: 'completed', evaluationId: evalRef.id });
                    }
                }
            });

            if (pendingSubmissionsCount > 0) {
                toast({ title: "Nuevas evaluaciones procesadas", description: `${pendingSubmissionsCount} envío(s) de evaluaciones han sido registrados.` });
            }

        } catch (error) {
            console.error("Error processing submissions transaction:", error);
            toast({ variant: 'destructive', title: 'Error de Transacción', description: 'No se pudieron procesar las evaluaciones pendientes. Reintentando...' });
        } finally {
            setIsProcessingSubmissions(false);
            setPendingSubmissionsCount(0);
        }
    }, [firestore, matchId, toast, pendingSubmissionsCount]);

    useEffect(() => {
        if (match && match.status !== 'evaluated') {
            const interval = setInterval(() => {
                processPendingSubmissions();
            }, 15000); // Check for new submissions every 15 seconds

            processPendingSubmissions(); // Also run once on load

            return () => clearInterval(interval);
        }
    }, [match, processPendingSubmissions]);

    useEffect(() => {
        const loading = matchLoading || assignmentsLoading || playersLoading;
        if (!loading) {
            setIsPageLoading(false);
        }
    }, [matchLoading, assignmentsLoading, playersLoading]);

    // FIX: Moved these declarations before the useEffect that uses them.
    const realPlayersInMatch = useMemo(() => {
        if (!match || !allGroupPlayers) return [];
        const playerIdsInMatch = new Set(match.players.map(p => p.uid));
        return allGroupPlayers.filter(p => playerIdsInMatch.has(p.id) && isRealUser(p));
    }, [match, allGroupPlayers]);

    const evaluatorsWhoHaveVoted = useMemo(() => {
        if (!assignments) return new Set();
        const completedEvaluators = assignments.filter(a => a.status === 'completed').map(a => a.evaluatorId);

        // Fix: Only count real users in the numerator to match "totalPossibleEvaluators" logic.
        // If we don't have player data yet to verify, return the raw set (though ideally we should wait).
        if (!allGroupPlayers) return new Set(completedEvaluators);

        const realEvaluatorIds = completedEvaluators.filter(id => {
            const player = allGroupPlayers.find(p => p.id === id);
            return player && isRealUser(player);
        });

        return new Set(realEvaluatorIds);
    }, [assignments, allGroupPlayers]);

    const totalPossibleEvaluators = realPlayersInMatch.length;
    const completedEvaluatorsCount = evaluatorsWhoHaveVoted.size;
    const evaluationProgress = totalPossibleEvaluators > 0 ? (completedEvaluatorsCount / totalPossibleEvaluators) * 100 : 0;

    // 🎉 Celebrate when 100% of evaluations are complete
    useEffect(() => {
        if (evaluationProgress === 100 && totalPossibleEvaluators > 0 && match?.status !== 'evaluated') {
            confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 }
            });
        }
    }, [evaluationProgress, totalPossibleEvaluators, match?.status]);

    const handleFinalizeEvaluation = async () => {
        if (!match || !match.id) return;
        setIsFinalizing(true);

        try {
            const completedAssignmentIds = assignments?.filter(a => a.status === 'completed').map(a => a.id) || [];
            if (completedAssignmentIds.length === 0) {
                throw new Error("No hay evaluaciones completadas para procesar.");
            }

            // Llamada atómica y segura al Backend (Server Action)
            const { finalizeMatchEvaluationAction } = await import('@/lib/actions/server-actions');
            const result = await finalizeMatchEvaluationAction(match.id);

            if (!result || isErrorResponse(result) || !result.success) {
                throw new Error(isErrorResponse(result) ? result.error : ((result as any)?.error || 'Ocurrió un error inesperado al finalizar el partido.'));
            }

            // 🎉 Confetti celebration on successful finalization
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            toast({
                title: "¡Evaluación Finalizada!",
                description: "Los resultados, estadísticas y avances han sido guardados."
            });

            if ((match.type === 'cup' || match.type === 'league_final') && match.leagueInfo?.leagueId) {
                router.push(`/competitions/${match.leagueInfo.leagueId}?celebrate=true`);
            } else if (match.type === 'league' && match.leagueInfo?.leagueId) {
                router.push(`/competitions/${match.leagueInfo.leagueId}`);
            } else {
                router.push('/matches');
            }

        } catch (error: any) {
            console.error("Error finalizing evaluation:", error);
            toast({
                variant: 'destructive',
                title: 'Error al finalizar',
                description: error.message || 'No se pudo completar el proceso de evaluación.'
            });
        } finally {
            setIsFinalizing(false);
        }
    };

    if (isPageLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!match || !user) {
        return (
            <div className="p-4">
                <BackButton href="/matches" label="Volver a Partidos" />
                <div>Datos no encontrados.</div>
            </div>
        );
    }

    if (user.uid !== match.ownerUid) {
        return (
            <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
                <BackButton href="/matches" label="Volver a Partidos" />
                <PageHeader title={`Evaluación de: ${match.title}`} />
                <Alert variant="destructive">
                    <AlertTitle>Acceso Denegado</AlertTitle>
                    <AlertDescription>Solo el organizador del partido puede ver esta página.</AlertDescription>
                </Alert>
            </div>
        )
    }

    if (match.status === 'evaluated') {
        return (
            <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
                <BackButton href="/matches" label="Volver a Partidos" />
                <PageHeader title={`Evaluación de: ${match.title}`} />
                <Alert>
                    <Check className="h-4 w-4" />
                    <AlertTitle>Evaluación Completa</AlertTitle>
                    <AlertDescription>Este partido ya ha sido evaluado y los OVRs de los jugadores han sido actualizados.</AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <BackButton href="/matches" label="Volver a Partidos" />
            <PageHeader
                title={`Panel de Evaluación: ${match.title}`}
                description={`Supervisa el progreso de las evaluaciones de los jugadores.`}
            />
            {isProcessingSubmissions && (
                <Alert variant="default" className="border-info">
                    <FileClock className="h-4 w-4 text-info" />
                    <AlertTitle>Procesando Evaluaciones</AlertTitle>
                    <AlertDescription>
                        Se están registrando {pendingSubmissionsCount} nuevos envíos de evaluaciones. La lista se actualizará en breve.
                    </AlertDescription>
                </Alert>
            )}
            <Card className="border-primary/20 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-black">Progreso de Evaluación</CardTitle>
                    <CardDescription>
                        Falta el <strong className="text-foreground">{Math.round(100 - evaluationProgress)}%</strong> de las votaciones. Se recomienda finalizar a partir del 80%.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 pt-4">
                    {/* Radial Progress Indicator */}
                    <div className="flex justify-center relative">
                        <div className="relative w-48 h-48">
                            {/* Background Circle */}
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50" cy="50" r="40"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    className="text-muted/30"
                                />
                                {/* Progress Circle */}
                                <motion.circle
                                    cx="50" cy="50" r="40"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    strokeDasharray="251.2"
                                    strokeLinecap="round"
                                    className={cn("transition-all duration-1000", evaluationProgress === 100 ? "text-emerald-500" : "text-primary")}
                                    initial={{ strokeDashoffset: 251.2 }}
                                    animate={{ strokeDashoffset: 251.2 - (251.2 * evaluationProgress) / 100 }}
                                />
                            </svg>
                            {/* Inner Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <motion.span
                                    className="text-4xl font-black tracking-tighter"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    key={evaluationProgress}
                                >
                                    {Math.round(evaluationProgress)}<span className="text-xl text-muted-foreground">%</span>
                                </motion.span>
                                <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold mt-1">
                                    {completedEvaluatorsCount} / {totalPossibleEvaluators}
                                </span>
                            </div>

                            {/* Sparkles on 100% */}
                            {evaluationProgress === 100 && (
                                <motion.div
                                    className="absolute inset-0 rounded-full border border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1.1, opacity: 0 }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <AnimatePresence>
                            {realPlayersInMatch.map((player, index) => {
                                const hasVoted = evaluatorsWhoHaveVoted.has(player.id);
                                return (
                                    <motion.div
                                        key={player.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 relative overflow-hidden",
                                            hasVoted ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/30 border-muted-foreground/20 opacity-70 grayscale-[50%]"
                                        )}
                                    >
                                        {!hasVoted && (
                                            <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 animate-pulse"></div>
                                        )}
                                        {hasVoted && (
                                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                        )}
                                        <div className="relative">
                                            <Avatar className={cn("h-10 w-10 border-2", hasVoted ? "border-emerald-500" : "border-muted-foreground border-dashed")}>
                                                <AvatarImage src={player.photoURL || (player as any).photoUrl} alt={player.name} />
                                                <AvatarFallback className="bg-background">{player.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            {!hasVoted && (
                                                <div className="absolute -inset-1 border border-primary/50 rounded-full animate-[spin_4s_linear_infinite] border-t-transparent"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={cn("font-bold truncate block", hasVoted ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                                                {player.name}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                                {hasVoted ? 'Completado' : 'Pendiente'}
                                            </span>
                                        </div>
                                        <AnimatePresence mode="wait">
                                            {hasVoted ? (
                                                <motion.div
                                                    key="checked"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    exit={{ scale: 0 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                                    className="bg-emerald-500/20 p-1.5 rounded-full"
                                                >
                                                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="unchecked"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    exit={{ scale: 0 }}
                                                    className="bg-muted-foreground/10 p-1.5 rounded-full"
                                                >
                                                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                    {completedEvaluatorsCount === 0 && (
                        <Alert>
                            <AlertTitle>Esperando Evaluaciones</AlertTitle>
                            <AlertDescription>
                                Aún ningún jugador ha completado su evaluación. El botón para finalizar se activará cuando haya al menos una.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button
                        size="lg"
                        onClick={handleFinalizeEvaluation}
                        disabled={isFinalizing || completedEvaluatorsCount === 0}
                        className={evaluationProgress === 100 ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" : ""}
                    >
                        {isFinalizing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : evaluationProgress === 100 ? (
                            <Sparkles className="mr-2 h-4 w-4" />
                        ) : (
                            <Star className="mr-2 h-4 w-4" />
                        )}
                        {isFinalizing ? "Procesando..." : evaluationProgress === 100 ? "¡Listo para Finalizar!" : "Finalizar y Calcular OVRs"}
                    </Button>
                    {evaluationProgress >= 80 && evaluationProgress < 100 && (
                        <p className="text-xs text-muted-foreground text-center">
                            Ya puedes finalizar, aunque no todos hayan evaluado (≥80%)
                        </p>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
