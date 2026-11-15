import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { submissionKey, validDocumentId, validateEvaluationSubmission } from '../lib/evaluation-submission';

/**
 * Lee nuevamente el documento dentro de la transacción: el evento puede llegar
 * más de una vez o cuando otro procesador ya consumió la submission. El marcador
 * estable por partido/evaluador también cubre documentos con IDs legados al azar.
 */
export async function processSubmission(
  db: admin.firestore.Firestore,
  submissionId: string,
): Promise<'processed' | 'duplicate' | 'missing' | 'rejected'> {
  if (!validDocumentId(submissionId)) return 'rejected';
  const sourceRef = db.doc(`evaluationSubmissions/${submissionId}`);
  return db.runTransaction(async transaction => {
    const sourceSnap = await transaction.get(sourceRef);
    if (!sourceSnap.exists) return 'missing';
    const source = sourceSnap.data()!;
    const { matchId, evaluatorId } = source;
    if (!validDocumentId(matchId) || !validDocumentId(evaluatorId)) {
      transaction.delete(sourceRef);
      return 'rejected';
    }

    const key = submissionKey(matchId, evaluatorId);
    const processedRef = db.doc(`matches/${matchId}/processedSubmissions/${key}`);
    const processedSnap = await transaction.get(processedRef);
    const legacyProcessed = await transaction.get(
      db.collection(`matches/${matchId}/processedSubmissions`)
        .where('evaluatorId', '==', evaluatorId).limit(1),
    );
    if (processedSnap.exists || !legacyProcessed.empty) {
      transaction.delete(sourceRef);
      return 'duplicate';
    }

    let form;
    try {
      form = await validateEvaluationSubmission(db, transaction, matchId, evaluatorId, source.submission);
    } catch (error) {
      if (!(error instanceof HttpsError)) throw error;
      // Datos inválidos no mejoran reintentando. El error queda sólo para su
      // autor, sin copiar la submission ni registrar testimonios en los logs.
      transaction.set(db.doc(`users/${evaluatorId}/evaluationSubmissionErrors/${submissionId}`), {
        matchId,
        code: error.code,
        message: error.message,
        processingStatus: 'rejected',
        processedAt: new Date().toISOString(),
      });
      transaction.delete(sourceRef);
      return 'rejected';
    }

    // Hasta aquí sólo lecturas. Todas las escrituras se confirman juntas.
    const reportedAt = typeof source.submittedAt === 'string'
      ? source.submittedAt : new Date().toISOString();
    const selfEvaluation: Record<string, unknown> = {
      playerId: evaluatorId,
      matchId,
      goals: form.evaluatorGoals,
      assists: form.evaluatorAssists,
      reportedAt,
    };
    if (form.personalChronicle) selfEvaluation.personalChronicle = form.personalChronicle;
    if (form.mvpVote) selfEvaluation.mvpVote = form.mvpVote;
    transaction.set(db.doc(`matches/${matchId}/selfEvaluations/${evaluatorId}`), selfEvaluation);

    if (form.mvpVote) {
      transaction.update(db.doc(`players/${form.mvpVote}`), {
        'stats.mvpVotes': admin.firestore.FieldValue.increment(1),
      });
    }

    for (const evaluation of form.evaluations) {
      // The public assignment is visible to the organizer. Its ID must not
      // predict the ID returned by the anonymous player-history endpoint.
      // The transactional processing marker provides idempotency independently.
      const evaluationRef = db.collection('evaluations').doc();
      const data: Record<string, unknown> = {
        assignmentId: evaluation.assignmentId,
        playerId: evaluation.subjectId,
        evaluatorId,
        matchId,
        goals: 0,
        evaluatedAt: reportedAt,
      };
      if (evaluation.evaluationType === 'points') data.rating = evaluation.rating;
      if (evaluation.evaluationType === 'tags') data.performanceTags = evaluation.performanceTags;
      if (evaluation.evaluationType === 'text') data.textDescription = evaluation.textDescription;
      transaction.set(evaluationRef, data);
      const assignmentRef = db.doc(`matches/${matchId}/assignments/${evaluation.assignmentId}`);
      transaction.set(db.doc(`${assignmentRef.path}/private/evaluation`), {
        evaluationId: evaluationRef.id,
        boundAt: new Date().toISOString(),
      });
      transaction.update(assignmentRef, {
        status: 'completed',
        evaluationId: admin.firestore.FieldValue.delete(),
      });
    }

    transaction.set(processedRef, {
      evaluatorId,
      matchId,
      submission: form,
      submittedAt: reportedAt,
      processedAt: new Date().toISOString(),
      originalSubmissionId: submissionId,
      processingStatus: 'completed',
      processedBy: 'cloud-function',
    });
    transaction.delete(sourceRef);
    return 'processed';
  });
}

export const processEvaluationSubmission = onDocumentCreated({
  document: 'evaluationSubmissions/{submissionId}',
  region: 'us-central1',
  retry: true,
}, async event => {
  const result = await processSubmission(admin.firestore(), event.params.submissionId);
  console.log(`[ProcessSubmission] ${result}`);
});
