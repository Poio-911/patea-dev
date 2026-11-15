import { createHash } from 'crypto';
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { canonicalPerformanceTags, CanonicalTag } from './performance-tags';

export type NormalizedEvaluation = {
  assignmentId: string;
  subjectId: string;
  evaluationType: 'points' | 'tags' | 'text';
  rating?: number;
  performanceTags?: CanonicalTag[];
  textDescription?: string;
};

export type NormalizedSubmission = {
  evaluatorGoals: number;
  evaluatorAssists: number;
  personalChronicle?: string;
  mvpVote?: string;
  evaluations: NormalizedEvaluation[];
};

const tagById = new Map(canonicalPerformanceTags.map(tag => [tag.id, tag]));

/** Una submission por persona y partido, independiente del ID legado del documento. */
export function submissionKey(matchId: string, evaluatorId: string): string {
  return createHash('sha256').update(JSON.stringify([matchId, evaluatorId])).digest('hex');
}

function invalid(message: string): never {
  throw new HttpsError('invalid-argument', message);
}

export function validDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && !value.includes('/') && value !== '.' && value !== '..';
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Datos de evaluación inválidos.');
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 20) {
    invalid('Los goles y asistencias deben ser enteros entre 0 y 20.');
  }
  return value;
}

function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maximum) invalid('Texto de evaluación inválido.');
  return value.trim() || undefined;
}

/** Normaliza sin conservar atributos calculados o identidades enviados por el cliente. */
export function normalizeSubmission(raw: unknown): NormalizedSubmission {
  const form = record(raw);
  if (!Array.isArray(form.evaluations) || form.evaluations.length < 1 || form.evaluations.length > 100) {
    invalid('Debés enviar las evaluaciones asignadas.');
  }
  const assignmentIds = new Set<string>();
  const evaluations = form.evaluations.map(rawEvaluation => {
    const evaluation = record(rawEvaluation);
    if (!validDocumentId(evaluation.assignmentId) || !validDocumentId(evaluation.subjectId)) {
      invalid('Asignación o jugador no válido.');
    }
    if (assignmentIds.has(evaluation.assignmentId)) invalid('La asignación está repetida.');
    assignmentIds.add(evaluation.assignmentId);
    const result: NormalizedEvaluation = {
      assignmentId: evaluation.assignmentId,
      subjectId: evaluation.subjectId,
      evaluationType: evaluation.evaluationType as NormalizedEvaluation['evaluationType'],
    };
    if (evaluation.evaluationType === 'points') {
      if (typeof evaluation.rating !== 'number' || !Number.isFinite(evaluation.rating)
          || evaluation.rating < 1 || evaluation.rating > 10) invalid('La nota debe estar entre 1 y 10.');
      result.rating = evaluation.rating;
    } else if (evaluation.evaluationType === 'tags') {
      if (!Array.isArray(evaluation.performanceTags) || evaluation.performanceTags.length < 1
          || evaluation.performanceTags.length > 10) invalid('Seleccioná entre 1 y 10 etiquetas.');
      const ids = new Set<string>();
      result.performanceTags = evaluation.performanceTags.map(rawTag => {
        const tag = record(rawTag);
        if (typeof tag.id !== 'string' || ids.has(tag.id) || !tagById.has(tag.id)) {
          invalid('Etiqueta desconocida o repetida.');
        }
        ids.add(tag.id);
        // Efectos, descripción e impacto salen del catálogo, no del payload.
        return tagById.get(tag.id)!;
      });
    } else if (evaluation.evaluationType === 'text') {
      const text = optionalText(evaluation.textDescription, 500);
      if (!text || text.length < 10) invalid('La descripción debe tener entre 10 y 500 caracteres.');
      result.textDescription = text;
      // Un cliente puede inventar aiAttributeChanges/aiConfidence. El texto se
      // conserva como testimonio; sólo un análisis ejecutado en servidor puede
      // autorizar cambios de atributos. Nunca se persisten efectos IA del cliente.
    } else {
      invalid('Tipo de evaluación inválido.');
    }
    return result;
  });
  const result: NormalizedSubmission = {
    evaluatorGoals: count(form.evaluatorGoals),
    evaluatorAssists: count(form.evaluatorAssists),
    evaluations,
  };
  const chronicle = optionalText(form.personalChronicle, 1000);
  if (chronicle) result.personalChronicle = chronicle;
  if (form.mvpVote !== undefined && form.mvpVote !== null && form.mvpVote !== '') {
    if (!validDocumentId(form.mvpVote)) invalid('Voto MVP inválido.');
    result.mvpVote = form.mvpVote;
  }
  return result;
}

/** Sólo lecturas: el caller debe ejecutarlo antes de cualquier escritura de la transacción. */
export async function validateEvaluationSubmission(
  db: admin.firestore.Firestore,
  transaction: admin.firestore.Transaction,
  matchId: string,
  evaluatorId: string,
  rawSubmission: unknown,
): Promise<NormalizedSubmission> {
  if (!validDocumentId(matchId) || !validDocumentId(evaluatorId)) invalid('Partido o evaluador inválido.');
  const form = normalizeSubmission(rawSubmission);
  const matchSnap = await transaction.get(db.doc(`matches/${matchId}`));
  if (!matchSnap.exists) throw new HttpsError('not-found', 'Partido no encontrado.');
  const match = matchSnap.data()!;
  if (match.status !== 'completed') throw new HttpsError('failed-precondition', 'El partido no admite evaluaciones.');
  const participants = new Set<string>(Array.isArray(match.playerUids) ? match.playerUids : []);
  if (!participants.has(evaluatorId)) throw new HttpsError('permission-denied', 'Sólo pueden evaluar quienes jugaron el partido.');
  if (form.mvpVote && !participants.has(form.mvpVote)) invalid('El MVP debe ser participante del partido.');
  const assignmentsSnap = await transaction.get(
    db.collection(`matches/${matchId}/assignments`).where('evaluatorId', '==', evaluatorId),
  );
  const assignments = new Map(assignmentsSnap.docs.map(doc => [doc.id, doc.data()]));
  for (const evaluation of form.evaluations) {
    const assignment = assignments.get(evaluation.assignmentId);
    if (!assignment || assignment.evaluatorId !== evaluatorId || assignment.subjectId !== evaluation.subjectId
        || assignment.matchId !== matchId || !participants.has(evaluation.subjectId)) {
      throw new HttpsError('permission-denied', 'La evaluación no corresponde a una asignación propia.');
    }
    if (assignment.status !== 'pending') throw new HttpsError('failed-precondition', 'La asignación ya fue completada.');
  }
  const pendingCount = [...assignments.values()].filter(a => a.status === 'pending').length;
  if (pendingCount !== form.evaluations.length) invalid('Debés completar todas tus asignaciones pendientes.');
  return form;
}
