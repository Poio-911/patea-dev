import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { GoogleGenAI, ThinkingLevel, Type as SchemaType } from '@google/genai';
import {
  buildAnalysisPrompt,
  buildChatPrompt,
  buildCoachContext,
  contextHash,
  hasEnoughData,
  parseAnalysis,
  parseChatReply,
  sanitizeHistory,
  sanitizeMessage,
  usageDocId,
  withinLimit,
  type CoachContext,
  type UsageKind,
} from '../lib/coach';

/**
 * Entrenador con IA: análisis del jugador y chat con el DT.
 *
 * Todo se arma en el servidor con los datos de quien llama (nunca con lo que
 * mande el teléfono), y solo sobre su propia ficha. Las evaluaciones son
 * anónimas, así que a la IA solo le llegan notas y etiquetas.
 */

const MODEL_NAME = 'gemini-3.1-flash-lite';
const ANALYSIS_TTL_MS = 24 * 60 * 60 * 1000;

const ITEM_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: { title: { type: SchemaType.STRING }, detail: { type: SchemaType.STRING } },
  required: ['title', 'detail'],
} as const;
const LIST = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } as const;

const ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    headline: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    strengths: { type: SchemaType.ARRAY, items: ITEM_SCHEMA },
    improvements: { type: SchemaType.ARRAY, items: ITEM_SCHEMA },
    patterns: LIST,
    plan: LIST,
  },
  required: ['headline', 'summary', 'strengths', 'improvements', 'plan'],
} as const;

const CHAT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: { reply: { type: SchemaType.STRING }, suggestions: LIST },
  required: ['reply'],
} as const;

function requireUid(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

async function loadContext(db: admin.firestore.Firestore, uid: string): Promise<CoachContext> {
  const [player, evals] = await Promise.all([
    db.doc(`players/${uid}`).get(),
    db.collection('evaluations').where('playerId', '==', uid).orderBy('evaluatedAt', 'desc').limit(20).get(),
  ]);
  if (!player.exists) throw new HttpsError('failed-precondition', 'No se encontró tu ficha de jugador.');
  return buildCoachContext(player.data()!, evals.docs.map((d) => d.data()));
}

/**
 * Suma un uso del día y falla si ya se llegó al tope. Va en una transacción
 * para que dos pedidos a la vez no se salteen el límite.
 */
async function consumeQuota(db: admin.firestore.Firestore, uid: string, kind: UsageKind): Promise<void> {
  const ref = db.doc(`aiUsage/${usageDocId(uid)}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!withinLimit(snap.data()?.[kind], kind)) {
      throw new HttpsError(
        'resource-exhausted',
        kind === 'chat'
          ? 'Hablaste mucho con el DT por hoy. Seguimos mañana.'
          : 'Ya pediste varios análisis hoy. Probá de nuevo mañana.',
      );
    }
    tx.set(ref, { [kind]: admin.firestore.FieldValue.increment(1), uid, updatedAt: Date.now() }, { merge: true });
  });
}

function aiClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCLOUD_PROJECT || admin.app().options.projectId,
    location: 'global',
  });
}

/** Análisis del jugador. Si sus datos no cambiaron, se devuelve el de antes. */
export const getPlayerAnalysis = onCall({ region: 'us-central1', timeoutSeconds: 90 }, async (request) => {
  const uid = requireUid(request);
  const db = admin.firestore();
  const ctx = await loadContext(db, uid);

  if (!hasEnoughData(ctx)) return { status: 'not_enough_data' as const };

  const cacheRef = db.doc(`ai_cache/coach-analysis-${contextHash(ctx)}`);
  const cached = await cacheRef.get();
  const entry = cached.data();
  if (entry && typeof entry.timestamp === 'number' && Date.now() - entry.timestamp < ANALYSIS_TTL_MS) {
    return { status: 'ok' as const, analysis: entry.result, cached: true };
  }

  await consumeQuota(db, uid, 'analysis');

  try {
    const result = await aiClient().models.generateContent({
      model: MODEL_NAME,
      contents: buildAnalysisPrompt(ctx),
      config: {
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA,
        httpOptions: { timeout: 75000 },
      },
    });
    const analysis = parseAnalysis(result.text, result.candidates?.[0]?.finishReason);
    await cacheRef.set({ result: analysis, timestamp: Date.now(), category: 'coach-analysis', hitCount: 0 });
    return { status: 'ok' as const, analysis, cached: false };
  } catch (err) {
    console.error('Coach analysis failed', { message: err instanceof Error ? err.message : 'unknown' });
    throw new HttpsError('internal', 'La IA no pudo armar tu análisis. Probá de nuevo en un rato.');
  }
});

/** Un turno de charla con el DT. El historial lo lleva la app y se recorta acá. */
export const coachChat = onCall({ region: 'us-central1', timeoutSeconds: 60 }, async (request) => {
  const uid = requireUid(request);
  const message = sanitizeMessage(request.data?.message);
  if (!message) throw new HttpsError('invalid-argument', 'Escribí un mensaje de hasta 500 caracteres.');
  const history = sanitizeHistory(request.data?.history);

  const db = admin.firestore();
  const ctx = await loadContext(db, uid);
  await consumeQuota(db, uid, 'chat');

  try {
    const result = await aiClient().models.generateContent({
      model: MODEL_NAME,
      contents: buildChatPrompt(ctx, history, message),
      config: {
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: 'application/json',
        responseSchema: CHAT_SCHEMA,
        httpOptions: { timeout: 45000 },
      },
    });
    return parseChatReply(result.text, result.candidates?.[0]?.finishReason);
  } catch (err) {
    console.error('Coach chat failed', { message: err instanceof Error ? err.message : 'unknown' });
    throw new HttpsError('internal', 'El DT no pudo contestar ahora. Probá de nuevo en un rato.');
  }
});
