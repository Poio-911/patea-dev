'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, onSnapshot, doc, getDoc, Unsubscribe } from 'firebase/firestore';
import type { Match, Player, EvaluationAssignment, EvaluationSubmission, Evaluation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldQuestion, Edit, Eye, EyeOff, FileClock, UsersRound, Check, Loader2, Clock, CheckCircle2, UserCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, isBefore, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { ViewSubmissionDialog } from '@/components/view-submission-dialog';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { respondToIdentityRevealAction } from '@/lib/actions/evaluation-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

type AssignedPlayerInfo = {
    id: string;
    name: string;
    photoURL?: string;
    position?: string;
};

type PendingItem = {
    match: Match;
    submission?: EvaluationSubmission;
    userAssignmentCount: number;
    totalAssignments: number;
    completedAssignments: number;
    assignedPlayers: AssignedPlayerInfo[];
};

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

type IdentityRevealRequest = {
    evaluation: Evaluation;
    fromPlayerName: string;
    fromPlayerPhotoUrl: string;
    matchTitle: string;
};

function IdentityRevealRequestCard({
    request,
    onResponded,
}: {
    request: IdentityRevealRequest;
    onResponded: (evaluationId: string) => void;
}) {
    const { user } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState<'accepted' | 'rejected' | null>(null);

    const handleRespond = async (response: 'accepted' | 'rejected') => {
        if (!user) return;
        setLoading(response);
        try {
            const result = await respondToIdentityRevealAction(request.evaluation.id, user.uid, response);
            if (result.success) {
                toast({
                    title: response === 'accepted' ? '✅ Identidad revelada' : '🔒 Identidad mantenida',
                    description: response === 'accepted'
                        ? `${request.fromPlayerName} ya sabe que fuiste vos.`
                        : 'Tu anonimato fue preservado.',
                });
                onResponded(request.evaluation.id);
            } else {
                toast({ variant: 'destructive', description: result.error || 'Error al responder.' });
                setLoading(null);
            }
        } catch {
            toast({ variant: 'destructive', description: 'Error de conexión.' });
            setLoading(null);
        }
    };

    return (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm game:border-primary/30 game:bg-card/80 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                    {request.fromPlayerPhotoUrl ? (
                        <AvatarImage src={request.fromPlayerPhotoUrl} />
                    ) : (
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                            {request.fromPlayerName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    )}
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{request.fromPlayerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{request.matchTitle}</p>
                </div>
            </div>
            <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{request.fromPlayerName}</span> quiere saber que fuiste vos quien lo evaluó.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50 game:border-white/5">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={loading !== null}
                    onClick={() => handleRespond('rejected')}
                    className="text-xs"
                >
                    {loading === 'rejected' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                    Mantener anonimato
                </Button>
                <Button
                    size="sm"
                    disabled={loading !== null}
                    onClick={() => handleRespond('accepted')}
                    className="text-xs"
                >
                    {loading === 'accepted' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    Revelar identidad
                </Button>
            </div>
        </div>
    );
}

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);
    const [identityRequests, setIdentityRequests] = useState<IdentityRevealRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);

    const handleRequestResponded = useCallback((evaluationId: string) => {
        setIdentityRequests(prev => prev.filter(r => r.evaluation.id !== evaluationId));
    }, []);

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

            const allRelevantMatchIds = [...new Set([...pendingMatchIds, ...completedMatchIds, ...submissionMatchIds])];

            if (allRelevantMatchIds.length === 0) {
                setPendingItems([]);
                setIsLoadingItems(false);
                return;
            }

            // 2. Fetch matches, processed submissions, AND player info in parallel
            const matchesMap = new Map<string, Match>();
            const chunks = [];
            for (let i = 0; i < allRelevantMatchIds.length; i += 30) {
                chunks.push(allRelevantMatchIds.slice(i, i + 30));
            }

            const matchPromises = chunks.map(chunk =>
                getDocs(query(collection(firestore, 'matches'), where('__name__', 'in', chunk)))
            );

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

            // 3. Fetch player info for pending assignments
            const subjectIds = [...new Set(userPendingAssignments.map(a => a.subjectId))];
            const playersMap = new Map<string, AssignedPlayerInfo>();
            if (subjectIds.length > 0) {
                const playerChunks = [];
                for (let i = 0; i < subjectIds.length; i += 10) playerChunks.push(subjectIds.slice(i, i + 10));
                const playerSnaps = await Promise.all(
                    playerChunks.map(chunk => getDocs(query(collection(firestore, 'players'), where('__name__', 'in', chunk))))
                );
                playerSnaps.forEach(snap => snap.docs.forEach(d => {
                    const p = d.data() as any;
                    playersMap.set(d.id, { id: d.id, name: p.name, photoURL: p.photoURL || p.photoUrl || '', position: p.position });
                }));
            }

            const initialItems: (PendingItem | null)[] = allRelevantMatchIds.map(matchId => {
                const match = matchesMap.get(matchId);
                const isSubmitted = submissionsMap.has(matchId);

                if (!match) return null;
                if (match.status === 'evaluated' && !isSubmitted) return null;

                const myPendingAssignments = userPendingAssignments.filter(a => a.matchId === matchId);
                const userAssignmentCount = myPendingAssignments.length;

                if (userAssignmentCount === 0 && !isSubmitted) return null;

                const assignedPlayers = myPendingAssignments
                    .map(a => playersMap.get(a.subjectId))
                    .filter((p): p is AssignedPlayerInfo => !!p);

                return {
                    match,
                    submission: submissionsMap.get(matchId),
                    userAssignmentCount,
                    totalAssignments: 0,
                    completedAssignments: 0,
                    assignedPlayers,
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

    // Load pending identity reveal requests (evaluations where this user is the evaluator)
    useEffect(() => {
        if (!user || !firestore) {
            setIsLoadingRequests(false);
            return;
        }

        setIsLoadingRequests(true);

        const fetchRequests = async () => {
            try {
                const snap = await getDocs(query(
                    collection(firestore, 'evaluations'),
                    where('evaluatorId', '==', user.uid),
                    where('identityRequestStatus', '==', 'pending')
                ));

                const evaluations = snap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation));

                // Enrich with player and match info
                const enriched = await Promise.all(evaluations.map(async (ev) => {
                    const [playerSnap, matchSnap] = await Promise.all([
                        getDoc(doc(firestore, 'players', ev.playerId)),
                        getDoc(doc(firestore, 'matches', ev.matchId)),
                    ]);
                    const playerData = playerSnap.data() as any;
                    const matchData = matchSnap.data() as any;
                    return {
                        evaluation: ev,
                        fromPlayerName: playerData?.name || 'Jugador',
                        fromPlayerPhotoUrl: playerData?.photoUrl || playerData?.photoURL || '',
                        matchTitle: matchData?.title || 'Partido',
                    } as IdentityRevealRequest;
                }));

                setIdentityRequests(enriched);
            } catch (err) {
                console.error('Error fetching identity requests:', err);
            } finally {
                setIsLoadingRequests(false);
            }
        };

        fetchRequests();
    }, [user, firestore]);

    const getMatchTypeLabel = (title?: string) => {
        if (!title) return 'Partido';
        if (title.includes('Copa')) return 'Copa';
        if (title.includes('Liga')) return 'Liga';
        return 'Amistoso';
    };

    const getUrgencyInfo = (match: Match) => {
        // Evaluations close 72h after the match
        const deadline = new Date(match.date);
        deadline.setHours(deadline.getHours() + 72);
        const now = new Date();
        const hoursLeft = differenceInHours(deadline, now);
        if (hoursLeft <= 0) return { label: 'Cerrada', color: 'text-slate-400 game:text-slate-500', bg: 'bg-slate-100 game:bg-slate-800', urgent: false };
        if (hoursLeft <= 12) return { label: `${hoursLeft}h restantes`, color: 'text-red-600 game:text-red-400', bg: 'bg-red-50 game:bg-red-950/40 border border-red-200 game:border-red-500/30', urgent: true };
        if (hoursLeft <= 24) return { label: `${hoursLeft}h restantes`, color: 'text-amber-600 game:text-amber-400', bg: 'bg-amber-50 game:bg-amber-950/40 border border-amber-200 game:border-amber-500/30', urgent: false };
        const days = Math.floor(hoursLeft / 24);
        return { label: `${days}d restantes`, color: 'text-slate-500 game:text-slate-400', bg: 'bg-muted game:bg-background', urgent: false };
    };

    const renderCard = (item: PendingItem) => {
        const isEvaluationSent = !!item.submission;
        const evaluationProgress = item.totalAssignments > 0 ? (item.completedAssignments / item.totalAssignments) * 100 : 0;
        const matchDate = new Date(item.match.date);
        const matchType = getMatchTypeLabel(item.match.title);
        const urgency = getUrgencyInfo(item.match);

        return (
            <motion.div
                key={item.match.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all hover:shadow-lg game:border-primary/30 game:bg-card/80 game:backdrop-blur-md game:shadow-[0_0_20px_rgba(170,254,72,0.08)] game:hover:border-primary/80"
            >
                {/* Top accent strip by type */}
                <div className={cn(
                    'h-0.5 w-full',
                    isEvaluationSent ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                        urgency.urgent ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse' :
                            matchType === 'Copa' ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                matchType === 'Liga' ? 'bg-gradient-to-r from-blue-600 to-indigo-500' :
                                    'bg-gradient-to-r from-slate-400 to-slate-300 game:from-primary/50 game:to-primary/20'
                )} />

                <div className="p-5 space-y-4">
                    {/* Header: Date, Type, Urgency */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 border border-border/50 px-2.5 py-1.5 min-w-[44px] game:bg-background game:border game:border-primary/20">
                                <span className="text-[10px] font-bold text-muted-foreground game:text-primary/70 tracking-widest">{format(matchDate, 'MMM', { locale: es }).toUpperCase()}</span>
                                <span className="text-xl font-black leading-none text-foreground game:text-white font-mono">{format(matchDate, 'dd')}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn(
                                        'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
                                        matchType === 'Copa' ? 'text-amber-700 bg-amber-50 border-amber-200 game:text-amber-300 game:bg-amber-900/30 game:border-amber-500/30' :
                                            matchType === 'Liga' ? 'text-blue-700 bg-blue-50 border-blue-200 game:text-blue-300 game:bg-blue-900/30 game:border-blue-500/30' :
                                                'text-muted-foreground bg-muted border-border'
                                    )}>
                                        {matchType}
                                    </span>
                                    {!isEvaluationSent && (
                                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', urgency.bg, urgency.color)}>
                                            {urgency.urgent && <Clock className="h-2.5 w-2.5" />}
                                            {urgency.label}
                                        </span>
                                    )}
                                    {isEvaluationSent && (
                                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full game:text-emerald-400 game:bg-emerald-950/30 game:border-emerald-500/30 flex items-center gap-1">
                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                            Enviada
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-sm text-foreground game:text-white mt-1 leading-tight line-clamp-1">
                                    {item.match.title}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Assigned Players Section */}
                    {!isEvaluationSent && item.assignedPlayers.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground game:text-primary/60">Evaluás a</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                {item.assignedPlayers.map(player => (
                                    <div key={player.id} className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-full px-2 py-0.5 game:bg-background game:border-white/10">
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={player.photoURL} alt={player.name} />
                                            <AvatarFallback className="text-[9px] font-bold bg-blue-100 text-blue-700 game:bg-primary/20 game:text-primary">
                                                {player.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-medium text-foreground game:text-white">{player.name.split(' ')[0]}</span>
                                        {player.position && <span className="text-[9px] text-muted-foreground font-mono">{player.position}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Submission summary for sent evaluations */}
                    {isEvaluationSent && item.submission && (
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 game:bg-emerald-950/20 game:border-emerald-500/20">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 game:text-emerald-400 shrink-0" />
                            <div className="text-xs text-emerald-700 game:text-emerald-300">
                                <span className="font-semibold">Evaluaste {item.submission.submission.evaluations.length} jugadores</span>
                                {item.submission.submission.evaluatorGoals !== undefined && (
                                    <span className="text-emerald-600/70 game:text-emerald-400/70 ml-1">
                                        · {item.submission.submission.evaluatorGoals} goles · {item.submission.submission.evaluatorAssists ?? 0} asis.
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Global round progress */}
                    {!isEvaluationSent && item.totalAssignments > 0 && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="uppercase tracking-widest font-bold game:text-primary/60">Progreso de la ronda</span>
                                <span className="font-mono game:text-white">{item.completedAssignments}/{item.totalAssignments}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden border border-border/50 game:bg-background game:border-white/5">
                                <div
                                    className="h-full bg-blue-500 game:bg-gradient-to-r game:from-primary game:to-primary/80 transition-all duration-700"
                                    style={{ width: `${evaluationProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer CTA */}
                <div className="px-5 pb-5">
                    {isEvaluationSent && item.submission ? (
                        <ViewSubmissionDialog submission={item.submission} matchPlayers={item.match.players as any}>
                            <Button variant="outline" className="w-full border-border bg-card text-foreground hover:bg-muted/50 hover:border-border shadow-sm game:border-primary/20 game:bg-background game:text-primary game:hover:bg-primary/10 transition-all">
                                <Eye className="mr-2 h-4 w-4" />
                                Ver mi Evaluación
                            </Button>
                        </ViewSubmissionDialog>
                    ) : (
                        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm hover:shadow-md game:bg-primary game:hover:bg-primary/90 game:text-background game:font-black game:uppercase game:tracking-wider game:shadow-[0_0_20px_rgba(170,254,72,0.3)] transition-all hover:scale-[1.01] active:scale-100">
                            <Link href={`/evaluations/${item.match.id}`}>
                                <Edit className="mr-2 h-4 w-4" />
                                EVALUAR AHORA
                            </Link>
                        </Button>
                    )}
                </div>
            </motion.div>
        );
    };

    const loading = userLoading || isLoadingItems;

    if (loading) {
        return (
            <div className="flex flex-col gap-8">
                <PageHeader title="Mis Evaluaciones" description="Aquí encontrarás los partidos que tienes pendientes por evaluar." />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-xl border border-border p-5 space-y-4">
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

    // Compute stats for the header
    const totalCompleted = pendingItems.filter(i => !!i.submission).length;
    const pendingCount = pendingItems.filter(i => !i.submission).length;
    const urgentCount = pendingItems.filter(i => !i.submission && differenceInHours(new Date(new Date(i.match.date).getTime() + 72 * 3600000), new Date()) <= 12).length;

    return (
        <div className="flex flex-col gap-6">
            <FirstTimeInfoDialog
                featureKey="hasSeenEvaluationsInfo"
                title="Bandeja de Evaluaciones"
                description="Después de cada partido, acá aparecerán tus tareas de evaluación. Tenés que puntuar el rendimiento de un par de compañer@s para que el sistema pueda actualizar los OVRs de tod@s. ¡Tu opinión es clave!"
            />

            {/* Header with stats */}
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1 flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5" />
                            SALA DE EVALUACIONES
                        </p>
                        <h1 className="text-2xl font-black tracking-tight">Mis Evaluaciones</h1>
                    </div>
                    <AttributesHelpDialog>
                        <Button variant="outline" size="sm" className="shrink-0 text-xs">
                            ¿Qué evalúo?
                        </Button>
                    </AttributesHelpDialog>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border bg-card px-4 py-3 text-center game:border-primary/20 game:bg-card/80">
                        <p className="text-2xl font-black text-foreground game:text-white">{pendingCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Pendientes</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-4 py-3 text-center game:border-primary/20 game:bg-card/80">
                        <p className="text-2xl font-black text-emerald-600 game:text-emerald-400">{totalCompleted}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Completadas</p>
                    </div>
                    <div className={cn(
                        "rounded-xl border px-4 py-3 text-center",
                        urgentCount > 0 ? 'border-red-200 bg-red-50 game:border-red-500/30 game:bg-red-950/20' : 'border-border bg-card game:border-primary/20 game:bg-card/80'
                    )}>
                        <p className={cn("text-2xl font-black", urgentCount > 0 ? 'text-red-600 game:text-red-400' : 'text-foreground game:text-white')}>{urgentCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Urgentes</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="pending">Pendientes</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                    <TabsTrigger value="requests" className="relative">
                        Solicitudes
                        {identityRequests.length > 0 && (
                            <Badge className="ml-1.5 h-4 min-w-[1rem] px-1 text-[10px] bg-primary text-primary-foreground">
                                {identityRequests.length}
                            </Badge>
                        )}
                    </TabsTrigger>
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

                <TabsContent value="requests" className="mt-6">
                    {isLoadingRequests ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(2)].map((_, i) => (
                                <div key={i} className="rounded-xl border border-border p-5 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-12 w-12 rounded-full" />
                                        <div className="space-y-1 flex-1">
                                            <Skeleton className="h-3 w-24" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-full" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <Skeleton className="h-9 rounded-md" />
                                        <Skeleton className="h-9 rounded-md" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : identityRequests.length === 0 ? (
                        <Alert>
                            <ShieldQuestion className="h-4 w-4" />
                            <AlertTitle>Sin solicitudes</AlertTitle>
                            <AlertDescription>
                                Cuando alguien quiera saber que fuiste vos quien lo evaluó, aparecerá aquí.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {identityRequests.map(request => (
                                <IdentityRevealRequestCard
                                    key={request.evaluation.id}
                                    request={request}
                                    onResponded={handleRequestResponded}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
