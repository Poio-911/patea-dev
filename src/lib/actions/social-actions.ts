'use server';

import { adminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { SocialActivity, Follow, Player, OvrHistory } from '@/lib/types';
import { handleServerActionError, createError, ErrorCodes } from '@/lib/errors';

// Generic publisher for social activities
export async function publishActivityAction(activity: Omit<SocialActivity, 'id'>) {
  try {
    const ref = await adminDb.collection('socialActivities').add(activity);
    return { success: true, id: ref.id };
  } catch (error) {
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

    // Check existing follow
    const existing = await adminDb
      .collection('follows')
      .where('followerId', '==', followerId)
      .where('followingId', '==', followingId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { success: false, error: 'Ya sigues a este usuario.' };
    }

    const followData: Omit<Follow, 'id'> = {
      followerId,
      followingId,
      createdAt: new Date().toISOString(),
    };
    const docRef = await adminDb.collection('follows').add(followData);

    // Publish social activity (new follower)
    await publishActivityAction({
      type: 'new_follower',
      userId: followerId,
      timestamp: new Date().toISOString(),
      metadata: { achievementName: 'Nuevo seguidor', achievementIcon: 'user-plus' },
    });

    // Optional: Notification to followed user
    await adminDb.collection(`users/${followingId}/notifications`).add({
      type: 'new_follower',
      title: 'Nuevo seguidor',
      message: `Un usuario ha comenzado a seguirte.`,
      link: '/feed',
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: { fromUserId: followerId },
    });

    return { success: true, followId: docRef.id };
  } catch (error) {
    const err = handleServerActionError(error, { followerId, followingId });
    return { success: false, error: err.error };
  }
}

// Unfollow
export async function unfollowUserAction(followerId: string, followingId: string) {
  try {
    const existing = await adminDb
      .collection('follows')
      .where('followerId', '==', followerId)
      .where('followingId', '==', followingId)
      .limit(1)
      .get();
    if (existing.empty) {
      return { success: false, error: 'No sigues a este usuario.' };
    }
    await existing.docs[0].ref.delete();
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
    timestamp: new Date().toISOString(),
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
    timestamp: new Date().toISOString(),
    metadata: { matchId, matchTitle },
  });
}
