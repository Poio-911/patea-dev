import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

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

function hasPermission(role: GroupRole, permission: GroupPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

function resolveGroupRole(group: admin.firestore.DocumentData, uid: string): GroupRole | null {
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

async function getTeamPermissionOrThrow(db: admin.firestore.Firestore, teamId: string, uid: string, permission: GroupPermission) {
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

/** Port de createTeamAction. */
export const createTeam = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const groupId = String(request.data?.groupId ?? '');
  const name = String(request.data?.name ?? '').trim();
  const jersey = request.data?.jersey ?? {};
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
  });

  return { ok: true, id: teamRef.id };
});

/** Port de updateTeamAction. */
export const updateTeam = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireAuth(request);
  const teamId = String(request.data?.teamId ?? '');
  const name = String(request.data?.name ?? '').trim();
  const jersey = request.data?.jersey ?? {};

  const db = admin.firestore();
  const { teamRef } = await getTeamPermissionOrThrow(db, teamId, uid, 'teams.edit');
  await teamRef.update({ name, jersey });
  return { ok: true };
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
