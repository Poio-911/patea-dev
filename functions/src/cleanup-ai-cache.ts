import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

/**
 * Limpieza semanal del caché de IA: borra las entradas de más de 30 días.
 *
 * Antes era un `functions.https.onRequest` sin verificación de identidad. El
 * comentario del archivo asumía un token OIDC de Cloud Scheduler configurado a
 * mano en la consola, pero la función nunca lo validaba: cualquiera que
 * conociera la URL podía invocarla, y cada invocación leía la colección entera
 * dos veces. Servía tanto para borrar como para inflar la factura.
 *
 * Como `onSchedule`, Cloud Scheduler queda declarado en el código, deja de
 * haber superficie HTTP pública, y el conteo final usa `count()` — una lectura
 * facturada en vez de N.
 */
export const cleanupAiCache = onSchedule(
    {
        schedule: 'every sunday 00:00',
        timeZone: 'America/Argentina/Buenos_Aires',
        region: 'us-central1',
    },
    async () => {
        const db = admin.firestore();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const oldEntriesSnapshot = await db
            .collection('ai_cache')
            .where('timestamp', '<', thirtyDaysAgo)
            .get();

        if (oldEntriesSnapshot.empty) {
            console.log('[CleanupAiCache] No hay entradas antiguas para eliminar.');
            return;
        }

        const batchSize = 500;
        let deletedCount = 0;

        for (let i = 0; i < oldEntriesSnapshot.docs.length; i += batchSize) {
            const batch = db.batch();
            oldEntriesSnapshot.docs
                .slice(i, i + batchSize)
                .forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            deletedCount += Math.min(batchSize, oldEntriesSnapshot.docs.length - i);
        }

        // `count()` factura una lectura, no una por documento.
        const remaining = await db.collection('ai_cache').count().get();

        console.log(
            `[CleanupAiCache] ${deletedCount} entradas eliminadas. Quedan ${remaining.data().count}.`
        );
    }
);
