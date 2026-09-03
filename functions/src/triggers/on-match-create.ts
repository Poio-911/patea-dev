import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { getTokensForUsers, pruneInvalidTokens, isDeadTokenError } from '../lib/fcm-tokens';

/**
 * Cloud Function that processes notifications off the main thread when a match is created.
 *
 * Trigger: When a document is created in `matches/{matchId}`
 *
 * Process:
 * 1. Read the newly created match data
 * 2. Send in-app notifications to all invited participants
 * 3. Fetch their FCM tokens and dispatch asynchronous Push Notifications
 */
export const onMatchCreate = onDocumentCreated({
    document: 'matches/{matchId}',
    region: 'us-central1',
}, async (event) => {
    const db = admin.firestore();
    const messaging = admin.messaging();
    const matchId = event.params.matchId;
    const matchData = event.data?.data();

    if (!matchData) {
        console.warn(`[OnMatchCreate] No data for match ${matchId}`);
        return;
    }

    const { playerUids, ownerUid, title = 'Partido' } = matchData;

    if (!playerUids || !Array.isArray(playerUids)) {
        console.warn(`[OnMatchCreate] No players associated with match ${matchId}`);
        return;
    }

    const participantIds = playerUids.filter((pid: string) => pid !== ownerUid);

    if (participantIds.length === 0) {
        console.info(`[OnMatchCreate] No participants to notify for match ${matchId}`);
        return;
    }

    console.info(`[OnMatchCreate] Processing notifications for match ${matchId} to ${participantIds.length} players`);

    try {
        // 1. In-app notifications
        const batch = db.batch();
        const now = new Date().toISOString();

        participantIds.forEach((pid: string) => {
            const notifRef = db.collection(`users/${pid}/notifications`).doc();
            batch.set(notifRef, {
                type: 'match_invite',
                title: '¡Te convocaron!',
                message: `Te sumaron al partido "${title}"`,
                link: `/matches/${matchId}`,
                isRead: false,
                createdAt: now,
                metadata: { fromUserId: ownerUid, matchId: matchId },
            });
        });

        await batch.commit();
        console.info(`[OnMatchCreate] In-app notifications batch committed successfully for match ${matchId}`);
    } catch (error) {
        console.error(`[OnMatchCreate] Error sending in-app notifications for match ${matchId}:`, error);
    }

    try {
        // 2. Push notifications (FCM)
        //
        // Los tokens salen de la subcolección privada `users/{uid}/fcmTokens`
        // (ver lib/fcm-tokens.ts). Antes se leían del campo array del documento
        // de usuario, que cualquier autenticado puede leer.
        const tokens: string[] = [];
        const tokenToUserId = new Map<string, string>();

        const tokensByUser = await getTokensForUsers(participantIds);
        tokensByUser.forEach((userTokens, uid) => {
            userTokens.forEach((token) => {
                tokens.push(token);
                tokenToUserId.set(token, uid);
            });
        });

        if (tokens.length > 0) {
            const response = await messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title: '⚽ ¡Te convocaron!',
                    body: `Te sumaron al partido "${title}"`,
                },
                webpush: {
                    fcmOptions: {
                        link: `/matches/${matchId}`,
                    },
                    notification: {
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-48x48.png',
                    },
                },
                data: {
                    type: 'match_invite',
                    link: `/matches/${matchId}`,
                    matchTitle: title,
                },
            });

            console.info(`[OnMatchCreate] Push notifications sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);

            // Cleanup invalid tokens silently
            const tokensToRemoveByUserId = new Map<string, string[]>();
            response.responses.forEach((resp, idx) => {
                if (!resp.success && isDeadTokenError(resp.error?.code)) {
                    const badToken = tokens[idx];
                    const uId = tokenToUserId.get(badToken);
                    if (uId) {
                        if (!tokensToRemoveByUserId.has(uId)) {
                            tokensToRemoveByUserId.set(uId, []);
                        }
                        tokensToRemoveByUserId.get(uId)!.push(badToken);
                    }
                }
            });

            if (tokensToRemoveByUserId.size > 0) {
                await Promise.all(
                    [...tokensToRemoveByUserId].map(([uid, badTokens]) =>
                        pruneInvalidTokens(uid, badTokens)
                    )
                );
                console.info(`[OnMatchCreate] Cleaned up ${response.failureCount} stale FCM tokens.`);
            }
        } else {
            console.info(`[OnMatchCreate] No FCM tokens found for participants of match ${matchId}`);
        }
    } catch (error) {
        console.error(`[OnMatchCreate] Error sending push notifications for match ${matchId}:`, error);
    }
});
