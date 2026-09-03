import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Callables de Evaluaciones — port de src/lib/actions/evaluation-actions.ts.
 * `evaluationSubmissions`, `evaluations` y `matches/{id}/assignments` bloquean
 * toda escritura de cliente en firestore.rules a propósito (comentario en la
 * regla: "Las evaluaciones las crea el servidor (Admin SDK)").
 *
 * El procesamiento real de una submission (crear `evaluations/`, actualizar
 * assignments a 'completed', selfEvaluation, mover a processedSubmissions)
 * ya lo hace el trigger `processEvaluationSubmission`
 * (functions/src/triggers/process-evaluation-submission.ts, ya desplegado) —
 * este callable solo necesita escribir el documento en `evaluationSubmissions`,
 * igual que `submitEvaluationSubmissionAction` en la web.
 */

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

// --- Player progression logic — port 1:1 de server-actions.ts (líneas ~34-155). ---
// No "simplificar" estos números: son los mismos que ya rigen la progresión
// de OVR en la web, cambiarlos desincroniza el progreso entre plataformas.
const OVR_PROGRESSION = {
  BASELINE_RATING: 5,
  MAX_STEP: 1.5,
  MIN_OVR: 40,
  MAX_OVR: 99,
  MIN_ATTRIBUTE: 20,
  MAX_ATTRIBUTE: 99,
};

type Attr = 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
const ATTRS: Attr[] = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];

function calculateOvrChange(currentOvr: number, avgRating: number): number {
  if (avgRating === OVR_PROGRESSION.BASELINE_RATING) return 0;
  const ratingDelta = avgRating - OVR_PROGRESSION.BASELINE_RATING;
  let scale = 0.3;
  if (currentOvr < 50) scale = 0.5;
  else if (currentOvr < 60) scale = 0.4;
  else if (currentOvr < 70) scale = 0.3;
  else if (currentOvr < 80) scale = 0.2;
  else if (currentOvr < 90) scale = 0.1;
  else scale = 0.05;
  const rawDelta = ratingDelta * scale;
  return Math.max(-OVR_PROGRESSION.MAX_STEP, Math.min(OVR_PROGRESSION.MAX_STEP, rawDelta));
}

const POSITION_WEIGHTS: Record<string, Record<Attr, number>> = {
  DEL: { pac: 0.25, sho: 0.35, pas: 0.15, dri: 0.15, def: 0.05, phy: 0.05 },
  MED: { pac: 0.15, sho: 0.15, pas: 0.3, dri: 0.2, def: 0.1, phy: 0.1 },
  DEF: { pac: 0.15, sho: 0.05, pas: 0.15, dri: 0.05, def: 0.4, phy: 0.2 },
  POR: { pac: 0.1, sho: 0.05, pas: 0.1, dri: 0.05, def: 0.5, phy: 0.2 },
};
const DEFAULT_WEIGHTS: Record<Attr, number> = { pac: 0.166, sho: 0.166, pas: 0.166, dri: 0.166, def: 0.166, phy: 0.166 };

function attributeMultiplier(currentVal: number): number {
  if (currentVal >= 92) return 0.1;
  if (currentVal >= 85) return 0.2;
  if (currentVal >= 75) return 0.4;
  if (currentVal >= 60) return 0.7;
  return 1.0;
}

function clampAttr(v: number): number {
  return Math.max(OVR_PROGRESSION.MIN_ATTRIBUTE, Math.min(OVR_PROGRESSION.MAX_ATTRIBUTE, v));
}

function calculateAttributeChangesFromPoints(
  currentAttrs: Record<Attr, number>,
  ovrChange: number,
  position: string
): Record<Attr, number> {
  if (ovrChange === 0) return currentAttrs;
  const newAttributes = { ...currentAttrs };
  const weights = POSITION_WEIGHTS[position] || DEFAULT_WEIGHTS;
  const totalPointsToAdd = ovrChange * 6;
  let accumulatedError = 0;

  for (const attr of ATTRS) {
    const currentVal = newAttributes[attr];
    const targetShare = totalPointsToAdd * weights[attr];
    const multiplier = attributeMultiplier(currentVal);
    const effectiveShare = targetShare > 0 ? targetShare * multiplier : targetShare;
    const pointWithDecimal = effectiveShare + accumulatedError;
    const pointRounded = effectiveShare > 0 ? Math.ceil(pointWithDecimal) : Math.floor(pointWithDecimal);
    accumulatedError = pointWithDecimal - pointRounded;
    newAttributes[attr] = clampAttr(currentVal + pointRounded);
  }
  return newAttributes;
}

function calculateAttributeChangesFromTags(
  currentAttrs: Record<Attr, number>,
  tags: Array<{ effects?: Array<{ attribute: string; change: number }> }>
): Record<Attr, number> {
  const newAttributes = { ...currentAttrs };
  for (const tag of tags || []) {
    for (const effect of tag.effects || []) {
      const key = effect.attribute as Attr;
      if (typeof newAttributes[key] !== 'number') continue;
      const currentVal = newAttributes[key];
      const rawChange = effect.change * attributeMultiplier(currentVal);
      const integerChange = rawChange > 0 ? Math.ceil(rawChange) : Math.floor(rawChange);
      newAttributes[key] = clampAttr(currentVal + integerChange);
    }
  }
  // Cap net delta per attribute to ±5
  const NET_CAP = 5;
  for (const attr of ATTRS) {
    const delta = newAttributes[attr] - currentAttrs[attr];
    if (Math.abs(delta) > NET_CAP) {
      newAttributes[attr] = currentAttrs[attr] + (delta > 0 ? NET_CAP : -NET_CAP);
    }
  }
  return newAttributes;
}

function calculateAttributeChangesFromAI(
  currentAttrs: Record<Attr, number>,
  aiChanges: Array<{ attribute: string; change: number }>
): Record<Attr, number> {
  const newAttributes = { ...currentAttrs };
  for (const change of aiChanges || []) {
    const key = change.attribute as Attr;
    if (typeof newAttributes[key] !== 'number') continue;
    const currentVal = newAttributes[key];
    const rawChange = change.change * attributeMultiplier(currentVal);
    const integerChange = rawChange > 0 ? Math.ceil(rawChange) : Math.floor(rawChange);
    newAttributes[key] = clampAttr(currentVal + integerChange);
  }
  return newAttributes;
}

/**
 * Port de finalizeMatchEvaluationAction (server-actions.ts ~L4221-4502).
 * Deliberadamente NO portado (dominios fuera de este barrido, ver plan):
 * standings de liga/copa (`updateLeagueStandingsAction`/`advanceCupWinnerAction`,
 * Sección 6), crónica IA del partido, achievements/gamification, y la
 * publicación de actividad social (`publishOvrChangeActivity`, Sección 9).
 * El núcleo — la única parte que de verdad hace progresar el OVR — sí está
 * completo y sin recortes.
 */
export const finalizeMatchEvaluation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  if (!matchId) throw new HttpsError('invalid-argument', 'Partido no válido.');

  const db = admin.firestore();
  const matchRef = db.doc(`matches/${matchId}`);
  const assignmentsCol = db.collection(`matches/${matchId}/assignments`);

  const matchSnapCheck = await matchRef.get();
  if (!matchSnapCheck.exists) throw new HttpsError('not-found', 'Partido no encontrado.');
  if (matchSnapCheck.data()!.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Solo el organizador puede finalizar la evaluación.');
  }

  const assignmentsSnapshot = await assignmentsCol.get();
  const assignments = assignmentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
  const completedAssignmentIds = assignments.filter((a) => a.status === 'completed').map((a) => a.id);
  if (completedAssignmentIds.length === 0) {
    throw new HttpsError('failed-precondition', 'No hay evaluaciones completadas para procesar.');
  }

  const playerOvrChanges = new Map<string, { oldOvr: number; newOvr: number }>();

  await db.runTransaction(async (transaction) => {
    const matchDoc = await transaction.get(matchRef);
    if (!matchDoc.exists || matchDoc.data()?.status === 'evaluated') {
      throw new HttpsError('failed-precondition', 'Este partido ya fue evaluado o no existe.');
    }
    const match = matchDoc.data()!;

    const pendingSubmissionsSnap = await transaction.get(
      db.collection('evaluationSubmissions').where('matchId', '==', matchId)
    );
    if (!pendingSubmissionsSnap.empty) {
      throw new HttpsError(
        'failed-precondition',
        `Aún hay ${pendingSubmissionsSnap.size} evaluaciones pendientes de procesar. Esperá un momento y reintentá.`
      );
    }

    const peerEvalsSnap = await transaction.get(db.collection('evaluations').where('matchId', '==', matchId));
    const matchPeerEvals = peerEvalsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as any)
      .filter((ev) => completedAssignmentIds.includes(ev.assignmentId));

    const selfEvalsSnap = await transaction.get(db.collection(`matches/${matchId}/selfEvaluations`));
    const matchSelfEvals = selfEvalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
    const selfEvalsByPlayerId = new Map<string, any>(matchSelfEvals.map((ev) => [ev.playerId, ev]));

    const mvpVoteCount = new Map<string, number>();
    for (const ev of matchSelfEvals) {
      if (ev.mvpVote) mvpVoteCount.set(ev.mvpVote, (mvpVoteCount.get(ev.mvpVote) || 0) + 1);
    }
    let matchMvpId: string | null = null;
    let maxMatchVotes = 0;
    for (const [pid, count] of mvpVoteCount) {
      if (count > maxMatchVotes) {
        maxMatchVotes = count;
        matchMvpId = pid;
      }
    }

    const peerEvalsByPlayer: Record<string, any[]> = {};
    for (const ev of matchPeerEvals) {
      (peerEvalsByPlayer[ev.playerId] ||= []).push(ev);
    }

    const allCompletedPointEvals = matchPeerEvals.filter((ev) => ev.rating !== undefined && ev.rating !== null);
    const matchAvgRating =
      allCompletedPointEvals.length > 0
        ? allCompletedPointEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0) / allCompletedPointEvals.length
        : 5;

    const pendingAssignments = assignments.filter((a) => a.status === 'pending');
    for (const assignment of pendingAssignments) {
      const synthEvalRef = db.collection('evaluations').doc();
      const synthEval = {
        assignmentId: assignment.id,
        playerId: assignment.subjectId,
        evaluatorId: assignment.evaluatorId,
        matchId,
        rating: Math.round(matchAvgRating * 10) / 10,
        goals: 0,
        evaluatedAt: new Date().toISOString(),
        autoGenerated: true,
      };
      transaction.set(synthEvalRef, synthEval);
      transaction.update(db.doc(`matches/${matchId}/assignments/${assignment.id}`), {
        status: 'completed',
        autoCompleted: true,
        evaluationId: synthEvalRef.id,
      });
      (peerEvalsByPlayer[assignment.subjectId] ||= []).push({ ...synthEval, id: synthEvalRef.id });
    }

    let team1CalculatedScore = 0;
    let team2CalculatedScore = 0;

    const playerIdsToUpdate: string[] = match.playerUids || [];
    if (playerIdsToUpdate.length === 0) {
      transaction.update(matchRef, { status: 'evaluated', finalizedAt: new Date().toISOString() });
      return;
    }

    const playerRefs = playerIdsToUpdate.map((id) => db.collection('players').doc(id));
    const playerDocsSnaps = await db.getAll(...playerRefs);
    const playerDocsMap = new Map<string, any>();
    playerDocsSnaps.forEach((d) => {
      if (d.exists) playerDocsMap.set(d.id, { id: d.id, ...d.data() });
    });

    for (const playerId of playerIdsToUpdate) {
      const player = playerDocsMap.get(playerId);
      if (!player) continue;

      const playerPeerEvals = peerEvalsByPlayer[playerId] || [];
      const pointBasedEvals = playerPeerEvals.filter((ev) => ev.rating !== undefined && ev.rating !== null);
      const tagBasedEvals = playerPeerEvals.filter((ev) => ev.performanceTags && ev.performanceTags.length > 0);
      const textBasedEvals = playerPeerEvals.filter((ev) => ev.aiAttributeChanges && ev.aiAttributeChanges.length > 0);

      let updatedAttributes: Record<Attr, number> = {
        pac: player.pac,
        sho: player.sho,
        pas: player.pas,
        dri: player.dri,
        def: player.def,
        phy: player.phy,
      };
      let ovrChangeFromPoints = 0;

      if (tagBasedEvals.length > 0) {
        const combinedTags = tagBasedEvals.flatMap((ev) => ev.performanceTags || []);
        updatedAttributes = calculateAttributeChangesFromTags(updatedAttributes, combinedTags);
      }
      if (textBasedEvals.length > 0) {
        const allAiChanges = textBasedEvals.flatMap((ev) => ev.aiAttributeChanges || []);
        updatedAttributes = calculateAttributeChangesFromAI(updatedAttributes, allAiChanges);
      }

      const playerSelfEval = selfEvalsByPlayerId.get(playerId);
      const goalsInMatch = playerSelfEval?.goals || 0;
      const assistsInMatch = playerSelfEval?.assists || 0;
      let avgRating = 5;

      if (pointBasedEvals.length > 0) {
        const totalRating = pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0);
        avgRating = totalRating / pointBasedEvals.length;
        ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
      } else {
        if (goalsInMatch >= 2 || assistsInMatch >= 2 || goalsInMatch + assistsInMatch >= 3) avgRating = 8;
        else if (goalsInMatch === 1 || assistsInMatch === 1) avgRating = 7;
        else avgRating = 5;
        ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
      }

      if (ovrChangeFromPoints !== 0) {
        updatedAttributes = calculateAttributeChangesFromPoints(updatedAttributes, ovrChangeFromPoints, player.position || 'MED');
      }

      let newOvr = Math.round(
        (updatedAttributes.pac + updatedAttributes.sho + updatedAttributes.pas + updatedAttributes.dri + updatedAttributes.def + updatedAttributes.phy) / 6
      );
      newOvr = Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.MAX_OVR, newOvr));

      const newMatchesPlayed = (player.stats?.matchesPlayed || 0) + 1;
      const newTotalGoals = (player.stats?.goals || 0) + goalsInMatch;
      const newTotalAssists = (player.stats?.assists || 0) + assistsInMatch;

      const isInTeam1 = match.teams?.[0]?.players?.some((p: any) => p.uid === playerId);
      const isInTeam2 = match.teams?.[1]?.players?.some((p: any) => p.uid === playerId);
      if (isInTeam1) team1CalculatedScore += goalsInMatch;
      else if (isInTeam2) team2CalculatedScore += goalsInMatch;

      const newAvgRating = ((player.stats?.averageRating || 0) * (player.stats?.matchesPlayed || 0) + avgRating) / newMatchesPlayed;

      transaction.update(db.doc(`players/${playerId}`), {
        ...updatedAttributes,
        ovr: newOvr,
        stats: {
          matchesPlayed: newMatchesPlayed,
          goals: newTotalGoals,
          assists: newTotalAssists,
          averageRating: newAvgRating,
          mvpVotes: (player.stats?.mvpVotes || 0) + (playerId === matchMvpId ? 1 : 0),
        },
      });

      const attributeDeltas: Record<Attr, number> = {
        pac: updatedAttributes.pac - player.pac,
        sho: updatedAttributes.sho - player.sho,
        pas: updatedAttributes.pas - player.pas,
        dri: updatedAttributes.dri - player.dri,
        def: updatedAttributes.def - player.def,
        phy: updatedAttributes.phy - player.phy,
      };

      transaction.set(db.collection(`players/${playerId}/ovrHistory`).doc(), {
        date: new Date().toISOString(),
        oldOVR: player.ovr,
        newOVR: newOvr,
        change: newOvr - player.ovr,
        matchId,
        attributeChanges: attributeDeltas,
      });

      playerOvrChanges.set(playerId, { oldOvr: player.ovr, newOvr });
    }

    transaction.update(matchRef, {
      status: 'evaluated',
      finalScore: { team1: team1CalculatedScore, team2: team2CalculatedScore },
      finalizedAt: new Date().toISOString(),
    });
  });

  return { ok: true, playersUpdated: playerOvrChanges.size };
});

/** Port de submitEvaluationSubmissionAction. */
export const submitEvaluationSubmission = onCall({ region: 'us-central1' }, async (request) => {
  const evaluatorId = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const submission = request.data?.submission;

  if (!matchId) throw new HttpsError('invalid-argument', 'Partido no válido.');
  if (!submission || typeof submission !== 'object') {
    throw new HttpsError('invalid-argument', 'Datos de evaluación inválidos.');
  }

  const db = admin.firestore();

  const existing = await db
    .collection('evaluationSubmissions')
    .where('matchId', '==', matchId)
    .where('evaluatorId', '==', evaluatorId)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { ok: true, alreadySubmitted: true };
  }

  await db.collection('evaluationSubmissions').add({
    evaluatorId,
    matchId,
    submittedAt: new Date().toISOString(),
    submission,
  });

  return { ok: true, alreadySubmitted: false };
});

/** Port de respondToIdentityRevealAction. Sin el envío push (FCM), ver header. */
export const respondToIdentityReveal = onCall({ region: 'us-central1' }, async (request) => {
  const evaluatorId = requireAuth(request);
  const evaluationId = String(request.data?.evaluationId ?? '');
  const response = request.data?.response;
  if (response !== 'accepted' && response !== 'rejected') {
    throw new HttpsError('invalid-argument', 'Respuesta inválida.');
  }

  const db = admin.firestore();
  const evalRef = db.collection('evaluations').doc(evaluationId);
  const evalSnap = await evalRef.get();
  if (!evalSnap.exists) throw new HttpsError('not-found', 'Evaluación no encontrada.');
  const evaluation = evalSnap.data()!;

  if (evaluation.evaluatorId !== evaluatorId) {
    throw new HttpsError('permission-denied', 'No tienes permiso para responder esta solicitud.');
  }
  if (evaluation.identityRequestStatus !== 'pending') {
    return { ok: true };
  }

  if (response === 'accepted') {
    const userSnap = await db.collection('users').doc(evaluatorId).get();
    const userData = userSnap.data() ?? {};
    const evaluatorDisplayName = (userData.displayName as string) || 'Un compañero';
    const evaluatorPhotoUrl = (userData.photoURL as string) || (userData.photoUrl as string) || '';

    await evalRef.update({
      identityRequestStatus: 'accepted',
      identityRevealed: true,
      identityRevealedAt: new Date().toISOString(),
      evaluatorDisplayName,
      evaluatorPhotoUrl,
    });

    await db.collection('users').doc(evaluation.playerId).collection('notifications').add({
      type: 'identity_reveal_requested',
      title: '✅ ¡Identidad revelada!',
      message: `${evaluatorDisplayName} aceptó revelar su identidad.`,
      link: `/players/${evaluation.playerId}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: { evaluationId, evaluatorName: evaluatorDisplayName },
    });
  } else {
    await evalRef.update({
      identityRequestStatus: 'rejected',
      identityRejectedAt: new Date().toISOString(),
    });
  }

  return { ok: true };
});
