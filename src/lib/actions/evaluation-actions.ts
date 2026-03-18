'use server';

import { analyzeTextPerformance } from '@/ai/flows/analyze-text-performance';
import { getAdminDb } from '@/firebase/admin-init';
import { requireAuth } from '@/lib/auth/get-server-session';
import type { Evaluation, Match, SelfEvaluation } from '@/lib/types';

export type AttributeChange = {
  attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
  change: number;
  reason: string;
};

export type AnalyzeEvaluationTextResult =
  | { attributeChanges: AttributeChange[]; confidence: number; summary: string }
  | { error: string };

export async function analyzeEvaluationTextAction(input: {
  text: string;
  playerPosition: 'DEL' | 'MED' | 'DEF' | 'POR';
  playerName: string;
}): Promise<AnalyzeEvaluationTextResult> {
  try {
    const result = await analyzeTextPerformance({
      text: input.text,
      playerPosition: input.playerPosition,
      playerName: input.playerName,
    });

    return {
      attributeChanges: result.attributeChanges,
      confidence: result.confidence,
      summary: result.summary,
    };
  } catch (error) {
    console.error('Error analyzing evaluation text:', error);
    return { error: 'No se pudo analizar el texto. Intenta describir el rendimiento de otra manera.' };
  }
}

export async function submitEvaluationSubmissionAction(
  matchId: string,
  submission: Record<string, unknown>
): Promise<{ success: boolean; alreadySubmitted?: boolean; error?: string }> {
  try {
    const evaluatorId = await requireAuth();
    const db = getAdminDb();

    if (!matchId) {
      return { success: false, error: 'Partido no válido.' };
    }

    const existingSubmission = await db
      .collection('evaluationSubmissions')
      .where('matchId', '==', matchId)
      .where('evaluatorId', '==', evaluatorId)
      .limit(1)
      .get();

    if (!existingSubmission.empty) {
      return { success: true, alreadySubmitted: true };
    }

    await db.collection('evaluationSubmissions').add({
      evaluatorId,
      matchId,
      submittedAt: new Date().toISOString(),
      submission,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error submitting evaluation submission:', error);
    return { success: false, error: error.message || 'No se pudieron enviar las evaluaciones.' };
  }
}

export async function processPendingEvaluationSubmissionsAction(
  matchId: string
): Promise<{ success: boolean; processedCount?: number; error?: string }> {
  try {
    const callerId = await requireAuth();
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      return { success: false, error: 'Partido no encontrado.' };
    }

    const match = matchSnap.data() as Match;
    if (match.ownerUid !== callerId) {
      return { success: false, error: 'Solo el organizador puede procesar evaluaciones.' };
    }

    let processedCount = 0;

    await db.runTransaction(async (transaction) => {
      const submissionsQuery = db.collection('evaluationSubmissions').where('matchId', '==', matchId);
      const snapshot = await transaction.get(submissionsQuery);

      if (snapshot.empty) {
        processedCount = 0;
        return;
      }

      processedCount = snapshot.size;

      for (const submissionDoc of snapshot.docs) {
        const submissionData = submissionDoc.data() as {
          evaluatorId: string;
          submittedAt: string;
          submission: {
            evaluatorGoals?: number;
            evaluatorAssists?: number;
            mvpVote?: string;
            evaluations?: Array<Record<string, any>>;
          };
        };

        const processedRef = db.collection(`matches/${matchId}/processedSubmissions`).doc();
        transaction.set(processedRef, {
          ...submissionData,
          processedAt: new Date().toISOString(),
          originalSubmissionId: submissionDoc.id,
          processingStatus: 'completed',
        });

        transaction.delete(submissionDoc.ref);

        const { evaluatorId, submission: formData } = submissionData;

        if (
          (formData.evaluatorGoals || 0) > 0 ||
          (formData.evaluatorAssists || 0) > 0 ||
          formData.mvpVote
        ) {
          const selfEvalRef = db.collection(`matches/${matchId}/selfEvaluations`).doc();
          const selfEvaluation: Omit<SelfEvaluation, 'id'> = {
            playerId: evaluatorId,
            matchId,
            goals: formData.evaluatorGoals || 0,
            assists: formData.evaluatorAssists || 0,
            mvpVote: formData.mvpVote || undefined,
            reportedAt: submissionData.submittedAt,
          };
          transaction.set(selfEvalRef, selfEvaluation);
        }

        for (const evaluation of formData.evaluations || []) {
          const evalRef = db.collection('evaluations').doc();
          const newEvaluation: Omit<Evaluation, 'id'> = {
            assignmentId: evaluation.assignmentId,
            playerId: evaluation.subjectId,
            evaluatorId,
            matchId,
            goals: 0,
            evaluatedAt: submissionData.submittedAt,
          };

          if (evaluation.evaluationType === 'points') {
            newEvaluation.rating = evaluation.rating;
          } else if (evaluation.evaluationType === 'tags') {
            newEvaluation.performanceTags = evaluation.performanceTags;
          } else if (evaluation.evaluationType === 'text') {
            if (evaluation.aiAttributeChanges) {
              newEvaluation.aiAttributeChanges = evaluation.aiAttributeChanges;
            }
            if (evaluation.aiConfidence) {
              newEvaluation.aiConfidence = evaluation.aiConfidence;
            }
            newEvaluation.textDescription = evaluation.textDescription || '';
            if (evaluation.aiSummary) {
              newEvaluation.aiSummary = evaluation.aiSummary;
            }
          }

          transaction.set(evalRef, newEvaluation);

          if (evaluation.assignmentId) {
            const assignmentRef = db.collection(`matches/${matchId}/assignments`).doc(evaluation.assignmentId);
            transaction.update(assignmentRef, { status: 'completed', evaluationId: evalRef.id });
          }
        }
      }
    });

    return { success: true, processedCount };
  } catch (error: any) {
    console.error('Error processing pending submissions:', error);
    return { success: false, error: error.message || 'No se pudieron procesar las evaluaciones pendientes.' };
  }
}

export async function requestIdentityRevelation(evaluationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { getAdminDb, getAdminAuth } = await import('@/firebase/admin-init');
    const { createError, ErrorCodes } = await import('../errors');
    const { requireAuth } = await import('../auth/get-server-session');

    // Verify caller is authenticated
    const callerId = await requireAuth();

    // 1. Get Evaluation
    const evalRef = getAdminDb().collection('evaluations').doc(evaluationId);
    const evalSnap = await evalRef.get();

    if (!evalSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND, { evaluationId });
    }

    const evaluation = evalSnap.data() as any;

    // Verify the caller is the evaluated player (only the subject can request identity)
    if (evaluation.playerId !== callerId) {
      return { success: false, error: 'No tienes permiso para solicitar esta revelación.' };
    }

    if (evaluation.identityRequestStatus === 'pending' || evaluation.identityRequestStatus === 'accepted') {
      return { success: true }; // Already processing
    }

    // 2. Update Status
    await evalRef.update({
      identityRequestStatus: 'pending',
      identityRequestDate: new Date().toISOString()
    });

    // 3. Fetch the evaluated player's info to personalize the notification
    const playerSnap = await getAdminDb().collection('players').doc(evaluation.playerId).get();
    const playerData = playerSnap.data() as any;
    const playerName: string = playerData?.name || 'Un compañero';
    const playerPhotoUrl: string = playerData?.photoUrl || playerData?.photoURL || '';

    // 4. Write notification to the evaluator's subcollection
    const evaluatorId: string = evaluation.evaluatorId;
    await getAdminDb()
      .collection('users')
      .doc(evaluatorId)
      .collection('notifications')
      .add({
        type: 'identity_reveal_requested',
        title: '🕵️ ¡Quieren saber quién sos!',
        message: `${playerName} quiere saber que fuiste vos quien lo evaluó.`,
        link: '/evaluations?tab=requests',
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: {
          evaluationId,
          matchId: evaluation.matchId,
          fromPlayerId: evaluation.playerId,
          fromPlayerName: playerName,
          fromPlayerPhotoUrl: playerPhotoUrl,
        },
      });

    // 5. Send FCM push notification to evaluator
    const { sendNotificationToUsersAction } = await import('./notification-actions');
    await sendNotificationToUsersAction({
      userIds: [evaluatorId],
      title: '🕵️ ¡Quieren saber quién sos!',
      body: `${playerName} quiere saber que fuiste vos quien lo evaluó.`,
      data: { type: 'identity_reveal_requested', link: '/evaluations?tab=requests' },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error requesting identity revelation:', error);
    return { success: false, error: error.message || 'Error al procesar la solicitud.' };
  }
}

export async function respondToIdentityRevealAction(
  evaluationId: string,
  evaluatorId: string,
  response: 'accepted' | 'rejected'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getAdminDb } = await import('@/firebase/admin-init');

    const evalRef = getAdminDb().collection('evaluations').doc(evaluationId);
    const evalSnap = await evalRef.get();

    if (!evalSnap.exists) {
      return { success: false, error: 'Evaluación no encontrada.' };
    }

    const evaluation = evalSnap.data() as any;

    // Verify the responder is the evaluator
    if (evaluation.evaluatorId !== evaluatorId) {
      return { success: false, error: 'No tienes permiso para responder esta solicitud.' };
    }

    // Idempotent: already processed
    if (evaluation.identityRequestStatus !== 'pending') {
      return { success: true };
    }

    if (response === 'accepted') {
      // Fetch evaluator's display info from users collection
      const userSnap = await getAdminDb().collection('users').doc(evaluatorId).get();
      const userData = userSnap.data() as any;
      const evaluatorDisplayName: string = userData?.displayName || 'Un compañero';
      const evaluatorPhotoUrl: string = userData?.photoURL || userData?.photoUrl || '';

      await evalRef.update({
        identityRequestStatus: 'accepted',
        identityRevealed: true,
        identityRevealedAt: new Date().toISOString(),
        evaluatorDisplayName,
        evaluatorPhotoUrl,
      });

      // Notify the evaluated player
      await getAdminDb()
        .collection('users')
        .doc(evaluation.playerId)
        .collection('notifications')
        .add({
          type: 'identity_reveal_requested',
          title: '✅ ¡Identidad revelada!',
          message: `${evaluatorDisplayName} aceptó revelar su identidad.`,
          link: `/players/${evaluation.playerId}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: {
            evaluationId,
            evaluatorName: evaluatorDisplayName,
          },
        });

      const { sendNotificationToUsersAction } = await import('./notification-actions');
      await sendNotificationToUsersAction({
        userIds: [evaluation.playerId],
        title: '✅ ¡Identidad revelada!',
        body: `${evaluatorDisplayName} aceptó revelar su identidad.`,
        data: { type: 'identity_reveal_requested', link: `/players/${evaluation.playerId}` },
      });
    } else {
      // rejected: silent, no notification to evaluated player
      await evalRef.update({
        identityRequestStatus: 'rejected',
        identityRejectedAt: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error responding to identity reveal:', error);
    return { success: false, error: error.message || 'Error al procesar la respuesta.' };
  }
}

/**
 * Fetches evaluations for a player, masking the evaluator ID if it hasn't been revealed.
 */
export async function getPlayerEvaluationsAction(playerId: string, requesterId?: string): Promise<{ evaluations: any[]; error?: string }> {
  try {
    const { getAdminDb } = await import('@/firebase/admin-init');
    const db = getAdminDb();

    const evalsSnap = await db.collection('evaluations')
      .where('playerId', '==', playerId)
      .orderBy('evaluatedAt', 'desc')
      .limit(20)
      .get();

    const rawEvals = evalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Masking logic
    const maskedEvals = rawEvals.map((ev: any) => {
      // If identity is already revealed, we show everything
      if (ev.identityRevealed) return ev;

      // If the requester is the evaluator themselves, they can see their own evaluation
      if (requesterId && ev.evaluatorId === requesterId) return ev;

      // If the evaluation is auto-generated or by AI, it's not private
      if (ev.autoGenerated || ev.evaluatorId === 'AI') return ev;

      // MASK: If identity is NOT revealed, we hide the evaluatorId
      const { evaluatorId, evaluatorDisplayName, evaluatorPhotoUrl, ...rest } = ev;
      return {
        ...rest,
        evaluatorId: 'anonymous', // Masked
        isAnonymous: true
      };
    });

    return { evaluations: maskedEvals };
  } catch (error: any) {
    console.error('Error fetching masked evaluations:', error);
    return { evaluations: [], error: 'Error al recuperar las evaluaciones.' };
  }
}
