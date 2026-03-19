'use server';

import { getAdminDb, getAdminAuth } from '@/firebase/admin-init';
import type { CommunicationMessage, MessageRecipientType } from '@/lib/types';
import { replaceVariables } from '@/lib/message-templates';

interface SendMessageParams {
  competitionId: string;
  competitionType: 'leagues' | 'cups';
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

export async function sendCompetitionMessageAction(params: SendMessageParams) {
  try {
    const auth = await getAdminAuth();
    const adminDb = getAdminDb();

    if (!auth || !adminDb) {
      return { success: false, error: 'Error de inicialización' };
    }

    const currentUser = { uid: 'temp', displayName: 'Organizador' }; 

    const {
      competitionId,
      competitionType,
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

    const competitionDoc = await adminDb.collection(competitionType).doc(competitionId).get();
    if (!competitionDoc.exists) {
      return { success: false, error: 'Competición no encontrada' };
    }

    const finalSubject = variables ? replaceVariables(subject, variables) : subject;
    const finalBody = variables ? replaceVariables(body, variables) : body;

    const recipientUids = await getRecipientUids(competitionId, competitionType, recipientType, recipientIds);

    if (recipientUids.length === 0) {
      return { success: false, error: 'No se encontraron destinatarios' };
    }

    const messageData: Partial<CommunicationMessage> = {
      leagueId: competitionId, // legacy support 
      competitionId,
      competitionType,
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

    const messageRef = await adminDb.collection(competitionType).doc(competitionId).collection('messages').add(messageData);

    if (deliveryMethod.includes('push')) {
      const pushResult = await sendPushNotifications(recipientUids, finalSubject, finalBody, competitionId, competitionType);
      messageData.deliveryStatus!.push = pushResult;
    }

    await messageRef.update({ deliveryStatus: messageData.deliveryStatus });

    return {
      success: true,
      messageId: messageRef.id,
      recipientCount: recipientUids.length,
    };
  } catch (error: any) {
    console.error('[sendCompetitionMessageAction] Error:', error);
    return { success: false, error: error.message || 'Error al enviar mensaje' };
  }
}

async function getRecipientUids(
  competitionId: string,
  competitionType: 'leagues' | 'cups',
  recipientType: MessageRecipientType,
  recipientIds: string[]
): Promise<string[]> {
  const uids: Set<string> = new Set();
  const adminDb = getAdminDb();

  if (!adminDb) return [];

  try {
    switch (recipientType) {
      case 'all_teams': {
        const teamsSnapshot = await adminDb.collection(competitionType).doc(competitionId).collection('teams').get();

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          if (teamData.players && Array.isArray(teamData.players)) {
            teamData.players.forEach((player: any) => {
              if (player.uid) uids.add(player.uid);
            });
          }
        }
        break;
      }

      case 'all_captains': {
        const teamsSnapshot = await adminDb.collection(competitionType).doc(competitionId).collection('teams').get();

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          if (teamData.captainUid) {
            uids.add(teamData.captainUid);
          }
        }
        break;
      }

      case 'all_referees': {
        const refereesSnapshot = await adminDb.collection(competitionType).doc(competitionId).collection('referees').get();

        for (const refereeDoc of refereesSnapshot.docs) {
          const refereeData = refereeDoc.data();
          if (refereeData.uid) {
            uids.add(refereeData.uid);
          }
        }
        break;
      }

      case 'specific_teams': {
        for (const teamId of recipientIds) {
          const teamDoc = await adminDb.collection(competitionType).doc(competitionId).collection('teams').doc(teamId).get();
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
  competitionId: string,
  competitionType: 'leagues' | 'cups'
): Promise<{ sent: number; delivered: number; failed: number }> {
  const result = { sent: 0, delivered: 0, failed: 0 };
  const adminDb = getAdminDb();

  if (!adminDb) return result;

  try {
    const usersSnapshot = await adminDb.collection('users').where('__name__', 'in', recipientUids.slice(0, 10)).get();
    const notifications: Promise<any>[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const notificationData = {
        type: 'competition_message',
        title,
        body,
        read: false,
        createdAt: new Date().toISOString(),
        data: {
          competitionId,
          competitionType,
          screen: 'CompetitionDetail',
        },
      };

      notifications.push(
        adminDb.collection('users').doc(userDoc.id).collection('notifications').add(notificationData)
      );
    }

    await Promise.all(notifications);

    result.sent = notifications.length;
    result.delivered = notifications.length;

    return result;
  } catch (error) {
    console.error('[sendPushNotifications] Error:', error);
    result.failed = recipientUids.length;
    return result;
  }
}

export async function getCompetitionMessagesAction(competitionId: string, competitionType: 'leagues' | 'cups', limit = 50) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return { success: false, error: 'Error de inicialización' };
    }

    const competitionDoc = await adminDb.collection(competitionType).doc(competitionId).get();
    if (!competitionDoc.exists) {
      return { success: false, error: 'Competición no encontrada' };
    }

    const messagesSnapshot = await adminDb
      .collection(competitionType)
      .doc(competitionId)
      .collection('messages')
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();

    const messages = messagesSnapshot.docs.map((docSnap: any) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        // Ensure common date fields are strings if they happen to be Timestamps
        sentAt: data.sentAt?.toDate ? data.sentAt.toDate().toISOString() : data.sentAt,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      };
    }) as CommunicationMessage[];

    return { success: true, messages };
  } catch (error: any) {
    console.error('[getCompetitionMessagesAction] Error:', error);
    return { success: false, error: error.message || 'Error al obtener mensajes' };
  }
}

export async function deleteCompetitionMessageAction(competitionId: string, competitionType: 'leagues' | 'cups', messageId: string) {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return { success: false, error: 'Error de inicialización' };
    }

    const competitionDoc = await adminDb.collection(competitionType).doc(competitionId).get();
    if (!competitionDoc.exists) {
      return { success: false, error: 'Competición no encontrada' };
    }

    await adminDb.collection(competitionType).doc(competitionId).collection('messages').doc(messageId).delete();

    return { success: true };
  } catch (error: any) {
    console.error('[deleteCompetitionMessageAction] Error:', error);
    return { success: false, error: error.message || 'Error al eliminar mensaje' };
  }
}
