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
 * Cloud Function que envía recordatorios de partido 2 horas antes de que empiecen.
 *
 * Corre cada 30 minutos y busca partidos con estado 'upcoming' cuya fecha sea
 * entre 1h50m y 2h10m desde ahora (ventana de 20 min para evitar duplicados).
 *
 * Deployment:
 * cd functions && npm run build
 * firebase deploy --only functions:sendMatchReminders
 */
exports.sendMatchReminders = (0, scheduler_1.onSchedule)({
    schedule: 'every 30 minutes',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: 'us-central1',
}, async () => {
    var _a, _b;
    const db = admin.firestore();
    const messaging = admin.messaging();
    const now = new Date();
    // 2 hours from now ± 10 minutes window
    const windowStart = new Date(now.getTime() + (2 * 60 - 10) * 60 * 1000); // 1h50m from now
    const windowEnd = new Date(now.getTime() + (2 * 60 + 10) * 60 * 1000); // 2h10m from now
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
            const matchLocation = ((_a = match.location) === null || _a === void 0 ? void 0 : _a.address) || '';
            // Avoid sending duplicate reminders by checking a flag
            if (match.reminderSent) {
                console.log(`[MatchReminders] Skipping ${matchId} — reminder already sent.`);
                continue;
            }
            const playerUids = match.playerUids || [];
            if (playerUids.length === 0)
                continue;
            // Collect all FCM tokens for players in the match
            const tokens = [];
            for (const uid of playerUids) {
                const userSnap = await db.collection('users').doc(uid).get();
                const userTokens = ((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.fcmTokens) || [];
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
    }
    catch (err) {
        console.error('[MatchReminders] Error sending reminders:', err);
        throw err;
    }
});
//# sourceMappingURL=send-match-reminders.js.map