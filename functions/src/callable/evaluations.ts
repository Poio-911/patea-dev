import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { submissionKey, validateEvaluationSubmission } from '../lib/evaluation-submission';
import { sendPushToUsers } from '../lib/fcm-push';
import {
  computeMatchProgression,
  equivalentRatingFromVector,
  vectorForPeerEvaluation,
} from '../lib/ovr-progression';

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

/**
 * Finaliza la evaluación del partido y actualiza OVR + atributos mediante el
 * motor unificado (`lib/ovr-progression.ts`), donde Nota, Etiquetas, Reseña
 * escrita y Nota de voz tienen exactamente el mismo peso y se promedian entre
 * evaluadores, más un micro-bono uniforme por goles/asistencias.
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

  const playerOvrChanges = new Map<string, { oldOvr: number; newOvr: number }>();

  await db.runTransaction(async (transaction) => {
    const matchDoc = await transaction.get(matchRef);
    if (!matchDoc.exists || matchDoc.data()?.status === 'evaluated') {
      throw new HttpsError('failed-precondition', 'Este partido ya fue evaluado o no existe.');
    }
    const match = matchDoc.data()!;
    if (match.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Solo el organizador puede finalizar la evaluación.');
    }
    if (match.status !== 'completed') {
      throw new HttpsError('failed-precondition', 'El partido aún no terminó.');
    }
    // El callback puede reintentarse: todas las lecturas y el resultado
    // devuelto pertenecen al intento que finalmente confirma Firestore.
    playerOvrChanges.clear();
    const assignmentsSnapshot = await transaction.get(assignmentsCol);
    const assignments = assignmentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
    const completedAssignmentIds = assignments.filter((a) => a.status === 'completed').map((a) => a.id);
    if (completedAssignmentIds.length === 0) {
      throw new HttpsError('failed-precondition', 'No hay evaluaciones completadas para procesar.');
    }

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

    const playerIdsToUpdate: string[] = [...new Set<string>(match.playerUids || [])];
    const playerRefs = playerIdsToUpdate.map((id) => db.collection('players').doc(id));
    // Leer jugadores DENTRO de la transacción y antes de cualquier escritura:
    // dos partidos del mismo jugador no pueden pisar su progresión.
    const playerDocsSnaps = playerRefs.length ? await transaction.getAll(...playerRefs) : [];
    const playerDocsMap = new Map<string, any>();
    playerDocsSnaps.forEach((d) => {
      if (d.exists) playerDocsMap.set(d.id, { id: d.id, ...d.data() });
    });

    const completedEquivalentRatings: number[] = [];
    for (const ev of matchPeerEvals) {
      const subjectPosition = playerDocsMap.get(ev.playerId)?.position || 'MED';
      const vec = vectorForPeerEvaluation(ev, subjectPosition);
      if (vec) completedEquivalentRatings.push(equivalentRatingFromVector(vec));
    }
    const matchAvgRating =
      completedEquivalentRatings.length > 0
        ? completedEquivalentRatings.reduce((sum, r) => sum + r, 0) / completedEquivalentRatings.length
        : 5;

    const pendingAssignments = assignments.filter((a) => a.status === 'pending');
    for (const assignment of pendingAssignments) {
      const synthEvalRef = db.collection('evaluations').doc();
      const synthEval = {
        assignmentId: assignment.id,
        playerId: assignment.subjectId,
        evaluatorId: 'AI',
        matchId,
        rating: Math.round(matchAvgRating * 10) / 10,
        goals: 0,
        evaluatedAt: new Date().toISOString(),
        autoGenerated: true,
      };
      transaction.set(synthEvalRef, synthEval);
      const assignmentRef = db.doc(`matches/${matchId}/assignments/${assignment.id}`);
      transaction.set(db.doc(`${assignmentRef.path}/private/evaluation`), {
        evaluationId: synthEvalRef.id,
        boundAt: new Date().toISOString(),
      });
      transaction.update(assignmentRef, {
        status: 'completed',
        autoCompleted: true,
        evaluationId: admin.firestore.FieldValue.delete(),
      });
      (peerEvalsByPlayer[assignment.subjectId] ||= []).push({ ...synthEval, id: synthEvalRef.id });
    }

    let team1CalculatedScore = 0;
    let team2CalculatedScore = 0;

    if (playerIdsToUpdate.length === 0) {
      transaction.update(matchRef, { status: 'evaluated', finalizedAt: new Date().toISOString() });
      return;
    }

    for (const playerId of playerIdsToUpdate) {
      const player = playerDocsMap.get(playerId);
      if (!player) continue;

      const playerPeerEvals = peerEvalsByPlayer[playerId] || [];
      const playerSelfEval = selfEvalsByPlayerId.get(playerId);
      const goalsInMatch = playerSelfEval?.goals || 0;
      const assistsInMatch = playerSelfEval?.assists || 0;

      const progression = computeMatchProgression({
        currentAttrs: {
          pac: player.pac,
          sho: player.sho,
          pas: player.pas,
          dri: player.dri,
          def: player.def,
          phy: player.phy,
        },
        currentOvr: player.ovr,
        position: player.position || 'MED',
        peerEvaluations: playerPeerEvals,
        goals: goalsInMatch,
        assists: assistsInMatch,
      });

      const updatedAttributes = progression.updatedAttributes;
      const attributeDeltas = progression.attributeDeltas;
      const newOvr = progression.newOvr;
      const avgRating = progression.equivalentRating;

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
        'stats.matchesPlayed': newMatchesPlayed,
        'stats.goals': newTotalGoals,
        'stats.assists': newTotalAssists,
        'stats.averageRating': newAvgRating,
        'stats.mvpCount': (player.stats?.mvpCount || 0) + (playerId === matchMvpId ? 1 : 0),
      });

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
      finalScore: match.finalScore ?? (
        match.teams?.length >= 2 && match.teams.every((team: any) => Number.isInteger(team.score) && team.score >= 0)
          ? { team1: match.teams[0].score, team2: match.teams[1].score }
          : { team1: team1CalculatedScore, team2: team2CalculatedScore }
      ),
      finalizedAt: new Date().toISOString(),
      // El más votado del partido. Se calculaba más arriba para sumarle el
      // voto al jugador y después se perdía; sin esto no hay forma de saber
      // quién fue la figura sin releer todas las autoevaluaciones.
      ...(matchMvpId ? { bestPlayerId: matchMvpId } : {}),
    });
  });

  return { ok: true, playersUpdated: playerOvrChanges.size };
});

/** Port de submitEvaluationSubmissionAction. */
export const submitEvaluationSubmission = onCall({ region: 'us-central1' }, async (request) => {
  const evaluatorId = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const submission = request.data?.submission;

  if (!matchId || matchId.includes('/')) throw new HttpsError('invalid-argument', 'Partido no válido.');
  if (!submission || typeof submission !== 'object') {
    throw new HttpsError('invalid-argument', 'Datos de evaluación inválidos.');
  }

  const db = admin.firestore();

  const key = submissionKey(matchId, evaluatorId);
  const pendingRef = db.collection('evaluationSubmissions').doc(key);
  const processedRef = db.doc(`matches/${matchId}/processedSubmissions/${key}`);
  const alreadySubmitted = await db.runTransaction(async (transaction) => {
    const existing = await transaction.getAll(pendingRef, processedRef);
    if (existing.some((doc) => doc.exists)) return true;
    // También cubre envíos antiguos de la web que tenían un ID aleatorio.
    const legacy = await transaction.get(
      db.collection(`matches/${matchId}/processedSubmissions`).where('evaluatorId', '==', evaluatorId).limit(1)
    );
    if (!legacy.empty) return true;
    const normalized = await validateEvaluationSubmission(db, transaction, matchId, evaluatorId, submission);
    transaction.create(pendingRef, {
      evaluatorId,
      matchId,
      submittedAt: new Date().toISOString(),
      submission: normalized,
    });
    return false;
  });

  return { ok: true, alreadySubmitted };
});

/** Port de respondToIdentityRevealAction con envío push (FCM). */
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

    const hasAudio = typeof evaluation.audioPath === 'string' && evaluation.audioPath.trim().length > 0;
    const body = hasAudio
      ? `${evaluatorDisplayName} aceptó revelar su identidad. Ya podés escuchar su nota de voz.`
      : `${evaluatorDisplayName} aceptó revelar su identidad.`;
    await db.collection('users').doc(evaluation.playerId).collection('notifications').add({
      type: 'identity_reveal_requested',
      title: '✅ ¡Identidad revelada!',
      message: body,
      link: `/players/${evaluation.playerId}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: { evaluationId, evaluatorName: evaluatorDisplayName, hasAudio },
    });

    await sendPushToUsers(
      [String(evaluation.playerId)],
      {
        title: '✅ ¡Identidad revelada!',
        body,
        type: 'identity_reveal_requested',
        link: `/players/${evaluation.playerId}`,
        extraData: { evaluationId },
      },
      'RespondIdentityReveal',
    );
  } else {
    await evalRef.update({
      identityRequestStatus: 'rejected',
      identityRejectedAt: new Date().toISOString(),
    });
  }

  return { ok: true };
});

/**
 * Permite al jugador evaluado pedir conocer quién dejó una evaluación anónima.
 * Si la evaluación fue una nota de voz, avisa al evaluador que al aceptar
 * también se habilita escuchar su audio.
 */
export const requestIdentityReveal = onCall({ region: 'us-central1' }, async (request) => {
  const requesterId = requireAuth(request);
  const evaluationId = String(request.data?.evaluationId ?? '').trim();
  if (!evaluationId || evaluationId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Evaluación no válida.');
  }

  const db = admin.firestore();
  const evalRef = db.collection('evaluations').doc(evaluationId);
  const evalSnap = await evalRef.get();
  if (!evalSnap.exists) throw new HttpsError('not-found', 'Evaluación no encontrada.');
  const evaluation = evalSnap.data()!;

  if (evaluation.playerId !== requesterId) {
    throw new HttpsError('permission-denied', 'Sólo podés pedir revelar tus propias evaluaciones.');
  }
  if (evaluation.autoGenerated === true || !evaluation.evaluatorId || evaluation.evaluatorId === 'AI') {
    throw new HttpsError('failed-precondition', 'Esta evaluación fue automática y no tiene autor.');
  }
  if (evaluation.identityRevealed === true || evaluation.identityRequestStatus === 'accepted') {
    return { ok: true, status: 'accepted' };
  }
  if (evaluation.identityRequestStatus === 'pending') {
    return { ok: true, status: 'pending' };
  }

  const [playerSnap, matchSnap] = await Promise.all([
    db.collection('players').doc(requesterId).get(),
    evaluation.matchId ? db.collection('matches').doc(String(evaluation.matchId)).get() : Promise.resolve(null),
  ]);
  const playerName = (playerSnap.data()?.name as string) || 'Un compañero';
  const matchTitle = (matchSnap?.data()?.title as string) || 'un partido';
  const hasAudio = typeof evaluation.audioPath === 'string' && evaluation.audioPath.trim().length > 0;

  await evalRef.update({
    identityRequestStatus: 'pending',
    identityRequestedAt: new Date().toISOString(),
  });

  const body = hasAudio
    ? `${playerName} quiere saber quién lo evaluó en ${matchTitle}. Si aceptás, va a ver tu nombre y poder escuchar tu nota de voz.`
    : `${playerName} quiere saber quién lo evaluó en ${matchTitle}.`;

  await db.collection('users').doc(String(evaluation.evaluatorId)).collection('notifications').add({
    type: 'identity_reveal_requested',
    title: 'Solicitud de identidad',
    message: body,
    link: '/evaluations',
    isRead: false,
    createdAt: new Date().toISOString(),
    metadata: { evaluationId, fromPlayerId: requesterId, hasAudio },
  });

  await sendPushToUsers(
    [String(evaluation.evaluatorId)],
    {
      title: 'Solicitud de identidad',
      body,
      type: 'identity_reveal_requested',
      link: '/evaluations',
      extraData: { evaluationId },
    },
    'RequestIdentityReveal',
  );

  return { ok: true, status: 'pending' };
});

/**
 * Entrega el audio de una evaluación en base64 únicamente cuando el autor
 * aceptó revelar su identidad (`identityRevealed === true`) o si lo pide el
 * propio evaluador. Así nunca se expone una URL pública en Storage.
 */
export const getEvaluationAudio = onCall({ region: 'us-central1', timeoutSeconds: 30 }, async (request) => {
  const uid = requireAuth(request);
  const evaluationId = String(request.data?.evaluationId ?? '').trim();
  if (!evaluationId || evaluationId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Evaluación no válida.');
  }

  const db = admin.firestore();
  const evalSnap = await db.collection('evaluations').doc(evaluationId).get();
  if (!evalSnap.exists) throw new HttpsError('not-found', 'Evaluación no encontrada.');
  const evaluation = evalSnap.data()!;

  const audioPath = typeof evaluation.audioPath === 'string' ? evaluation.audioPath.trim() : '';
  if (!audioPath) {
    throw new HttpsError('not-found', 'Esta evaluación no tiene nota de voz.');
  }

  const isAuthor = evaluation.evaluatorId === uid;
  const isRevealed = evaluation.identityRevealed === true;
  if (!isAuthor && !isRevealed) {
    throw new HttpsError(
      'permission-denied',
      'El audio permanece privado hasta que el evaluador acepte revelar su identidad.',
    );
  }

  const file = admin.storage().bucket().file(audioPath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError('not-found', 'El archivo de audio ya no está disponible.');
  }
  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  if (buffer.length > 2.5 * 1024 * 1024) {
    throw new HttpsError('failed-precondition', 'El audio excede el tamaño admitido.');
  }

  return {
    ok: true,
    audioBase64: buffer.toString('base64'),
    mimeType: String(metadata.contentType || 'audio/mp4'),
    durationSec: typeof evaluation.audioDurationSec === 'number' ? evaluation.audioDurationSec : null,
  };
});
