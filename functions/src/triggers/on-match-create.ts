import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendPushToUsers } from '../lib/fcm-push';

/**
 * Cloud Function that processes notifications off the main thread when a match is created.
 *
 * Trigger: When a document is created in `matches/{matchId}`
 *
 * Process:
 * 1. Read the newly created match data
 * 2. Send in-app notifications to all invited participants
 * 3. Dispatch asynchronous Push Notifications via FCM
 */
export const onMatchCreate = onDocumentCreated({
    document: 'matches/{matchId}',
    region: 'us-central1',
}, async (event) => {
    const db = admin.firestore();
    const matchId = event.params.matchId;
    const matchData = event.data?.data();

    if (!matchData) {
        console.warn(`[OnMatchCreate] No data for match ${matchId}`);
        return;
    }

    // Web-created challenges predate explicit side IDs. Normalize metadata
    // transactionally from their parallel-array contract, without replacing
    // a roster or a score that may already have changed since this event.
    if (matchData.type === 'intergroup_friendly') {
        await db.runTransaction(async tx => {
            const ref = db.doc(`matches/${matchId}`);
            const current = (await tx.get(ref)).data();
            if (!current || current.participantTeamIds?.length !== 2 || current.teams?.length !== 2 || current.teams.some((t: any) => t.teamId)) return;
            if (current.participantTeamIds[0] === current.participantTeamIds[1]) return;
            const teams = current.teams.map((team: any, index: number) => ({...team, teamId: current.participantTeamIds[index],
                ...(['planning', 'upcoming'].includes(current.status) && !current.events?.length && team.score === undefined ? {score: 0} : {})}));
            tx.update(ref, {teams});
        });
    }

    // Un desafío que el rival todavía no aceptó no avisa a nadie: la gente del
    // equipo desafiante no "fue convocada" a un partido que puede rechazarse. Se
    // avisa cuando el rival acepta (respondTeamChallenge).
    if (matchData.type === 'intergroup_friendly' && matchData.challengeStatus === 'pending') return;

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

    await Promise.all([
        sendPushToUsers(
            participantIds,
            {
                title: '⚽ ¡Te convocaron!',
                body: `Te sumaron al partido "${title}"`,
                type: 'match_invite',
                link: `/matches/${matchId}`,
                extraData: { matchTitle: String(title) },
            },
            'OnMatchCreate',
        ),
        sendPushToUsers(
            groupIds,
            {
                title: '⚽ Hay partido',
                body: groupBody,
                type: 'match_organized',
                link: `/matches/${matchId}`,
                extraData: { matchTitle: String(title) },
            },
            'OnMatchCreate',
        ),
    ]);
});
