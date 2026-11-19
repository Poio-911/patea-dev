import { randomUUID } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generateBalancedTeamsCore } from './generate-balanced-teams';
import { isMatchManager, isTeamMatch } from '../lib/match-access';

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

/**
 * Organizador o capitán. Fijar fecha y cancha lo hacen los dos capitanes de un
 * partido entre grupos; borrarlo o repartir los equipos sigue siendo del
 * organizador.
 */
async function getManagedMatchOrThrow(matchId: string, uid: string) {
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  const data = snap.data()!;
  if (!isMatchManager(data, uid)) {
    throw new HttpsError('permission-denied', 'Solo el organizador o los capitanes pueden realizar esta acción.');
  }
  return { db, ref, data };
}

const TEAM_MATCH_ROSTER_MESSAGE =
  'Los equipos de este partido son los planteles de cada equipo: no se reparten ni se re-equilibran.';

/**
 * Mover jugadores entre los dos equipos.
 *
 * Port de `updateMatchTeamsAction` + `EditableTeamsDialog`, que en la web es
 * un drag & drop: sólo cambia QUIÉN está en cada equipo, no los nombres ni
 * las camisetas.
 *
 * Diferencia deliberada con la web, y a favor: la web recibe el array
 * `teams` entero armado por el cliente y lo escribe tal cual, así que un
 * cliente modificado podría meter un jugador inventado con el OVR que
 * quiera. Acá el cliente manda sólo `{playerUid: 0|1}` y el equipo se
 * reconstruye desde `match.players`, que ya está del lado del servidor.
 */
/** Roster autoritativo; equipos legados sólo son respaldo si no hay playerUids. */
export function matchRosterIds(match: Record<string, any>): string[] {
  const entries = Array.isArray(match.playerUids) && match.playerUids.length
    ? match.playerUids
    : [...(Array.isArray(match.players) ? match.players : []),
       ...(Array.isArray(match.teams) ? match.teams.flatMap((t: any) => Array.isArray(t.players) ? t.players : []) : [])].map((p: any) => p?.uid);
  if (entries.some((uid: unknown) => typeof uid !== 'string' || !uid || uid.includes('/'))) {
    throw new HttpsError('failed-precondition', 'El plantel contiene un jugador inválido.');
  }
  return [...new Set<string>(entries)].sort();
}

export function isGeneratingTeams(match: Record<string, any>, now = Date.now()): boolean {
  return typeof match.teamGenerationUntil === 'number' && match.teamGenerationUntil > now;
}

function requireEditable(match: Record<string, any>) {
  if (!['planning', 'upcoming'].includes(match.status)) {
    throw new HttpsError('failed-precondition', 'Los equipos sólo se pueden cambiar antes de iniciar el partido.');
  }
}

export function assignMatchRoster(
  match: Record<string, any>, assignments: Record<string, unknown>, players: Array<Record<string, any>>,
): Array<Record<string, any>> {
  if (!Array.isArray(match.teams) || match.teams.length !== 2) {
    throw new HttpsError('failed-precondition', 'El partido todavía no tiene dos equipos.');
  }
  const ids = matchRosterIds(match);
  if (Object.keys(assignments).length !== ids.length || ids.some(id => !Object.prototype.hasOwnProperty.call(assignments, id))) {
    throw new HttpsError('failed-precondition', 'El plantel cambió. Cerrá y abrí el editor para incluir a todos los jugadores.');
  }
  const byUid = new Map(players.map(p => [p.uid, p]));
  const buckets: Array<Array<Record<string, any>>> = [[], []];
  for (const id of ids) {
    const side = assignments[id];
    if (side !== 0 && side !== 1) throw new HttpsError('invalid-argument', 'Cada jugador debe estar en uno de los dos equipos.');
    const player = byUid.get(id);
    if (!player) throw new HttpsError('failed-precondition', 'Falta un perfil del plantel. Actualizá el partido.');
    buckets[side].push(player);
  }
  if (buckets.some(team => team.length === 0)) throw new HttpsError('invalid-argument', 'Los dos equipos necesitan al menos un jugador.');
  return match.teams.map((team: Record<string, any>, i: number) => {
    const totalOVR = buckets[i].reduce((sum, p) => sum + p.ovr, 0);
    return { ...team, players: buckets[i], totalOVR, averageOVR: totalOVR / buckets[i].length };
  });
}

export const updateMatchTeams = onCall({ region: 'us-central1' }, async request => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const assignments = request.data?.assignments;
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    throw new HttpsError('invalid-argument', 'Falta el reparto de jugadores.');
  }
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const match = snap.data();
    if (!match) throw new HttpsError('not-found', 'El partido no existe.');
    if (match.ownerUid !== uid) throw new HttpsError('permission-denied', 'Sólo el organizador puede cambiar los equipos.');
    if (isTeamMatch(match)) throw new HttpsError('failed-precondition', TEAM_MATCH_ROSTER_MESSAGE);
    requireEditable(match);
    if (isGeneratingTeams(match)) throw new HttpsError('aborted', 'Se están armando los equipos. Esperá unos segundos.');
    const ids = matchRosterIds(match);
    const docs = ids.length ? await tx.getAll(...ids.map(id => db.doc(`players/${id}`))) : [];
    const players = docs.filter(d => d.exists).map(d => {
      const p = d.data()!;
      return { uid: d.id, displayName: p.name ?? p.displayName ?? 'Jugador', position: p.position ?? 'MED',
        ovr: Number(p.ovr ?? 50), photoURL: p.photoURL ?? p.photoUrl ?? '' };
    });
    const teams = assignMatchRoster(match, assignments, players);
    const maximum = Math.max(...teams.map(team => team.averageOVR));
    const minimum = Math.min(...teams.map(team => team.averageOVR));
    tx.update(ref, { teams, teamsGenerated: true, balanceMetrics: {
      ovrDifference: Math.round((maximum - minimum) * 100) / 100,
      fairnessPercentage: maximum === 0 ? 100 : Math.round(minimum / maximum * 10000) / 100,
    } });
  });
  return { ok: true };
});

/** Una generación en curso nunca sobrescribe un plantel o partido que cambió. */
export async function regenerateMatchTeams(
  db: admin.firestore.Firestore, matchId: string, ownerUid?: string, onlyWhenFull = false,
) {
  const ref = db.collection('matches').doc(matchId);
  const token = randomUUID();
  const claimed = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const match = snap.data();
    if (!match) throw new HttpsError('not-found', 'El partido no existe.');
    if (ownerUid && match.ownerUid !== ownerUid) throw new HttpsError('permission-denied', 'Sólo el organizador puede armar equipos.');
    if (isTeamMatch(match)) {
      // Un partido entre equipos nunca se re-equilibra solo; si lo pide una
      // persona, se le explica por qué no.
      if (onlyWhenFull) return null;
      throw new HttpsError('failed-precondition', TEAM_MATCH_ROSTER_MESSAGE);
    }
    if (onlyWhenFull && (!['planning', 'upcoming'].includes(match.status) || match.teamsGenerated)) return null;
    requireEditable(match);
    const ids = matchRosterIds(match);
    if (onlyWhenFull && (Number(match.matchSize) <= 0 || ids.length < Number(match.matchSize))) return null;
    if (ids.length < 2) throw new HttpsError('failed-precondition', 'Se necesitan al menos dos jugadores para armar equipos.');
    if (isGeneratingTeams(match)) {
      if (onlyWhenFull) return null;
      throw new HttpsError('aborted', 'Ya se están armando los equipos. Esperá unos segundos.');
    }
    tx.update(ref, { teamGenerationToken: token, teamGenerationUntil: Date.now() + 120000 });
    return { ids, ownerUid: match.ownerUid, status: match.status, teams: match.teams };
  });
  if (!claimed) return null;
  try {
    const docs = await db.getAll(...claimed.ids.map(id => db.doc(`players/${id}`)));
    if (docs.some(doc => !doc.exists)) throw new HttpsError('failed-precondition', 'Un jugador del plantel ya no tiene perfil. Revisá la convocatoria.');
    const players = docs.map(doc => {
      const p = doc.data()!;
      return { uid: doc.id, displayName: String(p.name ?? p.displayName ?? 'Jugador'),
        ovr: Number(p.ovr ?? 50), position: String(p.position ?? 'MED'), photoURL: String(p.photoURL ?? p.photoUrl ?? '') };
    });
    const generated = await generateBalancedTeamsCore(players, 2);
    const before = Array.isArray(claimed.teams) ? claimed.teams : [];
    const membership = (teams: any[]) => teams.map(team =>
      (Array.isArray(team.players) ? team.players : []).map((p: any) => p.uid).sort().join('|')).sort().join('::');
    const changed = membership(before) !== membership(generated.teams);
    const ordered = !changed && before.length === 2 ? before.map((old: any) => generated.teams.find(team =>
      membership([team]) === membership([old]))!) : generated.teams;
    const result = { ...generated, changed, teams: ordered.map((team, i) => ({
      ...team, ...(before.length === 2 ? {
        name: before[i].name ?? team.name, jersey: before[i].jersey ?? team.jersey,
      } : {}),
    })) };
    await db.runTransaction(async tx => {
      const fresh = (await tx.get(ref)).data();
      if (!fresh || fresh.teamGenerationToken !== token || fresh.ownerUid !== claimed.ownerUid ||
          fresh.status !== claimed.status || JSON.stringify(matchRosterIds(fresh)) !== JSON.stringify(claimed.ids)) {
        throw new HttpsError('aborted', 'El partido cambió mientras armábamos los equipos. Reintentá con el plantel actualizado.');
      }
      tx.update(ref, { teams: result.teams, balanceMetrics: result.balanceMetrics,
        teamsGenerated: true, teamGenerationToken: admin.firestore.FieldValue.delete(),
        teamGenerationUntil: admin.firestore.FieldValue.delete() });
    });
    return result;
  } catch (error) {
    await db.runTransaction(async tx => {
      const fresh = (await tx.get(ref)).data();
      if (fresh?.teamGenerationToken === token) tx.update(ref, {
        teamGenerationToken: admin.firestore.FieldValue.delete(), teamGenerationUntil: admin.firestore.FieldValue.delete(),
      });
    });
    throw error;
  }
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
  const { ref } = await getManagedMatchOrThrow(matchId, uid);
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
  const { ref } = await getManagedMatchOrThrow(matchId, uid);
  await ref.update({ location });
  return { ok: true };
});

/** Port de shuffleMatchTeamsAction: re-arma los equipos con IA desde cero. */
export const shuffleTeams = onCall({ region: 'us-central1', timeoutSeconds: 120 }, async request => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const result = await regenerateMatchTeams(admin.firestore(), matchId, uid);
  return { ok: true, ...result };
});
