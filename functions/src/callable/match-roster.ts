import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { hasFixedRoster, isCompetitionMatch, isMatchManager } from '../lib/match-access';
import { assertConvocationOpen, staleTeamsPatch } from '../lib/match-state';
import { teamAccess } from '../lib/team-rivals-store';
import { notifyUsers } from '../lib/notify-users';

/**
 * Quién está en el partido, después de armado.
 *
 * - `removeMatchPlayer`: el organizador (partido por convocatoria) o el
 *   responsable del equipo (partido entre equipos) saca a alguien. Antes sólo se
 *   podía mover o dejar a la persona, y en un partido entre equipos el plantel se
 *   releía de los equipos y volvía a aparecer.
 * - `reportMatchUnavailable`: en un partido de plantel fijo nadie "se baja", pero
 *   sí avisa que no puede ir, y los capitanes lo ven.
 *
 * Reglas: docs/technical/REGLAS_POR_TIPO_DE_PARTIDO.md §4 y §5.
 */

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

function cleanId(value: unknown, what: string): string {
  const id = String(value ?? '');
  if (!id || id.includes('/')) throw new HttpsError('invalid-argument', `Falta ${what}.`);
  return id;
}

function withoutPlayer(teams: any[], playerId: string) {
  return teams.map((team: any) => {
    const remaining = (Array.isArray(team.players) ? team.players : []).filter((p: any) => (p.uid ?? p.id) !== playerId);
    const totalOVR = remaining.reduce((sum: number, p: any) => sum + Number(p.ovr ?? 0), 0);
    return { ...team, players: remaining, totalOVR, averageOVR: remaining.length ? totalOVR / remaining.length : 0 };
  });
}

export const removeMatchPlayer = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = cleanId(request.data?.matchId, 'el partido');
  const playerId = cleanId(request.data?.playerId, 'el jugador');
  const restore = request.data?.restore === true;

  const db = admin.firestore();
  const ref = db.doc(`matches/${matchId}`);
  let notified: { title: string; message: string } | null = null;

  await db.runTransaction(async (tx) => {
    const match = (await tx.get(ref)).data();
    if (!match) throw new HttpsError('not-found', 'El partido no existe.');
    if (!isMatchManager(match, uid)) {
      throw new HttpsError('permission-denied', 'Sólo el organizador o los capitanes pueden sacar jugadores.');
    }
    if (isCompetitionMatch(match)) {
      throw new HttpsError('failed-precondition', 'El plantel de una competición se cambia desde el equipo.');
    }
    assertConvocationOpen(match);
    if (playerId === match.ownerUid) {
      throw new HttpsError('failed-precondition', 'El organizador no se puede sacar a sí mismo del partido.');
    }

    const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
    const players: any[] = Array.isArray(match.players) ? match.players : [];
    const teams: any[] = Array.isArray(match.teams) ? match.teams : [];

    if (!hasFixedRoster(match)) {
      // Convocatoria abierta (manual / colaborativo): sale de la lista y de los equipos.
      if (!playerUids.includes(playerId)) throw new HttpsError('not-found', 'Esa persona no está en el partido.');
      tx.update(ref, {
        players: players.filter((p) => p.uid !== playerId),
        playerUids: playerUids.filter((id) => id !== playerId),
        teams: withoutPlayer(teams, playerId),
        ...staleTeamsPatch(match),
      });
      notified = { title: 'Te sacaron del partido', message: `El organizador te sacó de "${match.title ?? 'el partido'}".` };
      return;
    }

    // Partido entre equipos: el plantel es el del equipo, así que se saca con una
    // exclusión sólo para este partido (el plantel del equipo no cambia) que la
    // sincronización respeta. Sólo la decide quien administra ESE equipo.
    const side = teams.find((team: any) => (team.players ?? []).some((p: any) => (p.uid ?? p.id) === playerId));
    const excluded: Record<string, string[]> = { ...(match.rosterExclusions ?? {}) };
    const teamId = String(
      side?.teamId ??
        Object.entries(excluded).find(([, ids]) => Array.isArray(ids) && ids.includes(playerId))?.[0] ??
        '',
    );
    if (!teamId) throw new HttpsError('not-found', 'Esa persona no está en el partido.');
    const isOrganizerOfSameGroupMatch = match.type === 'by_teams' && match.ownerUid === uid;
    if (!isOrganizerOfSameGroupMatch) await teamAccess(db, uid, teamId, true, tx);

    const current = new Set(Array.isArray(excluded[teamId]) ? excluded[teamId] : []);
    if (restore) current.delete(playerId);
    else current.add(playerId);
    if (current.size) excluded[teamId] = [...current];
    else delete excluded[teamId];

    const patch: Record<string, unknown> = { rosterExclusions: excluded };
    if (!restore) {
      if (!playerUids.includes(playerId)) throw new HttpsError('not-found', 'Esa persona no está en el partido.');
      const nextTeams = withoutPlayer(teams, playerId);
      if (nextTeams.some((team: any) => (team.players ?? []).length === 0)) {
        throw new HttpsError('failed-precondition', 'Cada equipo necesita al menos un jugador.');
      }
      patch.teams = nextTeams;
      patch.players = players.filter((p) => p.uid !== playerId);
      patch.playerUids = playerUids.filter((id) => id !== playerId);
      notified = { title: 'Te sacaron del partido', message: `Quedaste afuera de "${match.title ?? 'el partido'}".` };
    }
    tx.update(ref, patch);
  });

  if (notified) {
    const n: { title: string; message: string } = notified;
    await notifyUsers(db, [playerId], { type: 'match_update', title: n.title, message: n.message, link: `/matches/${matchId}`, metadata: { matchId } }, 'RemoveMatchPlayer')
      .catch((error: unknown) => console.error('[removeMatchPlayer] No se pudo avisar', error));
  }
  return { ok: true };
});

export const reportMatchUnavailable = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const matchId = cleanId(request.data?.matchId, 'el partido');
  const unavailable = request.data?.unavailable !== false;

  const db = admin.firestore();
  const ref = db.doc(`matches/${matchId}`);
  let recipients: string[] = [];
  let title = 'el partido';
  let name = 'Un jugador';

  await db.runTransaction(async (tx) => {
    const match = (await tx.get(ref)).data();
    if (!match) throw new HttpsError('not-found', 'El partido no existe.');
    if (!hasFixedRoster(match)) {
      throw new HttpsError('failed-precondition', 'En este partido podés darte de baja directamente.');
    }
    assertConvocationOpen(match);
    const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
    if (!playerUids.includes(uid)) throw new HttpsError('failed-precondition', 'No estás en este partido.');
    const list: string[] = Array.isArray(match.unavailablePlayerUids) ? match.unavailablePlayerUids : [];
    if (unavailable === list.includes(uid)) return; // idempotente
    tx.update(ref, {
      unavailablePlayerUids: unavailable
        ? admin.firestore.FieldValue.arrayUnion(uid)
        : admin.firestore.FieldValue.arrayRemove(uid),
    });
    title = String(match.title ?? title);
    const me = (Array.isArray(match.players) ? match.players : []).find((p: any) => p.uid === uid);
    name = String(me?.displayName ?? name);
    recipients = [...new Set<string>([match.ownerUid, ...(Array.isArray(match.captains) ? match.captains : [])].filter((id) => typeof id === 'string' && !!id && id !== uid))];
  });

  if (recipients.length > 0) {
    await notifyUsers(
      db,
      recipients,
      {
        type: 'match_update',
        title: unavailable ? 'No puede ir' : 'Ya puede ir',
        message: unavailable ? `${name} avisó que no puede ir a "${title}".` : `${name} confirmó que sí puede ir a "${title}".`,
        link: `/matches/${matchId}`,
        metadata: { matchId },
      },
      'ReportMatchUnavailable',
    ).catch((error: unknown) => console.error('[reportMatchUnavailable] No se pudo avisar', error));
  }
  return { ok: true };
});
