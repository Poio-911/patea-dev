import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sendPushToUsers } from '../lib/fcm-push';
import { buildMatchDateTime } from '../lib/match-date';

/**
 * Cloud Function que envía recordatorios de partido:
 *  - 2 horas antes: "Tu partido empieza en ~2hs"
 *  - 30 minutos antes: "¡Ya falta poco! Tu partido empieza en 30 min"
 *
 * Corre cada 5 minutos y filtra partidos en memoria combinando
 * los campos `date` (YYYY-MM-DD) y `time` (HH:MM) para obtener
 * el datetime real.
 */
export const sendMatchReminders = onSchedule({
    schedule: 'every 5 minutes',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: 'us-central1',
}, async () => {
    const db = admin.firestore();
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
            const body = matchTime
                ? `Tu partido "${matchTitle}" empieza en ~2hs, a las ${matchTime}${matchLocation ? ` en ${matchLocation}` : ''}. ¡Preparate!`
                : `Tu partido "${matchTitle}" empieza en aproximadamente 2 horas. ¡Preparate!`;

            const res = await sendPushToUsers(
                playerUids,
                {
                    title: '⏰ Recordatorio de partido',
                    body,
                    type: 'match_reminder',
                    link: `/matches/${matchId}`,
                    extraData: { matchId, matchTitle },
                },
                'MatchReminders',
            );
            if (res.tokensFound > 0) {
                await matchDoc.ref.update({ reminderSent2h: true });
            }
        }

        // ── RECORDATORIO 30 MINUTOS ───────────────────────────────────
        // Ventana: entre 20 y 40 minutos antes del partido
        if (minutesUntilMatch >= 20 && minutesUntilMatch <= 40 && !match.reminderSent30m) {
            const body = matchTime
                ? `¡Ya falta poco! "${matchTitle}" empieza a las ${matchTime}${matchLocation ? ` en ${matchLocation}` : ''}. ¡No llegues tarde! 🏃`
                : `¡Ya falta poco! Tu partido "${matchTitle}" empieza en 30 minutos.`;

            const res = await sendPushToUsers(
                playerUids,
                {
                    title: '🔥 ¡El partido está por empezar!',
                    body,
                    type: 'match_reminder',
                    link: `/matches/${matchId}`,
                    extraData: { matchId, matchTitle },
                },
                'MatchReminders',
            );
            if (res.tokensFound > 0) {
                await matchDoc.ref.update({ reminderSent30m: true });
            }
        }
    }

    console.log('[MatchReminders] Done.');
});
