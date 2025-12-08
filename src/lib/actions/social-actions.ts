'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { SocialActivity, Follow, Player, OvrHistory } from '../../lib/types';
import { handleServerActionError, createError, ErrorCodes } from '../../lib/errors';

// Generic publisher for social activities with fan-out system
export async function publishActivityAction(activity: Omit<SocialActivity, 'id'>) {
  try {
    // Ensure timestamp uses serverTimestamp for consistent ordering
    const baseActivity: Omit<SocialActivity, 'id'> = {
      ...activity,
      timestamp: FieldValue.serverTimestamp() as any,
    };

    // 1. Add to main socialActivities collection (for <= 10 followers case)
    const ref = await getAdminDb().collection('socialActivities').add(baseActivity).catch(err => {
      console.error('[publishActivityAction] Failed main write', err);
      throw err;
    });
    const activityWithId = { ...baseActivity, id: ref.id };

    // 2. Fan-out: Add to follower feeds (for > 10 followers case)
    try {
      // Get all followers of this user
      const followsSnapshot = await getAdminDb()
        .collection('follows')
        .where('followingId', '==', activity.userId)
        .get();

      if (!followsSnapshot.empty) {
        const batch = getAdminDb().batch();
        
        followsSnapshot.docs.forEach(followDoc => {
          const followerData = followDoc.data();
          const followerFeedRef = getAdminDb()
            .collection(`users/${followerData.followerId}/feeds`)
            .doc();
          
          batch.set(followerFeedRef, activityWithId);
        });

        await batch.commit().catch(err => console.error('[publishActivityAction] Fan-out batch failed', err));
      }
    } catch (fanOutError) {
      console.warn('Failed to fan-out activity to follower feeds:', fanOutError);
      // Don't fail the main activity creation if fan-out fails
    }

    return { success: true, id: ref.id };
  } catch (error) {
    console.error('[publishActivityAction] Error creating activity', error);
    const err = handleServerActionError(error, { activityType: activity.type });
    return { success: false, error: err.error };
  }
}

// Follow a user
export async function followUserAction(followerId: string, followingId: string) {
  try {
    if (followerId === followingId) {
      return { success: false, error: 'No puedes seguirte a ti mismo.' };
    }

    // ✅ FIX: Use transaction to prevent duplicate follows (race condition)
    const db = getAdminDb();
    const followsRef = db.collection('follows');

    // Create a deterministic document ID for idempotency
    const followDocId = `${followerId}_${followingId}`;
    const followDocRef = followsRef.doc(followDocId);

    const result = await db.runTransaction(async (transaction) => {
      // Check if follow already exists atomically
      const existingFollow = await transaction.get(followDocRef);

      if (existingFollow.exists) {
        return { alreadyExists: true };
      }

      // Create follow document atomically
      const followData: Omit<Follow, 'id'> = {
        followerId,
        followingId,
        createdAt: new Date().toISOString(),
      };
      transaction.set(followDocRef, followData);

      return { created: true };
    });

    if (result.alreadyExists) {
      return { success: false, error: 'Ya sigues a este usuario.' };
    }

    // Publish social activity (new follower) - outside transaction is OK
    await publishActivityAction({
      type: 'new_follower',
      userId: followerId,
      timestamp: FieldValue.serverTimestamp() as any,
      metadata: { achievementName: 'Nuevo seguidor', achievementIcon: 'user-plus' },
    });

    // Optional: Notification to followed user
    await db.collection(`users/${followingId}/notifications`).add({
      type: 'new_follower',
      title: 'Nuevo seguidor',
      message: `Un usuario ha comenzado a seguirte.`,
      link: '/feed',
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: { fromUserId: followerId },
    });

    return { success: true, followId: followDocId };
  } catch (error) {
    const err = handleServerActionError(error, { followerId, followingId });
    return { success: false, error: err.error };
  }
}

// Unfollow
export async function unfollowUserAction(followerId: string, followingId: string) {
  try {
    // ✅ FIX: Use deterministic document ID (same as followUserAction)
    const db = getAdminDb();
    const followDocId = `${followerId}_${followingId}`;
    const followDocRef = db.collection('follows').doc(followDocId);

    // Use transaction to ensure atomicity
    const result = await db.runTransaction(async (transaction) => {
      const followDoc = await transaction.get(followDocRef);

      if (!followDoc.exists) {
        return { notFound: true };
      }

      // Delete the follow relationship atomically
      transaction.delete(followDocRef);

      return { deleted: true };
    });

    if (result.notFound) {
      return { success: false, error: 'No sigues a este usuario.' };
    }

    // Clean up: Remove unfollowed user's activities from follower's feed
    // This happens outside the transaction and can fail gracefully
    try {
      const followerFeedSnapshot = await db
        .collection(`users/${followerId}/feeds`)
        .where('userId', '==', followingId)
        .get();

      if (!followerFeedSnapshot.empty) {
        const batch = db.batch();
        followerFeedSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup unfollowed user activities from feed:', cleanupError);
      // Don't fail the unfollow operation if cleanup fails
    }

    return { success: true };
  } catch (error) {
    const err = handleServerActionError(error, { followerId, followingId });
    return { success: false, error: err.error };
  }
}

// Helper to publish OVR change activity
export async function publishOvrChangeActivity(player: Player, history: OvrHistory) {
  const delta = history.change;
  await publishActivityAction({
    type: delta >= 0 ? 'ovr_increased' : 'ovr_decreased',
    userId: player.ownerUid,
    playerId: player.id,
    playerName: player.name,
    playerPhotoUrl: player.photoUrl,
    timestamp: FieldValue.serverTimestamp() as any,
    metadata: {
      oldOvr: history.oldOVR,
      newOvr: history.newOVR,
      ovrChange: delta,
    },
  });
}

// Activity when match played (aggregate per participant user)
export async function publishMatchPlayedActivity(userId: string, matchId: string, matchTitle: string) {
  await publishActivityAction({
    type: 'match_played',
    userId,
    timestamp: FieldValue.serverTimestamp() as any,
    metadata: { matchId, matchTitle },
  });
}

// Seed a few test activities for debugging the feed
export async function seedActivitiesAction(userId: string) {
  const examples: Array<Omit<SocialActivity, 'id'>> = [
    { type: 'player_created', userId, playerName: 'Jugador Seed', timestamp: FieldValue.serverTimestamp() as any },
    { type: 'achievement_unlocked', userId, metadata: { achievementName: 'Primer Logro' }, timestamp: FieldValue.serverTimestamp() as any },
    { type: 'match_played', userId, metadata: { matchTitle: 'Partido Seed' }, timestamp: FieldValue.serverTimestamp() as any },
  ];
  for (const act of examples) {
    await publishActivityAction(act);
  }
  return { success: true, count: examples.length };
}
