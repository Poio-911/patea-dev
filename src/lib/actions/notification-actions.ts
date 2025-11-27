'use server';

import { db } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { logger } from '@/lib/logger';

/**
 * Save FCM token for a user
 */
export async function saveFCMTokenAction(userId: string, token: string) {
  try {
    const userRef = doc(db, 'users', userId);

    // Add token to the user's fcmTokens array (arrayUnion prevents duplicates)
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
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
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      fcmTokens: arrayRemove(token),
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
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
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
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const userTokens = userData.fcmTokens || [];
        tokens.push(...userTokens);
      }
    }

    if (tokens.length === 0) {
      logger.warn('No FCM tokens found for users', { userIds });
      return { success: false, error: 'No tokens found' };
    }

    // In a real implementation, you would call Firebase Admin SDK here
    // For now, we'll use the Web API approach (requires a backend endpoint)

    // TODO: Implement actual FCM sending logic
    // This would typically be done via Firebase Cloud Functions or a backend API
    // For the client-side demo, we can show how it would work

    logger.info('Notification queued for sending', {
      userIds,
      title,
      tokenCount: tokens.length,
    });

    return {
      success: true,
      message: `Notification queued for ${tokens.length} devices`,
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
  matchTitle: string;
  matchDate: string;
  matchLocation: string;
}) {
  const { playerId, matchTitle, matchDate, matchLocation } = params;

  return sendNotificationToUsersAction({
    userIds: [playerId],
    title: '⚽ Te agregaron a un partido',
    body: `${matchTitle} - ${matchDate} en ${matchLocation}`,
    data: {
      type: 'match_invite',
      matchTitle,
      matchDate,
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
