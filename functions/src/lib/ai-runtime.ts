import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { usageDocId, withinLimit, type UsageKind } from './coach';

/**
 * Lo que comparten todas las funciones con IA: el cliente de Vertex, el tope
 * diario por persona y la caché de respuestas.
 */

export const MODEL_NAME = 'gemini-3.1-flash-lite';

export function aiClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCLOUD_PROJECT || admin.app().options.projectId,
    location: 'global',
  });
}

const LIMIT_MESSAGES: Record<UsageKind, string> = {
  chat: 'Hablaste mucho con el DT por hoy. Seguimos mañana.',
  analysis: 'Ya pediste varios análisis hoy. Probá de nuevo mañana.',
  help: 'Hiciste muchas consultas al asistente por hoy. Seguimos mañana.',
  summary: 'Ya pediste varios resúmenes hoy. Probá de nuevo mañana.',
  recruit: 'Ya pediste varias sugerencias hoy. Probá de nuevo mañana.',
};

/**
 * Suma un uso del día y falla si ya se llegó al tope. Va en una transacción
 * para que dos pedidos a la vez no se salteen el límite.
 */
export async function consumeQuota(db: admin.firestore.Firestore, uid: string, kind: UsageKind): Promise<void> {
  const ref = db.doc(`aiUsage/${usageDocId(uid)}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!withinLimit(snap.data()?.[kind], kind)) {
      throw new HttpsError('resource-exhausted', LIMIT_MESSAGES[kind]);
    }
    tx.set(ref, { [kind]: admin.firestore.FieldValue.increment(1), uid, updatedAt: Date.now() }, { merge: true });
  });
}

/** Pide un JSON al modelo y devuelve el texto con el motivo de corte. */
export async function generateJson(options: {
  prompt: string;
  schema: unknown;
  maxOutputTokens: number;
  timeoutMs: number;
}): Promise<{ text: string | undefined; finishReason: string | undefined }> {
  const result = await aiClient().models.generateContent({
    model: MODEL_NAME,
    contents: options.prompt,
    config: {
      maxOutputTokens: options.maxOutputTokens,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      responseMimeType: 'application/json',
      responseSchema: options.schema as any,
      httpOptions: { timeout: options.timeoutMs },
    },
  });
  return { text: result.text, finishReason: result.candidates?.[0]?.finishReason };
}

/** Caché de respuestas en `ai_cache` (solo el servidor la toca). */
export async function readCache<T>(db: admin.firestore.Firestore, key: string, ttlMs: number): Promise<T | null> {
  const entry = (await db.doc(`ai_cache/${key}`).get()).data();
  if (entry && typeof entry.timestamp === 'number' && Date.now() - entry.timestamp < ttlMs) return entry.result as T;
  return null;
}

export async function writeCache(db: admin.firestore.Firestore, key: string, category: string, result: unknown): Promise<void> {
  await db.doc(`ai_cache/${key}`).set({ result, timestamp: Date.now(), category, hitCount: 0 });
}
