/// Roles y permisos de grupo.
///
/// Port 1:1 de `src/lib/group-permissions.ts` y de `resolveGroupRole` en
/// `functions/src/callable/group-management.ts`.
///
/// **Esto es sólo para la interfaz.** Quien decide de verdad es la Cloud
/// Function: `getTeamPermissionOrThrow` valida el permiso antes de escribir.
/// Acá se usa para no mostrar botones que van a fallar, no como control de
/// acceso — un cliente modificado podría saltearse esto y el servidor igual
/// lo rechazaría.
library;

enum GroupRole { admin, moderator, member }

enum GroupPermission {
  groupEdit,
  groupDelete,
  membersAdd,
  membersRemove,
  membersView,
  rolesAssign,
  rolesRevoke,
  matchesCreate,
  matchesEdit,
  matchesDelete,
  matchesView,
  teamsCreate,
  teamsEdit,
  teamsDelete,
  teamsView,
  statsView,
  statsReset,
  announcementsPost,
  chatModerate,
}

const _adminPermissions = GroupPermission.values;

const _moderatorPermissions = <GroupPermission>{
  GroupPermission.membersAdd,
  GroupPermission.membersView,
  GroupPermission.matchesCreate,
  GroupPermission.matchesEdit,
  GroupPermission.matchesDelete,
  GroupPermission.matchesView,
  GroupPermission.teamsCreate,
  GroupPermission.teamsEdit,
  GroupPermission.teamsView,
  GroupPermission.statsView,
  GroupPermission.announcementsPost,
  GroupPermission.chatModerate,
};

const _memberPermissions = <GroupPermission>{
  GroupPermission.membersView,
  GroupPermission.matchesView,
  GroupPermission.teamsView,
  // Cualquier miembro puede armar su equipo dentro del grupo. Queda con su uid
  // en `createdBy`, y por eso después puede editarlo y borrarlo aunque no
  // tenga teamsEdit por rol — sobre equipos ajenos sigue sin poder.
  GroupPermission.teamsCreate,
  GroupPermission.statsView,
};

bool hasPermission(GroupRole? role, GroupPermission permission) {
  return switch (role) {
    GroupRole.admin => _adminPermissions.contains(permission),
    GroupRole.moderator => _moderatorPermissions.contains(permission),
    GroupRole.member => _memberPermissions.contains(permission),
    null => false,
  };
}

/// Mismo orden de precedencia que el servidor: dueño del grupo, rol explícito
/// en `memberRoles`, y por último miembro simple.
GroupRole? resolveGroupRole(Map<String, dynamic>? group, String uid) {
  if (group == null) return null;

  if (group['ownerUid'] == uid) return GroupRole.admin;

  final roles = group['memberRoles'];
  if (roles is List) {
    for (final entry in roles) {
      if (entry is Map && entry['userId'] == uid) {
        return switch (entry['role']) {
          'admin' => GroupRole.admin,
          'moderator' => GroupRole.moderator,
          'member' => GroupRole.member,
          _ => null,
        };
      }
    }
  }

  final members = group['members'];
  if (members is List && members.contains(uid)) return GroupRole.member;

  return null;
}

String roleLabel(GroupRole role) => switch (role) {
      GroupRole.admin => 'Admin',
      GroupRole.moderator => 'Moderador',
      GroupRole.member => 'Miembro',
    };
