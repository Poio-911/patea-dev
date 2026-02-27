'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, onSnapshot, Unsubscribe, doc, getDoc } from 'firebase/firestore';
import type { Match, Player, EvaluationAssignment, EvaluationSubmission, Evaluation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldQuestion, Calendar, Edit, Eye, FileClock, Users, MapPin, UsersRound, Check, EyeOff, Loader2 } from 'lucide-react';
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
import { respondToIdentityRevealAction } from '@/lib/actions/evaluation-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type PendingItem = {
    match: Match;
    submission?: EvaluationSubmission;
    userAssignmentCount: number;
    totalAssignments: number;
    completedAssignments: number;
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

    const renderCard = (item: PendingItem) => {
        const isEvaluationSent = !!item.submission;
        const evaluationProgress = item.totalAssignments > 0 ? (item.completedAssignments / item.totalAssignments) * 100 : 0;
        const matchDate = new Date(item.match.date);

        // --- CLEAN SAAS DESIGN (Light) & STRICT GAME MODE (Dark/Game) ---
        return (
            <div key={item.match.id} className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all hover:border-border hover:shadow-lg game:border-primary/30 game:bg-card/80 game:backdrop-blur-md game:shadow-[0_0_20px_rgba(170,254,72,0.1)] game:hover:border-primary/80 game:hover:shadow-[0_0_30px_rgba(170,254,72,0.25)]">

                {/* Game Mode Glow Effect (Volt Yellow) - ONLY in Game Mode */}
                <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/10 blur-[60px] hidden game:block pointer-events-none" />

                {/* Header: Date & Status */}
                <div className="mb-4 flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        {/* Date Box: Clean Gray (Light) vs Deep Tech (Game) */}
                        <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 border border-border/50 px-3 py-1.5 game:bg-background game:border game:border-primary/20 game:shadow-inner">
                            <span className="text-xs font-bold text-slate-500 game:text-primary/90 tracking-widest">{format(matchDate, 'MMM', { locale: es }).toUpperCase()}</span>
                            <span className="text-lg font-bold leading-none text-foreground game:text-white font-mono">{format(matchDate, 'dd')}</span>
                        </div>

                        <div className="flex flex-col">
                            {/* Type Badge: Clean Label (Light - Monochrome) vs Neon Badge (Game) */}
                            <span className={cn(
                                "text-xs font-medium uppercase tracking-wider w-fit px-2 py-0.5 rounded",
                                "text-muted-foreground bg-muted border border-border", // Light: Strictly Monochrome
                                "game:text-xs game:font-bold game:bg-background game:border", // Game Base
                                item.match.title?.includes('Copa') ? "game:text-accent game:border-accent/40" : "game:text-primary game:border-primary/40" // Game Variant
                            )}>
                                {item.match.title?.includes('Copa') ? 'Copa' : 'Amistoso'}
                            </span>
                            <h3 className="line-clamp-1 text-base font-bold text-foreground game:text-white group-hover:text-blue-600 game:group-hover:text-primary transition-colors mt-1">
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
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border/50 game:bg-background game:border game:border-white/5">
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
                <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-border/50 game:border-white/5 relative z-10">
                    {isEvaluationSent && item.submission ? (
                        <ViewSubmissionDialog submission={item.submission} matchPlayers={item.match.players as any}>
                            <Button variant="outline" className="w-full col-span-2 border-border bg-card text-foreground hover:bg-muted/50 hover:text-foreground hover:border-border shadow-sm game:border-primary/20 game:bg-background game:text-primary game:hover:bg-primary/20 game:hover:border-primary/50 transition-all">
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Evaluación
                            </Button>
                        </ViewSubmissionDialog>
                    ) : (
                        <Button asChild className="col-span-2 w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-transparent hover:shadow-md game:bg-primary game:hover:bg-primary/90 game:text-background game:font-black game:uppercase game:tracking-wide game:shadow-[0_0_20px_rgba(170,254,72,0.4)] game:hover:shadow-[0_0_35px_rgba(170,254,72,0.6)] transition-all hover:scale-[1.01]">
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
