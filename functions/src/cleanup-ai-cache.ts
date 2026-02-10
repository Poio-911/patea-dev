import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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
export const cleanupAiCache = functions.https.onRequest(async (req, res) => {
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
    } catch (error: any) {
        console.error('❌ Error en limpieza de caché:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
