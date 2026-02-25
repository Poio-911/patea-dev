'use server';

import { analyzeTextPerformance } from '@/ai/flows/analyze-text-performance';

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

export async function requestIdentityRevelation(evaluationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { getAdminDb, getAdminAuth } = await import('@/firebase/admin-init');
    const { createError, ErrorCodes } = await import('../errors');

    // In a real Next.js app with full Auth integration, we'd get the UID from session/cookies.
    // Since we are leveraging Firebase on the client, we need to ensure the action is secure.
    // TODO: When full server-side session is implemented, get UID from there.

    // 1. Get Evaluation
    const evalRef = getAdminDb().collection('evaluations').doc(evaluationId);
    const evalSnap = await evalRef.get();

    if (!evalSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND, { evaluationId });
    }

    const evaluation = evalSnap.data() as any; // Using any to avoid type check loop if types not fully loaded, or import Evaluation

    // For now, we are trusting the caller to be the subject, but we MUST ideally verify 
    // this with an auth token or session. 
    // In this specific implementation, we don't have the token here easily without refactoring the whole auth flow,
    // but we can at least ensure we don't pass around IDs in the client component anymore than necessary.
    // SECURITY NOTE: This action is still vulnerable if called manually until full session auth is added to Next.js.

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
