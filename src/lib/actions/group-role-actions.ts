'use server';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getServerSession } from '@/lib/auth-helpers';
import type { GroupMember, Group } from '@/lib/types';
import type { GroupRole } from '@/lib/group-permissions';
import { hasPermission, canAssignRole, canRemoveMember } from '@/lib/group-permissions';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountJson = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );

  initializeApp({
    credential: cert(serviceAccountJson),
    projectId: serviceAccountJson.project_id,
  });
}

const db = getFirestore();

/**
 * Obtener el rol de un usuario en un grupo
 */
export async function getUserRoleInGroupAction(
  groupId: string,
  userId?: string
): Promise<{ success: boolean; role?: GroupRole; error?: string }> {
  try {
    const session = await getServerSession();
    const targetUserId = userId || session?.user?.uid;

    if (!targetUserId) {
      return { success: false, error: 'No autenticado' };
    }

    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return { success: false, error: 'Grupo no encontrado' };
    }

    const groupData = groupDoc.data() as Group;

    // Si el usuario es el dueño, es admin
    if (groupData.ownerUid === targetUserId) {
      return { success: true, role: 'admin' };
    }

    // Buscar en memberRoles (nuevo sistema)
    if (groupData.memberRoles) {
      const memberData = groupData.memberRoles.find(
        (m: GroupMember) => m.userId === targetUserId
      );
      if (memberData) {
        return { success: true, role: memberData.role };
      }
    }

    // Fallback: buscar en members (sistema legacy)
    if (groupData.members?.includes(targetUserId)) {
      return { success: true, role: 'member' };
    }

    return { success: false, error: 'Usuario no es miembro del grupo' };
  } catch (error: any) {
    console.error('Error getting user role:', error);
    return { success: false, error: error.message || 'Error al obtener rol' };
  }
}

/**
 * Asignar un rol a un miembro del grupo
 */
export async function assignGroupRoleAction(
  groupId: string,
  targetUserId: string,
  newRole: GroupRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const currentUserId = session.user.uid;

    // Obtener información del grupo
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return { success: false, error: 'Grupo no encontrado' };
    }

    const groupData = groupDoc.data() as Group;

    // Verificar que el usuario actual tiene permisos
    const currentUserRoleResult = await getUserRoleInGroupAction(groupId, currentUserId);
    if (!currentUserRoleResult.success || !currentUserRoleResult.role) {
      return { success: false, error: 'No tienes permisos en este grupo' };
    }

    const currentUserRole = currentUserRoleResult.role;

    // Verificar permisos para asignar roles
    if (!hasPermission(currentUserRole, 'roles.assign')) {
      return { success: false, error: 'No tienes permiso para asignar roles' };
    }

    // Verificar que puede asignar este rol específico
    if (!canAssignRole(currentUserRole, newRole)) {
      return { success: false, error: 'No puedes asignar este rol' };
    }

    // No se puede cambiar el rol del dueño
    if (groupData.ownerUid === targetUserId) {
      return { success: false, error: 'No se puede cambiar el rol del creador del grupo' };
    }

    // Verificar que el usuario objetivo es miembro
    if (!groupData.members?.includes(targetUserId)) {
      return { success: false, error: 'El usuario no es miembro del grupo' };
    }

    // Inicializar memberRoles si no existe
    let memberRoles = groupData.memberRoles || [];

    // Buscar si ya existe en memberRoles
    const existingIndex = memberRoles.findIndex(
      (m: GroupMember) => m.userId === targetUserId
    );

    if (existingIndex >= 0) {
      // Actualizar rol existente
      memberRoles[existingIndex] = {
        ...memberRoles[existingIndex],
        role: newRole,
      };
    } else {
      // Agregar nuevo registro de rol
      memberRoles.push({
        userId: targetUserId,
        role: newRole,
        joinedAt: new Date().toISOString(),
        addedBy: currentUserId,
      });
    }

    // Actualizar grupo
    await groupRef.update({
      memberRoles,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error assigning role:', error);
    return { success: false, error: error.message || 'Error al asignar rol' };
  }
}

/**
 * Remover un miembro del grupo
 */
export async function removeMemberFromGroupAction(
  groupId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const currentUserId = session.user.uid;

    // Obtener información del grupo
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return { success: false, error: 'Grupo no encontrado' };
    }

    const groupData = groupDoc.data() as Group;

    // No se puede remover al dueño del grupo
    if (groupData.ownerUid === targetUserId) {
      return { success: false, error: 'No se puede remover al creador del grupo' };
    }

    // Obtener rol del usuario actual
    const currentUserRoleResult = await getUserRoleInGroupAction(groupId, currentUserId);
    if (!currentUserRoleResult.success || !currentUserRoleResult.role) {
      return { success: false, error: 'No tienes permisos en este grupo' };
    }

    // Obtener rol del usuario objetivo
    const targetUserRoleResult = await getUserRoleInGroupAction(groupId, targetUserId);
    const targetUserRole = targetUserRoleResult.role || 'member';

    // Verificar permisos para remover
    if (!canRemoveMember(
      currentUserRoleResult.role,
      targetUserRole,
      groupData.ownerUid === targetUserId
    )) {
      return { success: false, error: 'No tienes permiso para remover a este usuario' };
    }

    // Remover de members y memberRoles
    const updates: any = {
      members: FieldValue.arrayRemove(targetUserId),
    };

    if (groupData.memberRoles) {
      const updatedMemberRoles = groupData.memberRoles.filter(
        (m: GroupMember) => m.userId !== targetUserId
      );
      updates.memberRoles = updatedMemberRoles;
    }

    await groupRef.update(updates);

    return { success: true };
  } catch (error: any) {
    console.error('Error removing member:', error);
    return { success: false, error: error.message || 'Error al remover miembro' };
  }
}

/**
 * Obtener todos los miembros del grupo con sus roles
 */
export async function getGroupMembersWithRolesAction(
  groupId: string
): Promise<{
  success: boolean;
  members?: Array<GroupMember & { name?: string; photoUrl?: string }>;
  error?: string;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return { success: false, error: 'Grupo no encontrado' };
    }

    const groupData = groupDoc.data() as Group;

    // Verificar que el usuario es miembro
    if (!groupData.members?.includes(session.user.uid)) {
      return { success: false, error: 'No eres miembro de este grupo' };
    }

    // Preparar lista de miembros con roles
    const membersList: Array<GroupMember & { name?: string; photoUrl?: string }> = [];

    // Agregar dueño como admin
    const ownerDoc = await db.collection('players').doc(groupData.ownerUid).get();
    const ownerData = ownerDoc.data();
    membersList.push({
      userId: groupData.ownerUid,
      role: 'admin',
      joinedAt: groupData.createdAt || new Date().toISOString(),
      name: ownerData?.name || 'Usuario',
      photoUrl: ownerData?.photoUrl,
    });

    // Agregar otros miembros
    for (const memberId of groupData.members || []) {
      if (memberId === groupData.ownerUid) continue; // Ya agregamos al dueño

      // Buscar rol en memberRoles
      let role: GroupRole = 'member';
      let joinedAt = new Date().toISOString();
      let addedBy: string | undefined;

      if (groupData.memberRoles) {
        const memberRoleData = groupData.memberRoles.find(
          (m: GroupMember) => m.userId === memberId
        );
        if (memberRoleData) {
          role = memberRoleData.role;
          joinedAt = memberRoleData.joinedAt;
          addedBy = memberRoleData.addedBy;
        }
      }

      // Obtener información del jugador
      const playerDoc = await db.collection('players').doc(memberId).get();
      const playerData = playerDoc.data();

      membersList.push({
        userId: memberId,
        role,
        joinedAt,
        addedBy,
        name: playerData?.name || 'Usuario',
        photoUrl: playerData?.photoUrl,
      });
    }

    // Ordenar: admins primero, luego moderadores, luego miembros
    const roleOrder: Record<GroupRole, number> = { admin: 0, moderator: 1, member: 2 };
    membersList.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    return { success: true, members: membersList };
  } catch (error: any) {
    console.error('Error getting group members:', error);
    return { success: false, error: error.message || 'Error al obtener miembros' };
  }
}

/**
 * Verificar si el usuario tiene un permiso específico en un grupo
 */
export async function checkGroupPermissionAction(
  groupId: string,
  permission: string
): Promise<{ success: boolean; hasPermission?: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const roleResult = await getUserRoleInGroupAction(groupId);
    if (!roleResult.success || !roleResult.role) {
      return { success: false, error: 'No eres miembro del grupo' };
    }

    const hasPerm = hasPermission(roleResult.role, permission as any);
    return { success: true, hasPermission: hasPerm };
  } catch (error: any) {
    console.error('Error checking permission:', error);
    return { success: false, error: error.message || 'Error al verificar permiso' };
  }
}
