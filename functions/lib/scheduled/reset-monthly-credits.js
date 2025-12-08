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
exports.resetMonthlyCredits = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
/**
 * Cloud Function programada para resetear créditos mensuales
 *
 * Se ejecuta el primer día de cada mes a las 00:00 (timezone Argentina)
 * Resetea cardGenerationCredits a 3 para todos los jugadores que:
 * - No han recibido reset este mes (lastCreditReset < inicio del mes actual)
 * - O nunca han tenido reset (lastCreditReset no existe)
 *
 * Deployment:
 * cd functions
 * npm install
 * npm run build
 * firebase deploy --only functions:resetMonthlyCredits
 */
exports.resetMonthlyCredits = (0, scheduler_1.onSchedule)({
    schedule: '0 0 1 * *', // Cron: At 00:00 on day 1 of every month
    timeZone: 'America/Argentina/Buenos_Aires',
    region: 'us-central1',
}, async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    console.log(`[Reset Credits] Starting monthly credit reset for ${currentMonth.toISOString()}`);
    try {
        // Query players who need credit reset
        // Players who haven't reset this month OR never reset
        const playersRef = db.collection('players');
        // Get all players (we'll filter in code since Firestore can't do OR queries easily)
        const allPlayersSnapshot = await playersRef.get();
        const playersToReset = [];
        allPlayersSnapshot.forEach((doc) => {
            const data = doc.data();
            const lastReset = data.lastCreditReset;
            // Reset if never reset OR last reset was before current month
            if (!lastReset) {
                playersToReset.push(doc.ref);
            }
            else {
                const lastResetDate = new Date(lastReset);
                if (lastResetDate < currentMonth) {
                    playersToReset.push(doc.ref);
                }
            }
        });
        console.log(`[Reset Credits] Found ${playersToReset.length} players to reset out of ${allPlayersSnapshot.size} total`);
        if (playersToReset.length === 0) {
            console.log('[Reset Credits] No players need credit reset');
            return;
        }
        // Batch updates (max 500 per batch)
        const batches = [];
        let currentBatch = db.batch();
        let operationCount = 0;
        for (const playerRef of playersToReset) {
            currentBatch.update(playerRef, {
                cardGenerationCredits: 3, // FREE monthly credits
                lastCreditReset: admin.firestore.FieldValue.serverTimestamp(),
            });
            operationCount++;
            // Firestore batches are limited to 500 operations
            if (operationCount === 500) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                operationCount = 0;
            }
        }
        // Don't forget the last batch if it has operations
        if (operationCount > 0) {
            batches.push(currentBatch);
        }
        // Commit all batches
        console.log(`[Reset Credits] Committing ${batches.length} batches`);
        await Promise.all(batches.map(batch => batch.commit()));
        console.log(`[Reset Credits] ✅ Successfully reset credits for ${playersToReset.length} players`);
        // Log to a collection for monitoring
        await db.collection('systemLogs').add({
            type: 'credit_reset',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            playersReset: playersToReset.length,
            totalPlayers: allPlayersSnapshot.size,
            month: currentMonth.toISOString(),
        });
    }
    catch (error) {
        console.error('[Reset Credits] ❌ Error resetting credits:', error);
        // Log error for monitoring
        await db.collection('systemLogs').add({
            type: 'credit_reset_error',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            error: error instanceof Error ? error.message : String(error),
            month: currentMonth.toISOString(),
        });
        throw error; // Re-throw so Firebase Functions can retry
    }
});
//# sourceMappingURL=reset-monthly-credits.js.map