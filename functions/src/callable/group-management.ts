import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { buildTeamSearchTokens, normalizeSearchText } from '../lib/team-search';

/**
 * Callables de Grupos y Equipos — port de src/lib/actions/{group-actions,team-actions}.ts.
 * Necesarias porque firestore.rules tiene `allow create/update/delete: if false`
 * tanto en /groups/{groupId} como en /teams/{teamId} a propósito.
 */

type GroupRole = 'admin' | 'moderator' | 'member';
type GroupPermission = 'teams.create' | 'teams.edit' | 'teams.delete';

// Subconjunto de ROLE_PERMISSIONS (src/lib/group-permissions.ts) que necesitan
// estas Cloud Functions.
//
// Cualquier miembro puede crear equipos: el equipo queda del grupo y con
// `createdBy` en quien lo creó, y por `getTeamPermissionOrThrow` el creador
// después puede editarlo y borrarlo aunque no tenga 'teams.edit' por rol.
// Editar o borrar equipos *ajenos* sigue siendo de admin/moderator.
const ROLE_PERMISSIONS: Record<GroupRole, GroupPermission[]> = {
  admin: ['teams.create', 'teams.edit', 'teams.delete'],
  moderator: ['teams.create', 'teams.edit'],
  member: ['teams.create'],
};

export function hasPermission(role: GroupRole, permission: GroupPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function resolveGroupRole(group: admin.firestore.DocumentData, uid: string): GroupRole | null {
  if (group.ownerUid === uid) return 'admin';
  const explicit = (group.memberRoles as Array<{ userId: string; role: GroupRole }> | undefined)?.find((m) => m.userId === uid)?.role;
  if (explicit) return explicit;
  if ((group.members as string[] | undefined)?.includes(uid)) return 'member';
  return null;
}

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/** Port de createGroupAction. */
export const createGroup = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const name = String(request.data?.name ?? '').trim();
  if (name.length < 3) throw new HttpsError('invalid-argument', 'El nombre debe tener al menos 3 caracteres.');

  const db = admin.firestore();
  const groupRef = db.collection('groups').doc();
  const userRef = db.collection('users').doc(uid);
  const batch = db.batch();

  batch.set(groupRef, {
    name,
    ownerUid: uid,
    inviteCode: generateInviteCode(),
    members: [uid],
    memberRoles: [{ userId: uid, role: 'admin', joinedAt: new Date().toISOString(), addedBy: uid }],
    createdAt: new Date().toISOString(),
  });
  batch.set(userRef, { activeGroupId: groupRef.id, groups: admin.firestore.FieldValue.arrayUnion(groupRef.id) }, { merge: true });

  await batch.commit();
  return { ok: true, groupId: groupRef.id };
});

/** Port de joinGroupByInviteCodeAction. */
export const joinGroupByInviteCode = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const inviteCode = String(request.data?.inviteCode ?? '').trim();
  if (!inviteCode) throw new HttpsError('invalid-argument', 'Ingresá un código de invitación.');

  const db = admin.firestore();
  const snap = await db.collection('groups').where('inviteCode', '==', inviteCode).limit(1).get();
  if (snap.empty) throw new HttpsError('not-found', 'No se encontró ningún grupo con ese código.');

  const groupDoc = snap.docs[0];
  const group = groupDoc.data();
  const members: string[] = Array.isArray(group.members) ? group.members : [];
  if (members.includes(uid)) throw new HttpsError('already-exists', 'Ya perteneces a este grupo.');

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const existingGroups: string[] = Array.isArray(userSnap.data()?.groups) ? userSnap.data()!.groups : [];
  const memberRoles = Array.isArray(group.memberRoles) ? [...group.memberRoles] : undefined;
  if (memberRoles) memberRoles.push({ userId: uid, role: 'member', joinedAt: new Date().toISOString(), addedBy: group.ownerUid });

  const batch = db.batch();
  batch.update(groupDoc.ref, {
    members: [...members, uid],
    ...(memberRoles ? { memberRoles } : {}),
  });
  batch.set(userRef, {
    activeGroupId: groupDoc.id,
    groups: existingGroups.includes(groupDoc.id) ? existingGroups : [...existingGroups, groupDoc.id],
  }, { merge: true });

  await batch.commit();
  return { ok: true, groupId: groupDoc.id, groupName: group.name };
});

/** Port de setActiveGroupAction. */
export const setActiveGroup = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const groupId = String(request.data?.groupId ?? '');

  const db = admin.firestore();
  const [groupSnap, userSnap] = await Promise.all([
    db.collection('groups').doc(groupId).get(),
    db.collection('users').doc(uid).get(),
  ]);
  if (!groupSnap.exists) throw new HttpsError('not-found', 'Grupo no encontrado.');
  const group = groupSnap.data()!;
  if (!(group.members as string[] | undefined)?.includes(uid)) {
    throw new HttpsError('permission-denied', 'No perteneces a este grupo.');
  }

  const existingGroups: string[] = Array.isArray(userSnap.data()?.groups) ? userSnap.data()!.groups : [];
  const nextGroups = existingGroups.includes(groupId) ? existingGroups : [...existingGroups, groupId];

  await db.collection('users').doc(uid).set({ activeGroupId: groupId, groups: nextGroups }, { merge: true });
  return { ok: true, groupName: group.name };
});

export async function getTeamPermissionOrThrow(db: admin.firestore.Firestore, teamId: string, uid: string, permission: GroupPermission) {
  const teamRef = db.collection('teams').doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) throw new HttpsError('not-found', 'Equipo no encontrado.');
  const team = teamSnap.data()!;

  if (team.createdBy !== uid) {
    const groupSnap = await db.collection('groups').doc(team.groupId).get();
    if (!groupSnap.exists) throw new HttpsError('not-found', 'Grupo no encontrado.');
    const role = resolveGroupRole(groupSnap.data()!, uid);
    if (!role || !hasPermission(role, permission)) {
      throw new HttpsError('permission-denied', 'No tienes permiso para realizar esta acción sobre este equipo.');
    }
  }
  return { teamRef, team };
}

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value.trim());
}

const DEFAULT_PROJECT_ID = 'mil-disculpis';
const CREST_STORAGE_FOLDER = 'team-crests';

/** Buckets del propio proyecto: los de la config de Functions o los por defecto. */
function projectStorageBuckets(): string[] {
  const buckets = new Set<string>();
  const projectId =
    process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT_ID;
  buckets.add(`${projectId}.firebasestorage.app`);
  buckets.add(`${projectId}.appspot.com`);
  try {
    const configured = JSON.parse(process.env.FIREBASE_CONFIG ?? '{}')?.storageBucket;
    if (typeof configured === 'string' && configured) buckets.add(configured);
  } catch {
    // FIREBASE_CONFIG ausente o inválido: alcanzan los buckets por defecto.
  }
  return [...buckets];
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Un escudo subido es válido sólo si es una URL https del Storage de ESTE
 * proyecto y apunta a `team-crests/` (y, si se conoce, al grupo del equipo).
 * Chequear nada más el host dejaba apuntar a cualquier objeto de cualquier
 * bucket de Firebase.
 */
function isAllowedCrestUrl(value: unknown, groupId?: string): value is string {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;

  let bucket: string;
  let objectPath: string | null;
  if (url.hostname === 'firebasestorage.googleapis.com') {
    const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    if (!match) return false;
    bucket = match[1];
    objectPath = safeDecode(match[2]);
  } else if (url.hostname === 'storage.googleapis.com') {
    const match = /^\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (!match) return false;
    bucket = match[1];
    objectPath = safeDecode(match[2]);
  } else {
    return false;
  }

  if (objectPath === null || objectPath.includes('..')) return false;
  if (!projectStorageBuckets().includes(bucket)) return false;
  const requiredPrefix = groupId
    ? `${CREST_STORAGE_FOLDER}/${groupId}/`
    : `${CREST_STORAGE_FOLDER}/`;
  return objectPath.startsWith(requiredPrefix);
}

/**
 * Normaliza el payload de camiseta y escudo conservando compatibilidad con
 * la web (`type`, `primaryColor`, `secondaryColor`) y validando `crestUrl`.
 */
export function sanitizeJerseyPayload(
  raw: unknown,
  options: { groupId?: string } = {},
): Record<string, unknown> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {
    type: typeof input.type === 'string' && input.type.trim() ? input.type.trim().slice(0, 40) : 'plain',
    primaryColor: isValidHexColor(input.primaryColor) ? input.primaryColor.trim() : '#2563EB',
    secondaryColor: isValidHexColor(input.secondaryColor) ? input.secondaryColor.trim() : '#FFFFFF',
  };

  const mode = typeof input.crestMode === 'string' ? input.crestMode.trim() : '';
  if (mode === 'none') return out;

  if (input.crestUrl !== undefined && String(input.crestUrl).trim() !== '') {
    if (!isAllowedCrestUrl(input.crestUrl, options.groupId)) {
      throw new HttpsError('invalid-argument', 'El escudo debe estar alojado en el Storage del proyecto.');
    }
    out.crestMode = 'uploaded';
    out.crestUrl = input.crestUrl.trim();
    if (input.crestClipCircle === true) out.crestClipCircle = true;
    return out;
  }

  const shape = typeof input.crestShape === 'string' ? input.crestShape.trim().slice(0, 24) : '';
  if (mode === 'custom' || (shape && shape !== 'none')) {
    out.crestMode = 'custom';
    out.crestShape = shape && shape !== 'none' ? shape : 'classic';
    if (typeof input.crestLayout === 'string' && input.crestLayout.trim()) {
      out.crestLayout = input.crestLayout.trim().slice(0, 24);
    }
    if (typeof input.crestPattern === 'string' && input.crestPattern.trim()) {
      out.crestPattern = input.crestPattern.trim().slice(0, 24);
    }
    if (typeof input.crestSymbol === 'string' && input.crestSymbol.trim()) {
      out.crestSymbol = input.crestSymbol.trim().slice(0, 24);
    }
    const crestText = typeof input.crestText === 'string'
      ? input.crestText.trim().slice(0, 14)
      : (typeof input.crestInitials === 'string' ? input.crestInitials.trim().slice(0, 14) : '');
    if (crestText) {
      out.crestText = crestText;
      out.crestInitials = crestText.slice(0, 4).trim();
    }
    if (typeof input.crestSubtitle === 'string' && input.crestSubtitle.trim()) {
      out.crestSubtitle = input.crestSubtitle.trim().slice(0, 10);
    }
    if (typeof input.crestTextLayout === 'string' && input.crestTextLayout.trim()) {
      out.crestTextLayout = input.crestTextLayout.trim().slice(0, 20);
    }
    if (typeof input.crestFont === 'string' && input.crestFont.trim()) {
      out.crestFont = input.crestFont.trim().slice(0, 20);
    }
    if (isValidHexColor(input.crestBorderColor)) {
      out.crestBorderColor = input.crestBorderColor.trim();
    }
    if (typeof input.crestStars === 'number' && Number.isFinite(input.crestStars)) {
      out.crestStars = Math.max(0, Math.min(3, Math.round(input.crestStars)));
    }
    if (input.crestLaurel === true) out.crestLaurel = true;
    if (input.crestCrownTop === true) out.crestCrownTop = true;
    if (input.crestShowBanner === true) out.crestShowBanner = true;
  }

  return out;
}

/** Port de createTeamAction. */
export const createTeam = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const groupId = String(request.data?.groupId ?? '');
  const name = String(request.data?.name ?? '').trim();
  const jersey = sanitizeJerseyPayload(request.data?.jersey, { groupId });
  const members = Array.isArray(request.data?.members) ? request.data.members : [];

  if (name.length < 2) throw new HttpsError('invalid-argument', 'El nombre del equipo es muy corto.');

  const db = admin.firestore();
  const groupSnap = await db.collection('groups').doc(groupId).get();
  if (!groupSnap.exists) throw new HttpsError('not-found', 'Grupo no encontrado.');

  const role = resolveGroupRole(groupSnap.data()!, uid);
  if (!role || !hasPermission(role, 'teams.create')) {
    throw new HttpsError('permission-denied', 'No tienes permiso para crear equipos en este grupo.');
  }

  const teamRef = await db.collection('teams').add({
    name,
    groupId,
    jersey,
    members,
    createdBy: uid,
    createdAt: new Date().toISOString(),
    // Para el buscador de rivales (ver lib/team-search.ts). El trigger
    // `onTeamWrite` los mantiene al día también cuando el nombre se cambia
    // desde la web.
    nameLower: normalizeSearchText(name),
    searchTokens: buildTeamSearchTokens(name),
  });

  return { ok: true, id: teamRef.id };
});

/** Port de updateTeamAction. */
export const updateTeam = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const teamId = String(request.data?.teamId ?? '');
  const name = String(request.data?.name ?? '').trim();

  if (name.length < 2) throw new HttpsError('invalid-argument', 'El nombre del equipo es muy corto.');

  const db = admin.firestore();
  const { teamRef, team } = await getTeamPermissionOrThrow(db, teamId, uid, 'teams.edit');
  // Se sanea DESPUÉS de cargar el equipo para atar el escudo a su grupo.
  const jersey = sanitizeJerseyPayload(request.data?.jersey, { groupId: String(team.groupId ?? '') });
  await teamRef.update({
    name,
    jersey,
    nameLower: normalizeSearchText(name),
    searchTokens: buildTeamSearchTokens(name),
  });
  return { ok: true };
});

/**
 * Mostrar u ocultar un equipo en el buscador de rivales.
 *
 * Por defecto todos los equipos se pueden buscar y desafiar; esto es el "no
 * quiero recibir desafíos": el equipo sale de los resultados del buscador y
 * `challengeTeam` lo rechaza.
 */
export const setTeamChallengeOptOut = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const teamId = String(request.data?.teamId ?? '');
  const optOut = request.data?.optOut === true;
  if (!teamId || teamId.includes('/')) throw new HttpsError('invalid-argument', 'Falta el equipo.');

  const db = admin.firestore();
  const { teamRef } = await getTeamPermissionOrThrow(db, teamId, uid, 'teams.edit');
  await teamRef.update({ challengeOptOut: optOut });
  return { ok: true, optOut };
});

/** Port de updateTeamMembersAction. */
export const updateTeamMembers = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const teamId = String(request.data?.teamId ?? '');
  const members = Array.isArray(request.data?.members) ? request.data.members : [];

  const db = admin.firestore();
  const { teamRef } = await getTeamPermissionOrThrow(db, teamId, uid, 'teams.edit');
  await teamRef.update({ members });
  return { ok: true };
});

/** Port de deleteTeamAction. */
export const deleteTeam = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const teamId = String(request.data?.teamId ?? '');

  const db = admin.firestore();
  const { teamRef } = await getTeamPermissionOrThrow(db, teamId, uid, 'teams.delete');
  await teamRef.delete();
  return { ok: true };
});
