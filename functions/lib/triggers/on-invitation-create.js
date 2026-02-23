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
 * Cloud Function that sends push notifications when a match invitation is created.
 *
 * Trigger: When a document is created in `matches/{matchId}/invitations/{invId}`
 */
exports.onInvitationCreate = (0, firestore_1.onDocumentCreated)({
    document: 'matches/{matchId}/invitations/{invId}',
    region: 'us-central1',
}, async (event) => {
    var _a, _b;
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
        const tokens = ((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.fcmTokens) || [];
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
    }
    catch (err) {
        console.error(`[OnInvitationCreate] Error:`, err);
    }
});
//# sourceMappingURL=on-invitation-create.js.map