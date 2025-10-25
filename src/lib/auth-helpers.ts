/**
 * Helpers de autenticación y autorización para Server Actions
 *
 * Provee funciones para validar permisos y ownership antes de ejecutar
 * operaciones sensibles en el servidor.
 */

import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { ErrorCodes, createError, formatErrorResponse, type ErrorResponse } from './errors';

// Obtener instancias admin (deben estar inicializadas en actions.ts)
const adminApp = getApps()[0];
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

// ──────────────────────────────────────────────────────────────
// VALIDACIÓN DE AUTENTICACIÓN
// ──────────────────────────────────────────────────────────────

/**
 * Verifica que el userId sea válido y corresponda a un usuario autenticado
 * Retorna el usuario o un error
 */
export async function validateUser(userId: string): Promise<{ user?: any; error?: ErrorResponse }> {
  if (!userId) {
    const error = createError(ErrorCodes.AUTH_UNAUTHORIZED, { reason: 'No userId provided' });
    return { error: formatErrorResponse(error) };
  }

  try {
    const user = await adminAuth.getUser(userId);
    return { user };
  } catch (error: any) {
    const appError = createError(ErrorCodes.AUTH_INVALID_TOKEN, { userId }, error);
    return { error: formatErrorResponse(appError) };
  }
}

// ──────────────────────────────────────────────────────────────
// VALIDACIÓN DE OWNERSHIP
// ──────────────────────────────────────────────────────────────

/**
 * Verifica que el usuario sea el dueño del jugador (playerId)
 */
export async function validatePlayerOwnership(
  userId: string,
  playerId: string
): Promise<{ isOwner: boolean; error?: ErrorResponse }> {
  if (!userId || !playerId) {
    const error = createError(ErrorCodes.VAL_MISSING_FIELD, { userId, playerId });
    return { isOwner: false, error: formatErrorResponse(error) };
  }

  // Si el playerId es el mismo que el userId, es el owner
  if (userId === playerId) {
    return { isOwner: true };
  }

  try {
    const playerDoc = await adminDb.doc(`players/${playerId}`).get();

    if (!playerDoc.exists) {
      const error = createError(ErrorCodes.DATA_NOT_FOUND, { playerId });
      return { isOwner: false, error: formatErrorResponse(error) };
    }

    const playerData = playerDoc.data();
    const isOwner = playerData?.ownerUid === userId;

    if (!isOwner) {
      const error = createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, {
        userId,
        playerId,
        ownerUid: playerData?.ownerUid,
      });
      return { isOwner: false, error: formatErrorResponse(error) };
    }

    return { isOwner: true };
  } catch (error: any) {
    const appError = createError(ErrorCodes.SYS_DATABASE_ERROR, { userId, playerId }, error);
    return { isOwner: false, error: formatErrorResponse(appError) };
  }
}

/**
 * Verifica que el usuario sea el organizador del partido (matchId)
 */
export async function validateMatchOwnership(
  userId: string,
  matchId: string
): Promise<{ isOwner: boolean; error?: ErrorResponse }> {
  if (!userId || !matchId) {
    const error = createError(ErrorCodes.VAL_MISSING_FIELD, { userId, matchId });
    return { isOwner: false, error: formatErrorResponse(error) };
  }

  try {
    const matchDoc = await adminDb.doc(`matches/${matchId}`).get();

    if (!matchDoc.exists) {
      const error = createError(ErrorCodes.DATA_NOT_FOUND, { matchId });
      return { isOwner: false, error: formatErrorResponse(error) };
    }

    const matchData = matchDoc.data();
    const isOwner = matchData?.ownerUid === userId;

    if (!isOwner) {
      const error = createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, {
        userId,
        matchId,
        ownerUid: matchData?.ownerUid,
      });
      return { isOwner: false, error: formatErrorResponse(error) };
    }

    return { isOwner: true };
  } catch (error: any) {
    const appError = createError(ErrorCodes.SYS_DATABASE_ERROR, { userId, matchId }, error);
    return { isOwner: false, error: formatErrorResponse(appError) };
  }
}

/**
 * Verifica que el usuario sea admin del grupo (groupId)
 */
export async function validateGroupAdmin(
  userId: string,
  groupId: string
): Promise<{ isAdmin: boolean; error?: ErrorResponse }> {
  if (!userId || !groupId) {
    const error = createError(ErrorCodes.VAL_MISSING_FIELD, { userId, groupId });
    return { isAdmin: false, error: formatErrorResponse(error) };
  }

  try {
    const groupDoc = await adminDb.doc(`groups/${groupId}`).get();

    if (!groupDoc.exists) {
      const error = createError(ErrorCodes.DATA_NOT_FOUND, { groupId });
      return { isAdmin: false, error: formatErrorResponse(error) };
    }

    const groupData = groupDoc.data();
    const isAdmin = groupData?.ownerUid === userId;

    if (!isAdmin) {
      const error = createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, {
        userId,
        groupId,
        ownerUid: groupData?.ownerUid,
      });
      return { isAdmin: false, error: formatErrorResponse(error) };
    }

    return { isAdmin: true };
  } catch (error: any) {
    const appError = createError(ErrorCodes.SYS_DATABASE_ERROR, { userId, groupId }, error);
    return { isAdmin: false, error: formatErrorResponse(appError) };
  }
}

// ──────────────────────────────────────────────────────────────
// VALIDACIÓN DE PERTENENCIA
// ──────────────────────────────────────────────────────────────

/**
 * Verifica que el jugador pertenezca al grupo
 */
export async function validatePlayerInGroup(
  playerId: string,
  groupId: string
): Promise<{ inGroup: boolean; error?: ErrorResponse }> {
  if (!playerId || !groupId) {
    const error = createError(ErrorCodes.VAL_MISSING_FIELD, { playerId, groupId });
    return { inGroup: false, error: formatErrorResponse(error) };
  }

  try {
    const playerDoc = await adminDb.doc(`players/${playerId}`).get();

    if (!playerDoc.exists) {
      const error = createError(ErrorCodes.DATA_NOT_FOUND, { playerId });
      return { inGroup: false, error: formatErrorResponse(error) };
    }

    const playerData = playerDoc.data();
    const inGroup = playerData?.groupId === groupId;

    if (!inGroup) {
      const error = createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, {
        playerId,
        groupId,
        playerGroupId: playerData?.groupId,
      });
      return { inGroup: false, error: formatErrorResponse(error) };
    }

    return { inGroup: true };
  } catch (error: any) {
    const appError = createError(ErrorCodes.SYS_DATABASE_ERROR, { playerId, groupId }, error);
    return { inGroup: false, error: formatErrorResponse(appError) };
  }
}

// ──────────────────────────────────────────────────────────────
// HELPERS COMBINADOS
// ──────────────────────────────────────────────────────────────

/**
 * Valida que el usuario esté autenticado Y sea dueño del jugador
 * Combina validateUser + validatePlayerOwnership
 */
export async function validateUserAndPlayerOwnership(
  userId: string,
  playerId: string
): Promise<{ valid: boolean; error?: ErrorResponse }> {
  const { user, error: userError } = await validateUser(userId);
  if (userError) {
    return { valid: false, error: userError };
  }

  const { isOwner, error: ownerError } = await validatePlayerOwnership(userId, playerId);
  if (ownerError) {
    return { valid: false, error: ownerError };
  }

  return { valid: isOwner };
}

/**
 * Valida que el jugador pertenezca al grupo Y el usuario sea el dueño
 * Combina validatePlayerInGroup + validatePlayerOwnership
 */
export async function validatePlayerAccessInGroup(
  userId: string,
  playerId: string,
  groupId: string
): Promise<{ valid: boolean; error?: ErrorResponse }> {
  const { isOwner, error: ownerError } = await validatePlayerOwnership(userId, playerId);
  if (ownerError) {
    return { valid: false, error: ownerError };
  }

  const { inGroup, error: groupError } = await validatePlayerInGroup(playerId, groupId);
  if (groupError) {
    return { valid: false, error: groupError };
  }

  return { valid: isOwner && inGroup };
}
