import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { validDocumentId } from '../lib/evaluation-submission';
import {
  analyzeAudioPerformanceCore,
  analyzeTextPerformanceCore,
  hashEvaluationInput,
  isValidEvaluationAudioPath,
  TextPerformanceResult,
} from '../lib/text-performance-analyzer';

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

async function verifyPendingAssignment(
  db: admin.firestore.Firestore,
  matchId: string,
  assignmentId: string,
  evaluatorId: string,
): Promise<FirebaseFirestore.DocumentData> {
  if (!validDocumentId(matchId) || !validDocumentId(assignmentId)) {
    throw new HttpsError('invalid-argument', 'Partido o asignación no válidos.');
  }
  const snap = await db.doc(`matches/${matchId}/assignments/${assignmentId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Asignación no encontrada.');
  }
  const data = snap.data()!;
  if (data.evaluatorId !== evaluatorId || data.matchId !== matchId) {
    throw new HttpsError('permission-denied', 'Esta asignación no te pertenece.');
  }
  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Esta evaluación ya fue enviada.');
  }
  return data;
}

/**
 * Callable para previsualizar el impacto en atributos a partir de una reseña
 * escrita por el evaluador. Si recibe `matchId` y `assignmentId`, guarda el
 * resultado en un caché privado del servidor para reutilizarlo al enviar sin
 * duplicar llamadas a Vertex AI.
 */
export const analyzeTextPerformance = onCall(
  { region: 'us-central1', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
    }
    const uid = request.auth.uid;
    const text = typeof request.data?.text === 'string' ? request.data.text : '';
    const playerPosition =
      typeof request.data?.playerPosition === 'string'
        ? request.data.playerPosition
        : 'MED';
    const playerName =
      typeof request.data?.playerName === 'string'
        ? request.data.playerName
        : 'Jugador';
    const matchId = typeof request.data?.matchId === 'string' ? request.data.matchId.trim() : '';
    const assignmentId =
      typeof request.data?.assignmentId === 'string' ? request.data.assignmentId.trim() : '';

    const db = admin.firestore();
    let cacheRef: FirebaseFirestore.DocumentReference | null = null;
    const inputHash = hashEvaluationInput(text);

    if (matchId && assignmentId) {
      await verifyPendingAssignment(db, matchId, assignmentId, uid);
      cacheRef = db.doc(`matches/${matchId}/assignments/${assignmentId}/private/aiAnalysis`);
      const cachedSnap = await cacheRef.get();
      if (cachedSnap.exists) {
        const cached = cachedSnap.data()!;
        if (
          cached.kind === 'text' &&
          cached.inputHash === inputHash &&
          Array.isArray(cached.attributeChanges) &&
          typeof cached.summary === 'string'
        ) {
          return {
            summary: cached.summary,
            confidence: Number(cached.confidence ?? 0.7),
            attributeChanges: cached.attributeChanges,
          } satisfies TextPerformanceResult;
        }
      }
    }

    try {
      const result = await analyzeTextPerformanceCore({
        text,
        playerPosition,
        playerName,
      });
      if (cacheRef) {
        await cacheRef.set({
          kind: 'text',
          inputHash,
          summary: result.summary,
          confidence: result.confidence,
          attributeChanges: result.attributeChanges,
          analyzedAt: new Date().toISOString(),
        });
      }
      return result;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('Text performance Vertex analysis failed', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new HttpsError(
        'internal',
        'No se pudo analizar la reseña en este momento. Probá de nuevo.',
      );
    }
  },
);

/**
 * Callable para analizar una nota de voz subida a Storage.
 *
 * - Transcribe y calcula impactos con Vertex AI (`gemini-3.1-flash-lite`).
 * - Guarda transcripción + impactos en un caché privado del servidor indexado
 *   por `md5Hash` del archivo, para que `processEvaluationSubmission` lo
 *   reutilice al enviar sin volver a llamar a la IA.
 * - Devuelve al cliente únicamente `summary`, `confidence` y `attributeChanges`
 *   (sin exponer la transcripción cruda durante la carga).
 */
export const analyzeAudioPerformance = onCall(
  { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
    }
    const uid = request.auth.uid;
    const matchId = String(request.data?.matchId ?? '').trim();
    const assignmentId = String(request.data?.assignmentId ?? '').trim();
    const audioPath = String(request.data?.audioPath ?? '').trim();
    const rawDuration = request.data?.audioDurationSec;
    const audioDurationSec =
      typeof rawDuration === 'number' && Number.isFinite(rawDuration)
        ? Math.max(1, Math.min(75, Math.round(rawDuration)))
        : undefined;

    if (!isValidEvaluationAudioPath(audioPath, matchId, uid)) {
      throw new HttpsError('invalid-argument', 'Ruta de audio inválida.');
    }

    const db = admin.firestore();
    const assignment = await verifyPendingAssignment(db, matchId, assignmentId, uid);
    const subjectId = String(assignment.subjectId ?? '');

    const file = admin.storage().bucket().file(audioPath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', 'No encontramos el audio subido.');
    }
    const [metadata] = await file.getMetadata();
    const sizeBytes = Number(metadata.size ?? 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_AUDIO_BYTES) {
      throw new HttpsError('invalid-argument', 'El audio supera el límite de 2 MB.');
    }
    const mimeType = String(metadata.contentType || 'audio/mp4');
    if (!mimeType.startsWith('audio/')) {
      throw new HttpsError('invalid-argument', 'El archivo subido no es de audio.');
    }
    const audioMd5 = String(metadata.md5Hash ?? metadata.generation ?? '');

    const cacheRef = db.doc(`matches/${matchId}/assignments/${assignmentId}/private/aiAnalysis`);
    const cachedSnap = await cacheRef.get();
    if (cachedSnap.exists) {
      const cached = cachedSnap.data()!;
      if (
        cached.kind === 'audio' &&
        cached.audioPath === audioPath &&
        cached.audioMd5 === audioMd5 &&
        typeof cached.transcript === 'string' &&
        Array.isArray(cached.attributeChanges) &&
        typeof cached.summary === 'string'
      ) {
        return {
          summary: cached.summary,
          confidence: Number(cached.confidence ?? 0.7),
          attributeChanges: cached.attributeChanges,
        } satisfies TextPerformanceResult;
      }
    }

    try {
      const [[audioBuffer], playerSnap] = await Promise.all([
        file.download(),
        validDocumentId(subjectId) ? db.doc(`players/${subjectId}`).get() : Promise.resolve(null),
      ]);
      const pData = playerSnap?.exists ? playerSnap.data() : undefined;

      const analyzed = await analyzeAudioPerformanceCore({
        audioBuffer,
        mimeType,
        playerPosition: typeof pData?.position === 'string' ? pData.position : 'MED',
        playerName: typeof pData?.name === 'string' ? pData.name : 'Jugador',
      });

      await cacheRef.set({
        kind: 'audio',
        audioPath,
        audioMd5,
        ...(audioDurationSec !== undefined ? { audioDurationSec } : {}),
        transcript: analyzed.transcript,
        summary: analyzed.summary,
        confidence: analyzed.confidence,
        attributeChanges: analyzed.attributeChanges,
        analyzedAt: new Date().toISOString(),
      });

      return {
        summary: analyzed.summary,
        confidence: analyzed.confidence,
        attributeChanges: analyzed.attributeChanges,
      } satisfies TextPerformanceResult;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('Audio performance Vertex analysis failed', {
        assignmentId,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new HttpsError(
        'internal',
        'No se pudo analizar la nota de voz en este momento. Probá de nuevo.',
      );
    }
  },
);
