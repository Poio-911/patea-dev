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

    const { playerUids, ownerUid, title = 'Partido', groupId, type, matchSize } = matchData;

    if (!playerUids || !Array.isArray(playerUids)) {
        console.warn(`[OnMatchCreate] No players associated with match ${matchId}`);
        return;
    }

    const participantIds = playerUids.filter((pid: string) => pid !== ownerUid);

    // Avisarle al resto del grupo, no solo a los convocados.
    //
    // Hasta ahora esto solo notificaba a quien ya estaba en `playerUids`, o
    // sea a los que el organizador eligio a dedo. El que no fue elegido no se
    // enteraba de que habia partido, y justamente es el que podria sumarse si
    // falta gente. Ahora el resto del grupo recibe un aviso distinto: no "te
    // convocaron" sino "se armo un partido".
    //
    // Los partidos de competencia quedan afuera a proposito: generar un
    // fixture crea decenas de partidos de una, y avisar de cada uno seria
    // enterrar al grupo en notificaciones.
    const isCompetition = type === 'league' || type === 'cup' || type === 'league_final';
    let groupIds: string[] = [];
    let groupName = '';

    if (groupId && !isCompetition) {
        try {
            const groupSnap = await db.collection('groups').doc(groupId).get();
            const group = groupSnap.data();
            groupName = String(group?.name ?? '');
            const members: string[] = Array.isArray(group?.members) ? group!.members : [];
            const alreadyIn = new Set<string>([...playerUids, ownerUid]);
            groupIds = members.filter((uid) => typeof uid === 'string' && !alreadyIn.has(uid));
        } catch (error) {
            console.error(`[OnMatchCreate] No se pudo leer el grupo ${groupId}:`, error);
        }
    }

    if (participantIds.length === 0 && groupIds.length === 0) {
        console.info(`[OnMatchCreate] No hay a quien avisarle del partido ${matchId}`);
        return;
    }

    const spotsLeft = Number(matchSize ?? 0) - playerUids.length;
    const groupBody = groupName
        ? `Se armó un partido en ${groupName}${spotsLeft > 0 ? `. Quedan ${spotsLeft} lugares` : ''}`
        : `Se armó el partido "${title}"${spotsLeft > 0 ? `. Quedan ${spotsLeft} lugares` : ''}`;

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

        groupIds.forEach((uid: string) => {
            const notifRef = db.collection(`users/${uid}/notifications`).doc();
            batch.set(notifRef, {
                type: 'match_organized',
                title: '⚽ Hay partido',
                message: groupBody,
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

        const tokensByUser = await getTokensForUsers([...participantIds, ...groupIds]);
        const isConvocado = new Set(participantIds);
        tokensByUser.forEach((userTokens, uid) => {
            userTokens.forEach((token) => {
                tokens.push(token);
                tokenToUserId.set(token, uid);
            });
        });

        if (tokens.length > 0) {
            // Dos mensajes distintos sobre el mismo partido: al convocado se
            // le avisa que juega, al resto del grupo que hay partido. Mandar
            // "te convocaron" a quien no fue convocado es peor que no avisar.
            const convocadoTokens = tokens.filter((t) => isConvocado.has(tokenToUserId.get(t) ?? ''));
            const grupoTokens = tokens.filter((t) => !isConvocado.has(tokenToUserId.get(t) ?? ''));

            const sendTo = (targets: string[], pushTitle: string, body: string, notifType: string) =>
                messaging.sendEachForMulticast({
                    tokens: targets,
                    notification: { title: pushTitle, body },
                    webpush: {
                        fcmOptions: { link: `/matches/${matchId}` },
                        notification: {
                            icon: '/icons/icon-192x192.png',
                            badge: '/icons/icon-48x48.png',
                        },
                    },
                    data: {
                        type: notifType,
                        link: `/matches/${matchId}`,
                        matchTitle: title,
                    },
                });

            const batches = await Promise.all([
                convocadoTokens.length
                    ? sendTo(convocadoTokens, '⚽ ¡Te convocaron!', `Te sumaron al partido "${title}"`, 'match_invite')
                    : null,
                grupoTokens.length
                    ? sendTo(grupoTokens, '⚽ Hay partido', groupBody, 'match_organized')
                    : null,
            ]);

            const response = {
                successCount: batches.reduce((acc, b) => acc + (b?.successCount ?? 0), 0),
                failureCount: batches.reduce((acc, b) => acc + (b?.failureCount ?? 0), 0),
                responses: [
                    ...(batches[0]?.responses ?? []),
                    ...(batches[1]?.responses ?? []),
                ],
            };
            // El orden de `responses` sigue el de los dos lotes, no el de
            // `tokens`: para limpiar tokens muertos hay que mirar la misma
            // secuencia.
            const orderedTokens = [...convocadoTokens, ...grupoTokens];

            console.info(`[OnMatchCreate] Push notifications sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);

            // Cleanup invalid tokens silently
            const tokensToRemoveByUserId = new Map<string, string[]>();
            response.responses.forEach((resp, idx) => {
                if (!resp.success && isDeadTokenError(resp.error?.code)) {
                    const badToken = orderedTokens[idx];
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
