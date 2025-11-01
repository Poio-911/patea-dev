import { useState, useCallback } from 'react';
import type { Match, Player, EvaluationAssignment, Notification } from '@/lib/types';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, deleteDoc } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateTeamsAction } from '@/lib/actions/server-actions';
import { logger } from '@/lib/logger';
import { celebrationConfetti, miniConfetti } from '@/lib/animations';

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
    const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);
    realPlayerUids.forEach(evaluatorId => {
      if (!match.teams) return;
      const team = match.teams.find(t => t.players.some(p => p.uid === evaluatorId));
      if (!team) return;
      const teammates = team.players.filter(p => p.uid !== evaluatorId && realPlayerUids.includes(p.uid));
      const shuffledTeammates = teammates.sort(() => 0.5 - Math.random());
      const maxAssignments = Math.min(2, teammates.length);
      const playersToEvaluate = shuffledTeammates.slice(0, maxAssignments);
      playersToEvaluate.forEach(subject => {
        assignments.push({
          matchId: match.id,
          evaluatorId: evaluatorId,
          subjectId: subject.uid,
          status: 'pending',
        });
      });
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
          const playersToBalance = allGroupPlayers.filter(p => playerIdsInMatch.includes(p.id));
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

      // Generate evaluation assignments only if teams were successfully formed
      if (finalTeams && finalTeams.length > 0) {
        const assignments = generateEvaluationAssignments({ ...freshMatch, teams: finalTeams }, allGroupPlayers);
        const matchPlayers = allGroupPlayers.filter(p => freshMatch.playerUids.includes(p.id));
        const realPlayerUids = matchPlayers.filter(isRealUser).map(p => p.id);

        if (assignments.length < realPlayerUids.length * 2) {
          toast({
            variant: 'default',
            title: 'Advertencia: Pocos jugadores reales',
            description: `No todos los jugadores recibieron 2 asignaciones.`,
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
          };
          batch.set(notificationRef, notification);
        });
      }

      await batch.commit();

      toast({
        title: 'Partido Finalizado',
        description: `El partido "${freshMatch.title}" ha sido marcado como finalizado.`
      });

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
    if (!firestore || !userId || !match) return;
    setIsJoining(true);

    const batch = writeBatch(firestore);
    const matchRef = doc(firestore, 'matches', match.id);

    try {
      if (isUserInMatch) {
        const playerToRemove = match.players.find(p => p.uid === userId);
        if (playerToRemove) {
          batch.update(matchRef, {
            players: arrayRemove(playerToRemove),
            playerUids: arrayRemove(userId)
          });
        }
        toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${match.title}".` });
      } else {
        if (match.players.length >= match.matchSize) {
          toast({ variant: 'destructive', title: 'Partido Lleno', description: 'No quedan plazas disponibles en este partido.' });
          setIsJoining(false);
          return;
        }

        const playerProfileRef = doc(firestore, 'players', userId);
        const playerSnap = await getDoc(playerProfileRef);

        if (!playerSnap.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'No se encontró tu perfil de jugador.' });
          setIsJoining(false);
          return;
        }

        const playerProfile = playerSnap.data() as Player;

        const playerPayload = {
          uid: userId,
          displayName: playerProfile.name,
          ovr: playerProfile.ovr,
          position: playerProfile.position,
          photoUrl: playerProfile.photoUrl || ''
        };

        batch.update(matchRef, {
          players: arrayUnion(playerPayload),
          playerUids: arrayUnion(userId)
        });

        if (match.ownerUid !== userId) {
          const notificationRef = doc(collection(firestore, `users/${match.ownerUid}/notifications`));
          const notification: Omit<Notification, 'id'> = {
            type: 'new_joiner',
            title: '¡Nuevo Jugador!',
            message: `${userDisplayName} se ha apuntado a tu partido "${match.title}".`,
            link: `/matches`,
            isRead: false,
            createdAt: new Date().toISOString(),
          };
          batch.set(notificationRef, notification);
        }

        miniConfetti();
        toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${match.title}".` });
      }
      await batch.commit();
    } catch (error) {
      console.error("Error joining/leaving match: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la operación.' });
    } finally {
      setIsJoining(false);
    }
  }, [firestore, userId, match, isUserInMatch, userDisplayName, toast]);

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
      const playersToBalance = allGroupPlayers.filter(p => match.playerUids.includes(p.id));
      const teamGenerationResult = await generateTeamsAction(playersToBalance);

      if ('error' in teamGenerationResult) throw new Error(teamGenerationResult.error || 'La IA no pudo generar los equipos.');
      if (!teamGenerationResult.teams) throw new Error('La respuesta de la IA no contiene equipos.');

      await updateDoc(doc(firestore, 'matches', match.id), {
        teams: teamGenerationResult.teams
      });

      celebrationConfetti();
      toast({ title: "¡Equipos Sorteados!", description: "La IA ha generado nuevas formaciones." });

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
