import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * Cloud Function that sends push notifications when a match invitation is created.
 *
 * Trigger: When a document is created in `matches/{matchId}/invitations/{invId}`
 */
export const onInvitationCreate = onDocumentCreated({
    document: 'matches/{matchId}/invitations/{invId}',
    region: 'us-central1',
}, async (event) => {
    const db = admin.firestore();
    const messaging = admin.messaging();
    const { matchId } = event.params;
    const invData = event.data?.data();

    if (!invData) return;

    const { playerId, matchTitle = 'Partido' } = invData;
    if (!playerId) return;

    try {
        // In-app notification
        const notifRef = db.collection(`users/${playerId}/notifications`).doc();
        await notifRef.set({
            type: 'match_invite',
            title: '¡Te invitaron!',
            message: `Te invitaron a unirte al partido "${matchTitle}"`,
            link: `/matches/${matchId}`,
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { matchId },
        });

        // Push notification
        const userSnap = await db.collection('users').doc(playerId).get();
        const tokens: string[] = userSnap.data()?.fcmTokens || [];

        if (tokens.length > 0) {
            await messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title: '⚽ ¡Te invitaron!',
                    body: `Te invitaron al partido "${matchTitle}"`,
                },
                webpush: {
                    fcmOptions: { link: `/matches/${matchId}` },
                    notification: {
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-48x48.png',
                    },
                },
                data: { type: 'match_invite', link: `/matches/${matchId}`, matchTitle },
            });
        }
    } catch (err) {
        console.error(`[OnInvitationCreate] Error:`, err);
    }
});
