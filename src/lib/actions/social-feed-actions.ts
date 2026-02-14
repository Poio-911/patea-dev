'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { SocialActivity, SocialComment, ReactionType, SuggestedUser, Player } from '../../lib/types';
import { handleServerActionError } from '../../lib/errors';

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Add a comment to a social activity
 */
export async function addCommentAction(
  activityId: string,
  userId: string,
  userName: string,
  userPhotoUrl: string | undefined,
  text: string
): Promise<{ success: boolean; comment?: SocialComment; error?: string }> {
  try {
    if (!text.trim()) {
      return { success: false, error: 'El comentario no puede estar vacío' };
    }

    if (text.length > 500) {
      return { success: false, error: 'El comentario no puede exceder 500 caracteres' };
    }

    const db = getAdminDb();
    const commentRef = db.collection(`socialActivities/${activityId}/comments`).doc();

    const commentData: Omit<SocialComment, 'id'> = {
      activityId,
      userId,
      userName,
      userPhotoUrl,
      text: text.trim(),
      createdAt: FieldValue.serverTimestamp() as any,
      likes: [],
    };

    await commentRef.set(commentData);

    // Increment comment count on the activity
    await db.collection('socialActivities').doc(activityId).update({
      commentCount: FieldValue.increment(1),
    });

    return {
      success: true,
      comment: {
        id: commentRef.id,
        ...commentData,
        createdAt: new Date().toISOString(), // Return ISO string for client
      } as SocialComment,
    };
  } catch (error) {
    const err = handleServerActionError(error, { activityId });
    return { success: false, error: err.error };
  }
}

/**
 * Get comments for a social activity
 */
export async function getCommentsAction(
  activityId: string,
  limit: number = 50
): Promise<{ success: boolean; comments?: SocialComment[]; error?: string }> {
  try {
    const db = getAdminDb();
    const commentsSnapshot = await db
      .collection(`socialActivities/${activityId}/comments`)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    const comments: SocialComment[] = commentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      let createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate().toISOString();
      } else if (createdAt && createdAt._seconds) {
        createdAt = new Date(createdAt._seconds * 1000).toISOString();
      }

      return {
        id: doc.id,
        ...data,
        createdAt,
      } as SocialComment;
    });

    return { success: true, comments };
  } catch (error) {
    const err = handleServerActionError(error, { activityId });
    return { success: false, error: err.error };
  }
}

/**
 * Delete a comment (only author can delete)
 */
export async function deleteCommentAction(
  activityId: string,
  commentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    const commentRef = db.collection(`socialActivities/${activityId}/comments`).doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return { success: false, error: 'Comentario no encontrado' };
    }

    const commentData = commentDoc.data();
    if (commentData?.userId !== userId) {
      return { success: false, error: 'No tienes permiso para eliminar este comentario' };
    }

    await commentRef.delete();

    // Decrement comment count on the activity
    await db.collection('socialActivities').doc(activityId).update({
      commentCount: FieldValue.increment(-1),
    });

    return { success: true };
  } catch (error) {
    const err = handleServerActionError(error, { activityId, commentId });
    return { success: false, error: err.error };
  }
}

/**
 * Like a comment
 */
export async function likeCommentAction(
  activityId: string,
  commentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    const commentRef = db.collection(`socialActivities/${activityId}/comments`).doc(commentId);

    await commentRef.update({
      likes: FieldValue.arrayUnion(userId),
    });

    return { success: true };
  } catch (error) {
    const err = handleServerActionError(error, { activityId, commentId });
    return { success: false, error: err.error };
  }
}

/**
 * Unlike a comment
 */
export async function unlikeCommentAction(
  activityId: string,
  commentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    const commentRef = db.collection(`socialActivities/${activityId}/comments`).doc(commentId);

    await commentRef.update({
      likes: FieldValue.arrayRemove(userId),
    });

    return { success: true };
  } catch (error) {
    const err = handleServerActionError(error, { activityId, commentId });
    return { success: false, error: err.error };
  }
}

// ============================================================================
// REACTIONS
// ============================================================================

/**
 * Add a reaction to a social activity
 */
export async function addReactionAction(
  activityId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    const activityRef = db.collection('socialActivities').doc(activityId);

    await activityRef.update({
      [`reactions.${reactionType}`]: FieldValue.arrayUnion(userId),
    });

    return { success: true };
  } catch (error) {
    const err = handleServerActionError(error, { activityId, reactionType });
    return { success: false, error: err.error };
  }
}

/**
 * Remove a reaction from a social activity
 */
export async function removeReactionAction(
  activityId: string,
  userId: string,
  reactionType: ReactionType
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    const activityRef = db.collection('socialActivities').doc(activityId);

    await activityRef.update({
      [`reactions.${reactionType}`]: FieldValue.arrayRemove(userId),
    });

    return { success: true };
  } catch (error) {
    const err = handleServerActionError(error, { activityId, reactionType });
    return { success: false, error: err.error };
  }
}

// ============================================================================
// REPOST
// ============================================================================

/**
 * Repost a social activity
 */
export async function repostActivityAction(
  originalActivityId: string,
  userId: string,
  userName: string,
  userPhotoUrl?: string
): Promise<{ success: boolean; repostId?: string; error?: string }> {
  try {
    const db = getAdminDb();

    // Get original activity
    const originalDoc = await db.collection('socialActivities').doc(originalActivityId).get();
    if (!originalDoc.exists) {
      return { success: false, error: 'Actividad original no encontrada' };
    }

    const originalActivity = originalDoc.data() as SocialActivity;

    // Don't allow reposting reposts
    if (originalActivity.isRepost) {
      return { success: false, error: 'No se puede repostear un repost' };
    }

    // Check if user already reposted this activity
    const existingRepost = await db.collection('socialActivities')
      .where('originalActivityId', '==', originalActivityId)
      .where('userId', '==', userId)
      .where('isRepost', '==', true)
      .limit(1)
      .get();

    if (!existingRepost.empty) {
      return { success: false, error: 'Ya reposteaste esta actividad' };
    }

    // Create repost activity
    const repostData: Omit<SocialActivity, 'id'> = {
      type: 'repost',
      userId,
      playerName: userName,
      playerPhotoUrl: userPhotoUrl,
      playerId: originalActivity.playerId,
      timestamp: FieldValue.serverTimestamp() as any,
      metadata: originalActivity.metadata,
      isRepost: true,
      originalActivityId,
      repostedBy: {
        userId,
        userName,
        userPhotoUrl,
      },
      reactions: { fire: [], clap: [], goal: [] },
      commentCount: 0,
      repostCount: 0,
    };

    const repostRef = await db.collection('socialActivities').add(repostData);

    // Increment repost count on original activity
    await db.collection('socialActivities').doc(originalActivityId).update({
      repostCount: FieldValue.increment(1),
    });

    return { success: true, repostId: repostRef.id };
  } catch (error) {
    const err = handleServerActionError(error, { originalActivityId });
    return { success: false, error: err.error };
  }
}

/**
 * Remove a repost
 */
export async function unrepostActivityAction(
  originalActivityId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();

    // Find the user's repost of this activity
    const repostSnapshot = await db.collection('socialActivities')
      .where('originalActivityId', '==', originalActivityId)
      .where('userId', '==', userId)
      .where('isRepost', '==', true)
      .limit(1)
      .get();

    if (repostSnapshot.empty) {
      return { success: false, error: 'No has reposteado esta actividad' };
    }

    // Delete the repost
    await repostSnapshot.docs[0].ref.delete();

    // Decrement repost count on original activity
    await db.collection('socialActivities').doc(originalActivityId).update({
      repostCount: FieldValue.increment(-1),
    });

    return { success: true };
  } catch (error) {
    const err = handleServerActionError(error, { originalActivityId });
    return { success: false, error: err.error };
  }
}

/**
 * Check if user has reposted an activity
 */
export async function hasUserRepostedAction(
  activityId: string,
  userId: string
): Promise<{ success: boolean; hasReposted?: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    const repostSnapshot = await db.collection('socialActivities')
      .where('originalActivityId', '==', activityId)
      .where('userId', '==', userId)
      .where('isRepost', '==', true)
      .limit(1)
      .get();

    return { success: true, hasReposted: !repostSnapshot.empty };
  } catch (error) {
    const err = handleServerActionError(error, { activityId });
    return { success: false, error: err.error };
  }
}

// ============================================================================
// EXPLORE / SUGGESTED USERS
// ============================================================================

/**
 * Get suggested users to follow
 */
export async function getSuggestedUsersAction(
  userId: string,
  activeGroupId?: string
): Promise<{ success: boolean; users?: SuggestedUser[]; error?: string }> {
  try {
    const db = getAdminDb();
    const suggestedUsers: SuggestedUser[] = [];
    const addedUserIds = new Set<string>([userId]); // Exclude current user

    // Get list of users already followed + visible player IDs in parallel
    const [followsSnapshot, availablePlayersSnapshot] = await Promise.all([
      db.collection('follows')
        .where('followerId', '==', userId)
        .get(),
      // Get visible player IDs and their locations
      db.collection('availablePlayers').select('location').get(),
    ]);

    followsSnapshot.docs.forEach((doc) => {
      addedUserIds.add(doc.data().followingId);
    });

    const availablePlayerIds = new Set(availablePlayersSnapshot.docs.map(d => d.id));
    // Build location map from availablePlayers
    const availablePlayerLocations = new Map<string, { lat: number; lng: number }>();
    for (const apDoc of availablePlayersSnapshot.docs) {
      const loc = apDoc.data().location;
      if (loc?.lat && loc?.lng) {
        availablePlayerLocations.set(apDoc.id, { lat: loc.lat, lng: loc.lng });
      }
    }
    // Track group member IDs so sections 2 & 3 can skip visibility check for them
    const groupMemberIds = new Set<string>();

    // 1. Same group users (if activeGroupId provided)
    if (activeGroupId) {
      const groupDoc = await db.collection('groups').doc(activeGroupId).get();
      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        const members = groupData?.members || [];

        // Track all group members for visibility checks in sections 2 & 3
        for (const memberId of members) {
          groupMemberIds.add(memberId);
        }

        for (const memberId of members) {
          if (addedUserIds.has(memberId) || suggestedUsers.length >= 5) continue;

          // Get user profile
          const userDoc = await db.collection('users').doc(memberId).get();
          if (!userDoc.exists) continue;

          const userData = userDoc.data();

          // Get player data for position and OVR
          const playerDoc = await db.collection('players').doc(memberId).get();
          const playerData = playerDoc.exists ? playerDoc.data() as Player : null;

          // Get follower count
          const followerCount = await db.collection('follows')
            .where('followingId', '==', memberId)
            .count()
            .get();

          suggestedUsers.push({
            uid: memberId,
            displayName: userData?.displayName || 'Usuario',
            photoURL: userData?.photoURL,
            position: playerData?.position,
            ovr: playerData?.ovr,
            followerCount: followerCount.data().count,
            matchesPlayed: playerData?.stats?.matchesPlayed,
            reason: 'same_group',
            location: availablePlayerLocations.get(memberId),
          });
          addedUserIds.add(memberId);
        }
      }
    }

    // 2. Most followed users (global)
    // Get users with most followers
    const allFollowsSnapshot = await db.collection('follows')
      .select('followingId')
      .get();

    const followerCounts: Record<string, number> = {};
    allFollowsSnapshot.docs.forEach((doc) => {
      const followingId = doc.data().followingId;
      followerCounts[followingId] = (followerCounts[followingId] || 0) + 1;
    });

    const sortedByFollowers = Object.entries(followerCounts)
      .filter(([uid]) => !addedUserIds.has(uid))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [memberId, count] of sortedByFollowers) {
      if (suggestedUsers.length >= 15) break;
      if (addedUserIds.has(memberId)) continue;
      // Visibility: skip users outside the group who aren't in availablePlayers
      if (!groupMemberIds.has(memberId) && !availablePlayerIds.has(memberId)) continue;

      const userDoc = await db.collection('users').doc(memberId).get();
      if (!userDoc.exists) continue;

      const userData = userDoc.data();
      const playerDoc = await db.collection('players').doc(memberId).get();
      const playerData = playerDoc.exists ? playerDoc.data() as Player : null;

      suggestedUsers.push({
        uid: memberId,
        displayName: userData?.displayName || 'Usuario',
        photoURL: userData?.photoURL,
        position: playerData?.position,
        ovr: playerData?.ovr,
        followerCount: count,
        matchesPlayed: playerData?.stats?.matchesPlayed,
        reason: 'most_followed',
        location: availablePlayerLocations.get(memberId),
      });
      addedUserIds.add(memberId);
    }

    // 3. Recently active users (based on recent activities)
    const recentActivitiesSnapshot = await db.collection('socialActivities')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const recentUserIds = new Set<string>();
    recentActivitiesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.userId && !addedUserIds.has(data.userId)) {
        recentUserIds.add(data.userId);
      }
    });

    for (const memberId of recentUserIds) {
      if (suggestedUsers.length >= 20) break;
      if (addedUserIds.has(memberId)) continue;
      // Visibility: skip users outside the group who aren't in availablePlayers
      if (!groupMemberIds.has(memberId) && !availablePlayerIds.has(memberId)) continue;

      const userDoc = await db.collection('users').doc(memberId).get();
      if (!userDoc.exists) continue;

      const userData = userDoc.data();
      const playerDoc = await db.collection('players').doc(memberId).get();
      const playerData = playerDoc.exists ? playerDoc.data() as Player : null;

      const followerCount = await db.collection('follows')
        .where('followingId', '==', memberId)
        .count()
        .get();

      suggestedUsers.push({
        uid: memberId,
        displayName: userData?.displayName || 'Usuario',
        photoURL: userData?.photoURL,
        position: playerData?.position,
        ovr: playerData?.ovr,
        followerCount: followerCount.data().count,
        matchesPlayed: playerData?.stats?.matchesPlayed,
        reason: 'recently_active',
        location: availablePlayerLocations.get(memberId),
      });
      addedUserIds.add(memberId);
    }

    return { success: true, users: suggestedUsers };
  } catch (error) {
    const err = handleServerActionError(error, { userId });
    return { success: false, error: err.error };
  }
}

/**
 * Get original activity for a repost (to display the original content)
 */
export async function getOriginalActivityAction(
  activityId: string
): Promise<{ success: boolean; activity?: SocialActivity; error?: string }> {
  try {
    const db = getAdminDb();
    const activityDoc = await db.collection('socialActivities').doc(activityId).get();

    if (!activityDoc.exists) {
      return { success: false, error: 'Actividad no encontrada' };
    }

    const data = activityDoc.data();
    let timestamp = data?.timestamp;
    if (timestamp && typeof timestamp.toDate === 'function') {
      timestamp = timestamp.toDate().toISOString();
    } else if (timestamp && timestamp._seconds) {
      timestamp = new Date(timestamp._seconds * 1000).toISOString();
    }

    return {
      success: true,
      activity: {
        id: activityDoc.id,
        ...data,
        timestamp,
      } as SocialActivity,
    };
  } catch (error) {
    const err = handleServerActionError(error, { activityId });
    return { success: false, error: err.error };
  }
}
