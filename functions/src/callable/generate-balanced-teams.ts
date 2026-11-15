import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { balanceTeams, BalancedPlayer, BalancedTeamsOutput } from '../lib/team-balancer';

// Kept as an export for older lifecycle imports while their deployment migrates.
// Team balancing itself never reads the secret or makes a paid model request.
export const GOOGLE_GENAI_API_KEY = defineSecret('GOOGLE_GENAI_API_KEY');

export const generateBalancedTeams = onCall(
  { region: 'us-central1', timeoutSeconds: 30 },
  async (request): Promise<BalancedTeamsOutput> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión para armar equipos.');
    const uid = request.auth.uid;
    const raw = request.data?.players;
    const teamCount = request.data?.teamCount ?? 2;
    if (!Array.isArray(raw) || raw.length < 2 || raw.length > 100) {
      throw new HttpsError('invalid-argument', 'Seleccioná entre 2 y 100 jugadores.');
    }
    const ids = raw.map(player => player?.uid);
    if (ids.some(id => typeof id !== 'string' || !id || id.length > 128 || id.includes('/') || id === '.' || id === '..')
        || new Set(ids).size !== ids.length) {
      throw new HttpsError('invalid-argument', 'El plantel contiene identificadores inválidos o repetidos.');
    }
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 8 || teamCount > ids.length) {
      throw new HttpsError('invalid-argument', 'Cantidad de equipos inválida.');
    }
    const db = admin.firestore();
    const user = (await db.doc(`users/${uid}`).get()).data();
    const groupId = user?.activeGroupId;
    if (typeof groupId !== 'string' || !groupId || groupId.includes('/')) {
      throw new HttpsError('failed-precondition', 'Elegí un grupo activo para armar los equipos.');
    }
    const group = (await db.doc(`groups/${groupId}`).get()).data();
    const members: string[] = Array.isArray(group?.members) ? group.members : [];
    if (!group || (group.ownerUid !== uid && !members.includes(uid))) {
      throw new HttpsError('permission-denied', 'No pertenecés al grupo activo.');
    }
    const docs = await db.getAll(...ids.map(id => db.doc(`players/${id}`)));
    const players = docs.map(doc => {
      const player = doc.data();
      if (!player) throw new HttpsError('not-found', 'Un jugador seleccionado ya no existe. Actualizá el plantel.');
      if (player.groupId !== groupId && !members.includes(doc.id) && player.ownerUid !== uid) {
        throw new HttpsError('permission-denied', 'Seleccioná jugadores de tu grupo.');
      }
      // No identity, rating, position or photo is accepted from the caller.
      return {
        uid: doc.id,
        displayName: player.name ?? player.displayName ?? 'Jugador',
        position: player.position ?? 'MED',
        ovr: player.ovr ?? 50,
        photoURL: player.photoUrl ?? player.photoURL ?? '',
      };
    });
    try {
      return await generateBalancedTeamsCore(players, teamCount);
    } catch (error) {
      throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Plantel inválido.');
    }
  },
);

/** Shared in-process path: callers must authorize the match and hydrate its roster. */
export async function generateBalancedTeamsCore(
  players: Array<{ uid: string; displayName: string; position: string; ovr: number; photoURL?: string }>,
  teamCount = 2,
): Promise<BalancedTeamsOutput> {
  return balanceTeams(players, teamCount);
}

export type InputPlayer = BalancedPlayer;
