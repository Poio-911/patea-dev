"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMatchReminders = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
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
function buildMatchDateTime(date, time) {
    if (!date || !time)
        return null;
    const combined = `${date}T${time}:00-03:00`;
    const parsed = new Date(combined);
    return isNaN(parsed.getTime()) ? null : parsed;
}
/** Recolecta todos los tokens FCM de una lista de UIDs */
async function getTokensForUsers(db, uids) {
    var _a;
    const tokens = [];
    for (const uid of uids) {
        const userSnap = await db.collection('users').doc(uid).get();
        const userTokens = ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) || [];
        tokens.push(...userTokens);
    }
    return tokens;
}
/** Envía una notificación FCM multicast */
async function sendReminder(messaging, tokens, title, body, matchId, matchTitle) {
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
exports.sendMatchReminders = (0, scheduler_1.onSchedule)({
    schedule: 'every 5 minutes',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: 'us-central1',
}, async () => {
    var _a, _b;
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
        const matchTitle = match.title || 'Partido';
        const matchDate = match.date || '';
        const matchTime = match.time || '';
        const matchLocation = ((_a = match.location) === null || _a === void 0 ? void 0 : _a.address) || ((_b = match.location) === null || _b === void 0 ? void 0 : _b.name) || '';
        const matchDateTime = buildMatchDateTime(matchDate, matchTime);
        if (!matchDateTime) {
            // Partido en modo "planning" sin fecha/hora definida — skip
            continue;
        }
        const minutesUntilMatch = (matchDateTime.getTime() - now.getTime()) / 60000;
        const playerUids = match.playerUids || [];
        if (playerUids.length === 0)
            continue;
        // ── RECORDATORIO 2 HORAS ──────────────────────────────────────
        // Ventana: entre 110 y 130 minutos antes del partido
        if (minutesUntilMatch >= 110 && minutesUntilMatch <= 130 && !match.reminderSent2h) {
            const tokens = await getTokensForUsers(db, playerUids);
            const body = matchTime
                ? `Tu partido "${matchTitle}" empieza en ~2hs, a las ${matchTime}${matchLocation ? ` en ${matchLocation}` : ''}. ¡Preparate!`
                : `Tu partido "${matchTitle}" empieza en aproximadamente 2 horas. ¡Preparate!`;
            await sendReminder(messaging, tokens, '⏰ Recordatorio de partido', body, matchId, matchTitle);
            await matchDoc.ref.update({ reminderSent2h: true });
        }
        // ── RECORDATORIO 30 MINUTOS ───────────────────────────────────
        // Ventana: entre 20 y 40 minutos antes del partido
        if (minutesUntilMatch >= 20 && minutesUntilMatch <= 40 && !match.reminderSent30m) {
            const tokens = await getTokensForUsers(db, playerUids);
            const body = matchTime
                ? `¡Ya falta poco! "${matchTitle}" empieza a las ${matchTime}${matchLocation ? ` en ${matchLocation}` : ''}. ¡No llegues tarde! 🏃`
                : `¡Ya falta poco! Tu partido "${matchTitle}" empieza en 30 minutos.`;
            await sendReminder(messaging, tokens, '🔥 ¡El partido está por empezar!', body, matchId, matchTitle);
            await matchDoc.ref.update({ reminderSent30m: true });
        }
    }
    console.log('[MatchReminders] Done.');
});
//# sourceMappingURL=send-match-reminders.js.map