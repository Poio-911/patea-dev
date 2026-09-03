import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Port de createManualPlayerAction (src/lib/actions/player-actions.ts).
 * Necesaria porque firestore.rules tiene `allow create/update/delete: if
 * false` en /players/{playerId} a propósito.
 *
 * Deliberadamente NO portado: publishActivityAction (actividad social al
 * crear jugador) — depende de Comunidad/Social, Sección 9, 0%.
 */
export const createManualPlayer = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  const uid = request.auth.uid;
  const data = request.data ?? {};

  const name = String(data.name ?? '').trim();
  const position = String(data.position ?? '');
  const groupId = String(data.groupId ?? '');
  if (!name || !position || !groupId) {
    throw new HttpsError('invalid-argument', 'Faltan campos obligatorios para crear el jugador.');
  }

  const pac = Number(data.pac ?? 50);
  const sho = Number(data.sho ?? 50);
  const pas = Number(data.pas ?? 50);
  const dri = Number(data.dri ?? 50);
  const def = Number(data.def ?? 50);
  const phy = Number(data.phy ?? 50);
  const ovr = Number(data.ovr ?? Math.round((pac + sho + pas + dri + def + phy) / 6));

  const db = admin.firestore();
  const docRef = await db.collection('players').add({
    name,
    position,
    groupId,
    pac,
    sho,
    pas,
    dri,
    def,
    phy,
    ovr,
    ownerUid: uid,
    stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0, yellowCards: 0, redCards: 0 },
    createdAt: new Date().toISOString(),
  });

  return { ok: true, id: docRef.id };
});
