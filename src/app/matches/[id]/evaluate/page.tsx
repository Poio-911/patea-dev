'use client';

import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, writeBatch, runTransaction, getDocs, where, addDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, EvaluationAssignment, Evaluation, OvrHistory } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Check, BarChart, UserCheck, UserX, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

// --- Player Progression Logic ---
const OVR_PROGRESSION = {
    BASELINE_RATING: 5,   // Neutral rating. A 5/10 produces almost no change.
    SCALE: 0.6,           // Main multiplier. Controls the intensity of the change.
    MAX_STEP: 2,          // OVR cannot change more than 2 points in a single match.
    DECAY_START: 70,      // From 70 OVR onwards, progression starts to slow down.
    SOFT_CAP: 95,         // From 95 onwards, progression is drastically reduced.
    HARD_CAP: 99,         // Absolute maximum OVR a player can reach.
    MIN_OVR: 40,          // Absolute minimum OVR.
    MIN_ATTRIBUTE: 20,    // Minimum value for any specific attribute.
    MAX_ATTRIBUTE: 90     // Maximum value for any specific attribute.
};

const calculateOvrChange = (currentOvr: number, avgRating: number): number => {
    if (avgRating === OVR_PROGRESSION.BASELINE_RATING) return 0;

    const ratingDelta = avgRating - OVR_PROGRESSION.BASELINE_RATING;
    let rawDelta = ratingDelta * OVR_PROGRESSION.SCALE;

    // Apply decay for higher OVRs
    if (currentOvr >= OVR_PROGRESSION.DECAY_START) {
        if (currentOvr < OVR_PROGRESSION.SOFT_CAP) {
            const t = (currentOvr - OVR_PROGRESSION.DECAY_START) / (OVR_PROGRESSION.SOFT_CAP - OVR_PROGRESSION.DECAY_START);
            const decayFactor = 1 - (0.6 * t); // Reduce progression by up to 60% as it approaches soft cap
            rawDelta *= decayFactor;
        } else {
            const t = (currentOvr - OVR_PROGRESSION.SOFT_CAP) / (OVR_PROGRESSION.HARD_CAP - OVR_PROGRESSION.SOFT_CAP);
            const hardCapFactor = 0.25 * (1 - t); // Reduce progression by at least 75% above soft cap
            rawDelta *= hardCapFactor;
        }
    }
    
    const finalDelta = Math.round(Math.max(-OVR_PROGRESSION.MAX_STEP, Math.min(OVR_PROGRESSION.MAX_STEP, rawDelta)));
    return finalDelta;
};

const calculateAttributeChanges = (currentAttrs: Player, avgRating: number, position: string) => {
    const intensity = (avgRating - OVR_PROGRESSION.BASELINE_RATING) * 0.2; // Smaller scale for attributes
    const changes: Partial<Pick<Player, 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'>> = {};

    const positionPriorities = {
        DEL: { primary: 'sho', secondary: ['pac', 'dri'] },
        MED: { primary: 'pas', secondary: ['dri', 'sho'] },
        DEF: { primary: 'def', secondary: ['phy', 'pas'] },
        POR: { primary: 'def', secondary: ['phy', 'pas'] }, // Placeholder for now
    };

    const priorities = positionPriorities[position as keyof typeof positionPriorities] || positionPriorities.DEF;

    changes[priorities.primary as keyof typeof changes] = (currentAttrs[priorities.primary as keyof Player] as number) + intensity * 2;
    priorities.secondary.forEach(attr => {
        changes[attr as keyof typeof changes] = (currentAttrs[attr as keyof Player] as number) + intensity;
    });

    // Ensure all attributes stay within bounds
    for (const key in changes) {
        const attrKey = key as keyof typeof changes;
        changes[attrKey] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, changes[attrKey]!)));
    }
    
    return changes;
};

export default function EvaluateMatchPage() {
  const { id: matchId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

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

  useEffect(() => {
    const loading = matchLoading || assignmentsLoading || playersLoading;
    if (!loading) {
      setIsPageLoading(false);
    }
  }, [matchLoading, assignmentsLoading, playersLoading]);
  
  const handleFinalizeEvaluation = async () => {
    if (!firestore || !match || !match.id) return;
    setIsFinalizing(true);

    try {
        // 1. Fetch evaluations outside the transaction
        const completedAssignmentIds = assignments?.filter(a => a.status === 'completed').map(a => a.id) || [];
        if (completedAssignmentIds.length === 0) {
            throw new Error("No hay evaluaciones completadas para procesar.");
        }
        const evaluationsQuery = query(collection(firestore, 'evaluations'), where('assignmentId', 'in', completedAssignmentIds));
        const evaluationsSnapshot = await getDocs(evaluationsQuery);
        const matchEvaluations = evaluationsSnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as Evaluation));

        // 2. Group evaluations by player
        const evaluationsByPlayer = matchEvaluations.reduce((acc, ev) => {
            acc[ev.playerId] = acc[ev.playerId] || [];
            acc[ev.playerId].push(ev);
            return acc;
        }, {} as Record<string, Evaluation[]>);

        // 3. Run the transaction
        await runTransaction(firestore, async (transaction) => {
            if (!matchRef) return;
            const matchDoc = await transaction.get(matchRef);
            if (!matchDoc.exists() || matchDoc.data().status === 'evaluated') {
                throw new Error("Este partido ya ha sido evaluado o no existe.");
            }

            const playerIdsToUpdate = Object.keys(evaluationsByPlayer);
            const playerDocs = new Map<string, Player>();
            
            // --- READ PHASE ---
            for (const playerId of playerIdsToUpdate) {
                const playerDocRef = doc(firestore, 'players', playerId);
                const playerDoc = await transaction.get(playerDocRef);
                if (playerDoc.exists()) {
                    playerDocs.set(playerId, { id: playerDoc.id, ...playerDoc.data() } as Player);
                }
            }

            // --- WRITE PHASE ---
            for (const playerId of playerIdsToUpdate) {
                const player = playerDocs.get(playerId);
                if (!player) continue;

                const playerEvals = evaluationsByPlayer[playerId];
                const totalRating = playerEvals.reduce((sum, ev) => sum + ev.rating, 0);
                const avgRating = totalRating / playerEvals.length;
                const totalGoals = playerEvals.reduce((sum, ev) => sum + ev.goals, 0);

                const ovrChange = calculateOvrChange(player.ovr, avgRating);
                const newOvr = Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.HARD_CAP, player.ovr + ovrChange));
                const attributeChanges = calculateAttributeChanges(player, avgRating, player.position);

                const newMatchesPlayed = (player.stats.matchesPlayed || 0) + 1;
                const newTotalGoals = (player.stats.goals || 0) + totalGoals;
                const newAvgRating = ((player.stats.averageRating || 0) * (player.stats.matchesPlayed || 0) + avgRating) / newMatchesPlayed;
                
                const playerDocRef = doc(firestore, 'players', playerId);
                transaction.update(playerDocRef, {
                    ...attributeChanges,
                    ovr: newOvr,
                    stats: {
                        matchesPlayed: newMatchesPlayed,
                        goals: newTotalGoals,
                        assists: player.stats.assists || 0,
                        averageRating: newAvgRating,
                    },
                });

                // Create OVR history record
                const historyRef = doc(collection(firestore, 'players', playerId, 'ovrHistory'));
                const historyEntry: Omit<OvrHistory, 'id'> = {
                    date: new Date().toISOString(),
                    oldOVR: player.ovr,
                    newOVR: newOvr,
                    change: ovrChange,
                    matchId: match.id,
                };
                transaction.set(historyRef, historyEntry);
            }

            transaction.update(matchRef, { status: 'evaluated' });
        });

        toast({
            title: "¡Evaluación Finalizada!",
            description: "Los OVRs y estadísticas de los jugadores han sido actualizados."
        });
        router.push('/matches');

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


  const realPlayersInMatch = useMemo(() => {
    if (!match || !allGroupPlayers) return [];
    const playerIdsInMatch = new Set(match.players.map(p => p.uid));
    return allGroupPlayers.filter(p => playerIdsInMatch.has(p.id) && isRealUser(p));
  }, [match, allGroupPlayers]);

  const evaluatorsWhoHaveVoted = useMemo(() => {
    if (!assignments) return new Set();
    const completedEvaluators = assignments
        .filter(a => a.status === 'completed')
        .map(a => a.evaluatorId);
    return new Set(completedEvaluators);
  }, [assignments]);

  const totalPossibleEvaluators = realPlayersInMatch.length;
  const completedEvaluatorsCount = evaluatorsWhoHaveVoted.size;
  const evaluationProgress = totalPossibleEvaluators > 0 ? (completedEvaluatorsCount / totalPossibleEvaluators) * 100 : 0;
  
  if (isPageLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!match || !user) {
    return <div>Datos no encontrados.</div>;
  }
  
  if (user.uid !== match.ownerUid) {
    return (
        <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
            <PageHeader title={`Evaluación de: ${match.title}`}/>
            <Alert variant="destructive">
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>Solo el organizador del partido puede ver esta página.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/matches')}>Volver a Partidos</Button>
        </div>
    )
  }

  if (match.status === 'evaluated') {
    return (
        <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
            <PageHeader title={`Evaluación de: ${match.title}`}/>
            <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Evaluación Completa</AlertTitle>
                <AlertDescription>Este partido ya ha sido evaluado y los OVRs de los jugadores han sido actualizados.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/matches')}>Volver a Partidos</Button>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title={`Panel de Evaluación: ${match.title}`}
            description={`Supervisa el progreso de las evaluaciones de los jugadores.`}
        />
        <Card>
            <CardHeader>
                <CardTitle>Progreso de la Evaluación</CardTitle>
                <CardDescription>
                  Se recomienda finalizar cuando al menos el 80% de los jugadores hayan evaluado.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-primary">{completedEvaluatorsCount}</span>
                    <span className="text-muted-foreground">de</span> 
                    <span className="text-3xl font-bold text-primary">{totalPossibleEvaluators}</span>
                    <span className="text-muted-foreground">jugadores reales han evaluado</span>
                </div>
                <Progress value={evaluationProgress} />
                
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {realPlayersInMatch.map(player => (
                        <div key={player.id} className="flex items-center gap-3 p-2 rounded-md border">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={player.photoUrl} alt={player.name}/>
                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="flex-1 font-medium">{player.name}</span>
                            {evaluatorsWhoHaveVoted.has(player.id) ? (
                                <UserCheck className="h-5 w-5 text-green-500" />
                            ) : (
                                <UserX className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                    ))}
                 </div>
            </CardContent>
            <CardFooter>
                <Button size="lg" onClick={handleFinalizeEvaluation} disabled={isFinalizing || completedEvaluatorsCount === 0}>
                    {isFinalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Star className="mr-2 h-4 w-4" />}
                    {isFinalizing ? "Procesando..." : "Finalizar y Calcular OVRs"}
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
