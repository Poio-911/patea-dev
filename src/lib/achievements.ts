'use server';

import { getAdminDb } from '@/firebase/admin-init';
import type { Player, Achievement, PlayerAchievement } from './types';
import { publishAchievementActivity } from './actions/social-actions';
import { logger } from './logger';
import { ACHIEVEMENTS } from './achievements-config';

export async function checkAchievementsAction(playerId: string) {
    logger.info(`Checking achievements for player ${playerId}`);
    try {
        const db = getAdminDb();
        const playerRef = db.doc(`players/${playerId}`);
        const playerSnap = await playerRef.get();
        if (!playerSnap.exists) {
            return { error: 'Jugador no encontrado.' };
        }
        const player = { id: playerSnap.id, ...playerSnap.data() } as Player;

        // Fetch current unlocked achievements
        const unlockedSnap = await db.collection(`players/${playerId}/achievements`).get();
        const unlockedIds = new Set(unlockedSnap.docs.map(doc => doc.data().achievementId as string));

        const newlyUnlocked: Achievement[] = [];

        // Evaluate each locked achievement
        for (const achievement of ACHIEVEMENTS) {
            if (unlockedIds.has(achievement.id)) continue; // Already unlocked

            let isUnlocked = false;

            switch (achievement.requirement.type) {
                case 'matches':
                    isUnlocked = (player.stats?.matchesPlayed || 0) >= achievement.requirement.count;
                    break;
                case 'goals':
                    isUnlocked = (player.stats?.goals || 0) >= achievement.requirement.count;
                    break;
                case 'ovr':
                    isUnlocked = (player.ovr || 0) >= achievement.requirement.count;
                    break;
                case 'goals_in_match':
                    // To efficiently check goals in a single match without querying all matches every time, 
                    // we can look at the latest selfEvaluations since this function runs after a match.
                    // Instead of full history, we'll fetch the highest goal count they ever recorded in selfEvaluations.
                    const highestGoalSnap = await db.collection('matches')
                        .where('status', '==', 'evaluated') // Optional filter
                        .get();
                    // NOTE: Querying cross-collection for selfEvaluations where 'playerId' == playerId is better,
                    // but selfEvaluations are subcollections of matches.
                    // We can rely on a fast check. Let's do a Collection Group query.
                    const selfEvalsSnap = await db.collectionGroup('selfEvaluations').where('playerId', '==', playerId).orderBy('goals', 'desc').limit(1).get();
                    if (!selfEvalsSnap.empty) {
                        const topGoals = selfEvalsSnap.docs[0].data().goals || 0;
                        isUnlocked = topGoals >= achievement.requirement.count;
                    }
                    break;
                case 'wins':
                case 'followers':
                case 'organized':
                case 'champion':
                    // Leaving placeholders for future expansion as per type definitions
                    break;
            }

            if (isUnlocked) {
                newlyUnlocked.push(achievement);
            }
        }

        // Save newly unlocked achievements and trigger notifications
        if (newlyUnlocked.length > 0) {
            const batch = db.batch();
            for (const achievement of newlyUnlocked) {
                const docRef = db.collection(`players/${playerId}/achievements`).doc();
                const achievementData: Omit<PlayerAchievement, 'id'> = {
                    achievementId: achievement.id,
                    playerId,
                    userId: player.ownerUid,
                    unlockedAt: new Date().toISOString()
                };
                batch.set(docRef, achievementData);

                // Fire and forget social activity
                publishAchievementActivity(player, achievement).catch(err =>
                    logger.error(`Error publishing social activity for achievement ${achievement.id}`, err)
                );
            }
            await batch.commit();
            logger.info(`Player ${playerId} unlocked ${newlyUnlocked.length} new achievements.`);
        }

        return { success: true, newlyUnlocked };
    } catch (error: any) {
        logger.error(`Error checking achievements for player ${playerId}`, error);
        return { success: false, error: error.message };
    }
}
