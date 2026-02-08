'use server';

import { getAdminDb } from '@/firebase/admin-init';
import type { Query } from 'firebase-admin/firestore';
import type { Player, LeaderboardCategory, LeaderboardEntry } from '@/lib/types';
import { unstable_noStore as noStore } from 'next/cache';
import { logger } from '@/lib/logger';

const db = getAdminDb();

/**
 * Get leaderboard for a specific category
 * @param category - The category to rank by (ovr, goals, assists, matches, rating)
 * @param groupId - Optional group ID to filter by (null for global)
 * @param limitCount - Number of entries to return (default 10)
 */
export async function getLeaderboardActionV2(
  category: LeaderboardCategory,
  groupId?: string | null,
  limitCount: number = 10
): Promise<{ leaderboard: LeaderboardEntry[]; error?: string }> {
  noStore();
  try {
    // Map category to Firestore field
    const fieldMap: Record<LeaderboardCategory, string> = {
      ovr: 'ovr',
      goals: 'stats.goals',
      assists: 'stats.assists',
      matches: 'stats.matchesPlayed',
      rating: 'stats.averageRating',
    };

    const orderField = fieldMap[category];
    if (!orderField) {
      return { leaderboard: [], error: 'Invalid category' };
    }

    // Build query
    let query = db.collection('players').orderBy(orderField, 'desc').limit(limitCount);

    // Filter by group if specified
    if (groupId) {
      query = db
        .collection('players')
        .where('groupId', '==', groupId)
        .orderBy(orderField, 'desc')
        .limit(limitCount);
    }

    const snapshot = await query.get();

    const leaderboard: LeaderboardEntry[] = snapshot.docs.map((doc, index) => {
      const player = doc.data() as Player;

      // DEBUG: Trace value calculation
      if (index === 0) {
        // console.log(`[LB_DEBUG] Processing ${player.name} for category '${category}'`);
      }

      // Get the value for the ranking category
      let value: number = 0;
      switch (category) {
        case 'ovr':
          value = player.ovr || 0;
          break;
        case 'goals':
          value = player.stats?.goals || 0;
          break;
        case 'assists':
          value = player.stats?.assists || 0;
          break;
        case 'matches':
          value = player.stats?.matchesPlayed || 0;
          break;
        case 'rating':
          value = player.stats?.averageRating || 0;
          break;
        default:
          value = 0;
      }

      if (index < 3) console.log(`[LB_DEBUG] Final Value for ${player.name}: ${value}`);

      return {
        rank: index + 1,
        playerId: doc.id,
        playerName: player.name,
        playerPhotoUrl: player.photoUrl,
        position: player.position,
        value,
        userId: player.ownerUid,
      };
    });

    return { leaderboard };
  } catch (error: any) {
    logger.error('Error getting leaderboard', error, { category, groupId });
    return { leaderboard: [], error: error.message };
  }
}

/**
 * Get a player's rank in a specific category
 * @param playerId - The player ID to get rank for
 * @param category - The category to check rank in
 * @param groupId - Optional group ID to filter by (null for global)
 */
export async function getPlayerRankAction(
  playerId: string,
  category: LeaderboardCategory,
  groupId?: string | null
): Promise<{ rank: number | null; total: number; value: number; error?: string }> {
  try {
    // Get the player's value first
    const playerDoc = await db.collection('players').doc(playerId).get();
    if (!playerDoc.exists) {
      return { rank: null, total: 0, value: 0, error: 'Player not found' };
    }

    const player = playerDoc.data() as Player;

    // Get the value for this category
    let playerValue: number;
    switch (category) {
      case 'ovr':
        playerValue = player.ovr || 0;
        break;
      case 'goals':
        playerValue = player.stats?.goals || 0;
        break;
      case 'assists':
        playerValue = player.stats?.assists || 0;
        break;
      case 'matches':
        playerValue = player.stats?.matchesPlayed || 0;
        break;
      case 'rating':
        playerValue = player.stats?.averageRating || 0;
        break;
      default:
        playerValue = 0;
    }

    // Map category to Firestore field
    const fieldMap: Record<LeaderboardCategory, string> = {
      ovr: 'ovr',
      goals: 'stats.goals',
      assists: 'stats.assists',
      matches: 'stats.matchesPlayed',
      rating: 'stats.averageRating',
    };

    const orderField = fieldMap[category];

    // Count players with higher value
    let higherQuery: Query = db
      .collection('players')
      .where(orderField, '>', playerValue);

    let totalQuery: Query = db.collection('players');

    if (groupId) {
      higherQuery = db
        .collection('players')
        .where('groupId', '==', groupId)
        .where(orderField, '>', playerValue);

      totalQuery = db
        .collection('players')
        .where('groupId', '==', groupId);
    }

    const [higherSnapshot, totalSnapshot] = await Promise.all([
      higherQuery.count().get(),
      totalQuery.count().get(),
    ]);

    const playersAbove = higherSnapshot.data().count;
    const total = totalSnapshot.data().count;

    // Rank is number of players above + 1
    const rank = playersAbove + 1;

    return { rank, total, value: playerValue };
  } catch (error: any) {
    logger.error('Error getting player rank', error, { playerId, category });
    return { rank: null, total: 0, value: 0, error: error.message };
  }
}

/**
 * Get multiple leaderboards at once (for dashboard/overview)
 */
export async function getMultipleLeaderboardsAction(
  groupId?: string | null,
  limitCount: number = 5
): Promise<{
  leaderboards: Record<LeaderboardCategory, LeaderboardEntry[]>;
  error?: string;
}> {
  try {
    const categories: LeaderboardCategory[] = ['ovr', 'goals', 'assists', 'matches', 'rating'];

    const results = await Promise.all(
      categories.map(cat => getLeaderboardActionV2(cat, groupId, limitCount))
    );

    const leaderboards: Record<LeaderboardCategory, LeaderboardEntry[]> = {
      ovr: [],
      goals: [],
      assists: [],
      matches: [],
      rating: [],
    };

    categories.forEach((cat, index) => {
      leaderboards[cat] = results[index].leaderboard;
    });

    return { leaderboards };
  } catch (error: any) {
    logger.error('Error getting multiple leaderboards', error);
    return {
      leaderboards: { ovr: [], goals: [], assists: [], matches: [], rating: [] },
      error: error.message,
    };
  }
}

/**
 * Get player's ranks across all categories
 */
export async function getPlayerAllRanksAction(
  playerId: string,
  groupId?: string | null
): Promise<{
  ranks: Record<LeaderboardCategory, { rank: number | null; total: number; value: number }>;
  error?: string;
}> {
  try {
    const categories: LeaderboardCategory[] = ['ovr', 'goals', 'assists', 'matches', 'rating'];

    const results = await Promise.all(
      categories.map(cat => getPlayerRankAction(playerId, cat, groupId))
    );

    const ranks: Record<LeaderboardCategory, { rank: number | null; total: number; value: number }> = {
      ovr: { rank: null, total: 0, value: 0 },
      goals: { rank: null, total: 0, value: 0 },
      assists: { rank: null, total: 0, value: 0 },
      matches: { rank: null, total: 0, value: 0 },
      rating: { rank: null, total: 0, value: 0 },
    };

    categories.forEach((cat, index) => {
      ranks[cat] = {
        rank: results[index].rank,
        total: results[index].total,
        value: results[index].value,
      };
    });

    return { ranks };
  } catch (error: any) {
    logger.error('Error getting player all ranks', error, { playerId });
    return {
      ranks: {
        ovr: { rank: null, total: 0, value: 0 },
        goals: { rank: null, total: 0, value: 0 },
        assists: { rank: null, total: 0, value: 0 },
        matches: { rank: null, total: 0, value: 0 },
        rating: { rank: null, total: 0, value: 0 },
      },
      error: error.message,
    };
  }
}
