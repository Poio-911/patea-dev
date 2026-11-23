import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Type as SchemaType } from '@google/genai';
import { parseChatReply } from '../lib/coach';
import {
  MAX_CANDIDATES,
  buildGroupSummaryInput,
  buildGroupSummaryPrompt,
  buildHelpPrompt,
  buildRecruitPrompt,
  parseRecommendations,
  parseSummary,
  recruitCacheKey,
  sanitizeHistory,
  sanitizeMessage,
  summaryCacheKey,
  type Candidate,
} from '../lib/ai-assist';
import { consumeQuota, generateJson, readCache, writeCache } from '../lib/ai-runtime';
import { isGroupMember, userCanManageMatch } from '../lib/match-access';

/**
 * Ayudas con IA: asistente de la app, resumen del grupo y refuerzos para un
 * partido. Cada una tiene tope diario por persona y, cuando los datos no
 * cambian, reutiliza la respuesta anterior.
 */

const SUMMARY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECRUIT_TTL_MS = 60 * 60 * 1000;

const LIST = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } as const;
const CHAT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: { reply: { type: SchemaType.STRING }, suggestions: LIST },
  required: ['reply'],
} as const;
const SUMMARY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: { summary: { type: SchemaType.STRING } },
  required: ['summary'],
} as const;
const RECRUIT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    recommendations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { playerId: { type: SchemaType.STRING }, reason: { type: SchemaType.STRING } },
        required: ['playerId', 'reason'],
      },
    },
  },
  required: ['recommendations'],
} as const;

function requireUid(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

/** Asistente de la app: contesta con la documentación, no con datos de nadie. */
export const askAppHelp = onCall({ region: 'us-central1', timeoutSeconds: 60 }, async (request) => {
  const uid = requireUid(request);
  const message = sanitizeMessage(request.data?.message);
  if (!message) throw new HttpsError('invalid-argument', 'Escribí una pregunta de hasta 500 caracteres.');
  const history = sanitizeHistory(request.data?.history);

  await consumeQuota(admin.firestore(), uid, 'help');
  try {
    const { text, finishReason } = await generateJson({
      prompt: buildHelpPrompt(history, message),
      schema: CHAT_SCHEMA,
      maxOutputTokens: 700,
      timeoutMs: 45000,
    });
    return parseChatReply(text, finishReason);
  } catch (err) {
    console.error('App help failed', { message: err instanceof Error ? err.message : 'unknown' });
    throw new HttpsError('internal', 'El asistente no pudo contestar ahora. Probá de nuevo en un rato.');
  }
});

/** Resumen de un grupo, solo para quienes lo integran. */
export const getGroupSummary = onCall({ region: 'us-central1', timeoutSeconds: 60 }, async (request) => {
  const uid = requireUid(request);
  const groupId = String(request.data?.groupId ?? '');
  if (!groupId || groupId.includes('/')) throw new HttpsError('invalid-argument', 'Falta el grupo.');

  const db = admin.firestore();
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) throw new HttpsError('not-found', 'Grupo no encontrado.');
  const group = groupSnap.data()!;
  if (!isGroupMember(group, uid)) throw new HttpsError('permission-denied', 'Solo quienes integran el grupo pueden verlo.');

  // Los partidos jugados se cuentan como los muestra la app: los del grupo y
  // también los que juega como uno de los grupos participantes (sin repetir).
  const finished = ['completed', 'evaluated'];
  const [players, own, participating] = await Promise.all([
    db.collection('players').where('groupId', '==', groupId).limit(200).get(),
    db.collection('matches').where('groupId', '==', groupId).where('status', 'in', finished).select().get(),
    // Sin filtrar por estado en la consulta: así no hace falta un índice nuevo.
    db.collection('matches').where('participantGroupIds', 'array-contains', groupId).select('status').get(),
  ]);
  const matchIds = new Set([
    ...own.docs.map((d) => d.id),
    ...participating.docs.filter((d) => finished.includes(d.data().status)).map((d) => d.id),
  ]);
  const input = buildGroupSummaryInput(group, players.docs.map((d) => d.data()), matchIds.size);

  const cacheKey = summaryCacheKey(groupId, input);
  const cached = await readCache<{ summary: string }>(db, cacheKey, SUMMARY_TTL_MS);
  if (cached) return { summary: cached.summary, cached: true };

  await consumeQuota(db, uid, 'summary');
  try {
    const { text, finishReason } = await generateJson({
      prompt: buildGroupSummaryPrompt(input),
      schema: SUMMARY_SCHEMA,
      maxOutputTokens: 400,
      timeoutMs: 45000,
    });
    const result = parseSummary(text, finishReason);
    await writeCache(db, cacheKey, 'group-summary', result);
    return { summary: result.summary, cached: false };
  } catch (err) {
    console.error('Group summary failed', { message: err instanceof Error ? err.message : 'unknown' });
    throw new HttpsError('internal', 'No pudimos armar el resumen ahora. Probá de nuevo en un rato.');
  }
});

/**
 * Refuerzos sugeridos para un partido, entre las personas que la app ya mostró
 * (del grupo o de la zona). Los datos de cada una se leen acá, no se toman del
 * teléfono, y solo puede pedirlo quien administra el partido.
 */
export const recommendRecruits = onCall({ region: 'us-central1', timeoutSeconds: 60 }, async (request) => {
  const uid = requireUid(request);
  const matchId = String(request.data?.matchId ?? '');
  if (!matchId || matchId.includes('/')) throw new HttpsError('invalid-argument', 'Falta el partido.');
  const rawUids: unknown[] = Array.isArray(request.data?.candidateUids) ? request.data.candidateUids : [];

  const db = admin.firestore();
  const matchSnap = await db.doc(`matches/${matchId}`).get();
  if (!matchSnap.exists) throw new HttpsError('not-found', 'Partido no encontrado.');
  const match = matchSnap.data()!;
  if (!(await userCanManageMatch(db, match, uid))) {
    throw new HttpsError('permission-denied', 'Solo quienes organizan el partido pueden pedir sugerencias.');
  }

  const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
  const roster = (Array.isArray(match.players) ? match.players : []) as { uid?: string; position?: string }[];
  const spots = Number(match.matchSize ?? 0) - playerUids.length;
  if (!Number.isFinite(spots) || spots <= 0) return { recommendations: [] };

  const inMatch = new Set(playerUids);
  const ids = [
    ...new Set(rawUids.filter((u): u is string => typeof u === 'string' && !!u && !u.includes('/') && !inMatch.has(u))),
  ].slice(0, MAX_CANDIDATES);
  if (ids.length === 0) return { recommendations: [] };

  // Los datos salen de la ficha de cada persona (no del teléfono). Los jugadores
  // manuales no tienen cuenta y no se pueden invitar: se descartan.
  const snaps = await db.getAll(...ids.map((id) => db.doc(`players/${id}`)));
  const candidates: Candidate[] = snaps
    .filter((s) => s.exists && s.data()?.ownerUid === s.id)
    .map((s) => {
      const d = s.data()!;
      return {
        uid: s.id,
        name: String(d.name ?? 'Jugador').slice(0, 40),
        position: String(d.position ?? 'MED').slice(0, 4),
        ovr: Math.round(Number(d.ovr) || 0),
      };
    });
  if (candidates.length === 0) return { recommendations: [] };

  const cacheKey = recruitCacheKey(matchId, spots, candidates, roster.map((p) => ({ position: p.position ?? '' })));
  const cached = await readCache<{ playerId: string; reason: string }[]>(db, cacheKey, RECRUIT_TTL_MS);
  if (cached) return { recommendations: cached, cached: true };

  await consumeQuota(db, uid, 'recruit');
  try {
    const { text, finishReason } = await generateJson({
      prompt: buildRecruitPrompt({
        title: String(match.title ?? 'Partido').slice(0, 80),
        spots,
        roster: roster.map((p) => ({ position: p.position ?? '' })),
        candidates,
      }),
      schema: RECRUIT_SCHEMA,
      maxOutputTokens: 800,
      timeoutMs: 45000,
    });
    const recommendations = parseRecommendations(text, finishReason, new Set(candidates.map((c) => c.uid)), spots);
    await writeCache(db, cacheKey, 'recruit', recommendations);
    return { recommendations, cached: false };
  } catch (err) {
    console.error('Recruit suggestions failed', { message: err instanceof Error ? err.message : 'unknown' });
    throw new HttpsError('internal', 'No pudimos armar las sugerencias ahora. Probá de nuevo en un rato.');
  }
});
