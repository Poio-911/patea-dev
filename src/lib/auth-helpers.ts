import { headers } from 'next/headers';
import { adminAuth, adminDb } from '@/firebase/admin-init';
import { logger } from './logger';
import { createError, ErrorCodes } from './errors';
import type { Player, Match, UserProfile } from './types';

/**
 * Obtiene y valida el usuario autenticado desde el token
 */
export async function getAuthenticatedUser(): Promise<UserProfile> {
  const headersList = headers();
  const authHeader = headersList.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw createError(ErrorCodes.AUTH_MISSING_TOKEN, 'Token de autenticación faltante', 401);
  }

  const token = authHeader.substring(7);

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      throw createError(ErrorCodes.AUTH_INVALID_USER, 'Usuario no encontrado', 404);
    }

    return { uid, ...userDoc.data() } as UserProfile;
  } catch (error) {
    logger.error('Error verifying auth token', error);
    throw createError(ErrorCodes.AUTH_UNAUTHORIZED, 'Token inválido o expirado', 401);
  }
}

/**
 * Valida que el usuario sea dueño de un jugador
 */
export async function validatePlayerOwnership(playerId: string, userId: string): Promise<Player> {
  const playerDoc = await adminDb.collection('players').doc(playerId).get();

  if (!playerDoc.exists) {
    throw createError(ErrorCodes.PLAYER_NOT_FOUND, 'Jugador no encontrado', 404);
  }

  const player = { id: playerDoc.id, ...playerDoc.data() } as Player;

  if (player.ownerUid !== userId && player.id !== userId) {
    throw createError(
      ErrorCodes.AUTH_UNAUTHORIZED,
      'No tienes permiso para modificar este jugador',
      403,
      { playerId, userId }
    );
  }

  return player;
}

/**
 * Valida que el usuario sea dueño de un partido
 */
export async function validateMatchOwnership(matchId: string, userId: string): Promise<Match> {
  const matchDoc = await adminDb.collection('matches').doc(matchId).get();

  if (!matchDoc.exists) {
    throw createError(ErrorCodes.MATCH_NOT_FOUND, 'Partido no encontrado', 404);
  }

  const match = { id: matchDoc.id, ...matchDoc.data() } as Match;

  if (match.ownerUid !== userId) {
    throw createError(
      ErrorCodes.AUTH_UNAUTHORIZED,
      'No tienes permiso para modificar este partido',
      403,
      { matchId, userId }
    );
  }

  return match;
}

/**
 * Valida que el usuario tenga un grupo activo
 */
export function validateActiveGroup(user: UserProfile): string {
  if (!user.activeGroupId) {
    throw createError(ErrorCodes.AUTH_NO_ACTIVE_GROUP, 'No tienes un grupo activo', 400);
  }
  return user.activeGroupId;
}
