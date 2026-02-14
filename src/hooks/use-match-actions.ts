import { useState, useCallback } from 'react';
import type { Match, Player, EvaluationAssignment, Notification } from '@/lib/types';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, deleteDoc } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateTeamsAction } from '@/lib/actions/server-actions';
import { logger } from '@/lib/logger';
import { celebrationConfetti, miniConfetti } from '@/lib/animations';
import {
  notifyPlayerAddedToMatchAction,
  notifyTeamsShuffledAction,
  notifyEvaluationAvailableAction
} from '@/lib/actions/notification-actions';
import { joinMatchAction, leaveMatchAction } from '@/lib/actions/match-actions';

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

interface UseMatchActionsParams {
  match: Match | null | undefined;
  firestore: Firestore | null;
  userId: string | undefined;
  userDisplayName: string | undefined;
  allGroupPlayers: Player[] | undefined;
  isUserInMatch: boolean;
}

/**
 * Hook para gestionar todas las acciones relacionadas con un partido
 * (join, leave, delete, finish, shuffle teams)
 */
export function useMatchActions({
  match,
  firestore,
  userId,
  userDisplayName,
  allGroupPlayers,
  isUserInMatch,
}: UseMatchActionsParams) {
  const { toast } = useToast();
  const [isFinishing, setIsFinishing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  const generateEvaluationAssignments = useCallback((match: Match, allPlayers: Player[]): Omit<EvaluationAssignment, 'id'>[] => {
    const assignments: Omit<EvaluationAssignment, 'id'>[] = [];
    const matchPlayers = allPlayers.filter(p => match.playerUids.includes(p.id));

    // Only real users can be evaluators
    const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);

    // Track incoming evaluation counts to ensure balance
    const incomingCounts: Record<string, number> = {};
    matchPlayers.forEach(p => incomingCounts[p.id] = 0);

    // Fisher-Yates shuffle for unbiased randomization
    const shuffledEvaluators = [...realPlayerUids];
    for (let i = shuffledEvaluators.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledEvaluators[i], shuffledEvaluators[j]] = [shuffledEvaluators[j], shuffledEvaluators[i]];
    }

    shuffledEvaluators.forEach(evaluatorId => {
      // myTeam is undefined if no teams → no teammate priority, but assignments still generated
      const myTeam = match.teams?.find(t => t.players.some(p => p.uid === evaluatorId));

      // 1. Define candidates (ALL players except self)
      // We do NOT filter by 'already assigned' here because we want to soft-balance, 
      // but we will prioritize those with fewer incoming counts.
      let candidates = matchPlayers.filter(p => p.id !== evaluatorId);

      // 2. Sort candidates by:
      //    a. Incoming Count (Ascending) -> PRIMARY: STARVE THE RICH (Ensure everyone gets evals)
      //    b. Is Teammate (Descending)   -> SECONDARY: PREFER TEAMMATES
      //    c. Random                     -> TERTIARY: VARIETY

      candidates.sort((a, b) => {
        // Primary: Starvation (Load Balancing)
        const countDiff = incomingCounts[a.id] - incomingCounts[b.id];
        if (countDiff !== 0) return countDiff;

        // Secondary: Teammate Priority
        const aIsTeammate = myTeam?.players.some(tp => tp.uid === a.id);
        const bIsTeammate = myTeam?.players.some(tp => tp.uid === b.id);

        if (aIsTeammate && !bIsTeammate) return -1;
        if (!aIsTeammate && bIsTeammate) return 1;

        // Tertiary: Stable (pre-shuffle handles randomization)
        return 0;
      });

      // 3. Pick top 2
      const MAX_PEERS = 2;
      const selectedPeers = candidates.slice(0, MAX_PEERS);

      // If NO peers found (e.g. only 1 player match?), assign self-evaluation fallback
      if (selectedPeers.length === 0) {
        assignments.push({
          matchId: match.id,
          evaluatorId: evaluatorId,
          subjectId: evaluatorId, // Self
          status: 'pending',
        });
      } else {
        selectedPeers.forEach(subject => {
          incomingCounts[subject.id]++;
          assignments.push({
            matchId: match.id,
            evaluatorId: evaluatorId,
            subjectId: subject.id,
            status: 'pending',
          });
        });
      }
    });

    return assignments;
  }, []);

  const handleFinish = useCallback(async () => {
    if (!firestore || !userId || !match || !allGroupPlayers) return;
    setIsFinishing(true);
    const batch = writeBatch(firestore);
    const matchRef = doc(firestore, 'matches', match.id);

    try {
      const freshMatchSnap = await getDoc(matchRef);
      if (!freshMatchSnap.exists()) {
        throw new Error("El partido ya no existe.");
      }
      const freshMatch = { id: freshMatchSnap.id, ...freshMatchSnap.data() } as Match;

      let finalTeams = freshMatch.teams;
      let matchUpdateData: any = { status: 'completed' };

      // Logic to generate teams if they don't exist yet
      if (!finalTeams || finalTeams.length === 0) {
        const playerIdsInMatch = freshMatch.playerUids;
        if (playerIdsInMatch.length >= freshMatch.matchSize) {
          const playersToBalance = allGroupPlayers
            .filter(p => playerIdsInMatch.includes(p.id))
            .map(p => ({
              id: p.id,
              name: p.name,
              ovr: p.ovr,
              position: p.position
            }));
          const teamGenerationResult = await generateTeamsAction(playersToBalance);
          if ('error' in teamGenerationResult) throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
          if (!teamGenerationResult.teams) throw new Error('La respuesta de la IA no contiene equipos.');

          finalTeams = teamGenerationResult.teams as any;
          matchUpdateData.teams = finalTeams;
        } else {
          logger.warn("Finishing match without full player list. Teams not generated.");
        }
      }

      batch.update(matchRef, matchUpdateData);

      // Generate evaluation assignments (works with or without teams)
      const matchForAssignments = finalTeams ? { ...freshMatch, teams: finalTeams } : freshMatch;
      const assignments = generateEvaluationAssignments(matchForAssignments, allGroupPlayers);
      const matchPlayers = allGroupPlayers.filter(p => freshMatch.playerUids.includes(p.id));
      const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);

      if (assignments.length > 0) {
        if (assignments.length < realPlayerUids.length) {
          toast({
            variant: 'default',
            title: 'Advertencia: Asignaciones incompletas',
            description: `Algunos jugadores no recibieron su autoevaluación.`,
          });
        }

        assignments.forEach(assignment => {
          const assignmentRef = doc(collection(firestore, `matches/${freshMatch.id}/assignments`));
          batch.set(assignmentRef, assignment);

          const notificationRef = doc(collection(firestore, `users/${assignment.evaluatorId}/notifications`));
          const notification: Omit<Notification, 'id'> = {
            type: 'evaluation_pending',
            title: '¡Evaluación pendiente!',
            message: `Es hora de evaluar a tus compañeros del partido "${freshMatch.title}".`,
            link: `/evaluations/${freshMatch.id}`,
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { fromUserId: userId },
          };
          batch.set(notificationRef, notification);
        });
      }

      await batch.commit();

      toast({
        title: 'Partido Finalizado',
        description: `El partido "${freshMatch.title}" ha sido marcado como finalizado.`
      });

      // Send push notification to players about evaluation availability
      if (realPlayerUids.length > 0) {
        notifyEvaluationAvailableAction({
          playerIds: realPlayerUids,
          matchTitle: freshMatch.title,
        }).catch(err => logger.error('Failed to send evaluation notification', err));
      }

    } catch (error: any) {
      logger.error("Error finishing match", error, { matchId: match.id });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo finalizar el partido.'
      });
    } finally {
      setIsFinishing(false);
    }
  }, [firestore, userId, match, allGroupPlayers, generateEvaluationAssignments, toast]);

  const handleJoinOrLeave = useCallback(async () => {
    if (!userId || !match) return;
    setIsJoining(true);

    try {
      if (isUserInMatch) {
        const result = await leaveMatchAction(match.id, userId);
        if (result.success) {
          toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${match.title}".` });
        } else {
          throw new Error(result.error);
        }
      } else {
        const result = await joinMatchAction(match.id, userId, userDisplayName || 'Jugador');
        if (result.success) {
          miniConfetti();
          toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${match.title}".` });
        } else {
          throw new Error(result.error);
        }
      }
    } catch (error: any) {
      console.error("Error joining/leaving match: ", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo completar la operación.' });
    } finally {
      setIsJoining(false);
    }
  }, [userId, match, isUserInMatch, userDisplayName, toast]);

  const handleDelete = useCallback(async () => {
    if (!firestore || !match) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'matches', match.id));
      toast({ title: "Partido Eliminado", description: "El partido ha sido eliminado con éxito." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el partido." });
    } finally {
      setIsDeleting(false);
    }
  }, [firestore, match, toast]);

  const handleShuffleTeams = useCallback(async () => {
    if (!firestore || !match || !allGroupPlayers) return;
    setIsShuffling(true);

    try {
      const playersToBalance = allGroupPlayers
        .filter(p => match.playerUids.includes(p.id))
        .map(p => ({
          id: p.id,
          name: p.name,
          ovr: p.ovr,
          position: p.position
        }));
      const teamGenerationResult = await generateTeamsAction(playersToBalance);

      if ('error' in teamGenerationResult) throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
      if (!teamGenerationResult.teams) throw new Error('La respuesta de la IA no contiene equipos.');

      await updateDoc(doc(firestore, 'matches', match.id), {
        teams: teamGenerationResult.teams
      });

      celebrationConfetti();
      toast({ title: "¡Equipos Sorteados!", description: "La IA ha generado nuevas formaciones." });

      // Send push notification to all players about team change
      notifyTeamsShuffledAction({
        playerIds: match.playerUids,
        matchTitle: match.title,
      }).catch(err => logger.error('Failed to send team shuffle notification', err));

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron volver a sortear los equipos." });
    } finally {
      setIsShuffling(false);
    }
  }, [firestore, match, allGroupPlayers, toast]);

  return {
    isFinishing,
    isJoining,
    isDeleting,
    isShuffling,
    handleFinish,
    handleJoinOrLeave,
    handleDelete,
    handleShuffleTeams,
  };
}
