/**
 * Piezas puras del borrado de cuenta (sin tocar Firestore), para poder
 * probarlas sin emulador.
 */

export const DELETED_PLAYER_NAME = 'Jugador eliminado';

/**
 * Recorre un documento y reemplaza, en cada objeto que represente a `uid`
 * (`uid`, `id`, `playerId` o `userId` igual al uid), el nombre y la foto.
 *
 * Los partidos guardan copias del jugador (`players`, `teams[].players`...). Esas
 * copias son historial de OTRAS personas —el partido que jugaron—, así que no se
 * borran: se anonimizan. Devuelve `changed` para no reescribir documentos que
 * no cambian.
 */
export function scrubDeletedUser<T>(value: T, uid: string): { value: T; changed: boolean } {
  let changed = false;

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const isUser = obj.uid === uid || obj.id === uid || obj.playerId === uid || obj.userId === uid;
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(obj)) {
        if (isUser && (key === 'displayName' || key === 'name' || key === 'userName' || key === 'playerName')) {
          if (child !== DELETED_PLAYER_NAME) changed = true;
          out[key] = DELETED_PLAYER_NAME;
        } else if (isUser && (key === 'photoURL' || key === 'photoUrl' || key === 'userPhotoUrl' || key === 'playerPhotoUrl')) {
          if (child !== '') changed = true;
          out[key] = '';
        } else {
          out[key] = walk(child);
        }
      }
      return out;
    }
    return node;
  };

  return { value: walk(value) as T, changed };
}

/**
 * A quién pasa un grupo cuando se va su creador: primero otro admin (el que se
 * unió antes), si no el integrante más antiguo. `null` si no queda nadie.
 */
export function pickNextOwner(
  group: { members?: string[]; memberRoles?: Array<{ userId: string; role?: string; joinedAt?: string }> },
  leavingUid: string,
): string | null {
  const remaining = (group.members ?? []).filter((m) => m !== leavingUid);
  if (remaining.length === 0) return null;
  const roles = (group.memberRoles ?? []).filter((r) => remaining.includes(r.userId));
  const byJoin = (a: { joinedAt?: string }, b: { joinedAt?: string }) =>
    String(a.joinedAt ?? '').localeCompare(String(b.joinedAt ?? ''));
  const admin = roles.filter((r) => r.role === 'admin').sort(byJoin)[0];
  if (admin) return admin.userId;
  const oldest = [...roles].sort(byJoin)[0];
  return oldest?.userId ?? remaining[0];
}

/** El borrado pide una sesión iniciada hace poco (la app reautentica antes). */
export const RECENT_LOGIN_SECONDS = 5 * 60;

export function isRecentLogin(authTimeSeconds: number | undefined, nowMs = Date.now()): boolean {
  if (!authTimeSeconds) return false;
  return nowMs / 1000 - authTimeSeconds <= RECENT_LOGIN_SECONDS;
}
