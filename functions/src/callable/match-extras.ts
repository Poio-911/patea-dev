import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { userCanManageMatch } from '../lib/match-access';
import { isInRoster, normalizeCost, parseStreamLink, pickVenueForLocation, venueCost } from '../lib/match-extras';

/**
 * Costo del partido y transmisión. Los escribe solo quien administra el
 * partido; los ven todos los que pueden ver el partido (campos del propio
 * documento, sin reglas nuevas).
 */

function requireUid(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

/** Carga el partido y exige que quien llama lo administre y que siga vigente. */
async function loadManagedMatch(matchId: unknown, uid: string) {
  const id = typeof matchId === 'string' ? matchId : '';
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', 'Falta el partido.');
  const db = admin.firestore();
  const ref = db.doc(`matches/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Partido no encontrado.');
  const match = snap.data()!;
  if (!(await userCanManageMatch(db, match, uid))) {
    throw new HttpsError('permission-denied', 'Solo quienes organizan el partido pueden hacerlo.');
  }
  if (match.status === 'cancelled') throw new HttpsError('failed-precondition', 'El partido está cancelado.');
  return { ref, match };
}

/** Pone, cambia o saca el costo del partido (monto cero lo saca). */
export const setMatchCost = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireUid(request);
  const { ref } = await loadManagedMatch(request.data?.matchId, uid);

  let cost;
  try {
    cost = normalizeCost(request.data?.total, request.data?.currency);
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Costo no válido.');
  }
  if (!cost) {
    await ref.update({
      cost: admin.firestore.FieldValue.delete(),
      costPaidUids: admin.firestore.FieldValue.delete(),
    });
    return { ok: true, cost: null };
  }
  await ref.update({ cost });
  return { ok: true, cost };
});

/** Marca o desmarca que alguien del plantel ya pagó su parte. */
export const markMatchPayment = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireUid(request);
  const { ref, match } = await loadManagedMatch(request.data?.matchId, uid);

  // El costo es de la cancha; el partido puede tener uno propio que lo reemplaza.
  if (!match.cost) {
    const groupId = typeof match.groupId === 'string' ? match.groupId : '';
    const venues = groupId
      ? (await admin.firestore().collection('venues').where('groupId', '==', groupId).limit(200).get()).docs.map((d) => d.data())
      : [];
    if (!venueCost(pickVenueForLocation(match.location, venues))) {
      throw new HttpsError('failed-precondition', 'El partido no tiene costo cargado.');
    }
  }
  const playerId = typeof request.data?.playerId === 'string' ? request.data.playerId : '';
  if (!playerId || !isInRoster(match.playerUids, playerId)) {
    throw new HttpsError('invalid-argument', 'Esa persona no está en el partido.');
  }
  const paid = request.data?.paid === true;
  await ref.update({
    costPaidUids: paid
      ? admin.firestore.FieldValue.arrayUnion(playerId)
      : admin.firestore.FieldValue.arrayRemove(playerId),
  });
  return { ok: true };
});

/** Carga o saca el enlace a la transmisión (YouTube, Twitch o Kick). */
export const setMatchStream = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireUid(request);
  const { ref } = await loadManagedMatch(request.data?.matchId, uid);

  const raw = request.data?.url;
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    await ref.update({ stream: admin.firestore.FieldValue.delete() });
    return { ok: true, stream: null };
  }
  const stream = parseStreamLink(raw);
  if (!stream) {
    throw new HttpsError('invalid-argument', 'Pegá un enlace de YouTube, Twitch o Kick.');
  }
  await ref.update({ stream });
  return { ok: true, stream };
});
