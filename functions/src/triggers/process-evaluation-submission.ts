import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { submissionKey, validDocumentId, validateEvaluationSubmission } from '../lib/evaluation-submission';
import {
  analyzeAudioPerformanceCore,
  analyzeTextPerformanceCore,
  hashEvaluationInput,
  isValidEvaluationAudioPath,
  TextPerformanceResult,
} from '../lib/text-performance-analyzer';

type ResolvedAiAnalysis = TextPerformanceResult & {
  transcript?: string;
};

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

  // Pre-analiza o reutiliza caché verificado en servidor para evaluaciones 'text'
  // (escritas o por nota de voz) fuera de la transacción para no repetir llamadas
  // a Vertex AI ante retries.
  const aiAnalysisByAssignment = new Map<string, ResolvedAiAnalysis>();
  const initialSnap = await sourceRef.get();
  if (initialSnap.exists) {
    const initialData = initialSnap.data()!;
    const rawMatchId = typeof initialData.matchId === 'string' ? initialData.matchId : '';
    const rawEvaluatorId = typeof initialData.evaluatorId === 'string' ? initialData.evaluatorId : '';
    const rawSub = initialData.submission as Record<string, unknown> | undefined;
    const rawEvals = Array.isArray(rawSub?.evaluations) ? rawSub!.evaluations : [];
    const textEvals = rawEvals.filter(
      (ev: any) =>
        ev &&
        typeof ev === 'object' &&
        ev.evaluationType === 'text' &&
        validDocumentId(ev.assignmentId) &&
        validDocumentId(ev.subjectId) &&
        ((typeof ev.textDescription === 'string' && ev.textDescription.trim().length >= 10) ||
          (typeof ev.audioPath === 'string' && ev.audioPath.trim().length > 0)),
    );
    if (textEvals.length > 0 && validDocumentId(rawMatchId) && validDocumentId(rawEvaluatorId)) {
      await Promise.all(
        textEvals.map(async (ev: any) => {
          try {
            const assignmentId = String(ev.assignmentId);
            const cacheRef = db.doc(
              `matches/${rawMatchId}/assignments/${assignmentId}/private/aiAnalysis`,
            );
            const cachedSnap = await cacheRef.get();
            const cached = cachedSnap.exists ? cachedSnap.data() : undefined;

            if (typeof ev.audioPath === 'string' && ev.audioPath.trim().length > 0) {
              const audioPath = ev.audioPath.trim();
              if (!isValidEvaluationAudioPath(audioPath, rawMatchId, rawEvaluatorId)) return;

              const file = admin.storage().bucket().file(audioPath);
              const [exists] = await file.exists();
              if (!exists) return;
              const [metadata] = await file.getMetadata();
              const audioMd5 = String(metadata.md5Hash ?? metadata.generation ?? '');

              if (
                cached &&
                cached.kind === 'audio' &&
                cached.audioPath === audioPath &&
                cached.audioMd5 === audioMd5 &&
                typeof cached.transcript === 'string' &&
                Array.isArray(cached.attributeChanges) &&
                typeof cached.summary === 'string'
              ) {
                aiAnalysisByAssignment.set(assignmentId, {
                  transcript: cached.transcript,
                  summary: cached.summary,
                  confidence: Number(cached.confidence ?? 0.7),
                  attributeChanges: cached.attributeChanges,
                });
                return;
              }

              const [[audioBuffer], pSnap] = await Promise.all([
                file.download(),
                db.doc(`players/${ev.subjectId}`).get(),
              ]);
              const pData = pSnap.exists ? pSnap.data() : undefined;
              const analyzed = await analyzeAudioPerformanceCore({
                audioBuffer,
                mimeType: String(metadata.contentType || 'audio/mp4'),
                playerPosition: typeof pData?.position === 'string' ? pData.position : 'MED',
                playerName: typeof pData?.name === 'string' ? pData.name : 'Jugador',
              });
              aiAnalysisByAssignment.set(assignmentId, analyzed);
              return;
            }

            const cleanText = String(ev.textDescription).trim();
            const inputHash = hashEvaluationInput(cleanText);
            if (
              cached &&
              cached.kind === 'text' &&
              cached.inputHash === inputHash &&
              Array.isArray(cached.attributeChanges) &&
              typeof cached.summary === 'string'
            ) {
              aiAnalysisByAssignment.set(assignmentId, {
                summary: cached.summary,
                confidence: Number(cached.confidence ?? 0.7),
                attributeChanges: cached.attributeChanges,
              });
              return;
            }

            const pSnap = await db.doc(`players/${ev.subjectId}`).get();
            const pData = pSnap.exists ? pSnap.data() : undefined;
            const analyzed = await analyzeTextPerformanceCore({
              text: cleanText,
              playerPosition: typeof pData?.position === 'string' ? pData.position : 'MED',
              playerName: typeof pData?.name === 'string' ? pData.name : 'Jugador',
            });
            aiAnalysisByAssignment.set(assignmentId, analyzed);
          } catch (err) {
            console.error('Server-side text/audio evaluation analysis failed', {
              assignmentId: ev.assignmentId,
              message: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }),
      );
    }
  }

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
      if (evaluation.evaluationType === 'text') {
        const analyzed = aiAnalysisByAssignment.get(evaluation.assignmentId);
        if (evaluation.audioPath) {
          data.audioPath = evaluation.audioPath;
          if (evaluation.audioDurationSec !== undefined) {
            data.audioDurationSec = evaluation.audioDurationSec;
          }
          if (analyzed?.transcript) {
            data.textDescription = analyzed.transcript;
          }
        } else if (evaluation.textDescription) {
          data.textDescription = evaluation.textDescription;
        }
        if (analyzed) {
          data.aiAttributeChanges = analyzed.attributeChanges;
          data.aiSummary = analyzed.summary;
          data.aiConfidence = analyzed.confidence;
        }
      }
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
  memory: '512MiB',
}, async event => {
  const result = await processSubmission(admin.firestore(), event.params.submissionId);
  console.log(`[ProcessSubmission] ${result}`);
});
