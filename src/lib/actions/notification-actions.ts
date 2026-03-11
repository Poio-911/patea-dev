'use server';

import { getAdminDb, getAdminMessaging } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/get-server-session';

const db = getAdminDb();

/**
 * Mark all unread notifications as read for current authenticated user
 */
export async function markAllNotificationsAsReadAction(): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const userId = await requireAuth();

    const notificationsRef = db.collection('users').doc(userId).collection('notifications');
    const unreadSnap = await notificationsRef.where('isRead', '==', false).get();

    if (unreadSnap.empty) {
      return { success: true, updatedCount: 0 };
    }

    const batch = db.batch();
    unreadSnap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { isRead: true });
    });
    await batch.commit();

    return { success: true, updatedCount: unreadSnap.size };
  } catch (error: any) {
    logger.error('Error marking notifications as read', { error: error?.message });
    return { success: false, error: error?.message || 'No se pudieron marcar las notificaciones como leídas.' };
  }
}

/**
 * Save FCM token for a user
 */
export async function saveFCMTokenAction(userId: string, token: string) {
  try {
    const userRef = db.collection('users').doc(userId);

    // Add token to the user's fcmTokens array (arrayUnion prevents duplicates)
    await userRef.update({
      fcmTokens: FieldValue.arrayUnion(token),
    });

    logger.info('FCM token saved successfully', { userId });
    return { success: true };
  } catch (error: any) {
    logger.error('Error saving FCM token', { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Remove FCM token for a user
 */
export async function removeFCMTokenAction(userId: string, token: string) {
  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      fcmTokens: FieldValue.arrayRemove(token),
    });

    logger.info('FCM token removed successfully', { userId });
    return { success: true };
  } catch (error: any) {
    logger.error('Error removing FCM token', { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Update notification preferences for a user
 */
export async function updateNotificationPreferencesAction(
  userId: string,
  preferences: {
    matchInvites?: boolean;
    matchReminders?: boolean;
    teamChanges?: boolean;
    matchUpdates?: boolean;
  }
) {
  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      notificationPreferences: preferences,
    });

    logger.info('Notification preferences updated successfully', { userId, preferences });
    return { success: true };
  } catch (error: any) {
    logger.error('Error updating notification preferences', { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Send a notification to specific users
 * This will be called by server-side code to trigger push notifications
 */
export async function sendNotificationToUsersAction(params: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}) {
  const { userIds, title, body, data, imageUrl } = params;

  try {
    // Get FCM tokens for all target users
    const tokens: string[] = [];

    for (const userId of userIds) {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const userData = userSnap.data();
        const userTokens = userData?.fcmTokens || [];
        tokens.push(...userTokens);
      }
    }

    if (tokens.length === 0) {
      logger.warn('No FCM tokens found for users', { userIds });
      return { success: false, error: 'No tokens found' };
    }

    const messaging = getAdminMessaging();

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
        ...(imageUrl ? { imageUrl } : {}),
      },
      webpush: {
        fcmOptions: {
          link: data?.link || '/',
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-48x48.png',
        },
      },
      ...(data ? { data } : {}),
    });

    // Cleanup invalid/expired tokens
    const tokensToRemove: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const errorCode = resp.error.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      logger.info('Removing stale FCM tokens', { count: tokensToRemove.length });
      // Remove stale tokens from all target users
      for (const userId of userIds) {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
          fcmTokens: FieldValue.arrayRemove(...tokensToRemove),
        });
      }
    }

    logger.info('Push notifications sent', {
      userIds,
      title,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    return {
      success: true,
      message: `Notification sent to ${response.successCount}/${tokens.length} devices`,
    };
  } catch (error: any) {
    logger.error('Error sending notification', { userIds, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Send notification when a player is added to a match
 */
export async function notifyPlayerAddedToMatchAction(params: {
  playerId: string;
  matchId?: string;
  matchTitle: string;
  matchDate: string;
  matchLocation: string;
}) {
  const { playerId, matchId, matchTitle, matchDate, matchLocation } = params;

  return sendNotificationToUsersAction({
    userIds: [playerId],
    title: '⚽ Te agregaron a un partido',
    body: `${matchTitle} - ${matchDate} en ${matchLocation}`,
    data: {
      type: 'match_invite',
      matchTitle,
      matchDate,
      ...(matchId ? { link: `/matches/${matchId}` } : {}),
    },
  });
}

/**
 * Send notification when teams are shuffled
 */
export async function notifyTeamsShuffledAction(params: {
  playerIds: string[];
  matchTitle: string;
}) {
  const { playerIds, matchTitle } = params;

  return sendNotificationToUsersAction({
    userIds: playerIds,
    title: '🔄 Cambio de equipos',
    body: `Los equipos de "${matchTitle}" fueron redistribuidos`,
    data: {
      type: 'team_change',
      matchTitle,
    },
  });
}

/**
 * Send notification reminder before match starts
 */
export async function notifyMatchReminderAction(params: {
  playerIds: string[];
  matchTitle: string;
  matchTime: string;
  matchLocation: string;
}) {
  const { playerIds, matchTitle, matchTime, matchLocation } = params;

  return sendNotificationToUsersAction({
    userIds: playerIds,
    title: '⏰ Recordatorio de partido',
    body: `Tu partido "${matchTitle}" es a las ${matchTime} en ${matchLocation}`,
    data: {
      type: 'match_reminder',
      matchTitle,
      matchTime,
    },
  });
}

/**
 * Send notification when match details are updated
 */
export async function notifyMatchUpdatedAction(params: {
  playerIds: string[];
  matchTitle: string;
  updateType: 'location' | 'time' | 'date' | 'cancelled';
  updateDetails: string;
}) {
  const { playerIds, matchTitle, updateType, updateDetails } = params;

  const titles = {
    location: '📍 Cambio de cancha',
    time: '🕐 Cambio de horario',
    date: '📅 Cambio de fecha',
    cancelled: '❌ Partido cancelado',
  };

  return sendNotificationToUsersAction({
    userIds: playerIds,
    title: titles[updateType],
    body: `${matchTitle}: ${updateDetails}`,
    data: {
      type: 'match_update',
      matchTitle,
      updateType,
    },
  });
}

/**
 * Send notification when evaluation is available
 */
export async function notifyEvaluationAvailableAction(params: {
  playerIds: string[];
  matchTitle: string;
}) {
  const { playerIds, matchTitle } = params;

  return sendNotificationToUsersAction({
    userIds: playerIds,
    title: '⭐ ¡Evaluá el partido!',
    body: `Ya podés evaluar a tus compañeros en "${matchTitle}"`,
    data: {
      type: 'evaluation_available',
      matchTitle,
    },
  });
}
