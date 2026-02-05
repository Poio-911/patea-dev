
'use client';

import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, writeBatch, runTransaction, getDocs, where, addDoc, deleteDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, EvaluationAssignment, Evaluation, OvrHistory, SelfEvaluation, PerformanceTag } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Check, BarChart, UserCheck, UserX, Star, AlertTriangle, FileClock, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { logger } from '@/lib/logger';
import { publishMatchPlayedActivity, publishOvrChangeActivity } from '@/lib/actions/social-actions';
import { updateLeagueStandingsAction, advanceCupWinnerAction } from '@/lib/actions/server-actions';
import { BackButton } from '@/components/navigation/back-button';

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

// --- Player Progression Logic ---
const OVR_PROGRESSION = {
    BASELINE_RATING: 5,
    MAX_STEP: 1.5,
    MIN_OVR: 40,
    MAX_OVR: 99,
    MIN_ATTRIBUTE: 20,
    MAX_ATTRIBUTE: 99
};

const calculateOvrChange = (currentOvr: number, avgRating: number): number => {
    if (avgRating === OVR_PROGRESSION.BASELINE_RATING) return 0;

    const ratingDelta = avgRating - OVR_PROGRESSION.BASELINE_RATING; // -5 to +5 range

    // Dynamic Scale based on OVR Tier (Catch-up mechanic)
    let scale = 0.30; // Default (Normal)

    if (currentOvr < 50) scale = 0.50;      // Very Fast (Rookie)
    else if (currentOvr < 60) scale = 0.40; // Fast
    else if (currentOvr < 70) scale = 0.30; // Standard
    else if (currentOvr < 80) scale = 0.20; // Harder
    else if (currentOvr < 90) scale = 0.10; // Elite Grind
    else scale = 0.05;                      // Legend (Very slow)

    let rawDelta = ratingDelta * scale;

    // Apply limits
    return Math.max(-OVR_PROGRESSION.MAX_STEP, Math.min(OVR_PROGRESSION.MAX_STEP, rawDelta));
};

// Weights for distributing attribute points based on player position
const POSITION_WEIGHTS: Record<string, Record<keyof Player, number>> = {
    'DEL': { pac: 0.25, sho: 0.35, pas: 0.15, dri: 0.15, def: 0.05, phy: 0.05 },
    'MED': { pac: 0.15, sho: 0.15, pas: 0.30, dri: 0.20, def: 0.10, phy: 0.10 },
    'DEF': { pac: 0.15, sho: 0.05, pas: 0.15, dri: 0.05, def: 0.40, phy: 0.20 },
    'POR': { pac: 0.10, sho: 0.05, pas: 0.10, dri: 0.05, def: 0.50, phy: 0.20 }, // GK uses DEF/PHY broadly
};

const DEFAULT_WEIGHTS = { pac: 0.166, sho: 0.166, pas: 0.166, dri: 0.166, def: 0.166, phy: 0.166 };

// ✅ UPDATED: Distributes points using Error Accumulation (Dithering) instead of Ceil/Floor bias
const calculateAttributeChangesFromPoints = (currentAttrs: Player, ovrChange: number, position: string) => {
    if (ovrChange === 0) return currentAttrs;

    const newAttributes = { ...currentAttrs };
    const attributes: Array<keyof Player> = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
    const weights = POSITION_WEIGHTS[position as keyof typeof POSITION_WEIGHTS] || DEFAULT_WEIGHTS;

    // Total raw attribute points to distribute
    // OVR is roughly (Sum Attributes)/6, so to raise OVR by X, we need X*6 attribute points.
    const totalPointsToAdd = ovrChange * 6;

    // Distribute with error accumulation to avoid "Ceil" inflation
    let accumulatedError = 0;

    attributes.forEach((attr) => {
        const targetShare = totalPointsToAdd * weights[attr as keyof typeof weights];
        const pointWithDecimal = targetShare + accumulatedError;
        const pointRounded = Math.round(pointWithDecimal);

        accumulatedError = pointWithDecimal - pointRounded; // Carry over difference to next attribute

        const currentValue = newAttributes[attr] as number;
        // Apply change and clamp
        newAttributes[attr] = Math.round(Math.max(
            OVR_PROGRESSION.MIN_ATTRIBUTE,
            Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, currentValue + pointRounded)
        ));
    });

    return newAttributes;
};

const calculateAttributeChanges = (currentAttrs: Player, tags: PerformanceTag[] = []) => {
    const newAttributes = { ...currentAttrs };
    if (tags && tags.length > 0) {
        tags.forEach(tag => {
            if (!tag.effects) return;
            tag.effects.forEach(effect => {
                const key = effect.attribute as keyof Player;
                if (typeof newAttributes[key] === 'number') {
                    (newAttributes[key] as number) += effect.change;
                    newAttributes[key] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newAttributes[key] as number)));
                }
            });
        });
    }
    return newAttributes;
};

// Process AI-extracted attribute changes from text evaluations
const calculateAttributeChangesFromAI = (currentAttrs: Player, aiChanges: { attribute: string; change: number }[] = []) => {
    const newAttributes = { ...currentAttrs };
    if (aiChanges && aiChanges.length > 0) {
        aiChanges.forEach(change => {
            const key = change.attribute as keyof Player;
            if (typeof newAttributes[key] === 'number') {
                (newAttributes[key] as number) += change.change;
                newAttributes[key] = Math.round(Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, newAttributes[key] as number)));
            }
        });
    }
    return newAttributes;
};

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
        return new Set(completedEvaluators);
    }, [assignments]);

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
        if (!firestore || !match || !match.id) return;
        setIsFinalizing(true);

        try {
            const completedAssignmentIds = assignments?.filter(a => a.status === 'completed').map(a => a.id) || [];
            if (completedAssignmentIds.length === 0) {
                throw new Error("No hay evaluaciones completadas para procesar.");
            }

            // Declare these outside transaction so they're available later
            let playerIdsToUpdate: string[] = [];
            const playerDocs = new Map<string, Player>();
            let peerEvalsByPlayer: Record<string, Evaluation[]> = {};

            await runTransaction(firestore, async (transaction) => {
                if (!matchRef) return;
                const matchDoc = await transaction.get(matchRef);
                if (!matchDoc.exists() || matchDoc.data().status === 'evaluated') {
                    throw new Error("Este partido ya ha sido evaluado o no existe.");
                }

                // Ensure no pending submissions before finalizing
                const pendingSubmissionsQuery = query(collection(firestore, 'evaluationSubmissions'), where('matchId', '==', match.id));
                const pendingSubmissionsSnapshot = await getDocs(pendingSubmissionsQuery);
                if (!pendingSubmissionsSnapshot.empty) {
                    throw new Error(`Aún hay ${pendingSubmissionsSnapshot.size} evaluaciones pendientes de procesar. Espera un momento y reintenta.`);
                }

                const peerEvalsQuery = query(collection(firestore, 'evaluations'), where('assignmentId', 'in', completedAssignmentIds));
                const peerEvalsSnapshot = await getDocs(peerEvalsQuery);
                const matchPeerEvals = peerEvalsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Evaluation));

                const selfEvalsQuery = collection(firestore, 'matches', match.id as string, 'selfEvaluations');
                const selfEvalsSnapshot = await getDocs(selfEvalsQuery);
                const matchSelfEvals = selfEvalsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SelfEvaluation));
                const selfEvalsByPlayerId = new Map(matchSelfEvals.map(ev => [ev.playerId, ev]));

                peerEvalsByPlayer = matchPeerEvals.reduce((acc, ev) => {
                    acc[ev.playerId] = acc[ev.playerId] || [];
                    acc[ev.playerId].push(ev);
                    return acc;
                }, {} as Record<string, Evaluation[]>);

                // ✅ FIX: Include ALL players in match, not just those who received peer evaluations
                // This ensures manual players and players without completed assignments also get stats updates
                playerIdsToUpdate = match.playerUids || [];

                // Pre-fetch all player documents
                if (playerIdsToUpdate.length > 0) {
                    const playersQuery = query(collection(firestore, 'players'), where('__name__', 'in', playerIdsToUpdate));
                    const playersSnapshot = await getDocs(playersQuery);
                    playersSnapshot.forEach(playerDoc => {
                        playerDocs.set(playerDoc.id, { id: playerDoc.id, ...playerDoc.data() } as Player);
                    });
                }

                for (const playerId of playerIdsToUpdate) {
                    const player = playerDocs.get(playerId);
                    if (!player) continue;

                    // ✅ FIX: playerPeerEvals can be undefined for players without peer evaluations
                    const playerPeerEvals = peerEvalsByPlayer[playerId] || [];
                    const pointBasedEvals = playerPeerEvals.filter(ev => ev.rating !== undefined && ev.rating !== null);
                    const tagBasedEvals = playerPeerEvals.filter(ev => ev.performanceTags && ev.performanceTags.length > 0);
                    const textBasedEvals = playerPeerEvals.filter(ev => ev.aiAttributeChanges && ev.aiAttributeChanges.length > 0);

                    let updatedAttributes = { ...player };
                    let ovrChangeFromPoints = 0;

                    // ✅ STEP 1: Process tags ALWAYS if they exist → modifies specific attributes
                    if (tagBasedEvals.length > 0) {
                        const combinedTags = tagBasedEvals.flatMap(ev => ev.performanceTags || []);
                        updatedAttributes = calculateAttributeChanges(player, combinedTags);
                    }

                    // ✅ STEP 1.5: Process text-based AI attribute changes → modifies specific attributes
                    if (textBasedEvals.length > 0) {
                        const allAiChanges = textBasedEvals.flatMap(ev => ev.aiAttributeChanges || []);
                        updatedAttributes = calculateAttributeChangesFromAI(updatedAttributes, allAiChanges);
                    }

                    const playerSelfEval = selfEvalsByPlayerId.get(playerId);
                    const goalsInMatch = playerSelfEval?.goals || 0;
                    const assistsInMatch = playerSelfEval?.assists || 0;

                    // ✅ STEP 2: Calculate OVR change
                    let avgRating = 5; // Default baseline

                    if (pointBasedEvals.length > 0) {
                        // Case A: Has evaluations -> Use average
                        const totalRating = pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0);
                        avgRating = totalRating / pointBasedEvals.length;
                        ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
                    } else {
                        // Case B: No evaluations ("Paja") -> Infer rating from stats
                        // Fallback logic: significant contribution implies good performance
                        if (goalsInMatch >= 2 || assistsInMatch >= 2 || (goalsInMatch + assistsInMatch >= 3)) {
                            avgRating = 8;
                        } else if (goalsInMatch === 1 || assistsInMatch === 1) {
                            avgRating = 7;
                        } else {
                            // No stats, no votes -> Assume average performance (no change) or slight decay if we wanted
                            avgRating = 5;
                        }

                        // Only apply positive changes for inferred ratings to be safe, or allow full range?
                        // User said: "hay que tener un respaldo". Let's apply implied change.
                        ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
                    }

                    // ✅ STEP 3: Apply points-based OVR change proportionally to all attributes
                    if (ovrChangeFromPoints !== 0) {
                        // Pass player position to apply weighted distribution
                        updatedAttributes = calculateAttributeChangesFromPoints(updatedAttributes, ovrChangeFromPoints, player.position || 'MED');
                    }

                    // ✅ STEP 4: Calculate new OVR as average of updated attributes (ALWAYS CONSISTENT)
                    let newOvr = Math.round((updatedAttributes.pac + updatedAttributes.sho + updatedAttributes.pas + updatedAttributes.dri + updatedAttributes.def + updatedAttributes.phy) / 6);
                    newOvr = Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.MAX_OVR, newOvr));

                    const newMatchesPlayed = (player.stats.matchesPlayed || 0) + 1;
                    const newTotalGoals = (player.stats.goals || 0) + goalsInMatch;
                    const newTotalAssists = (player.stats.assists || 0) + assistsInMatch;

                    // Clarification: averageRating represents the average rating PER MATCH
                    // Use equality-checked avgRating from above (includes fallback logic)

                    // Weighted average: (previous_avg * prev_matches + new_match_avg) / total_matches
                    const newAvgRating = ((player.stats.averageRating || 0) * (player.stats.matchesPlayed || 0) + avgRating) / newMatchesPlayed;

                    const playerDocRef = doc(firestore, 'players', playerId);
                    transaction.update(playerDocRef, {
                        ...updatedAttributes,
                        ovr: newOvr,
                        stats: {
                            matchesPlayed: newMatchesPlayed,
                            goals: newTotalGoals,
                            assists: newTotalAssists,
                            averageRating: newAvgRating,
                        },
                    });

                    const historyRef = doc(collection(firestore, 'players', playerId, 'ovrHistory'));
                    const historyEntry: Omit<OvrHistory, 'id'> = {
                        date: new Date().toISOString(),
                        oldOVR: player.ovr,
                        newOVR: newOvr,
                        change: newOvr - player.ovr,
                        matchId: match.id,
                    };
                    transaction.set(historyRef, historyEntry);
                }

                transaction.update(matchRef, { status: 'evaluated' });
            });

            // 🎉 Confetti celebration on successful finalization
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            // Publish social activities for match participation and OVR changes
            try {
                const uniqueUsers = new Set<string>();
                const playerOvrChanges = new Map<string, { player: Player; oldOvr: number; newOvr: number; change: number }>();

                // Collect unique users and OVR changes
                for (const playerId of playerIdsToUpdate) {
                    const player = playerDocs.get(playerId);
                    if (!player) continue;
                    uniqueUsers.add(player.ownerUid);

                    const playerPeerEvals = peerEvalsByPlayer[playerId] || [];
                    const pointBasedEvals = playerPeerEvals.filter(ev => ev.rating !== undefined && ev.rating !== null);
                    const tagBasedEvals = playerPeerEvals.filter(ev => ev.performanceTags && ev.performanceTags.length > 0);

                    let ovrChange = 0;
                    if (pointBasedEvals.length > 0) {
                        const avgRating = pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0) / pointBasedEvals.length;
                        ovrChange = calculateOvrChange(player.ovr, avgRating);
                    }

                    // Add tag-based changes (simplified estimation)
                    if (tagBasedEvals.length > 0) {
                        const tagEffect = tagBasedEvals.flatMap(ev => ev.performanceTags || [])
                            .reduce((sum, tag) => sum + (tag.effects?.reduce((s, e) => s + e.change, 0) || 0), 0);
                        ovrChange += Math.round(tagEffect / 6); // Rough average across attributes
                    }

                    const newOvr = Math.max(40, Math.min(99, player.ovr + ovrChange));
                    if (ovrChange !== 0) {
                        playerOvrChanges.set(playerId, { player, oldOvr: player.ovr, newOvr, change: ovrChange });
                    }
                }

                // Publish match_played activities (handled by server-actions.ts)
                const publishPromises = [];

                // Publish OVR change activities
                for (const [playerId, { player, oldOvr, newOvr, change }] of playerOvrChanges) {
                    const historyEntry = { oldOVR: oldOvr, newOVR: newOvr, change, date: new Date().toISOString(), matchId: match.id, id: '' };

                    // Create a plain object for the server action to avoid serialization warnings with Timestamps
                    const safePlayer = {
                        ...player,
                        lastCreditReset: player.lastCreditReset ? new Date().toISOString() : undefined, // Convert or omit non-serializable fields
                        // Ensure we pass a plain object
                    };

                    publishPromises.push(publishOvrChangeActivity(safePlayer, historyEntry));
                }

                await Promise.allSettled(publishPromises);
                logger.info('Social activities published', { matchId: match.id, userCount: uniqueUsers.size, ovrChanges: playerOvrChanges.size });
            } catch (error) {
                logger.error('Error publishing social activities', error);
                // Don't block evaluation if social activities fail
            }

            // Update league standings if this is a league match
            if (match.type === 'league' && match.leagueInfo?.leagueId) {
                try {
                    await updateLeagueStandingsAction(match.leagueInfo.leagueId);
                    logger.info('League standings updated', { leagueId: match.leagueInfo.leagueId, matchId: match.id });
                } catch (error) {
                    logger.error('Error updating league standings', error);
                    // Don't block the flow if standings update fails
                }
            }

            // Advance winner in cup bracket if this is a cup match
            if (match.type === 'cup' && match.leagueInfo?.leagueId && match.finalScore && match.participantTeamIds) {
                try {
                    // Determine winner
                    const team1Score = match.finalScore.team1;
                    const team2Score = match.finalScore.team2;

                    if (team1Score !== team2Score) {
                        const winnerId = team1Score > team2Score ? match.participantTeamIds[0] : match.participantTeamIds[1];
                        await advanceCupWinnerAction(match.leagueInfo.leagueId, match.id, winnerId);
                        logger.info('Cup winner advanced', { cupId: match.leagueInfo.leagueId, winnerId, matchId: match.id });
                    } else {
                        logger.warn('Cup match ended in a tie - winner not advanced', { matchId: match.id });
                    }
                } catch (error) {
                    logger.error('Error advancing cup winner', error);
                    // Don't block the flow if cup advancement fails
                }
            }

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
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Progreso</span>
                            <span className="text-sm font-semibold text-primary">{Math.round(evaluationProgress)}%</span>
                        </div>
                        <Progress value={evaluationProgress} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                            {realPlayersInMatch.map((player, index) => (
                                <motion.div
                                    key={player.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center gap-3 p-2 rounded-md border"
                                >
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={player.photoURL} alt={player.name} />
                                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="flex-1 font-medium">{player.name}</span>
                                    <AnimatePresence mode="wait">
                                        {evaluatorsWhoHaveVoted.has(player.id) ? (
                                            <motion.div
                                                key="checked"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                            >
                                                <UserCheck className="h-5 w-5 text-green-500" />
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="unchecked"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                            >
                                                <UserX className="h-5 w-5 text-red-500" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
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
