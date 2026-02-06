'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { PlayerAchievement, Player, Achievement, AchievementRequirementType } from '@/lib/types';
import { ACHIEVEMENTS, getAchievementById } from '@/lib/achievements-config';
import { logger } from '@/lib/logger';

const db = getAdminDb();

/**
 * Get current progress values for a player towards achievements
 */
async function getPlayerProgress(playerId: string, userId: string): Promise<Record<AchievementRequirementType, number>> {
  const progress: Record<AchievementRequirementType, number> = {
    goals: 0,
    goals_in_match: 0,
    matches: 0,
    wins: 0,
    ovr: 0,
    followers: 0,
    organized: 0,
    champion: 0,
  };

  try {
    // Get player stats
    const playerDoc = await db.collection('players').doc(playerId).get();
    if (playerDoc.exists) {
      const player = playerDoc.data() as Player;
      progress.goals = player.stats?.goals || 0;
      progress.matches = player.stats?.matchesPlayed || 0;
      progress.ovr = player.ovr || 0;
    }

    // Count followers (users following this user)
    const followersSnapshot = await db
      .collection('follows')
      .where('followingId', '==', userId)
      .count()
      .get();
    progress.followers = followersSnapshot.data().count;

    // Count matches organized by this user
    const organizedSnapshot = await db
      .collection('matches')
      .where('ownerUid', '==', userId)
      .count()
      .get();
    progress.organized = organizedSnapshot.data().count;

    // Count wins - matches where player's team won
    const winsSnapshot = await db
      .collection('matches')
      .where('playerUids', 'array-contains', playerId)
      .where('status', 'in', ['completed', 'evaluated'])
      .get();

    let wins = 0;
    winsSnapshot.docs.forEach(doc => {
      const match = doc.data();
      if (match.finalScore && match.teams?.length === 2) {
        const playerTeamIndex = match.teams.findIndex((t: any) =>
          t.players?.some((p: any) => p.uid === playerId)
        );
        if (playerTeamIndex !== -1) {
          const playerScore = playerTeamIndex === 0 ? match.finalScore.team1 : match.finalScore.team2;
          const opponentScore = playerTeamIndex === 0 ? match.finalScore.team2 : match.finalScore.team1;
          if (playerScore > opponentScore) {
            wins++;
          }
        }
      }
    });
    progress.wins = wins;

    // Count championships (leagues/cups where user's team won)
    const [leagueChampSnapshot, cupChampSnapshot] = await Promise.all([
      db.collection('leagues')
        .where('championTeamId', '!=', null)
        .get(),
      db.collection('cups')
        .where('championTeamId', '!=', null)
        .get(),
    ]);

    let championships = 0;

    // Check league championships - need to verify if player was on champion team
    for (const leagueDoc of leagueChampSnapshot.docs) {
      const league = leagueDoc.data();
      if (league.championTeamId) {
        const teamDoc = await db.collection('groupTeams').doc(league.championTeamId).get();
        if (teamDoc.exists) {
          const team = teamDoc.data();
          if (team?.members?.some((m: any) => m.playerId === playerId)) {
            championships++;
          }
        }
      }
    }

    // Check cup championships
    for (const cupDoc of cupChampSnapshot.docs) {
      const cup = cupDoc.data();
      if (cup.championTeamId) {
        const teamDoc = await db.collection('groupTeams').doc(cup.championTeamId).get();
        if (teamDoc.exists) {
          const team = teamDoc.data();
          if (team?.members?.some((m: any) => m.playerId === playerId)) {
            championships++;
          }
        }
      }
    }
    progress.champion = championships;

  } catch (error) {
    logger.error('Error getting player progress for achievements', error, { playerId });
  }

  return progress;
}

/**
 * Get already unlocked achievements for a player
 */
export async function getPlayerAchievementsAction(
  playerId: string
): Promise<{ achievements: PlayerAchievement[]; error?: string }> {
  try {
    const snapshot = await db
      .collection('playerAchievements')
      .where('playerId', '==', playerId)
      .get();

    const achievements = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PlayerAchievement[];

    // Sort in memory to avoid index requirements
    achievements.sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime());

    return { achievements };
  } catch (error: any) {
    logger.error('Error getting player achievements', error, { playerId });
    return { achievements: [], error: error.message };
  }
}

/**
 * Get progress towards all achievements for a player
 */
export async function getAchievementProgressAction(
  playerId: string,
  userId: string
): Promise<{
  progress: { achievement: Achievement; current: number; unlocked: boolean; unlockedAt?: string }[];
  error?: string;
}> {
  try {
    // Ensure achievements are synchronized before getting progress
    await checkAndUnlockAchievementsAction(playerId, userId);

    const [playerProgress, { achievements: unlockedAchievements }] = await Promise.all([
      getPlayerProgress(playerId, userId),
      getPlayerAchievementsAction(playerId),
    ]);

    const unlockedIds = new Set(unlockedAchievements.map(a => a.achievementId));

    const progress = ACHIEVEMENTS.map(achievement => {
      const current = playerProgress[achievement.requirement.type] || 0;
      const unlocked = unlockedIds.has(achievement.id);
      const unlockedAchievement = unlockedAchievements.find(a => a.achievementId === achievement.id);

      return {
        achievement,
        current,
        unlocked,
        unlockedAt: unlockedAchievement?.unlockedAt,
      };
    });

    return { progress };
  } catch (error: any) {
    logger.error('Error getting achievement progress', error, { playerId });
    return { progress: [], error: error.message };
  }
}

/**
 * Check and unlock achievements for a player.
 * Call this after relevant actions (match evaluation, follow, etc.)
 *
 * @param playerId - The player ID to check achievements for
 * @param userId - The user ID who owns the player
 * @param context - Optional context for specific checks (e.g., goals in current match)
 * @returns List of newly unlocked achievements
 */
export async function checkAndUnlockAchievementsAction(
  playerId: string,
  userId: string,
  context?: {
    goalsInMatch?: number;
    matchId?: string;
  }
): Promise<{ unlocked: Achievement[]; error?: string }> {
  try {
    const [playerProgress, { achievements: existingAchievements }] = await Promise.all([
      getPlayerProgress(playerId, userId),
      getPlayerAchievementsAction(playerId),
    ]);

    // Add context-specific progress
    if (context?.goalsInMatch !== undefined) {
      playerProgress.goals_in_match = context.goalsInMatch;
    }

    const unlockedIds = new Set(existingAchievements.map(a => a.achievementId));
    const newlyUnlocked: Achievement[] = [];

    // Check each achievement
    for (const achievement of ACHIEVEMENTS) {
      // Skip if already unlocked
      if (unlockedIds.has(achievement.id)) continue;

      const currentValue = playerProgress[achievement.requirement.type] || 0;
      const requiredValue = achievement.requirement.count;

      // Check if requirement is met
      if (currentValue >= requiredValue) {
        // Unlock the achievement
        const achievementData: Omit<PlayerAchievement, 'id'> = {
          achievementId: achievement.id,
          playerId: playerId,
          userId: userId,
          unlockedAt: new Date().toISOString(),
        };

        await db.collection('playerAchievements').doc(`${playerId}_${achievement.id}`).set(achievementData);
        newlyUnlocked.push(achievement);

        // Create notification for the user
        await db.collection(`users/${userId}/notifications`).add({
          type: 'achievement_unlocked',
          title: '🏆 ¡Logro Desbloqueado!',
          message: `Has conseguido "${achievement.name}"`,
          link: '/achievements',
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: {
            achievementId: achievement.id,
            playerId: playerId,
          },
        });

        // Publish social activity
        await db.collection('socialActivities').add({
          type: 'achievement_unlocked',
          userId: userId,
          playerId: playerId,
          timestamp: FieldValue.serverTimestamp(),
          metadata: {
            achievementName: achievement.name,
            achievementIcon: achievement.icon,
          },
        });

        logger.info('Achievement unlocked', {
          playerId,
          achievementId: achievement.id,
          achievementName: achievement.name
        });
      }
    }

    return { unlocked: newlyUnlocked };
  } catch (error: any) {
    logger.error('Error checking achievements', error, { playerId });
    return { unlocked: [], error: error.message };
  }
}

/**
 * Get recent achievements across all players (for feed/discovery)
 */
export async function getRecentAchievementsAction(
  limit: number = 10
): Promise<{ achievements: (PlayerAchievement & { playerName?: string; playerPhotoUrl?: string })[]; error?: string }> {
  try {
    const snapshot = await db
      .collection('playerAchievements')
      .get();

    const allAchievements = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as PlayerAchievement[];

    // Sort in memory and limit
    const sortedAchievements = allAchievements
      .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
      .slice(0, limit);

    const achievements = await Promise.all(
      sortedAchievements.map(async data => {

        // Get player info
        let playerName: string | undefined;
        let playerPhotoUrl: string | undefined;

        try {
          const playerDoc = await db.collection('players').doc(data.playerId).get();
          if (playerDoc.exists) {
            const player = playerDoc.data() as Player;
            playerName = player.name;
            playerPhotoUrl = (player as any).photoUrl || player.photoURL;
          }
        } catch (e) {
          // Ignore errors fetching player info
        }

        return {
          ...data,
          id: data.id,
          playerName,
          playerPhotoUrl: playerPhotoUrl,
        };
      })
    );

    return { achievements };
  } catch (error: any) {
    logger.error('Error getting recent achievements', error);
    return { achievements: [], error: error.message };
  }
}
