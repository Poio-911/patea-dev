import { buildChallengeTeams } from '../lib/challenge-roster';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendPushToUsers } from '../lib/fcm-push';
import { buildMatchDateTime } from '../lib/match-date';
import { acceptedRivals, challengeState, teamAccess } from '../lib/team-rivals-store';
import { rivalDocId } from '../lib/team-rivals';
import {
  MAX_QUERY_LENGTH,
  matchesTeamQuery,
  parseTeamQuery,
  rankTeamMatch,
} from '../lib/team-search';
import { getTeamPermissionOrThrow, hasPermission, resolveGroupRole } from './group-management';

/**
 * Desafíos entre equipos de DISTINTOS grupos.
 *
 * La web ya tenía el flujo (`challengeTeamPostAction` / `acceptTeamChallengeAction`
 * en server-actions.ts) y el móvil no tenía nada. Esto es el equivalente para
 * la app, compatible con lo que escribe la web: las invitaciones viven en
 * `teams/{equipoDesafiado}/invitations` con `type: 'team_challenge'` y, al
 * aceptar, se crea un partido `intergroup_friendly`.
 *
 * Cuatro callables:
 *  - `searchTeams`          buscador por nombre (nunca lista sin búsqueda).
 *  - `challengeTeam`        manda el desafío.
 *  - `respondTeamChallenge` acepta (crea el partido) o rechaza.
 *  - `getMyTeamChallenges`  desafíos pendientes de mis equipos.
 */

type Doc = Record<string, any>;

const REGION = { region: 'us-central1' } as const;
const MAX_RESULTS = 15;
const SEARCH_CANDIDATES = 100;
const MAX_MESSAGE = 200;

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

function cleanId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.includes('/')) return '';
  return id;
}

function memberCount(team: Doc): number {
  return Array.isArray(team.members) ? team.members.length : 0;
}

/** Quienes administran un equipo: su creador y los administradores de su grupo. */
export function teamManagerUids(team: Doc, group: Doc | undefined | null): string[] {
  const uids = new Set<string>();
  if (typeof team.createdBy === 'string' && team.createdBy) uids.add(team.createdBy);
  if (group) {
    if (typeof group.ownerUid === 'string' && group.ownerUid) uids.add(group.ownerUid);
    const roles: Array<{ userId?: string; role?: string }> = Array.isArray(group.memberRoles)
      ? group.memberRoles
      : [];
    for (const entry of roles) {
      if (entry.userId && (entry.role === 'admin' || entry.role === 'moderator')) uids.add(entry.userId);
    }
  }
  return [...uids];
}

async function notifyUsers(
  db: admin.firestore.Firestore,
  uids: string[],
  notification: { type: string; title: string; message: string; link: string; metadata?: Record<string, string> },
  logTag: string,
): Promise<void> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (unique.length === 0) return;
  const batch = db.batch();
  const createdAt = new Date().toISOString();
  for (const uid of unique) {
    batch.set(db.collection(`users/${uid}/notifications`).doc(), {
      ...notification,
      isRead: false,
      createdAt,
    });
  }
  await batch.commit();
  await sendPushToUsers(
    unique,
    {
      title: notification.title,
      body: notification.message,
      type: notification.type,
      link: notification.link,
      extraData: notification.metadata ?? {},
    },
    logTag,
  );
}

async function groupOf(db: admin.firestore.Firestore, team: Doc): Promise<Doc | null> {
  const groupId = cleanId(team.groupId);
  if (!groupId) return null;
  const snap = await db.doc(`groups/${groupId}`).get();
  return snap.exists ? (snap.data() as Doc) : null;
}

// ---------------------------------------------------------------------------
// Buscador
// ---------------------------------------------------------------------------

/**
 * Busca equipos por nombre, con coincidencia por prefijo en cualquier palabra
 * ("gal" encuentra "Los Galácticos").
 *
 * - Con menos de 2 letras NO devuelve nada: la pantalla no lista equipos hasta
 *   que la persona escribe.
 * - Devuelve datos públicos y mínimos. Nunca la lista de jugadores.
 * - Excluye el equipo propio, los del grupo indicado, los ocultos
 *   (`challengeOptOut`) y los que no tienen jugadores (no pueden jugar).
 */
export const searchTeams = onCall(REGION, async (request) => {
  requireAuth(request);
  const query = parseTeamQuery(String(request.data?.query ?? '').slice(0, MAX_QUERY_LENGTH));
  if (!query) return { ok: true, teams: [], tooShort: true };

  const excludeTeamId = cleanId(request.data?.excludeTeamId);
  const excludeGroupId = cleanId(request.data?.excludeGroupId);

  const db = admin.firestore();
  const snap = await db
    .collection('teams')
    .where('searchTokens', 'array-contains', query.anchor)
    .limit(SEARCH_CANDIDATES)
    .get();

  const candidates = snap.docs
    .map((doc): Doc & { id: string } => ({ ...(doc.data() as Doc), id: doc.id }))
    .filter(
      (team) =>
        team.id !== excludeTeamId &&
        (!excludeGroupId || team.groupId !== excludeGroupId) &&
        team.challengeOptOut !== true &&
        memberCount(team) > 0 &&
        matchesTeamQuery(team.name, query),
    )
    .sort(
      (a, b) =>
        rankTeamMatch(a.name, query) - rankTeamMatch(b.name, query) ||
        String(a.name).length - String(b.name).length ||
        String(a.name).localeCompare(String(b.name), 'es'),
    )
    .slice(0, MAX_RESULTS);

  const groupIds = [...new Set(candidates.map((team) => cleanId(team.groupId)).filter(Boolean))];
  const groupSnaps = groupIds.length ? await db.getAll(...groupIds.map((id) => db.doc(`groups/${id}`))) : [];
  const groupNames = new Map(groupSnaps.map((g) => [g.id, String(g.data()?.name ?? '')]));

  return {
    ok: true,
    teams: candidates.map((team) => ({
      id: team.id,
      name: String(team.name ?? ''),
      jersey: team.jersey ?? null,
      groupId: cleanId(team.groupId),
      groupName: groupNames.get(cleanId(team.groupId)) ?? '',
      memberCount: memberCount(team),
    })),
  };
});

// ---------------------------------------------------------------------------
// Desafiar
// ---------------------------------------------------------------------------

function optionalText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Valida y normaliza la propuesta opcional de fecha y hora. Devuelve `null` si
 * no mandaron ninguna; lanza si mandaron una inválida o ya pasada.
 */
export function parseProposal(date: unknown, time: unknown): { date: string; time: string } | null {
  const d = typeof date === 'string' ? date.trim() : '';
  const t = typeof time === 'string' ? time.trim() : '';
  if (!d && !t) return null;
  const when = d && t ? buildMatchDateTime(d, t) : null;
  if (!when) throw new HttpsError('invalid-argument', 'Elegí una fecha y hora válidas, o dejá ambas por definir.');
  if (when.getTime() < Date.now() - 60_000) throw new HttpsError('invalid-argument', 'El horario propuesto ya pasó.');
  return { date: d, time: t };
}

export const challengeTeam = onCall(REGION, async (request) => {
  const uid = requireAuth(request);
  const fromTeamId = cleanId(request.data?.fromTeamId);
  const toTeamId = cleanId(request.data?.toTeamId);
  if (!fromTeamId || !toTeamId) throw new HttpsError('invalid-argument', 'Faltan los equipos.');
  if (fromTeamId === toTeamId) throw new HttpsError('invalid-argument', 'No podés desafiar a tu propio equipo.');

  const message = optionalText(request.data?.message, MAX_MESSAGE);
  const proposal = parseProposal(request.data?.date, request.data?.time);
  const proposedLocationName = optionalText(request.data?.locationName, 80);

  const db = admin.firestore();
  // Sólo quien administra el equipo que desafía (su creador o un admin del grupo).
  const { team: fromTeam } = await getTeamPermissionOrThrow(db, fromTeamId, uid, 'teams.edit');
  const toSnap = await db.doc(`teams/${toTeamId}`).get();
  if (!toSnap.exists) throw new HttpsError('not-found', 'Ese equipo ya no existe.');
  const toTeam = toSnap.data() as Doc;

  if (toTeam.challengeOptOut === true) {
    throw new HttpsError('failed-precondition', 'Ese equipo no recibe desafíos por ahora.');
  }
  if (fromTeam.groupId && fromTeam.groupId === toTeam.groupId) {
    throw new HttpsError(
      'failed-precondition',
      'Los dos equipos son del mismo grupo: armá el partido con "Enfrentar dos equipos".',
    );
  }
  if (memberCount(fromTeam) === 0 || memberCount(toTeam) === 0) {
    throw new HttpsError('failed-precondition', 'Los dos equipos necesitan jugadores para jugar un partido.');
  }

  const invitations = db.collection(`teams/${toTeamId}/invitations`);
  const [fromGroup, toGroup] = await Promise.all([groupOf(db, fromTeam), groupOf(db, toTeam)]);

  const invitationRef = invitations.doc();
  const isRematch = await db.runTransaction(async tx => {
    const freshFrom = await teamAccess(db, uid, fromTeamId, true, tx);
    const freshTo = await tx.get(db.doc(`teams/${toTeamId}`));
    const opponent = freshTo.data();
    if (!opponent || opponent.challengeOptOut || opponent.groupId === freshFrom.data.groupId || !memberCount(opponent) || !memberCount(freshFrom.data)) throw new HttpsError('failed-precondition', 'Revisá los equipos y si reciben desafíos.');
    const limitRef = db.doc(`teamChallengeLimits/${fromTeamId}`);
    const limit = (await tx.get(limitRef)).data();
    const state = await challengeState(tx, db, fromTeamId, toTeamId);
    if (state.upcoming) throw new HttpsError('already-exists', 'Ya tienen un partido acordado.');
    if (state.pair.invitationPath) {
      const prior = await tx.get(db.doc(state.pair.invitationPath));
      if (prior.data()?.status === 'pending') throw new HttpsError('already-exists', 'Ya hay un desafío pendiente entre estos equipos.');
    }
    const sent = await tx.get(db.collectionGroup('invitations').where('fromTeamId', '==', fromTeamId).where('status', '==', 'pending').limit(11));
    const daily = await tx.get(db.collectionGroup('invitations').where('fromTeamId', '==', fromTeamId).where('createdAt', '>=', new Date(Date.now() - 86400000).toISOString()).limit(21));
    const incoming = await tx.get(db.collection(`teams/${fromTeamId}/invitations`).where('fromTeamId', '==', toTeamId));
    if (sent.docs.some(d => d.data().toTeamId === toTeamId && d.data().status === 'pending') || incoming.docs.some(d => d.data().status === 'pending')) throw new HttpsError('already-exists', 'Ya hay un desafío pendiente entre estos equipos.');
    if (sent.size >= 10) throw new HttpsError('resource-exhausted', 'Tu equipo ya tiene demasiados desafíos pendientes.');
    if (daily.size >= 20) throw new HttpsError('resource-exhausted', 'Tu equipo alcanzó los 20 desafíos en 24 horas.');
    const rivalRef = db.doc(`teamRivals/${rivalDocId(fromTeamId, toTeamId)}`);
    const rival = (await tx.get(rivalRef)).data();
    tx.set(limitRef, {revision: Number(limit?.revision ?? 0) + 1, lastSentAt: new Date().toISOString()});
    tx.set(state.pairRef, {invitationPath: invitationRef.path, updatedAt: new Date().toISOString()});
    if (rival) tx.update(rivalRef, {lastChallengeAt: new Date().toISOString()});
    tx.set(invitationRef, {
    type: 'team_challenge',
    status: 'pending',
    fromTeamId,
    fromTeamName: String(fromTeam.name ?? ''),
    fromTeamJersey: fromTeam.jersey ?? null,
    fromGroupId: String(fromTeam.groupId ?? ''),
    fromGroupName: String(fromGroup?.name ?? ''),
    toTeamId,
    toTeamName: String(toTeam.name ?? ''),
    toTeamJersey: toTeam.jersey ?? null,
    createdBy: uid,
    createdAt: new Date().toISOString(),
    ...(message ? { message } : {}),
    ...(proposal ? { proposedDate: proposal.date, proposedTime: proposal.time } : {}),
    ...(proposedLocationName ? { proposedLocationName } : {}),
    isRematch: Number(rival?.played ?? 0) > 0,
  });
    return Number(rival?.played ?? 0) > 0;
  });

  await notifyUsers(
    db,
    teamManagerUids(toTeam, toGroup),
    {
      type: isRematch ? 'team_rematch' : 'team_challenge',
      title: isRematch ? '¡Te proponen una revancha!' : '¡Desafío recibido!',
      message: `"${fromTeam.name}"${fromGroup?.name ? ` (${fromGroup.name})` : ''} quiere jugar contra "${toTeam.name}".`,
      link: '/challenges',
      metadata: { invitationId: invitationRef.id, toTeamId, fromTeamId },
    },
    'ChallengeTeam',
  );

  return { ok: true, invitationId: invitationRef.id };
});

// ---------------------------------------------------------------------------
// Responder
// ---------------------------------------------------------------------------

export { buildChallengeTeams } from '../lib/challenge-roster';

export const respondTeamChallenge = onCall(REGION, async (request) => {
  const uid = requireAuth(request);
  const toTeamId = cleanId(request.data?.toTeamId);
  const invitationId = cleanId(request.data?.invitationId);
  const accepted = request.data?.accepted === true;
  if (!toTeamId || !invitationId) throw new HttpsError('invalid-argument', 'Falta el desafío.');

  const db = admin.firestore();
  // Responde quien administra el equipo desafiado: su creador o un admin del grupo.
  const { team: toTeam } = await getTeamPermissionOrThrow(db, toTeamId, uid, 'teams.edit');

  const invitationRef = db.doc(`teams/${toTeamId}/invitations/${invitationId}`);
  const matchRef = db.collection('matches').doc(`challenge_${invitationId}`);

  const result = await db.runTransaction(async (tx) => {
    const freshTo = await teamAccess(db, uid, toTeamId, true, tx);
    const toTeam = freshTo.data;
    const invitationSnap = await tx.get(invitationRef);
    const invitation = invitationSnap.data() as Doc | undefined;
    if (!invitation || invitation.type !== 'team_challenge') {
      throw new HttpsError('not-found', 'El desafío ya no existe.');
    }
    if (invitation.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Este desafío ya fue respondido.');
    }

    const fromTeamId = cleanId(invitation.fromTeamId);
    const fromSnap = fromTeamId ? await tx.get(db.doc(`teams/${fromTeamId}`)) : null;
    const fromTeam = fromSnap?.data() as Doc | undefined;

    if (!accepted) {
      tx.update(invitationRef, { status: 'declined', respondedBy: uid, respondedAt: new Date().toISOString() });
      return { accepted: false as const, invitation, fromTeam };
    }

    if (!fromTeam) throw new HttpsError('failed-precondition', 'El equipo que desafió ya no existe.');
    if (toTeam.groupId && toTeam.groupId === fromTeam.groupId) {
      throw new HttpsError('failed-precondition', 'Los dos equipos pasaron a ser del mismo grupo.');
    }

    const memberIds = [
      ...new Set(
        [toTeam, fromTeam].flatMap((team) =>
          (Array.isArray(team.members) ? team.members : []).map((m: Doc) => String(m?.playerId ?? '')).filter(Boolean),
        ),
      ),
    ];
    const playerSnaps = memberIds.length ? await tx.getAll(...memberIds.map((id) => db.doc(`players/${id}`))) : [];
    const playersById = new Map<string, Doc>();
    for (const snap of playerSnaps) if (snap.exists) playersById.set(snap.id, snap.data() as Doc);

    const teams = buildChallengeTeams(
      [
        { id: toTeamId, data: toTeam },
        { id: fromTeamId, data: fromTeam },
      ],
      playersById,
    );
    const players = teams.flatMap((team) => team.players as Array<Doc>);
    const playerUids = players.map((p) => p.uid as string);

    // Fecha y cancha: si quien desafió propuso, se usan; si no, el partido
    // arranca en "a definir" y los capitanes la votan con el flujo de siempre.
    const proposal =
      typeof invitation.proposedDate === 'string' && typeof invitation.proposedTime === 'string'
        ? (() => {
            try {
              return parseProposal(invitation.proposedDate, invitation.proposedTime);
            } catch {
              return null; // la propuesta venció mientras esperaba respuesta
            }
          })()
        : null;
    const locationName = optionalText(invitation.proposedLocationName, 80);

    const captains = [...new Set([String(invitation.createdBy ?? ''), uid].filter(Boolean))];
    const groupIds = [...new Set([toTeam.groupId, fromTeam.groupId].map((g) => cleanId(g)).filter(Boolean))];

    const pairState = await challengeState(tx, db, toTeamId, fromTeamId);
    if (pairState.upcoming) throw new HttpsError('already-exists', 'Ya tienen un partido acordado.');
    await acceptedRivals(tx, db, [{id: toTeamId, data: toTeam}, {id: fromTeamId, data: fromTeam}]);
    tx.set(pairState.pairRef, {matchId: matchRef.id, invitationPath: invitationRef.path, updatedAt: new Date().toISOString()});
    tx.create(matchRef, {
      title: `${toTeam.name} vs ${fromTeam.name}`,
      type: 'intergroup_friendly',
      date: proposal?.date ?? '',
      time: proposal?.time ?? '',
      status: proposal ? 'upcoming' : 'planning',
      matchSize: Math.max(2, players.length),
      isPublic: false,
      ownerUid: uid,
      captains,
      groupId: cleanId(toTeam.groupId) || null,
      participantGroupIds: groupIds,
      participantTeamIds: [toTeamId, fromTeamId],
      location: { name: locationName, address: '', lat: 0, lng: 0, placeId: '' },
      players,
      playerUids,
      teams,
      teamsGenerated: true,
      events: [],
      challengeInvitationId: invitationId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(proposal ? {} : { isVotingOpen: true, dateProposals: [] }),
    });
    tx.update(invitationRef, {
      status: 'accepted',
      matchId: matchRef.id,
      respondedBy: uid,
      respondedAt: new Date().toISOString(),
    });
    return { accepted: true as const, invitation, fromTeam };
  });

  const fromGroup = result.fromTeam ? await groupOf(db, result.fromTeam) : null;
  const challengers = [
    String(result.invitation.createdBy ?? ''),
    ...(result.fromTeam ? teamManagerUids(result.fromTeam, fromGroup) : []),
  ];

  if (result.accepted) {
    await notifyUsers(
      db,
      challengers,
      {
        type: 'challenge_accepted',
        title: '¡Desafío aceptado!',
        message: `"${toTeam.name}" aceptó jugar contra "${result.fromTeam?.name ?? 'tu equipo'}". El partido ya está creado.`,
        link: `/matches/${matchRef.id}`,
        metadata: { matchId: matchRef.id },
      },
      'RespondTeamChallenge',
    );
    return { ok: true, accepted: true, matchId: matchRef.id };
  }

  await notifyUsers(
    db,
    challengers,
    {
      type: 'match_update',
      title: 'Desafío rechazado',
      message: `"${toTeam.name}" no puede jugar por ahora.`,
      link: '/challenges',
    },
    'RespondTeamChallenge',
  );
  return { ok: true, accepted: false };
});

// ---------------------------------------------------------------------------
// Pendientes
// ---------------------------------------------------------------------------

/** Desafíos pendientes que recibieron los equipos que administro. */
export const getMyTeamChallenges = onCall(REGION, async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();

  const managed = new Map<string, Doc>();
  const created = await db.collection('teams').where('createdBy', '==', uid).limit(50).get();
  created.docs.forEach((doc) => managed.set(doc.id, doc.data() as Doc));

  const groups = await db.collection('groups').where('members', 'array-contains', uid).limit(20).get();
  const adminGroupIds = groups.docs
    .filter((doc) => {
      const role = resolveGroupRole(doc.data(), uid);
      return !!role && hasPermission(role, 'teams.edit');
    })
    .map((doc) => doc.id);
  const groupTeams = await Promise.all(
    adminGroupIds.map((groupId) => db.collection('teams').where('groupId', '==', groupId).limit(50).get()),
  );
  groupTeams.forEach((snap) => snap.docs.forEach((doc) => managed.set(doc.id, doc.data() as Doc)));

  const lists = await Promise.all(
    [...managed.keys()].slice(0, 60).map(async (teamId) => {
      const snap = await db
        .collection(`teams/${teamId}/invitations`)
        .where('status', '==', 'pending')
        .where('type', '==', 'team_challenge')
        .limit(20)
        .get();
      return snap.docs.map((doc): Doc & { id: string } => ({ ...(doc.data() as Doc), id: doc.id }));
    }),
  );

  const incoming = lists
    .flat()
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, 50)
    .map((invitation) => ({
      id: invitation.id,
      toTeamId: String(invitation.toTeamId ?? ''),
      toTeamName: String(invitation.toTeamName ?? ''),
      fromTeamId: String(invitation.fromTeamId ?? ''),
      fromTeamName: String(invitation.fromTeamName ?? ''),
      fromTeamJersey: invitation.fromTeamJersey ?? null,
      fromGroupName: String(invitation.fromGroupName ?? ''),
      message: String(invitation.message ?? ''),
      proposedDate: String(invitation.proposedDate ?? ''),
      proposedTime: String(invitation.proposedTime ?? ''),
      proposedLocationName: String(invitation.proposedLocationName ?? ''),
      createdAt: String(invitation.createdAt ?? ''),
    }));

  return { ok: true, incoming };
});
