import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generateBalancedTeamsCore, GOOGLE_GENAI_API_KEY } from './generate-balanced-teams';

/**
 * Callables de gestión de partido usadas por MatchManagementActions en la
 * web (deleteMatchAction, updateMatchDateAction, updateMatchLocationAction,
 * shuffleMatchTeamsAction en src/lib/actions/match-actions.ts y
 * server-actions.ts) — necesarias porque firestore.rules bloquea
 * update/delete directo en /matches/{matchId}.
 *
 * Simplificación consciente respecto a la web: la web permite estas
 * acciones al ownerUid O a un miembro del grupo con permiso 'matches.edit'
 * (canEditMatch, que consulta group-permissions.ts). Acá se chequea solo
 * ownerUid, igual que el resto de las Cloud Functions de match-lifecycle.ts
 * ya desplegadas — si se necesita el caso de "editor delegado" hay que
 * portar group-permissions.ts primero.
 *
 * También se omiten las notificaciones a jugadores (notifyMatchUpdatedAction
 * push) que la web dispara al reprogramar/cambiar cancha/eliminar — mismo
 * criterio que en finishMatch: la infraestructura de push todavía no está
 * portada a Flutter.
 */

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

async function getOwnedMatchOrThrow(matchId: string, uid: string) {
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  const data = snap.data()!;
  if (data.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Solo el organizador puede realizar esta acción.');
  }
  return { db, ref, data };
}

/** Port de deleteMatchAction. */
export const deleteMatch = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const { ref } = await getOwnedMatchOrThrow(matchId, uid);
  await ref.delete();
  return { ok: true };
});

/** Port de updateMatchDateAction. */
export const updateMatchDate = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const date = String(request.data?.date ?? '');
  const time = String(request.data?.time ?? '');
  const { ref } = await getOwnedMatchOrThrow(matchId, uid);
  await ref.update({ date, time });
  return { ok: true };
});

/** Port de updateMatchLocationAction. */
export const updateMatchLocation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const location = {
    name: String(request.data?.locationName ?? ''),
    address: String(request.data?.locationAddress ?? ''),
    lat: Number(request.data?.locationLat ?? 0) || 0,
    lng: Number(request.data?.locationLng ?? 0) || 0,
    placeId: String(request.data?.locationPlaceId ?? ''),
  };
  const { ref } = await getOwnedMatchOrThrow(matchId, uid);
  await ref.update({ location });
  return { ok: true };
});

/** Port de shuffleMatchTeamsAction: re-arma los equipos con IA desde cero. */
export const shuffleTeams = onCall({ region: 'us-central1', secrets: [GOOGLE_GENAI_API_KEY] }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const { db, ref, data } = await getOwnedMatchOrThrow(matchId, uid);

  const playerUids: string[] = Array.isArray(data.playerUids) ? data.playerUids : [];
  const playerRefs = playerUids.map((id) => db.collection('players').doc(id));
  const playerDocs = playerRefs.length > 0 ? await db.getAll(...playerRefs) : [];
  const playersToBalance = playerDocs
    .filter((doc) => doc.exists)
    .map((doc) => {
      const p = doc.data() as Record<string, unknown>;
      return {
        uid: doc.id,
        displayName: String(p.name ?? p.displayName ?? ''),
        position: String(p.position ?? ''),
        ovr: Number(p.ovr ?? 0),
      };
    });

  if (playersToBalance.length < 2) {
    throw new HttpsError('failed-precondition', 'Se necesitan al menos 2 jugadores para sortear equipos.');
  }

  const result = await generateBalancedTeamsCore(playersToBalance, 2);
  await ref.update({ teams: result.teams ?? [] });
  return { ok: true, teams: result.teams };
});
