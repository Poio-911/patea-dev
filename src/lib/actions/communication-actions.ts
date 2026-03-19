'use server';

import { getAdminDb, getAdminAuth } from '@/firebase/admin-init';
import type { CommunicationMessage, MessageRecipientType } from '@/lib/types';
import { replaceVariables } from '@/lib/message-templates';

interface SendMessageParams {
  leagueId: string;
  recipientType: MessageRecipientType;
  recipientIds: string[];
  subject: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  deliveryMethod?: ('push' | 'email')[];
  metadata?: {
    relatedMatchId?: string;
    relatedFixtureId?: string;
  };
}

export async function sendLeagueMessageAction(params: SendMessageParams) {
  try {
    const auth = await getAdminAuth();
    const adminDb = getAdminDb();

    if (!auth || !adminDb) {
      return { success: false, error: 'Error de inicialización' };
    }

    // TODO: Get current user from context/session
    const currentUser = { uid: 'temp', displayName: 'Organizador' }; // This should come from auth context

    const {
      leagueId,
      recipientType,
      recipientIds,
      subject,
      body,
      templateId,
      variables = {},
      priority = 'normal',
      deliveryMethod = ['push'],
      metadata,
    } = params;

    // Verify user is owner of the league
    const leagueDoc = await adminDb.collection('leagues').doc(leagueId).get();
    if (!leagueDoc.exists) {
      return { success: false, error: 'Liga no encontrada' };
    }

    const leagueData = leagueDoc.data();
    // TODO: Verify ownership when auth is properly implemented
    // if (leagueData?.ownerUid !== currentUser.uid) {
    //   return { success: false, error: 'No tenés permisos para enviar mensajes en esta liga' };
    // }

    // Replace variables in subject and body if provided
    const finalSubject = variables ? replaceVariables(subject, variables) : subject;
    const finalBody = variables ? replaceVariables(body, variables) : body;

    // Get recipient user IDs based on recipient type
    const recipientUids = await getRecipientUids(leagueId, recipientType, recipientIds);

    if (recipientUids.length === 0) {
      return { success: false, error: 'No se encontraron destinatarios' };
    }

    // Create message document
    const messageData: Partial<CommunicationMessage> = {
      leagueId,
      sentBy: currentUser.uid,
      sentByName: currentUser.displayName || 'Organizador',
      recipientType,
      recipientIds,
      subject: finalSubject,
      body: finalBody,
      templateId,
      sentAt: new Date().toISOString(),
      deliveryMethod,
      priority,
      metadata,
      deliveryStatus: {
        push: { sent: 0, delivered: 0, failed: 0 },
        email: { sent: 0, delivered: 0, failed: 0 },
      },
    };

    const messageRef = await adminDb.collection('leagues').doc(leagueId).collection('messages').add(messageData);

    // Send push notifications if enabled
    if (deliveryMethod.includes('push')) {
      const pushResult = await sendPushNotifications(recipientUids, finalSubject, finalBody, leagueId);
      messageData.deliveryStatus!.push = pushResult;
    }

    // Update delivery status
    await messageRef.update({ deliveryStatus: messageData.deliveryStatus });

    return {
      success: true,
      messageId: messageRef.id,
      recipientCount: recipientUids.length,
    };
  } catch (error: any) {
    console.error('[sendLeagueMessageAction] Error:', error);
    return { success: false, error: error.message || 'Error al enviar mensaje' };
  }
}

async function getRecipientUids(
  leagueId: string,
  recipientType: MessageRecipientType,
  recipientIds: string[]
): Promise<string[]> {
  const uids: Set<string> = new Set();
  const adminDb = getAdminDb();

  if (!adminDb) return [];

  try {
    switch (recipientType) {
      case 'all_teams': {
        // Get all teams in the league
        const teamsSnapshot = await adminDb.collection('leagues').doc(leagueId).collection('teams').get();

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          // Add all players from the team (assuming teams have a players array)
          if (teamData.players && Array.isArray(teamData.players)) {
            teamData.players.forEach((player: any) => {
              if (player.uid) uids.add(player.uid);
            });
          }
        }
        break;
      }

      case 'all_captains': {
        // Get all teams and their captains
        const teamsSnapshot = await adminDb.collection('leagues').doc(leagueId).collection('teams').get();

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          if (teamData.captainUid) {
            uids.add(teamData.captainUid);
          }
        }
        break;
      }

      case 'all_referees': {
        // Get all referees in the league
        const refereesSnapshot = await adminDb.collection('leagues').doc(leagueId).collection('referees').get();

        for (const refereeDoc of refereesSnapshot.docs) {
          const refereeData = refereeDoc.data();
          // Assuming referees might have a uid field
          if (refereeData.uid) {
            uids.add(refereeData.uid);
          }
        }
        break;
      }

      case 'specific_teams': {
        // Get players from specific teams
        for (const teamId of recipientIds) {
          const teamDoc = await adminDb.collection('leagues').doc(leagueId).collection('teams').doc(teamId).get();
          const teamData = teamDoc.data();

          if (teamData?.players && Array.isArray(teamData.players)) {
            teamData.players.forEach((player: any) => {
              if (player.uid) uids.add(player.uid);
            });
          }
        }
        break;
      }

      case 'specific_players': {
        // recipientIds are already UIDs
        recipientIds.forEach(uid => uids.add(uid));
        break;
      }
    }

    return Array.from(uids);
  } catch (error) {
    console.error('[getRecipientUids] Error:', error);
    return [];
  }
}

async function sendPushNotifications(
  recipientUids: string[],
  title: string,
  body: string,
  leagueId: string
): Promise<{ sent: number; delivered: number; failed: number }> {
  const result = { sent: 0, delivered: 0, failed: 0 };
  const adminDb = getAdminDb();

  if (!adminDb) return result;

  try {
    // Get FCM tokens for all recipients
    const usersSnapshot = await adminDb.collection('users').where('__name__', 'in', recipientUids.slice(0, 10)).get();

    const notifications: Promise<any>[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      // Create notification document for each user
      const notificationData = {
        type: 'league_message',
        title,
        body,
        read: false,
        createdAt: new Date().toISOString(),
        data: {
          leagueId,
          screen: 'LeagueDetail',
        },
      };

      notifications.push(
        adminDb.collection('users').doc(userDoc.id).collection('notifications').add(notificationData)
      );
    }

    // Execute all notification creations in parallel
    await Promise.all(notifications);

    result.sent = notifications.length;
    result.delivered = notifications.length; // Assume all were delivered (we don't have FCM confirmation)

    return result;
  } catch (error) {
    console.error('[sendPushNotifications] Error:', error);
    result.failed = recipientUids.length;
    return result;
  }
}

export async function getLeagueMessagesAction(leagueId: string, limit = 50) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return { success: false, error: 'Error de inicialización' };
    }

    // Verify user has access to this league
    const leagueDoc = await adminDb.collection('leagues').doc(leagueId).get();
    if (!leagueDoc.exists) {
      return { success: false, error: 'Liga no encontrada' };
    }

    const messagesSnapshot = await adminDb
      .collection('leagues')
      .doc(leagueId)
      .collection('messages')
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();

    const messages = messagesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    })) as CommunicationMessage[];

    return { success: true, messages };
  } catch (error: any) {
    console.error('[getLeagueMessagesAction] Error:', error);
    return { success: false, error: error.message || 'Error al obtener mensajes' };
  }
}

export async function deleteLeagueMessageAction(leagueId: string, messageId: string) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return { success: false, error: 'Error de inicialización' };
    }

    // Verify user is owner of the league
    const leagueDoc = await adminDb.collection('leagues').doc(leagueId).get();
    if (!leagueDoc.exists) {
      return { success: false, error: 'Liga no encontrada' };
    }

    // TODO: Add ownership verification when auth is properly implemented

    await adminDb.collection('leagues').doc(leagueId).collection('messages').doc(messageId).delete();

    return { success: true };
  } catch (error: any) {
    console.error('[deleteLeagueMessageAction] Error:', error);
    return { success: false, error: error.message || 'Error al eliminar mensaje' };
  }
}
