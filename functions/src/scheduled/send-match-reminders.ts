import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * Cloud Function que envía recordatorios de partido 2 horas antes de que empiecen.
 *
 * Corre cada 30 minutos y busca partidos con estado 'upcoming' cuya fecha sea
 * entre 1h50m y 2h10m desde ahora (ventana de 20 min para evitar duplicados).
 *
 * Deployment:
 * cd functions && npm run build
 * firebase deploy --only functions:sendMatchReminders
 */
export const sendMatchReminders = onSchedule({
    schedule: 'every 30 minutes',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: 'us-central1',
}, async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    const now = new Date();
    // 2 hours from now ± 10 minutes window
    const windowStart = new Date(now.getTime() + (2 * 60 - 10) * 60 * 1000); // 1h50m from now
    const windowEnd = new Date(now.getTime() + (2 * 60 + 10) * 60 * 1000);   // 2h10m from now

    const windowStartISO = windowStart.toISOString();
    const windowEndISO = windowEnd.toISOString();

    console.log(`[MatchReminders] Checking matches between ${windowStartISO} and ${windowEndISO}`);

    try {
        const matchesSnap = await db.collection('matches')
            .where('status', '==', 'upcoming')
            .where('date', '>=', windowStartISO)
            .where('date', '<=', windowEndISO)
            .get();

        if (matchesSnap.empty) {
            console.log('[MatchReminders] No matches to remind about.');
            return;
        }

        console.log(`[MatchReminders] Found ${matchesSnap.size} match(es) to send reminders for.`);

        for (const matchDoc of matchesSnap.docs) {
            const match = matchDoc.data();
            const matchId = matchDoc.id;
            const matchTitle = match.title || 'Partido';
            const matchTime = match.time || '';
            const matchLocation = match.location?.address || '';

            // Avoid sending duplicate reminders by checking a flag
            if (match.reminderSent) {
                console.log(`[MatchReminders] Skipping ${matchId} — reminder already sent.`);
                continue;
            }

            const playerUids: string[] = match.playerUids || [];
            if (playerUids.length === 0) continue;

            // Collect all FCM tokens for players in the match
            const tokens: string[] = [];
            for (const uid of playerUids) {
                const userSnap = await db.collection('users').doc(uid).get();
                const userTokens: string[] = userSnap.data()?.fcmTokens || [];
                tokens.push(...userTokens);
            }

            if (tokens.length > 0) {
                const body = matchTime
                    ? `Tu partido "${matchTitle}" empieza en ~2hs, a las ${matchTime} en ${matchLocation}`
                    : `Tu partido "${matchTitle}" empieza en aproximadamente 2 horas. ¡Preparate!`;

                await messaging.sendEachForMulticast({
                    tokens,
                    notification: {
                        title: '⏰ Recordatorio de partido',
                        body,
                    },
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

                console.log(`[MatchReminders] Sent reminder for "${matchTitle}" to ${tokens.length} device(s).`);
            }

            // Mark as reminded to prevent duplicate sends
            await matchDoc.ref.update({ reminderSent: true });
        }
    } catch (err) {
        console.error('[MatchReminders] Error sending reminders:', err);
        throw err;
    }
});
