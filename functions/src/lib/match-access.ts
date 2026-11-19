import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Quién puede ver, anotarse y gestionar un partido.
 *
 * Hasta ahora ninguna Cloud Function miraba `isPublic` ni la pertenencia al
 * grupo: `firestore.rules` deja leer cualquier partido a cualquier usuario con
 * sesión, y `joinMatch` / `requestJoinMatch` aceptaban a quien llegara con el
 * id. "Sólo el grupo" era una etiqueta de la pantalla, no una regla.
 *
 * Todo lo que decide acceso vive acá, en funciones puras fáciles de testear, y
 * los callables sólo las llaman.
 */

type Doc = Record<string, any>;

/** Partidos entre equipos con plantel propio: no admiten inscripción individual. */
export const TEAM_MATCH_TYPES = ['by_teams', 'intergroup_friendly'] as const;

export function isTeamMatch(match: Doc): boolean {
  return (TEAM_MATCH_TYPES as readonly string[]).includes(String(match.type ?? ''));
}

/** Los grupos que participan: el del partido más los de cada equipo, sin repetir. */
export function matchGroupIds(match: Doc): string[] {
  const ids = [
    ...(typeof match.groupId === 'string' && match.groupId ? [match.groupId] : []),
    ...(Array.isArray(match.participantGroupIds) ? match.participantGroupIds : []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0 && !id.includes('/'));
  return [...new Set(ids)];
}

/**
 * Organizador o capitán. Los capitanes existen en los partidos entre grupos
 * distintos (`intergroup_friendly`): cada equipo tiene el suyo, y ninguno
 * puede depender del organizador del otro para fijar la hora, arrancar o
 * cerrar el partido.
 */
export function isMatchManager(match: Doc, uid: string): boolean {
  if (!uid) return false;
  if (match.ownerUid === uid) return true;
  return Array.isArray(match.captains) && match.captains.includes(uid);
}

export function isGroupMember(group: Doc | undefined | null, uid: string): boolean {
  if (!group || !uid) return false;
  if (group.ownerUid === uid) return true;
  return Array.isArray(group.members) && group.members.includes(uid);
}

/**
 * ¿Puede `uid` sumarse (o pedir sumarse) a este partido?
 *
 * - Un partido público lo puede pedir cualquiera.
 * - Uno privado sólo los que ya tienen vínculo: organizador, capitanes,
 *   jugadores o miembros de alguno de los grupos que participan.
 */
export function canJoinMatch(match: Doc, uid: string, groups: Array<Doc | undefined | null>): boolean {
  if (match.isPublic === true) return true;
  if (isMatchManager(match, uid)) return true;
  if (Array.isArray(match.playerUids) && match.playerUids.includes(uid)) return true;
  return groups.some((group) => isGroupMember(group, uid));
}

/** Carga los grupos del partido y devuelve si `uid` puede sumarse. */
export async function userCanJoinMatch(
  db: admin.firestore.Firestore,
  match: Doc,
  uid: string,
): Promise<boolean> {
  if (match.isPublic === true || isMatchManager(match, uid)) return true;
  const ids = matchGroupIds(match);
  const snaps = ids.length ? await db.getAll(...ids.map((id) => db.doc(`groups/${id}`))) : [];
  return canJoinMatch(match, uid, snaps.map((s) => (s.exists ? s.data() : null)));
}

export function assertNotTeamMatch(match: Doc): void {
  if (isTeamMatch(match)) {
    throw new HttpsError(
      'failed-precondition',
      'Es un partido entre equipos con plantel armado. Los jugadores se suman desde su equipo, no de a uno.',
    );
  }
}

export async function assertCanJoinMatch(
  db: admin.firestore.Firestore,
  match: Doc,
  uid: string,
): Promise<void> {
  assertNotTeamMatch(match);
  if (!(await userCanJoinMatch(db, match, uid))) {
    throw new HttpsError('permission-denied', 'Este partido es sólo para el grupo.');
  }
}
