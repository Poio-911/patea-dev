/**
 * Sistema de permisos para grupos
 * Define roles y sus capacidades dentro de un grupo
 */

export type GroupRole = 'admin' | 'moderator' | 'member';

export type GroupPermission =
  // Gestión del grupo
  | 'group.edit' // Editar nombre, descripción, configuración del grupo
  | 'group.delete' // Eliminar el grupo
  // Gestión de miembros
  | 'members.add' // Agregar nuevos miembros al grupo
  | 'members.remove' // Remover miembros del grupo
  | 'members.view' // Ver lista de miembros
  // Gestión de roles
  | 'roles.assign' // Asignar roles a miembros
  | 'roles.revoke' // Revocar roles de miembros
  // Gestión de partidos
  | 'matches.create' // Crear nuevos partidos
  | 'matches.edit' // Editar partidos existentes
  | 'matches.delete' // Eliminar partidos
  | 'matches.view' // Ver partidos del grupo
  // Gestión de equipos
  | 'teams.create' // Crear equipos persistentes
  | 'teams.edit' // Editar equipos
  | 'teams.delete' // Eliminar equipos
  | 'teams.view' // Ver equipos
  // Gestión de estadísticas
  | 'stats.view' // Ver estadísticas del grupo
  | 'stats.reset' // Resetear estadísticas
  // Otras acciones
  | 'announcements.post' // Publicar anuncios en el grupo
  | 'chat.moderate'; // Moderar chat/comentarios

/**
 * Matriz de permisos: define qué puede hacer cada rol
 */
export const ROLE_PERMISSIONS: Record<GroupRole, GroupPermission[]> = {
  admin: [
    // Admins tienen todos los permisos
    'group.edit',
    'group.delete',
    'members.add',
    'members.remove',
    'members.view',
    'roles.assign',
    'roles.revoke',
    'matches.create',
    'matches.edit',
    'matches.delete',
    'matches.view',
    'teams.create',
    'teams.edit',
    'teams.delete',
    'teams.view',
    'stats.view',
    'stats.reset',
    'announcements.post',
    'chat.moderate',
  ],
  moderator: [
    // Moderadores pueden gestionar contenido pero no el grupo mismo
    'members.add',
    'members.view',
    'matches.create',
    'matches.edit',
    'matches.delete',
    'matches.view',
    'teams.create',
    'teams.edit',
    'teams.view',
    'stats.view',
    'announcements.post',
    'chat.moderate',
  ],
  member: [
    // Miembros solo pueden ver y crear contenido básico
    'members.view',
    'matches.view',
    'teams.view',
    'stats.view',
  ],
};

/**
 * Verifica si un rol tiene un permiso específico
 */
export function hasPermission(role: GroupRole, permission: GroupPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Verifica si un rol puede asignar otro rol
 * Regla: Solo admins pueden asignar roles
 * Los admins no pueden remover el rol de admin del creador original del grupo
 */
export function canAssignRole(
  assignerRole: GroupRole,
  targetRole: GroupRole
): boolean {
  // Solo admins pueden asignar roles
  if (assignerRole !== 'admin') {
    return false;
  }

  return true;
}

/**
 * Verifica si un usuario puede remover a otro del grupo
 * Reglas:
 * - Admins pueden remover moderadores y miembros
 * - Moderadores pueden remover miembros
 * - Nadie puede remover al creador original del grupo
 */
export function canRemoveMember(
  removerRole: GroupRole,
  targetRole: GroupRole,
  isTargetOwner: boolean
): boolean {
  // No se puede remover al dueño original
  if (isTargetOwner) {
    return false;
  }

  // Admins pueden remover moderadores y miembros
  if (removerRole === 'admin') {
    return true;
  }

  // Moderadores solo pueden remover miembros
  if (removerRole === 'moderator' && targetRole === 'member') {
    return true;
  }

  return false;
}

/**
 * Obtiene el label en español para un rol
 */
export function getRoleLabel(role: GroupRole): string {
  const labels: Record<GroupRole, string> = {
    admin: 'Administrador',
    moderator: 'Moderador',
    member: 'Miembro',
  };

  return labels[role];
}

/**
 * Obtiene la descripción de un rol
 */
export function getRoleDescription(role: GroupRole): string {
  const descriptions: Record<GroupRole, string> = {
    admin: 'Control total del grupo, miembros y contenido',
    moderator: 'Puede gestionar partidos, equipos y moderar contenido',
    member: 'Puede ver contenido y participar en partidos',
  };

  return descriptions[role];
}

/**
 * Obtiene el color del badge para un rol
 */
export function getRoleColor(role: GroupRole): string {
  const colors: Record<GroupRole, string> = {
    admin: 'bg-red-500 text-white',
    moderator: 'bg-blue-500 text-white',
    member: 'bg-muted text-muted-foreground',
  };

  return colors[role];
}

/**
 * Obtiene todos los permisos de un rol en formato legible
 */
export function getRolePermissions(role: GroupRole): Array<{
  permission: GroupPermission;
  label: string;
  category: string;
}> {
  const permissions = ROLE_PERMISSIONS[role];

  return permissions.map(permission => ({
    permission,
    label: getPermissionLabel(permission),
    category: getPermissionCategory(permission),
  }));
}

/**
 * Obtiene el label legible de un permiso
 */
function getPermissionLabel(permission: GroupPermission): string {
  const labels: Record<GroupPermission, string> = {
    'group.edit': 'Editar grupo',
    'group.delete': 'Eliminar grupo',
    'members.add': 'Agregar miembros',
    'members.remove': 'Remover miembros',
    'members.view': 'Ver miembros',
    'roles.assign': 'Asignar roles',
    'roles.revoke': 'Revocar roles',
    'matches.create': 'Crear partidos',
    'matches.edit': 'Editar partidos',
    'matches.delete': 'Eliminar partidos',
    'matches.view': 'Ver partidos',
    'teams.create': 'Crear equipos',
    'teams.edit': 'Editar equipos',
    'teams.delete': 'Eliminar equipos',
    'teams.view': 'Ver equipos',
    'stats.view': 'Ver estadísticas',
    'stats.reset': 'Resetear estadísticas',
    'announcements.post': 'Publicar anuncios',
    'chat.moderate': 'Moderar chat',
  };

  return labels[permission];
}

/**
 * Obtiene la categoría de un permiso
 */
function getPermissionCategory(permission: GroupPermission): string {
  if (permission.startsWith('group.')) return 'Grupo';
  if (permission.startsWith('members.')) return 'Miembros';
  if (permission.startsWith('roles.')) return 'Roles';
  if (permission.startsWith('matches.')) return 'Partidos';
  if (permission.startsWith('teams.')) return 'Equipos';
  if (permission.startsWith('stats.')) return 'Estadísticas';
  return 'Otros';
}
