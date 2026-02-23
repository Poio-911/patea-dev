'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Match, Player, EvaluationAssignment, EvaluationSubmission } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldQuestion, Calendar, Edit, Eye, FileClock, Users, MapPin, UsersRound, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { MatchTeamsDialog } from '@/components/match-teams-dialog';
import { ViewSubmissionDialog } from '@/components/view-submission-dialog';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { MatchEventCard } from '@/components/ui/gamer/match-event-card';
import { GamerProgress } from '@/components/ui/gamer/gamer-progress';

type PendingItem = {
    match: Match;
    submission?: EvaluationSubmission;
    userAssignmentCount: number;
    totalAssignments: number;
    completedAssignments: number;
};

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);

    const userAssignmentsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collectionGroup(firestore, 'assignments'),
            where('evaluatorId', '==', user.uid),
            where('status', '==', 'pending')
        );
    }, [firestore, user?.uid]);
    const { data: userAssignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(userAssignmentsQuery);

    useEffect(() => {
        if (userLoading || assignmentsLoading) return;
        if (!user || !firestore) {
            setIsLoadingItems(false);
            return;
        }

        setIsLoadingItems(true);

        const processItems = async () => {
            const userPendingAssignments = userAssignments || [];

            // 1. Fetch completed assignments AND evaluation submissions in parallel
            const [completedAssignmentsSnapshot, submissionsSnapshot] = await Promise.all([
                getDocs(query(
                    collectionGroup(firestore, 'assignments'),
                    where('evaluatorId', '==', user.uid),
                    where('status', '==', 'completed')
                )),
                getDocs(query(
                    collection(firestore, 'evaluationSubmissions'),
                    where('evaluatorId', '==', user.uid)
                ))
            ]);

            const userCompletedAssignments = completedAssignmentsSnapshot.docs.map(d => d.data() as EvaluationAssignment);

            const submissionsMap = new Map<string, EvaluationSubmission>();
            submissionsSnapshot.docs.forEach(doc => submissionsMap.set(doc.data().matchId, doc.data() as EvaluationSubmission));

            const pendingMatchIds = new Set(userPendingAssignments.map(a => a.matchId));
            const completedMatchIds = new Set(userCompletedAssignments.map(a => a.matchId));
            const submissionMatchIds = new Set([...submissionsMap.keys()]);

            // Fix "Ghost Matches": Only include matches where the user HAS assignments or submissions
            // We NO LONGER include all participated matches by default to avoid showing 0/0 items
            const allRelevantMatchIds = [...new Set([...pendingMatchIds, ...completedMatchIds, ...submissionMatchIds])];

            if (allRelevantMatchIds.length === 0) {
                setPendingItems([]);
                setIsLoadingItems(false);
                return;
            }

            // 2. Fetch the actual matches AND processed submissions in parallel
            const matchesMap = new Map<string, Match>();
            const chunks = [];
            for (let i = 0; i < allRelevantMatchIds.length; i += 30) {
                chunks.push(allRelevantMatchIds.slice(i, i + 30));
            }

            const matchPromises = chunks.map(chunk =>
                getDocs(query(collection(firestore, 'matches'), where('__name__', 'in', chunk)))
            );

            // Reverted back to individual queries because collectionGroup required a missing index.
            // Since we removed participatedMatchIds, this array is very small now, making this fast.
            const processedPromises = allRelevantMatchIds.map(matchId =>
                getDocs(query(collection(firestore, `matches/${matchId}/processedSubmissions`), where('evaluatorId', '==', user.uid)))
            );

            const [matchSnapshots, processedSnapshots] = await Promise.all([
                Promise.all(matchPromises),
                Promise.all(processedPromises)
            ]);

            matchSnapshots.forEach(snap => {
                snap.docs.forEach(doc => matchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Match));
            });

            processedSnapshots.forEach(snap => {
                snap.docs.forEach(doc => {
                    const data = doc.data() as EvaluationSubmission;
                    submissionsMap.set(data.matchId, data);
                });
            });

            const initialItems: (PendingItem | null)[] = allRelevantMatchIds.map(matchId => {
                const match = matchesMap.get(matchId);
                const isSubmitted = submissionsMap.has(matchId);

                if (!match || (match.status === 'evaluated' && !isSubmitted)) return null;

                const userAssignmentCount = userPendingAssignments.filter(a => a.matchId === matchId).length;

                // If no assignments and not submitted, avoid showing unless it's recent and we are expecting something
                if (userAssignmentCount === 0 && !isSubmitted) {
                    // Check if there are any assignments at all for this match for THIS user in completed state
                    const hasCompleted = userCompletedAssignments.some(a => a.matchId === matchId);
                    if (!hasCompleted) return null;
                }

                return {
                    match,
                    submission: submissionsMap.get(matchId),
                    userAssignmentCount,
                    totalAssignments: 0,
                    completedAssignments: 0,
                };
            });

            const validItems = initialItems.filter((item): item is PendingItem => item !== null);
            setPendingItems(validItems.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime()));
            setIsLoadingItems(false);

            // 3. Optimize listeners: Only listen to assignments if match is not yet fully evaluated/submitted
            const unsubscribers: Unsubscribe[] = validItems
                .filter(item => !item.submission)
                .map(item => {
                    const assignmentsCollectionRef = collection(firestore, 'matches', item.match.id, 'assignments');
                    return onSnapshot(assignmentsCollectionRef, (snapshot) => {
                        const total = snapshot.size;
                        const completed = snapshot.docs.filter(d => d.data().status === 'completed').length;
                        setPendingItems(currentItems =>
                            currentItems.map(currentItem =>
                                currentItem.match.id === item.match.id
                                    ? { ...currentItem, totalAssignments: total, completedAssignments: completed }
                                    : currentItem
                            )
                        );
                    });
                });

            return () => unsubscribers.forEach(unsub => unsub());
        };

        let cleanup: (() => void) | undefined;
        processItems().then(unsubFunc => {
            cleanup = unsubFunc;
        }).catch(console.error);

        return () => {
            if (cleanup) {
                cleanup();
            }
        };

    }, [userAssignments, firestore, user, assignmentsLoading, userLoading]);

    const renderCard = (item: PendingItem) => {
        const isEvaluationSent = !!item.submission;
        const evaluationProgress = item.totalAssignments > 0 ? (item.completedAssignments / item.totalAssignments) * 100 : 0;
        const matchDate = new Date(item.match.date);

        // --- CLEAN SAAS DESIGN (Light) & STRICT GAME MODE (Dark/Game) ---
        return (
            <div key={item.match.id} className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all hover:border-slate-300 hover:shadow-lg game:border-primary/30 game:bg-[#0b1e3b]/80 game:backdrop-blur-md game:shadow-[0_0_20px_rgba(170,254,72,0.1)] game:hover:border-primary/80 game:hover:shadow-[0_0_30px_rgba(170,254,72,0.25)]">

                {/* Game Mode Glow Effect (Volt Yellow) - ONLY in Game Mode */}
                <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/10 blur-[60px] hidden game:block pointer-events-none" />

                {/* Header: Date & Status */}
                <div className="mb-4 flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        {/* Date Box: Clean Gray (Light) vs Deep Tech (Game) */}
                        <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5 game:bg-[#051329] game:border game:border-primary/20 game:shadow-inner">
                            <span className="text-xs font-bold text-slate-500 game:text-primary/90 tracking-widest">{format(matchDate, 'MMM', { locale: es }).toUpperCase()}</span>
                            <span className="text-lg font-bold leading-none text-slate-900 game:text-white font-mono">{format(matchDate, 'dd')}</span>
                        </div>

                        <div className="flex flex-col">
                            {/* Type Badge: Clean Label (Light - Monochrome) vs Neon Badge (Game) */}
                            <span className={cn(
                                "text-xs font-medium uppercase tracking-wider w-fit px-2 py-0.5 rounded",
                                "text-slate-600 bg-slate-100 border border-slate-200", // Light: Strictly Monochrome
                                "game:text-xs game:font-bold game:bg-[#051329] game:border", // Game Base
                                item.match.title?.includes('Copa') ? "game:text-accent game:border-accent/40" : "game:text-primary game:border-primary/40" // Game Variant
                            )}>
                                {item.match.title?.includes('Copa') ? 'Copa' : 'Amistoso'}
                            </span>
                            <h3 className="line-clamp-1 text-base font-bold text-slate-900 game:text-white group-hover:text-blue-600 game:group-hover:text-primary transition-colors mt-1">
                                {item.match.title}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Progress Section */}
                <div className="mb-6 space-y-3 relative z-10">
                    <div className="flex items-center justify-between text-xs text-slate-500 game:text-slate-400 font-medium">
                        <span className="uppercase tracking-wider text-[10px] text-slate-400 game:text-primary/80">Tu Progreso</span>
                        <span className="text-slate-700 game:text-white font-mono">{item.completedAssignments} <span className="text-slate-300 game:text-slate-600">/</span> {item.totalAssignments}</span>
                    </div>

                    {/* Progress Bar: Clean Line (Light) vs Volt Gradient (Game) */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-100 game:bg-[#051329] game:border game:border-white/5">
                        <div
                            className="h-full bg-blue-600 game:bg-gradient-to-r game:from-primary game:to-primary/80 game:shadow-[0_0_12px_rgba(170,254,72,0.6)] transition-all duration-500 ease-out relative"
                            style={{ width: `${evaluationProgress}%` }}
                        >
                            {/* Shine effect for Game Mode ONLY */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite] hidden game:block" />
                        </div>
                    </div>

                    {/* Status Text */}
                    <div className="flex items-center gap-2 text-sm">
                        {isEvaluationSent ? (
                            <div className="flex items-center gap-2 font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md game:bg-emerald-950/30 game:text-emerald-400 game:border game:border-emerald-500/30">
                                <Check className="h-4 w-4" />
                                <span>Completado</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-600 game:text-slate-300">
                                <UsersRound className="h-4 w-4 text-slate-400 game:text-slate-500" />
                                <span>{item.userAssignmentCount} jugadores asignados</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 game:border-white/5 relative z-10">
                    {isEvaluationSent && item.submission ? (
                        <ViewSubmissionDialog submission={item.submission} matchPlayers={item.match.players as any}>
                            <Button variant="outline" className="w-full col-span-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 shadow-sm game:border-primary/20 game:bg-[#051329] game:text-primary game:hover:bg-primary/20 game:hover:border-primary/50 transition-all">
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Evaluación
                            </Button>
                        </ViewSubmissionDialog>
                    ) : (
                        <Button asChild className="col-span-2 w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-transparent hover:shadow-md game:bg-primary game:hover:bg-primary/90 game:text-[#0b1e3b] game:font-black game:uppercase game:tracking-wide game:shadow-[0_0_20px_rgba(170,254,72,0.4)] game:hover:shadow-[0_0_35px_rgba(170,254,72,0.6)] transition-all hover:scale-[1.01]">
                            <Link href={`/evaluations/${item.match.id}`}>
                                <Edit className="mr-2 h-4 w-4" />
                                EVALUAR AHORA
                            </Link>
                        </Button>
                    )}
                </div>

            </div>
        );
    };

    const loading = userLoading || isLoadingItems;

    if (loading) {
        return (
            <div className="flex flex-col gap-8">
                <PageHeader title="Mis Evaluaciones" description="Aquí encontrarás los partidos que tienes pendientes por evaluar." />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-12 w-10 rounded-lg" />
                                <div className="space-y-1 flex-1">
                                    <Skeleton className="h-3 w-12" />
                                    <Skeleton className="h-4 w-40" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-full rounded-full" />
                            <Skeleton className="h-9 w-full rounded-md" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col gap-8">
                <PageHeader title="Mis Evaluaciones" description="Evalúa el rendimiento de tus compañeros de equipo." />
                <Alert>
                    <AlertTitle>Función no disponible</AlertTitle>
                    <AlertDescription>
                        Debes iniciar sesión para ver tus evaluaciones pendientes.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <FirstTimeInfoDialog
                featureKey="hasSeenEvaluationsInfo"
                title="Bandeja de Evaluaciones"
                description="Después de cada partido, acá aparecerán tus tareas de evaluación. Tenés que puntuar el rendimiento de un par de compañer@s para que el sistema pueda actualizar los OVRs de tod@s. ¡Tu opinión es clave!"
            />
            <PageHeader title="Mis Evaluaciones" description="Aquí encontrarás los partidos que tienes pendientes por evaluar." />

            <AttributesHelpDialog>
                <Button variant="link" className="p-0 h-auto self-start">¿Qué significan los atributos de evaluación?</Button>
            </AttributesHelpDialog>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="pending">Pendientes</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                    {pendingItems.filter(item => !item.submission).length === 0 ? (
                        <Alert>
                            <ShieldQuestion className="h-4 w-4" />
                            <AlertTitle>¡Todo al día!</AlertTitle>
                            <AlertDescription>
                                No tienes evaluaciones pendientes.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingItems
                                .filter(item => !item.submission)
                                .map((item) => renderCard(item))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    {pendingItems.filter(item => {
                        if (!item.submission) return false;
                        // Mantener en historial por 14 días
                        const archiveThreshold = subDays(new Date(), 14);
                        return !isBefore(new Date(item.submission.submittedAt), archiveThreshold);
                    }).length === 0 ? (
                        <Alert>
                            <FileClock className="h-4 w-4" />
                            <AlertTitle>Historial vacío</AlertTitle>
                            <AlertDescription>
                                Aquí aparecerán tus evaluaciones completadas recientemente.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingItems
                                .filter(item => {
                                    if (!item.submission) return false;
                                    const archiveThreshold = subDays(new Date(), 14);
                                    return !isBefore(new Date(item.submission.submittedAt), archiveThreshold);
                                })
                                .map((item) => renderCard(item))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
