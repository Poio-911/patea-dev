import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

// Cargar variables de entorno
config({ path: join(process.cwd(), '.env.local') });

// Inicializar Firebase Admin
function initializeFirebaseAdmin() {
    if (getApps().length === 0) {
        const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!rawServiceAccount) {
            console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no encontrada');
            process.exit(1);
        }
        const serviceAccountJson = JSON.parse(rawServiceAccount);
        initializeApp({
            credential: cert(serviceAccountJson as ServiceAccount),
            projectId: serviceAccountJson.project_id,
        });
    }
}

initializeFirebaseAdmin();
const db = getFirestore();
const BATCH_SIZE = 400;

async function resetPlayers() {
    console.log('🚀 Iniciando script de limpieza de jugadores y reset de OVR...');

    // 1. Obtener todos los IDs de usuarios reales
    const usersSnap = await db.collection('users').get();
    const realUserIds = new Set(usersSnap.docs.map(doc => doc.id));
    console.log(`✅ Se encontraron ${realUserIds.size} usuarios reales.`);

    // 2. Obtener todos los jugadores
    const playersSnap = await db.collection('players').get();
    console.log(`📋 Se encontraron ${playersSnap.size} documentos en la colección 'players'.`);

    let deletedCount = 0;
    let resetCount = 0;
    const batch = db.batch();
    let operationCounter = 0;

    for (const playerDoc of playersSnap.docs) {
        const playerId = playerDoc.id;

        if (realUserIds.has(playerId)) {
            // ES USUARIO REAL: Resetear OVR a 50
            resetCount++;
            batch.update(playerDoc.ref, {
                ovr: 50,
                pac: 50,
                sho: 50,
                pas: 50,
                dri: 50,
                def: 50,
                phy: 50,
                'stats.matchesPlayed': 0,
                'stats.goals': 0,
                'stats.assists': 0,
                'stats.averageRating': 0
            });
            console.log(`   🔄 Update (Real): ${playerDoc.data().name || playerId} -> OVR 50`);
        } else {
            // NO ES USUARIO REAL (Es bot/guest): Borrar
            deletedCount++;
            batch.delete(playerDoc.ref);
            console.log(`   ❌ Delete (Bot): ${playerDoc.data().name || 'Sin nombre'} (${playerId})`);
        }

        operationCounter++;

        // Commit batch si llegamos al límite
        if (operationCounter >= BATCH_SIZE) {
            await batch.commit();
            console.log(`   💾 Commiteando batch de ${operationCounter} operaciones...`);
            // Reiniciar batch y contador (en firestore admin hay que crear nuevo batch)
            // Nota: db.batch() crea uno nuevo, pero en un loop asi hay que tener cuidado.
            // Para simplicidad en script simple, haré commit y crearé uno nuevo.
            // (El objeto batch no se reutiliza tras commit)
        }
    }

    // Commit final de lo que quede
    if (operationCounter > 0) { // Bug en lógica arriba: operationCounter no se resetea si no lo hago.
        // Mejor enfoque para batches grandes: usar un array de promesas o manejar grupos manualmente.
        // Re-implementación simple abajo para evitar error "batch commited twice"
    }
}

// Re-implementación interna más segura para batches
async function runSafeBatch() {
    // 1. Obtener todos los IDs de usuarios reales
    const usersSnap = await db.collection('users').get();
    const realUserIds = new Set(usersSnap.docs.map(doc => doc.id));
    console.log(`✅ Se encontraron ${realUserIds.size} usuarios reales.`);

    // 2. Procesar players
    const playersSnap = await db.collection('players').get();
    const docs = playersSnap.docs;

    let deletedCount = 0;
    let resetCount = 0;

    // Chunk array
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const doc of chunk) {
            const playerId = doc.id;
            if (realUserIds.has(playerId)) {
                // RESET
                resetCount++;
                batch.update(doc.ref, {
                    ovr: 50,
                    pac: 50,
                    sho: 50,
                    pas: 50,
                    dri: 50,
                    def: 50,
                    phy: 50,
                    'stats.matchesPlayed': 0,
                    'stats.goals': 0,
                    'stats.assists': 0,
                    'stats.averageRating': 0,
                    // Limpiar historial si existe
                    // ovrHistory se borra en clean-database.ts, pero por si acaso.
                });
            } else {
                // DELETE
                deletedCount++;
                batch.delete(doc.ref);
            }
        }
        await batch.commit();
        console.log(`   💾 Procesados ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
    }

    console.log('=====================================');
    console.log(`🎉 FIN. Resumen:`);
    console.log(`   - Jugadores REALES reseteados: ${resetCount}`);
    console.log(`   - Bots/Guests ELIMINADOS:      ${deletedCount}`);
    console.log('=====================================');
}

runSafeBatch()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
