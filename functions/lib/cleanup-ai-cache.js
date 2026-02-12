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
exports.cleanupAiCache = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * HTTP Function para limpiar entradas antiguas del caché de IA
 * Puede ser llamada manualmente o configurada en Cloud Scheduler
 *
 * Para configurar en Cloud Scheduler:
 * 1. Ir a https://console.cloud.google.com/cloudscheduler
 * 2. Crear job con schedule: "0 0 * * 0" (domingos 00:00)
 * 3. Target: HTTP
 * 4. URL: https://us-central1-mil-disculpis.cloudfunctions.net/cleanupAiCache
 * 5. Auth: Add OIDC token
 */
exports.cleanupAiCache = functions.https.onRequest(async (req, res) => {
    const db = admin.firestore();
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    try {
        // Obtener entradas antiguas
        const oldEntriesSnapshot = await db
            .collection('ai_cache')
            .where('timestamp', '<', thirtyDaysAgo)
            .get();
        if (oldEntriesSnapshot.empty) {
            console.log('No hay entradas antiguas para eliminar');
            res.status(200).json({
                success: true,
                message: 'No hay entradas antiguas para eliminar',
                deletedCount: 0
            });
            return;
        }
        // Eliminar en lotes de 500 (límite de Firestore)
        const batchSize = 500;
        let deletedCount = 0;
        for (let i = 0; i < oldEntriesSnapshot.docs.length; i += batchSize) {
            const batch = db.batch();
            const docsToDelete = oldEntriesSnapshot.docs.slice(i, i + batchSize);
            docsToDelete.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += docsToDelete.length;
        }
        console.log(`✅ Limpieza completada: ${deletedCount} entradas eliminadas`);
        // Estadísticas de caché restante
        const remainingSnapshot = await db.collection('ai_cache').get();
        console.log(`📊 Entradas restantes en caché: ${remainingSnapshot.size}`);
        res.status(200).json({
            success: true,
            deletedCount,
            remainingCount: remainingSnapshot.size,
            message: `Limpieza completada: ${deletedCount} entradas eliminadas`
        });
    }
    catch (error) {
        console.error('❌ Error en limpieza de caché:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
//# sourceMappingURL=cleanup-ai-cache.js.map