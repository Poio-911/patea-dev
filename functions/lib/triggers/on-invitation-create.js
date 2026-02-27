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
exports.onInvitationCreate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function that sends notifications when a match invitation is created.
 * This is the SINGLE SOURCE OF TRUTH for invitation notifications.
 * Client-side code should NOT create notification docs manually when inviting — this handles it.
 *
 * Trigger: When a document is created in `matches/{matchId}/invitations/{invId}`
 */
exports.onInvitationCreate = (0, firestore_1.onDocumentCreated)({
    document: 'matches/{matchId}/invitations/{invId}',
    region: 'us-central1',
}, async (event) => {
    var _a, _b, _c, _d, _e;
    const db = admin.firestore();
    const messaging = admin.messaging();
    const { matchId } = event.params;
    const invData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!invData)
        return;
    const { playerId, matchTitle = 'Partido' } = invData;
    if (!playerId)
        return;
    try {
        // Try to get the match owner's name for a richer message
        let inviterName = 'El organizador';
        try {
            const matchSnap = await db.collection('matches').doc(matchId).get();
            const ownerUid = (_b = matchSnap.data()) === null || _b === void 0 ? void 0 : _b.ownerUid;
            if (ownerUid) {
                const ownerSnap = await db.collection('users').doc(ownerUid).get();
                inviterName = ((_c = ownerSnap.data()) === null || _c === void 0 ? void 0 : _c.displayName) || ((_d = ownerSnap.data()) === null || _d === void 0 ? void 0 : _d.name) || 'El organizador';
            }
        }
        catch (_) { /* non-critical, fallback to generic */ }
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
        // Push notification
        const userSnap = await db.collection('users').doc(playerId).get();
        const tokens = ((_e = userSnap.data()) === null || _e === void 0 ? void 0 : _e.fcmTokens) || [];
        if (tokens.length > 0) {
            await messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title: '⚽ ¡Te invitaron!',
                    body: pushBody,
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
            console.log(`[OnInvitationCreate] Notified ${playerId} for match "${matchTitle}" (${matchId})`);
        }
    }
    catch (err) {
        console.error(`[OnInvitationCreate] Error:`, err);
    }
});
//# sourceMappingURL=on-invitation-create.js.map