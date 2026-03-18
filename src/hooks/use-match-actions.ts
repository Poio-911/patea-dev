import { useState, useCallback } from 'react';
import type { Match, Player, EvaluationAssignment, Notification, MatchLocation } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateTeamsAction, updateMatchDateAction, updateMatchLocationAction } from '@/lib/actions/server-actions';
import { logger } from '@/lib/logger';
import { celebrationConfetti, miniConfetti } from '@/lib/animations';
import { isErrorResponse } from '@/lib/errors';
import {
  notifyPlayerAddedToMatchAction
} from '@/lib/actions/notification-actions';
import { deleteMatchAction, finishMatchAction, joinMatchAction, leaveMatchAction, requestJoinMatchAction, shuffleMatchTeamsAction } from '@/lib/actions/match-actions';
import { useHaptics } from '@/hooks/use-haptics';

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
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const { success: hapticSuccess } = useHaptics();

  const handleFinish = useCallback(async () => {
    if (!userId || !match) return;
    setIsFinishing(true);

    try {
      const result = await finishMatchAction(match.id);
      if (isErrorResponse(result) || !result.success) {
        throw new Error(result.error || 'No se pudo finalizar el partido.');
      }

      hapticSuccess();
      toast({
        title: 'Partido Finalizado',
        description: `El partido "${match.title}" ha sido marcado como finalizado.`
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
  }, [userId, match, toast, hapticSuccess]);

  const isUserPendingRequest = !!(userId && match?.pendingPlayerUids?.includes(userId));

  const handleJoinOrLeave = useCallback(async () => {
    if (!userId || !match) return;
    setIsJoining(true);

    try {
      if (isUserInMatch) {
        const result = await leaveMatchAction(match.id, userId);
        if ('success' in result) {
          toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${match.title}".` });
        } else {
          throw new Error(result.error);
        }
      } else if (match.type === 'manual' && match.ownerUid !== userId) {
        // Manual public matches require organizer approval
        const result = await requestJoinMatchAction(match.id);
        if ('success' in result && result.success) {
          if ((result as any).alreadyPending) {
            toast({ description: 'Ya enviaste una solicitud para este partido.' });
          } else {
            hapticSuccess();
            toast({
              title: '📋 Solicitud enviada',
              description: `El organizador revisará tu perfil y te avisará.`,
            });
          }
        } else {
          throw new Error('error' in result ? (result as any).error : 'No se pudo enviar la solicitud.');
        }
      } else {
        const result = await joinMatchAction(match.id, userId, userDisplayName || 'Jugador');
        if ('success' in result) {
          miniConfetti();
          hapticSuccess();
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
  }, [userId, match, isUserInMatch, userDisplayName, toast, hapticSuccess]);

  const handleDelete = useCallback(async () => {
    if (!match) return;
    setIsDeleting(true);
    try {
      const result = await deleteMatchAction(match.id);
      if (isErrorResponse(result) || !result.success) {
        throw new Error(result.error || 'No se pudo eliminar el partido.');
      }
      toast({ title: "Partido Eliminado", description: "El partido ha sido eliminado con éxito." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el partido." });
    } finally {
      setIsDeleting(false);
    }
  }, [match, toast]);

  const handleReschedule = useCallback(async (date: string, time: string) => {
    if (!match) return;
    setIsRescheduling(true);
    try {
      const result = await updateMatchDateAction(match.id, date, time, undefined, match.playerUids);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Partido reprogramado', description: 'La fecha y hora han sido actualizadas.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo reprogramar el partido.' });
      throw error;
    } finally {
      setIsRescheduling(false);
    }
  }, [match, toast]);

  const handleChangeLocation = useCallback(async (location: MatchLocation) => {
    if (!match) return;
    setIsChangingLocation(true);
    try {
      const result = await updateMatchLocationAction(match.id, location, match.playerUids);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Cancha actualizada', description: 'La ubicación del partido ha sido actualizada.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo actualizar la cancha.' });
      throw error;
    } finally {
      setIsChangingLocation(false);
    }
  }, [match, toast]);

  const handleShuffleTeams = useCallback(async () => {
    if (!match) return;
    setIsShuffling(true);

    try {
      const result = await shuffleMatchTeamsAction(match.id);
      if (isErrorResponse(result) || !result.success) {
        throw new Error(result.error || 'No se pudieron volver a sortear los equipos.');
      }

      celebrationConfetti();
      hapticSuccess();
      toast({ title: "¡Equipos Sorteados!", description: "La IA ha generado nuevas formaciones." });

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron volver a sortear los equipos." });
    } finally {
      setIsShuffling(false);
    }
  }, [match, toast, hapticSuccess]);

  return {
    isFinishing,
    isJoining,
    isDeleting,
    isShuffling,
    isRescheduling,
    isChangingLocation,
    isUserPendingRequest,
    handleFinish,
    handleJoinOrLeave,
    handleDelete,
    handleShuffleTeams,
    handleReschedule,
    handleChangeLocation,
  };
}
