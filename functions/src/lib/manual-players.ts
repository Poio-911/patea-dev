import { HttpsError } from 'firebase-functions/v2/https';

export function normalizeContact(data: Record<string, unknown>) {
  const email = String(data.email ?? '').trim().toLowerCase();
  const phone = String(data.phone ?? '').replace(/[\s().-]/g, '');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Ingresá un correo válido.');
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new HttpsError('invalid-argument', 'Usá el teléfono con código de país, por ejemplo +59899123456.');
  return { email, phone };
}

export function manualFields(data: Record<string, unknown>) {
  const name = String(data.name ?? '').trim();
  const position = String(data.position ?? '').toUpperCase();
  if (!name || name.length > 80 || !['POR', 'DEF', 'MED', 'DEL'].includes(position)) throw new HttpsError('invalid-argument', 'Revisá el nombre y la posición.');
  const stats = Object.fromEntries(['pac', 'sho', 'pas', 'dri', 'def', 'phy'].map(key => {
    const value = data[key] ?? 70;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 20 || value > 99) throw new HttpsError('invalid-argument', 'Los atributos deben estar entre 20 y 99.');
    return [key, value];
  }));
  return { name, position, ...stats, ovr: Math.max(40, Math.round(Object.values(stats).reduce((a, b) => a + b, 0) / 6)) };
}

export function assertManualCreator(player: Record<string, any> | undefined, id: string, uid: string) {
  if (!player) throw new HttpsError('not-found', 'El jugador no existe.');
  if (id === player.ownerUid || player.claimedBy || player.archived || player.ownerUid !== uid) throw new HttpsError('permission-denied', 'Sólo su creador puede gestionar este jugador sin cuenta.');
}

const identityKeys = new Set(['id', 'uid', 'playerId', 'playerUid', 'subjectId', 'evaluatorId', 'mvpVote', 'mvpId', 'mvpPlayerId', 'bestPlayerId', 'captainId', 'assistId', 'assistPlayerId', 'assisterId', 'playerOutId', 'playerInId', 'goalkeeperId', 'playerUids', 'pendingPlayerUids', 'playerIds', 'members']);
/** Changes identity references, never display names or narrative text. */
export function replacePlayerReferences(value: any, oldId: string, uid: string, key = ''): any {
  if (typeof value === 'string') return value === oldId && identityKeys.has(key) ? uid : value;
  if (Array.isArray(value)) return value.map(v => replacePlayerReferences(v, oldId, uid, key));
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k === oldId ? uid : k, replacePlayerReferences(v, oldId, uid, k)]));
  return value;
}

export function verifiedContactMatches(contact: Record<string, any>, account: {email?: string; emailVerified?: boolean; phoneNumber?: string}) {
  return !!((account.emailVerified && account.email && contact.email === account.email.trim().toLowerCase()) || (account.phoneNumber && contact.phone === account.phoneNumber));
}
