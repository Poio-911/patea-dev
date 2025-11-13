
'use client';

import { useMemo } from 'react';
import type { Match } from '@/lib/types';

/**
 * Hook para gestionar permisos relacionados con un partido
 *
 * @param match - El partido actual
 * @param userId - ID del usuario actual
 * @returns Objeto con permisos calculados
 */
export function useMatchPermissions(match: Match | null | undefined, userId: string | undefined) {
  const isOwner = useMemo(() => {
    if (!userId || !match) return false;
    return userId === match.ownerUid;
  }, [userId, match?.ownerUid]);

  const isUserInMatch = useMemo(() => {
    if (!userId || !match?.playerUids) return false;
    return match.playerUids.includes(userId);
  }, [match?.playerUids, userId]);

  const canEdit = useMemo(() => isOwner, [isOwner]);

  const canJoin = useMemo(() => {
    if (!match || isUserInMatch || !match.players) return false; // ✅ FIX: Check if match.players exists
    return match.status === 'upcoming' && match.players.length < match.matchSize;
  }, [match?.status, match?.players, match?.matchSize, isUserInMatch]);

  const canLeave = useMemo(() => {
    if (!match || !isUserInMatch) return false;
    return match.status === 'upcoming';
  }, [match?.status, isUserInMatch]);

  const canFinalize = useMemo(() => {
    if (!match || !isOwner || !match.players) return false; // ✅ FIX: Check if match.players exists
    return match.status === 'upcoming' && match.players.length >= 2;
  }, [match?.status, match?.players, isOwner]);

  const canDelete = useMemo(() => isOwner, [isOwner]);

  const canGenerateTeams = useMemo(() => {
    if (!match || !isOwner || !match.players) return false; // ✅ FIX: Check if match.players exists
    return match.status === 'upcoming' && match.players.length >= 2;
  }, [match?.status, match?.players, isOwner]);

  return {
    isOwner,
    isUserInMatch,
    canEdit,
    canJoin,
    canLeave,
    canFinalize,
    canDelete,
    canGenerateTeams,
  };
}
