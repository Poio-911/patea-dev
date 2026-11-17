import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendPushToUsers } from '../lib/fcm-push';

/**
 * Cloud Function that sends notifications when a match invitation is created.
 * This is the SINGLE SOURCE OF TRUTH for invitation notifications.
 * Client-side code should NOT create notification docs manually when inviting — this handles it.
 *
 * Trigger: When a document is created in `matches/{matchId}/invitations/{invId}`
 */
export const onInvitationCreate = onDocumentCreated({
    document: 'matches/{matchId}/invitations/{invId}',
    region: 'us-central1',
}, async (event) => {
    const db = admin.firestore();
    const { matchId } = event.params;
    const invData = event.data?.data();

    if (!invData) return;

    const { playerId, matchTitle = 'Partido' } = invData;
    if (!playerId) return;

    try {
        // Try to get the match owner's name for a richer message
        let inviterName = 'El organizador';
        try {
            const matchSnap = await db.collection('matches').doc(matchId).get();
            const ownerUid = matchSnap.data()?.ownerUid;
            if (ownerUid) {
                const ownerSnap = await db.collection('users').doc(ownerUid).get();
                inviterName = ownerSnap.data()?.displayName || ownerSnap.data()?.name || 'El organizador';
            }
        } catch (_) { /* non-critical, fallback to generic */ }

        const pushBody = `${inviterName} te invitó al partido "${matchTitle}"`;
        const inAppMessage = `${inviterName} te invitó a unirte al partido "${matchTitle}"`;

        // In-app notification
        const notifRef = db.collection(`users/${playerId}/notifications`).doc();
        await notifRef.set({
            type: 'match_invite',
            title: '⚽ ¡Te invitaron a un partido!',
            message: inAppMessage,
            link: `/matches/${matchId}`,
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { matchId },
        });

        await sendPushToUsers(
            [playerId],
            {
                title: '⚽ ¡Te invitaron!',
                body: pushBody,
                type: 'match_invite',
                link: `/matches/${matchId}`,
                extraData: { matchTitle: String(matchTitle) },
            },
            'OnInvitationCreate',
        );
    } catch (err) {
        console.error(`[OnInvitationCreate] Error:`, err);
    }
});
