'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { requireAuth } from '@/lib/auth/get-server-session';
import { hasPermission } from '@/lib/group-permissions';
import type { Group, GroupTeam, GroupTeamMember, Jersey } from '@/lib/types';

async function getUserRoleForGroup(group: Group, userId: string): Promise<'admin' | 'moderator' | 'member' | null> {
  if (group.ownerUid === userId) {
    return 'admin';
  }

  const explicitRole = group.memberRoles?.find((member) => member.userId === userId)?.role;
  if (explicitRole) {
    return explicitRole;
  }

  if (group.members?.includes(userId)) {
    return 'member';
  }

  return null;
}

export async function createTeamAction(input: {
  name: string;
  groupId: string;
  jersey: Jersey;
  members: GroupTeamMember[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const groupSnap = await db.collection('groups').doc(input.groupId).get();

    if (!groupSnap.exists) {
      return { success: false, error: 'Grupo no encontrado.' };
    }

    const role = await getUserRoleForGroup({ id: groupSnap.id, ...groupSnap.data() } as Group, userId);
    if (!role || !hasPermission(role, 'teams.create')) {
      return { success: false, error: 'No tienes permiso para crear equipos en este grupo.' };
    }

    const teamRef = await db.collection('teams').add({
      name: input.name,
      groupId: input.groupId,
      jersey: input.jersey,
      members: input.members,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    });

    return { success: true, id: teamRef.id };
  } catch (error: any) {
    console.error('Error creating team:', error);
    return { success: false, error: error.message || 'No se pudo crear el equipo.' };
  }
}

export async function updateTeamAction(input: {
  teamId: string;
  name: string;
  jersey: Jersey;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const teamRef = db.collection('teams').doc(input.teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      return { success: false, error: 'Equipo no encontrado.' };
    }

    const team = { id: teamSnap.id, ...teamSnap.data() } as GroupTeam;

    if (team.createdBy !== userId) {
      const groupSnap = await db.collection('groups').doc(team.groupId).get();
      if (!groupSnap.exists) {
        return { success: false, error: 'Grupo no encontrado.' };
      }

      const role = await getUserRoleForGroup({ id: groupSnap.id, ...groupSnap.data() } as Group, userId);
      if (!role || !hasPermission(role, 'teams.edit')) {
        return { success: false, error: 'No tienes permiso para editar este equipo.' };
      }
    }

    await teamRef.update({
      name: input.name,
      jersey: input.jersey,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating team:', error);
    return { success: false, error: error.message || 'No se pudo actualizar el equipo.' };
  }
}

export async function updateTeamMembersAction(input: {
  teamId: string;
  members: GroupTeamMember[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const teamRef = db.collection('teams').doc(input.teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      return { success: false, error: 'Equipo no encontrado.' };
    }

    const team = { id: teamSnap.id, ...teamSnap.data() } as GroupTeam;

    if (team.createdBy !== userId) {
      const groupSnap = await db.collection('groups').doc(team.groupId).get();
      if (!groupSnap.exists) {
        return { success: false, error: 'Grupo no encontrado.' };
      }

      const role = await getUserRoleForGroup({ id: groupSnap.id, ...groupSnap.data() } as Group, userId);
      if (!role || !hasPermission(role, 'teams.edit')) {
        return { success: false, error: 'No tienes permiso para editar este plantel.' };
      }
    }

    await teamRef.update({ members: input.members });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating team members:', error);
    return { success: false, error: error.message || 'No se pudo actualizar el plantel.' };
  }
}

export async function deleteTeamAction(teamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const teamRef = db.collection('teams').doc(teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      return { success: false, error: 'Equipo no encontrado.' };
    }

    const team = { id: teamSnap.id, ...teamSnap.data() } as GroupTeam;

    if (team.createdBy !== userId) {
      const groupSnap = await db.collection('groups').doc(team.groupId).get();
      if (!groupSnap.exists) {
        return { success: false, error: 'Grupo no encontrado.' };
      }

      const role = await getUserRoleForGroup({ id: groupSnap.id, ...groupSnap.data() } as Group, userId);
      if (!role || !hasPermission(role, 'teams.delete')) {
        return { success: false, error: 'No tienes permiso para eliminar este equipo.' };
      }
    }

    await teamRef.delete();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting team:', error);
    return { success: false, error: error.message || 'No se pudo eliminar el equipo.' };
  }
}