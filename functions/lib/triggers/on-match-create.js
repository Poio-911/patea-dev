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
exports.onMatchCreate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
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
exports.onMatchCreate = (0, firestore_1.onDocumentCreated)({
    document: 'matches/{matchId}',
    region: 'us-central1',
}, async (event) => {
    var _a;
    const db = admin.firestore();
    const messaging = admin.messaging();
    const matchId = event.params.matchId;
    const matchData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!matchData) {
        console.warn(`[OnMatchCreate] No data for match ${matchId}`);
        return;
    }
    const { playerUids, ownerUid, title = 'Partido' } = matchData;
    if (!playerUids || !Array.isArray(playerUids)) {
        console.warn(`[OnMatchCreate] No players associated with match ${matchId}`);
        return;
    }
    const participantIds = playerUids.filter((pid) => pid !== ownerUid);
    if (participantIds.length === 0) {
        console.info(`[OnMatchCreate] No participants to notify for match ${matchId}`);
        return;
    }
    console.info(`[OnMatchCreate] Processing notifications for match ${matchId} to ${participantIds.length} players`);
    try {
        // 1. In-app notifications
        const batch = db.batch();
        const now = new Date().toISOString();
        participantIds.forEach((pid) => {
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
    }
    catch (error) {
        console.error(`[OnMatchCreate] Error sending in-app notifications for match ${matchId}:`, error);
    }
    try {
        // 2. Push notifications (FCM)
        const tokens = [];
        const tokenToUserId = new Map();
        // Firestore 'in' query supports max 30 items
        const chunkSize = 30;
        for (let i = 0; i < participantIds.length; i += chunkSize) {
            const chunk = participantIds.slice(i, i + chunkSize);
            const usersSnap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
            usersSnap.forEach(doc => {
                const userData = doc.data();
                if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                    userData.fcmTokens.forEach(token => {
                        tokens.push(token);
                        tokenToUserId.set(token, doc.id);
                    });
                }
            });
        }
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
            const tokensToRemoveByUserId = new Map();
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                    const errorCode = resp.error.code;
                    if (errorCode === 'messaging/invalid-registration-token' ||
                        errorCode === 'messaging/registration-token-not-registered') {
                        const badToken = tokens[idx];
                        const uId = tokenToUserId.get(badToken);
                        if (uId) {
                            if (!tokensToRemoveByUserId.has(uId)) {
                                tokensToRemoveByUserId.set(uId, []);
                            }
                            tokensToRemoveByUserId.get(uId).push(badToken);
                        }
                    }
                }
            });
            if (tokensToRemoveByUserId.size > 0) {
                const cleanupBatch = db.batch();
                tokensToRemoveByUserId.forEach((badTokens, uid) => {
                    cleanupBatch.update(db.collection('users').doc(uid), {
                        fcmTokens: admin.firestore.FieldValue.arrayRemove(...badTokens)
                    });
                });
                await cleanupBatch.commit();
                console.info(`[OnMatchCreate] Cleaned up ${response.failureCount} stale FCM tokens.`);
            }
        }
        else {
            console.info(`[OnMatchCreate] No FCM tokens found for participants of match ${matchId}`);
        }
    }
    catch (error) {
        console.error(`[OnMatchCreate] Error sending push notifications for match ${matchId}:`, error);
    }
});
//# sourceMappingURL=on-match-create.js.map