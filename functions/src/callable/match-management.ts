import { randomUUID } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generateBalancedTeamsCore } from './generate-balanced-teams';
import { hasFixedRoster, matchGroupIds, userCanManageMatch } from '../lib/match-access';
import { assertCancellable, assertDeletable, assertFutureSchedule, assertScheduleOpen, staleTeamsPatch } from '../lib/match-state';
import { sendPushToUsers } from '../lib/fcm-push';
import { upsertGroupVenue } from '../lib/places-search';

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
export async function getManagedMatchOrThrow(matchId: string, uid: string) {
  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  const data = snap.data()!;
  if (!(await userCanManageMatch(db, data, uid))) {
    throw new HttpsError('permission-denied', 'Solo los organizadores o administradores del grupo pueden realizar esta acción.');
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
  const preSnap = await ref.get();
  if (!preSnap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  if (!(await userCanManageMatch(db, preSnap.data()!, uid))) {
    throw new HttpsError('permission-denied', 'Sólo los organizadores pueden cambiar los equipos.');
  }
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const match = snap.data();
    if (!match) throw new HttpsError('not-found', 'El partido no existe.');
    if (hasFixedRoster(match)) throw new HttpsError('failed-precondition', TEAM_MATCH_ROSTER_MESSAGE);
    requireEditable(match);
    if (isGeneratingTeams(match)) throw new HttpsError('aborted', 'Se están armando los equipos. Esperá unos segundos.');
    const ids = matchRosterIds(match);
    const realIds = ids.filter((id) => !id.startsWith('guest_'));
    const docs = realIds.length ? await tx.getAll(...realIds.map(id => db.doc(`players/${id}`))) : [];
    const realPlayers = docs.filter(d => d.exists).map(d => {
      const p = d.data()!;
      return { uid: d.id, displayName: p.name ?? p.displayName ?? 'Jugador', position: p.position ?? 'MED',
        ovr: Number(p.ovr ?? 50), photoURL: p.photoURL ?? p.photoUrl ?? '' };
    });
    const guestPlayers = (Array.isArray(match.players) ? match.players : [])
      .filter((p: any) => p?.isGuest === true || String(p?.uid ?? '').startsWith('guest_'))
      .map((p: any) => ({
        uid: String(p.uid),
        displayName: String(p.displayName ?? 'Invitado'),
        position: String(p.position ?? 'MED'),
        ovr: Number(p.ovr ?? 70),
        photoURL: '',
        isGuest: true,
      }));
    const players = [...realPlayers, ...guestPlayers];
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
  db: admin.firestore.Firestore, matchId: string, actorUid?: string, onlyWhenFull = false,
) {
  const ref = db.collection('matches').doc(matchId);
  const token = randomUUID();
  const claimed = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const match = snap.data();
    if (!match) throw new HttpsError('not-found', 'El partido no existe.');
    if (actorUid && !(await userCanManageMatch(db, match, actorUid))) {
      throw new HttpsError('permission-denied', 'Sólo los organizadores pueden armar equipos.');
    }
    if (hasFixedRoster(match)) {
      // Un partido entre equipos o de competición nunca se re-equilibra solo; si lo pide una
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
    return {
      ids,
      ownerUid: match.ownerUid,
      status: match.status,
      teams: match.teams,
      rawPlayers: Array.isArray(match.players) ? match.players : [],
    };
  });
  if (!claimed) return null;
  try {
    const realIds = claimed.ids.filter((id) => !id.startsWith('guest_'));
    const docs = realIds.length ? await db.getAll(...realIds.map(id => db.doc(`players/${id}`))) : [];
    if (docs.some(doc => !doc.exists)) throw new HttpsError('failed-precondition', 'Un jugador del plantel ya no tiene perfil. Revisá la convocatoria.');
    const realPlayers = docs.map(doc => {
      const p = doc.data()!;
      return { uid: doc.id, displayName: String(p.name ?? p.displayName ?? 'Jugador'),
        ovr: Number(p.ovr ?? 50), position: String(p.position ?? 'MED'), photoURL: String(p.photoURL ?? p.photoUrl ?? '') };
    });
    const guestPlayers = claimed.rawPlayers
      .filter((p: any) => p?.isGuest === true || String(p?.uid ?? '').startsWith('guest_'))
      .map((p: any) => ({
        uid: String(p.uid),
        displayName: String(p.displayName ?? 'Invitado'),
        ovr: Number(p.ovr ?? 70),
        position: String(p.position ?? 'MED'),
        photoURL: '',
      }));
    const players = [...realPlayers, ...guestPlayers];
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
  const { db, ref, data } = await getOwnedMatchOrThrow(matchId, uid);
  // Sólo se borra lo que no empezó ni tuvo actividad; competiciones, nunca.
  assertDeletable(data);

  const recipients = (Array.isArray(data.playerUids) ? data.playerUids : [])
    .filter((id: unknown): id is string => typeof id === 'string' && !!id && id !== uid);
  const title = String(data.title ?? 'el partido');

  // `recursiveDelete` también borra mensajes, solicitudes, invitaciones y
  // presencia: antes quedaban huérfanos.
  await db.recursiveDelete(ref);

  // El diálogo de la app promete avisar a los anotados; hasta ahora no pasaba.
  if (recipients.length > 0) {
    try {
      const batch = db.batch();
      const createdAt = new Date().toISOString();
      for (const playerId of recipients) {
        batch.set(db.collection(`users/${playerId}/notifications`).doc(), {
          type: 'match_update',
          title: 'Partido cancelado',
          message: `El organizador eliminó "${title}".`,
          link: '/matches',
          isRead: false,
          createdAt,
        });
      }
      await batch.commit();
      await sendPushToUsers(
        recipients,
        { title: 'Partido cancelado', body: `El organizador eliminó "${title}".`, type: 'match_update', link: '/matches' },
        'DeleteMatch',
      );
    } catch (error) {
      console.error('[deleteMatch] No se pudo avisar a los anotados', error);
    }
  }
  return { ok: true };
});

/** Avisa a los jugadores y capitanes (menos a quien actúa). Nunca rompe la acción principal. */
export async function notifyMatchPeople(
  db: admin.firestore.Firestore,
  match: Record<string, any>,
  exceptUid: string,
  notification: { title: string; message: string; type?: string },
  tag: string,
) {
  const recipients = [
    ...new Set(
      [
        ...(Array.isArray(match.playerUids) ? match.playerUids : []),
        ...(Array.isArray(match.captains) ? match.captains : []),
        match.ownerUid,
      ].filter((id: unknown): id is string => typeof id === 'string' && !!id && id !== exceptUid),
    ),
  ];
  if (recipients.length === 0) return;
  try {
    const batch = db.batch();
    const createdAt = new Date().toISOString();
    for (const playerId of recipients) {
      batch.set(db.collection(`users/${playerId}/notifications`).doc(), {
        type: notification.type ?? 'match_update',
        title: notification.title,
        message: notification.message,
        link: '/matches',
        isRead: false,
        createdAt,
      });
    }
    await batch.commit();
    await sendPushToUsers(
      recipients,
      { title: notification.title, body: notification.message, type: notification.type ?? 'match_update', link: '/matches' },
      tag,
    );
  } catch (error) {
    console.error(`[${tag}] No se pudo avisar`, error);
  }
}

/**
 * Cancelar un partido que no empezó: queda en el historial como `cancelled`,
 * se avisa a los anotados y, si era un desafío entre equipos todavía pendiente,
 * se cierra la invitación para que el rival no la siga viendo.
 */
export const cancelMatch = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const reason = String(request.data?.reason ?? '').trim().slice(0, 200);
  const { db, ref } = await getManagedMatchOrThrow(matchId, uid);

  const match = await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(ref)).data();
    if (!fresh) throw new HttpsError('not-found', 'El partido no existe.');
    assertCancellable(fresh);
    // Todas las lecturas van antes de las escrituras.
    const invitationRef =
      fresh.challengeStatus === 'pending' && fresh.challengeToTeamId && fresh.challengeInvitationId
        ? db.doc(`teams/${fresh.challengeToTeamId}/invitations/${fresh.challengeInvitationId}`)
        : null;
    const invitation = invitationRef ? await tx.get(invitationRef) : null;
    tx.update(ref, {
      status: 'cancelled',
      cancelledBy: uid,
      cancelledAt: new Date().toISOString(),
      ...(reason ? { cancelReason: reason } : {}),
      isVotingOpen: false,
      ...(fresh.challengeStatus === 'pending' ? { challengeStatus: 'cancelled' } : {}),
    });
    if (invitationRef && invitation) {
      if (invitation.exists && invitation.data()?.status === 'pending') {
        tx.update(invitationRef, { status: 'cancelled', respondedBy: uid, respondedAt: new Date().toISOString() });
      }
    }
    return fresh;
  });

  const title = String(match.title ?? 'el partido');
  await notifyMatchPeople(
    db,
    match,
    uid,
    { title: 'Partido cancelado', message: `Se canceló "${title}".${reason ? ` Motivo: ${reason}` : ''}` },
    'CancelMatch',
  );
  return { ok: true };
});

/** Port de updateMatchDateAction. */
export const updateMatchDate = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const date = String(request.data?.date ?? '');
  const time = String(request.data?.time ?? '');
  const { ref, data } = await getManagedMatchOrThrow(matchId, uid);
  assertScheduleOpen(data, 'cambiar la fecha');
  assertFutureSchedule(date, time);
  await ref.update({
    date,
    time,
    // Poner fecha a un partido en planificación es confirmarla. Antes quedaba
    // con fecha pero en `planning` para siempre. Un desafío que todavía no
    // aceptó el rival no pasa a `upcoming` por esta vía.
    ...(data.status === 'planning' && data.challengeStatus !== 'pending'
      ? { status: 'upcoming', isVotingOpen: false }
      : {}),
  });
  return { ok: true };
});

/** Port de updateMatchLocationAction. */
export const updateMatchLocation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const photoUrl = String(request.data?.locationPhotoUrl ?? '').trim();
  const location = {
    name: String(request.data?.locationName ?? ''),
    address: String(request.data?.locationAddress ?? ''),
    lat: Number(request.data?.locationLat ?? 0) || 0,
    lng: Number(request.data?.locationLng ?? 0) || 0,
    placeId: String(request.data?.locationPlaceId ?? ''),
    ...(photoUrl ? { photoUrl } : {}),
  };
  const { ref, data: match } = await getManagedMatchOrThrow(matchId, uid);
  assertScheduleOpen(match, 'cambiar la cancha');
  await ref.update({ location });
  const groupId = typeof match.groupId === 'string' ? match.groupId : '';
  if (groupId && location.name) {
    await upsertGroupVenue(admin.firestore(), {
      groupId,
      uid,
      name: location.name,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      placeId: location.placeId,
      photoUrl,
    }).catch(() => {});
  }
  return { ok: true };
});

/** Port de shuffleMatchTeamsAction: re-arma los equipos con IA desde cero. */
export const shuffleTeams = onCall({ region: 'us-central1', timeoutSeconds: 120 }, async request => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '');
  const result = await regenerateMatchTeams(admin.firestore(), matchId, uid);
  return { ok: true, ...result };
});

/**
 * Permite al creador del partido (o admin del grupo) asignar o quitar
 * co-organizadores que pueden gestionar el partido.
 */
export const updateMatchOrganizers = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '').trim();
  const rawUids = Array.isArray(request.data?.coOrganizerUids) ? request.data.coOrganizerUids : [];
  if (!matchId || matchId.includes('/')) {
    throw new HttpsError('invalid-argument', 'matchId inválido.');
  }

  const { ref, data: match } = await getManagedMatchOrThrow(matchId, uid);
  const nextCoOrganizers = [...new Set<string>(
    rawUids
      .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0 && !id.includes('/'))
      .map((id: string) => id.trim())
      .filter((id: string) => id !== match.ownerUid && !id.startsWith('guest_')),
  )];

  await ref.update({ coOrganizerUids: nextCoOrganizers });
  return { ok: true, coOrganizerUids: nextCoOrganizers };
});

/**
 * Agrega jugadores del grupo directamente al partido (sirve en `manual` y
 * `collaborative`, tanto en `planning` como en `upcoming`).
 */
export const addMatchPlayers = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '').trim();
  const rawPlayerIds = Array.isArray(request.data?.playerUids) ? request.data.playerUids : [];
  const requestedIds = [...new Set<string>(
    rawPlayerIds
      .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0 && !id.includes('/'))
      .map((id: string) => id.trim()),
  )];

  if (!matchId || matchId.includes('/') || requestedIds.length === 0) {
    throw new HttpsError('invalid-argument', 'Falta el partido o los jugadores a agregar.');
  }

  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  const preSnap = await ref.get();
  if (!preSnap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  const preMatch = preSnap.data()!;
  if (!(await userCanManageMatch(db, preMatch, uid))) {
    throw new HttpsError('permission-denied', 'Solo los organizadores pueden agregar jugadores.');
  }

  const allowedGroupIds = matchGroupIds(preMatch);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;
    if (!['planning', 'upcoming'].includes(match.status)) {
      throw new HttpsError('failed-precondition', 'La convocatoria ya está cerrada.');
    }
    if (hasFixedRoster(match)) {
      throw new HttpsError('failed-precondition', TEAM_MATCH_ROSTER_MESSAGE);
    }
    if (isGeneratingTeams(match)) {
      throw new HttpsError('aborted', 'Se están armando los equipos. Reintentá en unos segundos.');
    }

    const currentPlayers: Array<Record<string, any>> = Array.isArray(match.players) ? [...match.players] : [];
    const currentUids: string[] = Array.isArray(match.playerUids) ? [...match.playerUids] : [];
    const toAddIds = requestedIds.filter((id) => !currentUids.includes(id));
    if (toAddIds.length === 0) return;

    const matchSize = Number(match.matchSize ?? 0);
    if (matchSize > 0 && currentPlayers.length + toAddIds.length > matchSize) {
      throw new HttpsError('failed-precondition', 'No hay suficientes cupos disponibles en el partido.');
    }

    const playerSnaps = await tx.getAll(...toAddIds.map((id) => db.collection('players').doc(id)));
    for (const pSnap of playerSnaps) {
      if (!pSnap.exists) {
        throw new HttpsError('not-found', 'Uno de los jugadores seleccionados ya no existe.');
      }
      const p = pSnap.data()!;
      if (allowedGroupIds.length > 0 && p.groupId && !allowedGroupIds.includes(String(p.groupId))) {
        throw new HttpsError('permission-denied', 'Solo podés agregar jugadores pertenecientes al grupo del partido.');
      }
      currentPlayers.push({
        uid: pSnap.id,
        displayName: String(p.name ?? p.displayName ?? 'Jugador'),
        ovr: Number(p.ovr ?? 50),
        position: String(p.position ?? 'MED'),
        photoURL: String(p.photoURL ?? p.photoUrl ?? ''),
      });
      currentUids.push(pSnap.id);
    }

    tx.update(ref, { players: currentPlayers, playerUids: currentUids, ...staleTeamsPatch(match) });
  });

  await regenerateMatchTeams(db, matchId, undefined, true).catch(() => {});
  return { ok: true };
});

/**
 * Agrega un invitado puntual ("de afuera", sin crear perfil permanente en
 * `players/`). Ocupa cupo y entra en equipos, pero queda excluido de
 * evaluaciones y métricas OVR (Opción A).
 */
export const addMatchGuest = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = String(request.data?.matchId ?? '').trim();
  const name = String(request.data?.name ?? '').trim();
  const rawPos = String(request.data?.position ?? 'MED').trim().toUpperCase();
  const position = ['POR', 'DEF', 'MED', 'DEL'].includes(rawPos) ? rawPos : 'MED';
  const rawOvr = Number(request.data?.ovr ?? 70);
  const ovr = Number.isFinite(rawOvr) ? Math.min(99, Math.max(40, Math.round(rawOvr))) : 70;

  if (!matchId || matchId.includes('/')) {
    throw new HttpsError('invalid-argument', 'matchId inválido.');
  }
  if (name.length < 2 || name.length > 40) {
    throw new HttpsError('invalid-argument', 'El nombre del invitado debe tener entre 2 y 40 caracteres.');
  }

  const db = admin.firestore();
  const ref = db.collection('matches').doc(matchId);
  const preSnap = await ref.get();
  if (!preSnap.exists) throw new HttpsError('not-found', 'El partido no existe.');
  if (!(await userCanManageMatch(db, preSnap.data()!, uid))) {
    throw new HttpsError('permission-denied', 'Solo los organizadores pueden agregar invitados.');
  }

  const guestUid = `guest_${randomUUID().slice(0, 8)}`;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'El partido no existe.');
    const match = snap.data()!;
    if (!['planning', 'upcoming'].includes(match.status)) {
      throw new HttpsError('failed-precondition', 'La convocatoria ya está cerrada.');
    }
    if (hasFixedRoster(match)) {
      throw new HttpsError('failed-precondition', TEAM_MATCH_ROSTER_MESSAGE);
    }
    if (isGeneratingTeams(match)) {
      throw new HttpsError('aborted', 'Se están armando los equipos. Reintentá en unos segundos.');
    }

    const currentPlayers: Array<Record<string, any>> = Array.isArray(match.players) ? [...match.players] : [];
    const currentUids: string[] = Array.isArray(match.playerUids) ? [...match.playerUids] : [];
    const matchSize = Number(match.matchSize ?? 0);
    if (matchSize > 0 && currentPlayers.length >= matchSize) {
      throw new HttpsError('failed-precondition', 'El partido ya está completo.');
    }

    currentPlayers.push({
      uid: guestUid,
      displayName: name,
      ovr,
      position,
      photoURL: '',
      isGuest: true,
      addedBy: uid,
    });
    currentUids.push(guestUid);

    tx.update(ref, { players: currentPlayers, playerUids: currentUids, ...staleTeamsPatch(match) });
  });

  await regenerateMatchTeams(db, matchId, undefined, true).catch(() => {});
  return { ok: true, guestUid };
});
