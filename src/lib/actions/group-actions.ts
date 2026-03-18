'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { requireAuth } from '@/lib/auth/get-server-session';
import { hasPermission } from '@/lib/group-permissions';
import type { Group } from '@/lib/types';
import { nanoid } from 'nanoid';

async function resolveGroupRole(group: Group, userId: string): Promise<'admin' | 'moderator' | 'member' | null> {
  if (group.ownerUid === userId) {
    return 'admin';
  }
  const role = group.memberRoles?.find((member) => member.userId === userId)?.role;
  if (role) {
    return role;
  }
  if (group.members?.includes(userId)) {
    return 'member';
  }
  return null;
}

export async function createGroupAction(name: string) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const inviteCode = nanoid(8);
    const groupRef = db.collection('groups').doc();
    const userRef = db.collection('users').doc(userId);
    const batch = db.batch();

    batch.set(groupRef, {
      name,
      ownerUid: userId,
      inviteCode,
      members: [userId],
      memberRoles: [{ userId, role: 'admin', joinedAt: new Date().toISOString(), addedBy: userId }],
      createdAt: new Date().toISOString(),
    });

    batch.set(userRef, {
      activeGroupId: groupRef.id,
      groups: [groupRef.id],
    }, { merge: true });

    await batch.commit();
    return { success: true, groupId: groupRef.id };
  } catch (error: any) {
    console.error('Error creating group:', error);
    return { success: false, error: error.message || 'No se pudo crear el grupo.' };
  }
}

export async function joinGroupByInviteCodeAction(inviteCode: string) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const snapshot = await db.collection('groups').where('inviteCode', '==', inviteCode).limit(1).get();

    if (snapshot.empty) {
      return { success: false, error: 'No se encontró ningún grupo con ese código.' };
    }

    const groupDoc = snapshot.docs[0];
    const group = { id: groupDoc.id, ...groupDoc.data() } as Group;

    if (group.members.includes(userId)) {
      return { success: false, error: 'Ya perteneces a este grupo.' };
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const existingGroups = Array.isArray(userSnap.data()?.groups) ? userSnap.data()?.groups : [];
    const nextMemberRoles = group.memberRoles
      ? [...group.memberRoles, { userId, role: 'member', joinedAt: new Date().toISOString(), addedBy: group.ownerUid }]
      : undefined;

    const batch = db.batch();
    batch.update(groupDoc.ref, {
      members: [...group.members, userId],
      ...(nextMemberRoles ? { memberRoles: nextMemberRoles } : {}),
    });
    batch.set(userRef, {
      activeGroupId: groupDoc.id,
      groups: existingGroups.includes(groupDoc.id) ? existingGroups : [...existingGroups, groupDoc.id],
    }, { merge: true });

    await batch.commit();
    return { success: true, groupId: groupDoc.id, groupName: group.name };
  } catch (error: any) {
    console.error('Error joining group:', error);
    return { success: false, error: error.message || 'No se pudo unir al grupo.' };
  }
}

export async function editGroupNameAction(groupId: string, name: string) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return { success: false, error: 'Grupo no encontrado.' };
    }

    const group = { id: groupSnap.id, ...groupSnap.data() } as Group;
    const role = await resolveGroupRole(group, userId);
    if (!role || !hasPermission(role, 'group.edit')) {
      return { success: false, error: 'No tienes permiso para editar este grupo.' };
    }

    await groupRef.update({ name });
    return { success: true };
  } catch (error: any) {
    console.error('Error editing group:', error);
    return { success: false, error: error.message || 'No se pudo actualizar el grupo.' };
  }
}

export async function setActiveGroupAction(groupId: string) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const [groupSnap, userSnap] = await Promise.all([
      db.collection('groups').doc(groupId).get(),
      db.collection('users').doc(userId).get(),
    ]);

    if (!groupSnap.exists) {
      return { success: false, error: 'Grupo no encontrado.' };
    }

    const group = { id: groupSnap.id, ...groupSnap.data() } as Group;
    if (!group.members?.includes(userId)) {
      return { success: false, error: 'No perteneces a este grupo.' };
    }

    const existingGroups = Array.isArray(userSnap.data()?.groups) ? userSnap.data()?.groups : [];
    const nextGroups = existingGroups.includes(groupId) ? existingGroups : [...existingGroups, groupId];

    await db.collection('users').doc(userId).set({
      activeGroupId: groupId,
      groups: nextGroups,
    }, { merge: true });

    return { success: true, groupName: group.name };
  } catch (error: any) {
    console.error('Error setting active group:', error);
    return { success: false, error: error.message || 'No se pudo cambiar de grupo.' };
  }
}

export async function deleteGroupAction(groupId: string) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return { success: false, error: 'Grupo no encontrado.' };
    }

    const group = { id: groupSnap.id, ...groupSnap.data() } as Group;
    if (group.ownerUid !== userId) {
      return { success: false, error: 'Solo el dueño puede eliminar este grupo.' };
    }

    const [playersSnap, matchesSnap, teamsSnap] = await Promise.all([
      db.collection('players').where('groupId', '==', groupId).get(),
      db.collection('matches').where('groupId', '==', groupId).get(),
      db.collection('teams').where('groupId', '==', groupId).get(),
    ]);

    const memberUserSnaps = group.members?.length
      ? await Promise.all(group.members.map((memberId) => db.collection('users').doc(memberId).get()))
      : [];

    const batch = db.batch();

    playersSnap.docs.forEach((playerDoc) => batch.delete(playerDoc.ref));
    matchesSnap.docs.forEach((matchDoc) => batch.delete(matchDoc.ref));
    teamsSnap.docs.forEach((teamDoc) => batch.delete(teamDoc.ref));
    batch.delete(groupRef);

    memberUserSnaps.forEach((userDoc) => {
      if (!userDoc.exists) {
        return;
      }
      const data = userDoc.data() || {};
      const groups = Array.isArray(data.groups) ? data.groups.filter((id: string) => id !== groupId) : [];
      const nextActiveGroupId = data.activeGroupId === groupId ? (groups[0] ?? null) : data.activeGroupId;
      batch.set(userDoc.ref, {
        groups,
        activeGroupId: nextActiveGroupId,
      }, { merge: true });
    });

    await batch.commit();
    return { success: true, groupName: group.name };
  } catch (error: any) {
    console.error('Error deleting group:', error);
    return { success: false, error: error.message || 'No se pudo eliminar el grupo.' };
  }
}