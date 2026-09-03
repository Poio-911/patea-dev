import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getTokensForUser } from '../lib/fcm-tokens';

/**
 * Cloud Function que envía recordatorios de partido:
 *  - 2 horas antes: "Tu partido empieza en ~2hs"
 *  - 30 minutos antes: "¡Ya falta poco! Tu partido empieza en 30 min"
 *
 * Corre cada 15 minutos y filtra partidos en memoria combinando
 * los campos `date` (YYYY-MM-DD) y `time` (HH:MM) para obtener
 * el datetime real. Esto evita el bug anterior donde la query
 * comparaba ISO timestamps contra fechas sin hora, devolviendo 0 resultados.
 *
 * Deployment:
 * cd functions && npm run build
 * firebase deploy --only functions:sendMatchReminders
 */

/** Combina "YYYY-MM-DD" + "HH:MM" -> Date en horario de Buenos Aires (UTC-3, sin DST) */
function buildMatchDateTime(date: string, time: string): Date | null {
    if (!date || !time) return null;
    const combined = `${date}T${time}:00-03:00`;
    const parsed = new Date(combined);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Recolecta todos los tokens FCM de una lista de UIDs.
 *
 * Lee de la subcolección `users/{uid}/fcmTokens` (ver lib/fcm-tokens.ts).
 * Antes leía el campo array del documento de usuario, que es legible por
 * cualquier autenticado, y además lo hacía en serie: un `await` por jugador.
 */
async function getTokensForUsers(uids: string[]): Promise<string[]> {
    const perUser = await Promise.all(uids.map((uid) => getTokensForUser(uid)));
    return [...new Set(perUser.flat())];
}

/** Envía una notificación FCM multicast */
async function sendReminder(
    messaging: admin.messaging.Messaging,
    tokens: string[],
    title: string,
    body: string,
    matchId: string,
    matchTitle: string,
): Promise<void> {
    if (tokens.length === 0) {
        console.log(`[MatchReminders] No tokens found for "${matchTitle}" — skipping.`);
        return;
    }
    await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        webpush: {
            fcmOptions: { link: `/matches/${matchId}` },
            notification: {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-48x48.png',
            },
        },
        data: {
            type: 'match_reminder',
            matchId,
            matchTitle,
            link: `/matches/${matchId}`,
        },
    });
    console.log(`[MatchReminders] "${title}" sent for "${matchTitle}" (${matchId}) to ${tokens.length} device(s).`);
}

export const sendMatchReminders = onSchedule({
    schedule: 'every 5 minutes',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: 'us-central1',
}, async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();
    const now = new Date();

    console.log(`[MatchReminders] Running at ${now.toISOString()}`);

    // Traer todos los partidos "upcoming". Filtramos en memoria porque Firestore
    // no puede consultar sobre un valor combinado (date + time).
    const matchesSnap = await db.collection('matches')
        .where('status', '==', 'upcoming')
        .get();

    if (matchesSnap.empty) {
        console.log('[MatchReminders] No upcoming matches found.');
        return;
    }

    console.log(`[MatchReminders] Evaluating ${matchesSnap.size} upcoming match(es).`);

    for (const matchDoc of matchesSnap.docs) {
        const match = matchDoc.data();
        const matchId = matchDoc.id;
        const matchTitle: string = match.title || 'Partido';
        const matchDate: string = match.date || '';
        const matchTime: string = match.time || '';
        const matchLocation: string = match.location?.address || match.location?.name || '';

        const matchDateTime = buildMatchDateTime(matchDate, matchTime);
        if (!matchDateTime) {
            // Partido en modo "planning" sin fecha/hora definida — skip
            continue;
        }

        const minutesUntilMatch = (matchDateTime.getTime() - now.getTime()) / 60000;
        const playerUids: string[] = match.playerUids || [];

        if (playerUids.length === 0) continue;

        // ── RECORDATORIO 2 HORAS ──────────────────────────────────────
        // Ventana: entre 110 y 130 minutos antes del partido
        if (minutesUntilMatch >= 110 && minutesUntilMatch <= 130 && !match.reminderSent2h) {
            const tokens = await getTokensForUsers(playerUids);
            const body = matchTime
                ? `Tu partido "${matchTitle}" empieza en ~2hs, a las ${matchTime}${matchLocation ? ` en ${matchLocation}` : ''}. ¡Preparate!`
                : `Tu partido "${matchTitle}" empieza en aproximadamente 2 horas. ¡Preparate!`;

            await sendReminder(messaging, tokens, '⏰ Recordatorio de partido', body, matchId, matchTitle);
            await matchDoc.ref.update({ reminderSent2h: true });
        }

        // ── RECORDATORIO 30 MINUTOS ───────────────────────────────────
        // Ventana: entre 20 y 40 minutos antes del partido
        if (minutesUntilMatch >= 20 && minutesUntilMatch <= 40 && !match.reminderSent30m) {
            const tokens = await getTokensForUsers(playerUids);
            const body = matchTime
                ? `¡Ya falta poco! "${matchTitle}" empieza a las ${matchTime}${matchLocation ? ` en ${matchLocation}` : ''}. ¡No llegues tarde! 🏃`
                : `¡Ya falta poco! Tu partido "${matchTitle}" empieza en 30 minutos.`;

            await sendReminder(messaging, tokens, '🔥 ¡El partido está por empezar!', body, matchId, matchTitle);
            await matchDoc.ref.update({ reminderSent30m: true });
        }
    }

    console.log('[MatchReminders] Done.');
});
